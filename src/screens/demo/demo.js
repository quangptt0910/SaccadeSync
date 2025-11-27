import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

// ============================================================================
// 1. CONSTANTS & INDICES
// ============================================================================

// --- LEFT EYE (Subject's Left) ---
const LEFT_IRIS_CENTER = 468;
const LEFT_IRIS_CONTOUR = [469, 470, 471, 472];
// Using MediaPipe's standard Left Eye indices for the eyelid
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;

// --- RIGHT EYE (Subject's Right) ---
const RIGHT_IRIS_CENTER = 473;
const RIGHT_IRIS_CONTOUR = [474, 475, 476, 477];
// Using MediaPipe's standard Right Eye indices for the eyelid
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;

// Boundaries for Gaze Calculations
const LEFT_EYE_TOP = [159, 158, 157, 173, 133];
const LEFT_EYE_BOTTOM = [145, 153, 154, 155, 33];
const RIGHT_EYE_TOP = [386, 385, 384, 398, 362];
const RIGHT_EYE_BOTTOM = [374, 380, 381, 382, 263];

// ============================================================================
// 2. DOM ELEMENTS
// ============================================================================

const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exportBtn = document.getElementById('exportBtn');
const statusText = document.getElementById('statusText');

// Data Display Elements
const leftXEl = document.getElementById('leftX');
const leftYEl = document.getElementById('leftY');
const rightXEl = document.getElementById('rightX');
const rightYEl = document.getElementById('rightY');
const leftREl = document.getElementById('leftR');
const rightREl = document.getElementById('rightR');
const framesEl = document.getElementById('frames');
const fpsEl = document.getElementById('fps');
const recordedEl = document.getElementById('recorded');

// Gaze Elements
const gazePointEl = document.getElementById('gazePoint');
const gazeDirectionEl = document.getElementById('gazeDirection');
const gazeHEl = document.getElementById('gazeH');
const gazeVEl = document.getElementById('gazeV');

// Movement Elements
const movementTypeEl = document.getElementById('movementType');
const movementMagnitudeEl = document.getElementById('movementMagnitude');
const velocityEl = document.getElementById('velocity');

// ============================================================================
// 3. STATE VARIABLES
// ============================================================================

let faceLandmarker = null;
let isRunning = false;
let frameCount = 0;
let lastFrameTime = performance.now();
let lastVideoTime = -1;
const recordedData = [];
let webcamRunning = false;
let drawingUtils = null;

// Tracking history
let prevLeftIris = null;
let prevRightIris = null;
let movementHistory = [];
const maxHistoryLength = 10;

// ============================================================================
// 4. INITIALIZATION
// ============================================================================

async function initialize() {
    try {
        console.log('🚀 Initializing MediaPipe Face Landmarker...');
        statusText.textContent = 'Loading MediaPipe...';

        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputFaceBlendshapes: false
        });

        drawingUtils = new DrawingUtils(canvasCtx);
        statusText.textContent = '✅ Ready to start tracking';
        console.log('✅ MediaPipe initialized successfully!');

    } catch (error) {
        console.error('❌ Error initializing MediaPipe:', error);
        statusText.textContent = '❌ Failed to load MediaPipe';
        alert('Failed to load MediaPipe. Please refresh the page.');
    }
}

// ============================================================================
// 5. WEBCAM CONTROL
// ============================================================================

async function startTracking() {
    if (isRunning) return;

    try {
        isRunning = true;
        webcamRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        exportBtn.disabled = true;
        recordedData.length = 0;
        frameCount = 0;
        prevLeftIris = null;
        prevRightIris = null;
        movementHistory = [];
        statusText.textContent = '🎥 Starting camera...';

        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        };

        videoElement.srcObject = await navigator.mediaDevices.getUserMedia(constraints);

        videoElement.addEventListener('loadedmetadata', () => {
            videoElement.play();
            statusText.textContent = '🟢 Tracking active';
            predictWebcam();
        });

    } catch (error) {
        console.error('❌ Webcam error:', error);
        statusText.textContent = '❌ Camera access denied';
        alert('Failed to access webcam. Please check permissions.');
        isRunning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

function stopTracking() {
    if (!isRunning) return;

    isRunning = false;
    webcamRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    exportBtn.disabled = recordedData.length === 0;

    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
    }

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    statusText.textContent = `⏸️ Stopped - ${recordedData.length} frames recorded`;
}

// ============================================================================
// 6. DETECTION LOOP & VISUALIZATION (CRITICAL FIX HERE)
// ============================================================================

let cachedWidth = 0, cachedHeight = 0;

async function predictWebcam() {
    if (!isRunning || !webcamRunning) return;

    videoElement.requestVideoFrameCallback(() => {


        if (!faceLandmarker || !videoElement) {
            window.requestAnimationFrame(predictWebcam);
            return;
        }

        if (lastVideoTime === videoElement.currentTime) {
            window.requestAnimationFrame(predictWebcam);
            return;
        }

        lastVideoTime = videoElement.currentTime;

        try {
            const w = videoElement.videoWidth;
            const h = videoElement.videoHeight;

            if (w !== cachedWidth || h !== cachedHeight) {
                canvasElement.width = w;
                canvasElement.height = h;
                cachedWidth = w;
                cachedHeight = h;
            }

            const startTimeMs = performance.now();
            const results = faceLandmarker.detectForVideo(videoElement, startTimeMs);

            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            // Draw video frame first
            canvasCtx.save();
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            // Draw landmarks (will also be mirrored because canvas is flipped)
            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];
                drawStrictIrisVisualization(landmarks);

                const irisData = processIrisData(landmarks);
                updateUI(irisData);

                recordedData.push({ timestamp: startTimeMs, ...irisData });
                recordedEl.textContent = recordedData.length;
            } else {
                updateNoDetection();
            }

            canvasCtx.restore();

            updatePerformanceMetrics();

        } catch (error) {
            console.error('❌ Prediction error:', error);
        }

        window.requestAnimationFrame(predictWebcam);

        predictWebcam();
    });

}

// ============================================================================
// 7. DRAWING FUNCTIONS
// ===========================================================================

function drawStrictIrisVisualization(landmarks) {
    // --- LEFT IRIS SYSTEM (indices 468-472) -> GREEN ---
    drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,  // Swap left and right
        { color: "#00FF00", lineWidth: 2 }
    );

    drawManualLoop(landmarks, LEFT_IRIS_CONTOUR, '#00FF00', 3);

    const leftIris = landmarks[LEFT_IRIS_CENTER];
    if (leftIris) {
        drawPoint(leftIris, '#00FF00', 5);
        drawCircle(leftIris, 15, '#00FF00', 2);
    }

    // --- RIGHT IRIS SYSTEM (indices 473-477) -> RED ---
    // Use MediaPipe's "LEFT_EYE" constant (which actually contains RIGHT eye indices!)
    drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        { color: "#FF3030", lineWidth: 2 }
    );

    drawManualLoop(landmarks, RIGHT_IRIS_CONTOUR, '#FF3030', 3);

    const rightIris = landmarks[RIGHT_IRIS_CENTER];
    if (rightIris) {
        drawPoint(rightIris, '#FF3030', 5);
        drawCircle(rightIris, 15, '#FF3030', 2);
    }
}


function drawManualLoop(landmarks, indices, color, lineWidth) {
    if(!indices?.length) return;

    const w = cachedWidth, h = cachedHeight;

    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.beginPath();

    const start = landmarks[indices[0]];
    canvasCtx.moveTo(start.x * w, start.y * h);

    for(let i = 1; i < indices.length; i++) {
        const pt = landmarks[indices[i]];
        canvasCtx.lineTo(pt.x * w, pt.y * h);
    }

    canvasCtx.closePath();
    canvasCtx.stroke();
}

function drawPoint(landmark, color, size) {
    const x = landmark.x * canvasElement.width;
    const y = landmark.y * canvasElement.height;

    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();
}

function drawCircle(landmark, radius, color, lineWidth) {
    const x = landmark.x * cachedWidth;  // Use cached values
    const y = landmark.y * cachedHeight;

    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, radius, 0, 6.283185307179586); // 2*PI pre-calculated
    canvasCtx.stroke();
}

// ============================================================================
// 8. DATA PROCESSING (MATH)
// ============================================================================

function processIrisData(landmarks) {
    const leftIris = landmarks[LEFT_IRIS_CENTER];
    const rightIris = landmarks[RIGHT_IRIS_CENTER];

    const leftIrisContour = LEFT_IRIS_CONTOUR.map(idx => landmarks[idx]);
    const rightIrisContour = RIGHT_IRIS_CONTOUR.map(idx => landmarks[idx]);

    const leftRadius = calculateIrisRadius(leftIrisContour);
    const rightRadius = calculateIrisRadius(rightIrisContour);

    const leftIrisPixel = { x: leftIris.x * canvasElement.width, y: leftIris.y * canvasElement.height };
    const rightIrisPixel = { x: rightIris.x * canvasElement.width, y: rightIris.y * canvasElement.height };

    const gazeDirection = calculateGazeDirection(landmarks, leftIris, rightIris);
    const movement = detectEyeMovement(leftIris, rightIris);
    const velocity = calculateVelocity(leftIris, rightIris);

    prevLeftIris = leftIris;
    prevRightIris = rightIris;

    return {
        leftIris: leftIrisPixel,
        rightIris: rightIrisPixel,
        leftIrisNormalized: { x: leftIris.x, y: leftIris.y, z: leftIris.z },
        rightIrisNormalized: { x: rightIris.x, y: rightIris.y, z: rightIris.z },
        leftRadius,
        rightRadius,
        gazeDirection,
        movement,
        velocity
    };
}

function calculateIrisRadius(contourPoints) {
    if (contourPoints.length !== 4) return 0;
    const hDist = calculateDistance(contourPoints[0], contourPoints[2]);
    const vDist = calculateDistance(contourPoints[1], contourPoints[3]);
    return (hDist + vDist) / 4;
}

function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

function calculateGazeDirection(landmarks, leftIris, rightIris) {
    const leftEyeInner = landmarks[LEFT_EYE_INNER];
    const leftEyeOuter = landmarks[LEFT_EYE_OUTER];
    const rightEyeInner = landmarks[RIGHT_EYE_INNER];
    const rightEyeOuter = landmarks[RIGHT_EYE_OUTER];

    // Widths
    const leftWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
    const rightWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);

    // Centers
    const leftCenterX = (leftEyeInner.x + leftEyeOuter.x) / 2;
    const rightCenterX = (rightEyeInner.x + rightEyeOuter.x) / 2;

    // Relative Position (0 = left, 1 = right)
    const leftRelX = 0.5 + (leftIris.x - leftCenterX) / leftWidth;
    const rightRelX = 0.5 + (rightIris.x - rightCenterX) / rightWidth;
    const avgX = (leftRelX + rightRelX) / 2;

    // Vertical
    const leftTop = Math.min(...LEFT_EYE_TOP.map(i => landmarks[i].y));
    const leftBot = Math.max(...LEFT_EYE_BOTTOM.map(i => landmarks[i].y));
    const rightTop = Math.min(...RIGHT_EYE_TOP.map(i => landmarks[i].y));
    const rightBot = Math.max(...RIGHT_EYE_BOTTOM.map(i => landmarks[i].y));

    const leftH = leftBot - leftTop;
    const rightH = rightBot - rightTop;

    const leftCenterY = (leftTop + leftBot) / 2;
    const rightCenterY = (rightTop + rightBot) / 2;

    const AMP = 1.5;
    const leftRelY = 0.5 + ((leftIris.y - leftCenterY) / leftH) * AMP;
    const rightRelY = 0.5 + ((rightIris.y - rightCenterY) / rightH) * AMP;
    const avgY = (leftRelY + rightRelY) / 2;

    // Map -1 to 1
    const gazeX = (avgX - 0.5) * 2;
    const gazeY = (avgY - 0.5) * 2;

    // Classification
    const H_DEAD = 0.15;
    const V_DEAD = 0.10;

    let hLabel = "Center";
    if (avgX > 0.5 + H_DEAD) hLabel = "Left";
    if (avgX < 0.5 - H_DEAD) hLabel = "Right";

    let vLabel = "Center";
    if (avgY < 0.5 - V_DEAD) vLabel = "Up";
    if (avgY > 0.5 + V_DEAD) vLabel = "Down";

    // Smoothing
    if (!window.gazeHistory) window.gazeHistory = { x: gazeX, y: gazeY };
    const ALPHA = 0.3;
    const smoothX = window.gazeHistory.x * (1 - ALPHA) + gazeX * ALPHA;
    const smoothY = window.gazeHistory.y * (1 - ALPHA) + gazeY * ALPHA;
    window.gazeHistory = { x: smoothX, y: smoothY };

    return {
        horizontal: hLabel,
        vertical: vLabel,
        direction: `${hLabel} ${vLabel}`,
        continuousGazeX: smoothX,
        continuousGazeY: smoothY
    };
}

function updateGazeVisualization(gaze) {
    const maxOffset = 45;
    // Invert X because user looks Left -> Pointer goes Left (Screen Left)
    const x = -gaze.continuousGazeX * maxOffset;
    const y = gaze.continuousGazeY * maxOffset;

    gazePointEl.style.left = `calc(50% + ${x}%)`;
    gazePointEl.style.top = `calc(50% + ${y}%)`;

    // Dynamic Size
    const intensity = Math.sqrt(gaze.continuousGazeX**2 + gaze.continuousGazeY**2);
    const size = 20 + (intensity * 10);
    gazePointEl.style.width = `${size}px`;
    gazePointEl.style.height = `${size}px`;
}

function detectEyeMovement(left, right) {
    if (!prevLeftIris || !prevRightIris) return { type: "Init", magnitude: 0 };

    const dX = (left.x - prevLeftIris.x + right.x - prevRightIris.x) / 2;
    const dY = (left.y - prevLeftIris.y + right.y - prevRightIris.y) / 2;
    const mag = Math.sqrt(dX*dX + dY*dY);

    let type = "Steady";
    if (mag > 0.015) type = "Saccade";
    else if (mag > 0.008) type = "Rapid";
    else if (mag > 0.004) type = "Moderate";

    return { type, magnitude: mag };
}

function calculateVelocity(left, right) {
    if (!prevLeftIris) return 0;
    const dist = (calculateDistance(left, prevLeftIris) + calculateDistance(right, prevRightIris)) / 2;
    movementHistory.push(dist);
    if (movementHistory.length > maxHistoryLength) movementHistory.shift();
    return movementHistory.reduce((a,b)=>a+b,0) / movementHistory.length;
}

// ============================================================================
// 9. UI UPDATES & EXPORT
// ============================================================================

function updateUI(data) {
    leftXEl.textContent = data.leftIris.x.toFixed(1);
    leftYEl.textContent = data.leftIris.y.toFixed(1);
    rightXEl.textContent = data.rightIris.x.toFixed(1);
    rightYEl.textContent = data.rightIris.y.toFixed(1);

    leftREl.textContent = (data.leftRadius * 100).toFixed(1);
    rightREl.textContent = (data.rightRadius * 100).toFixed(1);

    gazeDirectionEl.textContent = data.gazeDirection.direction;
    gazeHEl.textContent = data.gazeDirection.horizontal;
    gazeVEl.textContent = data.gazeDirection.vertical;
    updateGazeVisualization(data.gazeDirection);

    movementTypeEl.textContent = data.movement.type;
    movementMagnitudeEl.textContent = `Mag: ${data.movement.magnitude.toFixed(4)}`;
    velocityEl.textContent = (data.velocity * 1000).toFixed(1);
}

function updateNoDetection() {
    gazeDirectionEl.textContent = "No Face";
}

function updatePerformanceMetrics() {
    frameCount++;
    const now = performance.now();
    const fps = 1000 / (now - lastFrameTime);
    lastFrameTime = now;
    fpsEl.textContent = fps.toFixed(0);
    framesEl.textContent = frameCount;
}

function exportCSV() {
    if (recordedData.length === 0) { alert('No data'); return; }
    const headers = 'time,lx,ly,rx,ry,l_rad,r_rad,gazeH,gazeV';
    const rows = recordedData.map(d =>
        `${d.timestamp.toFixed(0)},${d.leftIrisNormalized.x.toFixed(4)},${d.leftIrisNormalized.y.toFixed(4)},${d.rightIrisNormalized.x.toFixed(4)},${d.rightIrisNormalized.y.toFixed(4)},${d.leftRadius.toFixed(4)},${d.rightRadius.toFixed(4)},${d.gazeDirection.horizontal},${d.gazeDirection.vertical}`
    ).join('\n');

    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `iris-data-${Date.now()}.csv`;
    link.click();
}

startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);
exportBtn.addEventListener('click', exportCSV);

initialize();