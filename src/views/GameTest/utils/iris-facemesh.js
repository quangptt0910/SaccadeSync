// GameTest\iris-facemesh.js
import {FaceLandmarker, FilesetResolver} from '@mediapipe/tasks-vision';
import {detectSaccade} from './detectSaccade';

const EYE_INDICES = {
    // Subject's Left Eye (MediaPipe indices)
    left: { inner: 33, outer: 133, iris: 468 },
    // Subject's Right Eye (MediaPipe indices)
    right: { inner: 362, outer: 263, iris: 473 }
};

class IrisFaceMeshTracker {
    constructor() {
        this.faceLandmarker = null;
        this.isTracking = false;
        this.trackingData = [];
        this.videoElement = null;
        this.lastVideoTime = -1;

        this.startTime = null;
        this.animationId = null;
        this.previousFrame = null;
        this.calibrationModel = null;
        // Iris landmark indices in MediaPipe Face Landmarker

        // Use same iris indices as calibration
        this.RIGHT_IRIS_CENTER = 473;
        this.LEFT_IRIS_CENTER = 468;


        // Store current trial context to apply to every new frame
        this.currentContext = {
            trial: null,
            dotPosition: null,
            targetX: null,
            targetY: null
        };
    }


    /**
     * Calculates iris position relative to eye corners (Local Coordinates).
     * Returns {x, y} where x=0 is Inner Corner, x=1 is Outer Corner.
     */
    getRelativeIrisPos(landmarks, eyeSide) {
        const indices = EYE_INDICES[eyeSide];
        const pInner = landmarks[indices.inner];
        const pOuter = landmarks[indices.outer];
        const pIris = landmarks[indices.iris];

        if (!pInner || !pOuter || !pIris) return null;

        // 1. Calculate Vector Basis (Eye Width line)
        const vecEye = { x: pOuter.x - pInner.x, y: pOuter.y - pInner.y };
        const vecIris = { x: pIris.x - pInner.x, y: pIris.y - pInner.y };

        // 2. Eye Width (Magnitude squared for projection)
        const eyeWidthSq = vecEye.x * vecEye.x + vecEye.y * vecEye.y;
        const eyeWidth = Math.sqrt(eyeWidthSq);

        // 3. Project Iris onto horizontal Eye Axis (Scalar Projection)
        // Formula: (Iris • Eye) / |Eye|^2
        // This gives a normalized X value: 0.0 (Inner) -> 1.0 (Outer)
        let normX = (vecIris.x * vecEye.x + vecIris.y * vecEye.y) / eyeWidthSq;

        // 4. Calculate Vertical Offset (Cross Product)
        // Measures distance from the line connecting corners
        // Formula: (Iris x Eye) / |Eye|
        const crossProduct = vecIris.x * vecEye.y - vecIris.y * vecEye.x;

        // Scale Y: We multiply by 4.0 to amplify vertical movement / more sensitivity
        let normY = 0.5 + (crossProduct / eyeWidth) * 4.0;

        return { x: normX, y: normY };
    }

    // computeIrisCenter(landmarks, index) {
    //     const point = landmarks[index];
    //     if (!point) return null;
    //     return { x: point.x, y: point.y };
    // }

    async initialize() {
        // Create hidden video element for camera input
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        document.body.appendChild(this.videoElement);

        // Initialize FilesetResolver for WASM files
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Create FaceLandmarker with iris tracking enabled
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false
        });

        console.log('FaceLandmarker initialized');
    }

    setCalibrationModel(model) {
        this.calibrationModel = model;
        console.log("Calibration model set in tracker:", model);
    }

    // Helper to apply quadratic model
    predictGaze(iris, eye) {
        if (!this.calibrationModel || !this.calibrationModel[eye]) return null;

        const { coefX, coefY } = this.calibrationModel[eye];
        if (!coefX || !coefY || coefX.length < 6 || coefY.length < 6) return null;

        const x = iris.x;
        const y = iris.y;

        const rawX = coefX[0] + coefX[1]*x + coefX[2]*y + coefX[3]*x*x + coefX[4]*y*y + coefX[5]*x*y;
        const rawY = coefY[0] + coefY[1]*x + coefY[2]*y + coefY[3]*x*x + coefY[4]*y*y + coefY[5]*x*y;

        // If metadata exists, trust it
        if (this.calibrationModel.metadata?.coordinateSystem === 'normalized') {
            return { x: rawX, y: rawY };
        }

        // Fallback: Infer from coefficient magnitude
        const interceptMagnitude = Math.abs(coefX[0]);

        if (Math.abs(rawX) > 2.0 || Math.abs(rawY) > 2.0) {
            return { x: rawX / window.innerWidth, y: rawY / window.innerHeight };
        }

        return { x: rawX, y: rawY };
    }

    async startCamera() {
        try {
            this.videoElement.srcObject = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: {ideal: 1280},
                    height: {ideal: 720},
                    frameRate: { ideal: 60, min: 30 },
                    facingMode: 'user'
                }
            });

            return new Promise((resolve) => {
                this.videoElement.onloadeddata = () => {
                    console.log('Camera ready:', {
                        videoWidth: this.videoElement.videoWidth,
                        videoHeight: this.videoElement.videoHeight,
                        readyState: this.videoElement.readyState
                    });
                    resolve();
                };
            });
        } catch (error) {
            console.error('Camera access error:', error);
            throw error;
        }
    }

    getRelativeTime() {
        if (!this.startTime) return 0;
        return Date.now() - this.startTime;
    }

    processFrame() {
        if (!this.isTracking || !this.videoElement || !this.faceLandmarker) return;

        const currentTime = performance.now();

        const results = this.faceLandmarker.detectForVideo(
            this.videoElement,
            currentTime
        );

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            // const timestamp = Date.now() - this.startTime;
            const timestamp = Date.now() - this.startTime;

            // Extract raw iris centers
            const rightRaw = this.getRelativeIrisPos(landmarks, 'right');
            const leftRaw = this.getRelativeIrisPos(landmarks, 'left');

            const rightIris = rightRaw ? { x: 1 - rightRaw.x, y: rightRaw.y } : null;
            const leftIris = leftRaw ? { x: 1 - leftRaw.x, y: leftRaw.y } : null;

            // 🔍 DIAGNOSTIC - Log first 3 frames
            if (this.trackingData.length < 3) {
                console.log(`🎮Frame ${this.trackingData.length + 1}:`, {
                    timestamp,
                    leftIris,
                    rightIris,
                    totalLandmarks: landmarks.length
                });
            }

            // Apply calibration if available
            let calibratedLeft = null;
            let calibratedRight = null;
            let calibratedAvg = null;

            if (this.calibrationModel) {
                calibratedLeft = this.predictGaze(leftIris, 'left');
                calibratedRight = this.predictGaze(rightIris, 'right');

                // Average the two eyes
                if (calibratedLeft && calibratedRight) {
                    calibratedAvg = {
                        x: (calibratedLeft.x + calibratedRight.x) / 2,
                        y: (calibratedLeft.y + calibratedRight.y) / 2
                    };
                }


                // 🔍 DIAGNOSTIC - Log first 3 calibrated predictions
                if (this.trackingData.length < 3) {
                    console.log(`🎯 Calibrated ${this.trackingData.length + 1}:`, {
                        raw: {left: leftIris, right: rightIris},
                        calibrated: {left: calibratedLeft, right: calibratedRight, avg: calibratedAvg},
                    });
                }


            } else {
                // Fallback if no calibration (Use raw normalized inputs)
                if (leftIris) calibratedLeft = leftIris;
                if (rightIris) calibratedRight = rightIris;
                if (leftIris && rightIris) {
                    calibratedAvg = {
                        x: (leftIris.x + rightIris.x) / 2,
                        y: (leftIris.y + rightIris.y) / 2
                    };
                }
            }


            const dataPoint = {
                timestamp: timestamp,

                trial: this.currentContext.trial,
                dotPosition: this.currentContext.dotPosition,
                targetX: this.currentContext.targetX,
                targetY: this.currentContext.targetY,

                leftIris: leftIris,
                rightIris: rightIris,
                avgIris: {
                    x: (leftIris.x + rightIris.x) / 2,
                    y: (leftIris.y + rightIris.y) / 2,
                },
                // Calibrated Data (Screen Coordinates 0.0-1.0)
                calibrated: {
                    left: calibratedLeft,
                    right: calibratedRight,
                    avg: calibratedAvg
                },
                x: calibratedAvg ? calibratedAvg.x : null,
                y: calibratedAvg ? calibratedAvg.y : null
            };

            if (!calibratedAvg && this.calibrationModel) {
                console.warn(`Frame ${this.trackingData.length}: No calibrated data (left: ${!!calibratedLeft}, right: ${!!calibratedRight})`);
            }

            this.trackingData.push(dataPoint);

            // Real-time saccade detection
            this.performSaccadeDetection(dataPoint);
        }

        // Continue tracking loop
        if (this.isTracking) {
            this.animationId = requestAnimationFrame(() => this.processFrame());
        }

    }

    performSaccadeDetection(currentPoint) {
        if (this.trackingData.length < 2) return;

        const prevPoint = this.trackingData[this.trackingData.length - 2];
        const result = detectSaccade(currentPoint, prevPoint);

        if (this.trackingData.length <= 10) {
            console.log(`Saccade detection frame ${this.trackingData.length}:`, {
                isValid: result.isValid,
                velocity: result.velocity,
                isSaccade: result.isSaccade,
                reason: result.reason
            });
        }

        // Always store velocity and saccade status
        currentPoint.isSaccade = result.isSaccade;
        currentPoint.velocity = result.velocity;
        
        // Optional: Store debug info
        if (!result.isValid) {
             currentPoint.debug = result.reason;
        }
    }

    async startTracking() {
        if (!this.faceLandmarker) {
            await this.initialize();
        }

        await this.startCamera();

        this.isTracking = true;
        this.trackingData = [];
        this.startTime = Date.now();

        // Start processing loop
        this.processFrame();

        console.log('Iris tracking started');
    }

    stopTracking() {
        this.isTracking = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Stop camera stream
        if (this.videoElement && this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }

        console.log('Iris tracking stopped. Total data points:', this.trackingData.length);
    }

    // Add trial context to current tracking data
    addTrialContext(trialNumber, dotPosition) {
        // Calculate target coordinates based on dotPosition
        let targetX = null;
        let targetY = null;
        
        // Check for anti-saccade phase
        const isAnti = typeof dotPosition === 'string' && dotPosition.toLowerCase().includes('anti');

        if (dotPosition === 'center' || (typeof dotPosition === 'string' && dotPosition.includes('center'))) {
            targetX = 0.5;
            targetY = 0.5;
        } else if (dotPosition === 'left' || (typeof dotPosition === 'string' && dotPosition.includes('left'))) {
            // For anti-saccade, target is opposite to the stimulus
            targetX = isAnti ? 0.8 : 0.2;
            targetY = 0.5;
        } else if (dotPosition === 'right' || (typeof dotPosition === 'string' && dotPosition.includes('right'))) {
            // For anti-saccade, target is opposite to the stimulus
            targetX = isAnti ? 0.2 : 0.8;
            targetY = 0.5;
        }

        // Update current context state so future frames get this info
        this.currentContext = {
            trial: trialNumber,
            dotPosition: dotPosition,
            targetX: targetX,
            targetY: targetY
        };

        // Also update the last point if exists (for immediate effect on the current frame if timing is tight)
        if (this.trackingData.length > 0) {
            const lastPoint = this.trackingData[this.trackingData.length - 1];
            lastPoint.trial = trialNumber;
            lastPoint.dotPosition = dotPosition;
            lastPoint.targetX = targetX;
            lastPoint.targetY = targetY;
        }
    }

    // Export data as CSV
    exportCSV() {
        if (this.trackingData.length === 0) {
            console.warn('No tracking data to export');
            return;
        }

        // CSV header
        let csv = 'timestamp,leftIris_x,leftIris_y,rightIris_x,rightIris_y,avgIris_x,avgIris_y,cal_left_x,cal_left_y,cal_right_x,cal_right_y,cal_avg_x,cal_avg_y,isSaccade,velocity,trial,dotPosition,targetX,targetY\n';


        // CSV rows
        this.trackingData.forEach(point => {

            csv += `${point.startTime || point.timestamp},`;
            csv += `${point.leftIris.x},${point.leftIris.y},`;
            csv += `${point.rightIris.x},${point.rightIris.y},`;
            csv += `${point.avgIris.x},${point.avgIris.y},`;
            
            // Add calibrated data to CSV
            const c = point.calibrated || {};
            // Use nullish coalescing operator (??) to allow 0 values but handle null/undefined
            csv += `${c.left?.x ?? ''},${c.left?.y ?? ''},`;
            csv += `${c.right?.x ?? ''},${c.right?.y ?? ''},`;
            csv += `${c.avg?.x ?? ''},${c.avg?.y ?? ''},`;

            csv += `${point.isSaccade || false},`;
            csv += `${point.velocity || 0},`; // Added velocity column
            csv += `${point.trial || ''},${point.dotPosition || ''},`;
            csv += `${point.targetX ?? ''},${point.targetY ?? ''}\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iris-tracking-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('CSV exported successfully');
    }

    getTrackingData() {
        return this.trackingData;
    }

    cleanup() {
        this.stopTracking();

        if (this.faceLandmarker) {
            this.faceLandmarker.close();
        }

        if (this.videoElement && this.videoElement.parentNode) {
            this.videoElement.parentNode.removeChild(this.videoElement);
        }
    }
}

export default IrisFaceMeshTracker;
