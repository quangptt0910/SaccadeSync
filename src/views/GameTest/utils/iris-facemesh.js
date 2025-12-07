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

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
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

            const dataPoint = {
                timestamp: timestamp,
                leftIris: {
                    x: leftIris.x,
                    y: leftIris.y,
                    z: leftIris.z
                },
                rightIris: {
                    x: rightIris.x,
                    y: rightIris.y,
                    z: rightIris.z
                },
                // Calculate average iris position (monocular approximation)
                avgIris: {
                    x: (leftIris.x + rightIris.x) / 2,
                    y: (leftIris.y + rightIris.y) / 2,
                    z: (leftIris.z + rightIris.z) / 2
                }
            };

            this.trackingData.push(dataPoint);

            // Simple saccade detection
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

        // Calculate velocity (approximation using screen dimensions)
        const dx = (currentPoint.avgIris.x - prevPoint.avgIris.x) * window.screen.width;
        const dy = (currentPoint.avgIris.y - prevPoint.avgIris.y) * window.screen.height;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / timeDiff;

        // Saccade threshold (pixels per second)
        const SACCADE_THRESHOLD = 1500;

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
        let csv = 'timestamp,leftIris_x,leftIris_y,rightIris_x,rightIris_y,avgIris_x,avgIris_y,isSaccade,velocity,trial,dotPosition\n';

        // CSV rows
        this.trackingData.forEach(point => {
            csv += `${point.timestamp},`;
            csv += `${point.leftIris.x},${point.leftIris.y},`;
            csv += `${point.rightIris.x},${point.rightIris.y},`;
            csv += `${point.avgIris.x},${point.avgIris.y},`;
            csv += `${point.isSaccade || false},${point.velocity || 0},`;
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
