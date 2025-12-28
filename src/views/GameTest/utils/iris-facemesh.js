// iris-facemesh.js
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

class IrisFaceMeshTracker {
    constructor() {
        this.faceLandmarker = null;
        this.isTracking = false;
        this.trackingData = [];
        this.videoElement = null;
        this.startTime = null;
        this.animationId = null;
        this.previousFrame = null;
        this.calibrationModel = null;
        // Iris landmark indices in MediaPipe Face Landmarker
        // Indices 468-477 are iris landmarks (468-472: left, 473-477: right)
        this.LEFT_IRIS_CENTER = 468;
        this.RIGHT_IRIS_CENTER = 473;
    }

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
        // Check if coefficients exist and are valid arrays
        if (!coefX || !coefY || coefX.length < 6 || coefY.length < 6) return null;

        const x = iris.x;
        const y = iris.y;

        // Quadratic polynomial: a0 + a1*x + a2*y + a3*x*x + a4*y*y + a5*x*y
        const screenX = coefX[0] + coefX[1]*x + coefX[2]*y + coefX[3]*x*x + coefX[4]*y*y + coefX[5]*x*y;
        const screenY = coefY[0] + coefY[1]*x + coefY[2]*y + coefY[3]*x*x + coefY[4]*y*y + coefY[5]*x*y;

        return { x: screenX, y: screenY };
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'user'
                }
            });
            this.videoElement.srcObject = stream;

            return new Promise((resolve) => {
                this.videoElement.onloadeddata = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('Camera access error:', error);
            throw error;
        }
    }

    processFrame() {
        if (!this.isTracking || !this.videoElement) return;

        const currentTime = performance.now();

        // Detect face landmarks
        const results = this.faceLandmarker.detectForVideo(
            this.videoElement,
            currentTime
        );

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const timestamp = Date.now() - this.startTime;

            // Extract iris center coordinates (normalized 0-1 range)
            const leftIris = landmarks[this.LEFT_IRIS_CENTER];
            const rightIris = landmarks[this.RIGHT_IRIS_CENTER];

            // Apply calibration if available
            let calibratedLeft = null;
            let calibratedRight = null;
            let calibratedAvg = null;

            if (this.calibrationModel) {
                calibratedLeft = this.predictGaze(leftIris, 'left');
                calibratedRight = this.predictGaze(rightIris, 'right');

                if (calibratedLeft && calibratedRight) {
                    calibratedAvg = {
                        x: (calibratedLeft.x + calibratedRight.x) / 2,
                        y: (calibratedLeft.y + calibratedRight.y) / 2
                    };
                } else if (calibratedLeft) {
                    calibratedAvg = { ...calibratedLeft };
                } else if (calibratedRight) {
                    calibratedAvg = { ...calibratedRight };
                }
            }

            const dataPoint = {
                timestamp: timestamp,
                // Raw Data
                leftIris: { x: leftIris.x, y: leftIris.y, z: leftIris.z },
                rightIris: { x: rightIris.x, y: rightIris.y, z: rightIris.z },
                avgIris: {
                    x: (leftIris.x + rightIris.x) / 2,
                    y: (leftIris.y + rightIris.y) / 2,
                    z: (leftIris.z + rightIris.z) / 2
                },
                // Calibrated Data (Screen Coordinates 0.0-1.0)
                calibrated: {
                    left: calibratedLeft,
                    right: calibratedRight,
                    avg: calibratedAvg
                }
            };

            this.trackingData.push(dataPoint);

            // Simple saccade detection (optional, can be updated to use calibrated data)
            this.detectSaccade(dataPoint);
        }

        // Continue tracking loop
        if (this.isTracking) {
            this.animationId = requestAnimationFrame(() => this.processFrame());
        }
    }

    detectSaccade(currentPoint) {
        if (this.trackingData.length < 2) return;

        const prevPoint = this.trackingData[this.trackingData.length - 2];
        const timeDiff = (currentPoint.timestamp - prevPoint.timestamp) / 1000; // seconds

        if (timeDiff === 0) return;

        let velocity = 0;

        // Use calibrated data if available for better accuracy
        if (currentPoint.calibrated && currentPoint.calibrated.avg && prevPoint.calibrated && prevPoint.calibrated.avg) {
             const dx = (currentPoint.calibrated.avg.x - prevPoint.calibrated.avg.x) * window.screen.width;
             const dy = (currentPoint.calibrated.avg.y - prevPoint.calibrated.avg.y) * window.screen.height;
             const distance = Math.sqrt(dx * dx + dy * dy);
             velocity = distance / timeDiff; // pixels per second
        } else {
            // Fallback to raw iris movement approximation
            const dx = (currentPoint.avgIris.x - prevPoint.avgIris.x) * window.screen.width;
            const dy = (currentPoint.avgIris.y - prevPoint.avgIris.y) * window.screen.height;
            const distance = Math.sqrt(dx * dx + dy * dy);
            velocity = distance / timeDiff;
        }

        // Saccade threshold (pixels per second) - adjust as needed
        const SACCADE_THRESHOLD = 150; 

        if (velocity > SACCADE_THRESHOLD) {
            currentPoint.isSaccade = true;
            currentPoint.velocity = velocity;
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
        if (this.trackingData.length > 0) {
            const lastPoint = this.trackingData[this.trackingData.length - 1];
            lastPoint.trial = trialNumber;
            lastPoint.dotPosition = dotPosition;
        }
    }

    // Export data as CSV
    exportCSV() {
        if (this.trackingData.length === 0) {
            console.warn('No tracking data to export');
            return;
        }

        // CSV header
        let csv = 'timestamp,leftIris_x,leftIris_y,rightIris_x,rightIris_y,avgIris_x,avgIris_y,cal_left_x,cal_left_y,cal_right_x,cal_right_y,cal_avg_x,cal_avg_y,isSaccade,trial,dotPosition\n';

        // CSV rows
        this.trackingData.forEach(point => {
            csv += `${point.timestamp},`;
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
            csv += `${point.trial || ''},${point.dotPosition || ''}\n`;
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
