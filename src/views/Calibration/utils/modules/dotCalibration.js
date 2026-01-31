// Calibration/dotCalibration.js
import { refs } from "./domRefs.js";
import { faceLandmarker } from "./faceModel.js";
import { distanceOK } from "./distance.js";
import { stopDistanceCheck } from "./video.js";
import {displayPredictionModel} from "./display";

/**
 * Array storing collected raw gaze samples.
 * Each entry contains screen target coordinates and iris positions.
 * @type {Array<Object>}
 */
export let gazeData = [];

/**
 * The resulting calibration coefficients for left and right eyes after 'fitting'.
 * @type {Object}
 */
export let calibrationModel = {
    left: { coefX: [0,0,0,0,0,0], coefY: [0,0,0,0,0,0] },
    right: { coefX: [0,0,0,0,0,0], coefY: [0,0,0,0,0,0] }
};

/** @type {boolean} Flag indicating if the dot calibration sequence is active. */
export let runningDot = false;

/** @type {boolean} Flag used to signal the calibration loop to abort. */
export let abortDot = false;

// utils points (screen ratios)
// export const CALIBRATION_POINTS = [
//     { x: 0.1, y: 0.1, label: "Top-Left" },
//     { x: 0.5, y: 0.1, label: "Top-Center" },
//     { x: 0.9, y: 0.1, label: "Top-Right" },
//     { x: 0.1, y: 0.5, label: "Mid-Left" },
//     { x: 0.5, y: 0.5, label: "Center" },
//     { x: 0.9, y: 0.5, label: "Mid-Right" },
//     { x: 0.1, y: 0.9, label: "Bottom-Left" },
//     { x: 0.5, y: 0.9, label: "Bottom-Center" },
//     { x: 0.9, y: 0.9, label: "Bottom-Right" }
// ];

const SAMPLES_PER_POINT = 15;
const SAMPLE_INTERVAL_MS = 200;
const TRANSITION_MS = 650;
const WAIT_AFTER = 200;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Displays the full-screen warning overlay when distance or face detection fails during calibration.
 */
export function showFsWarning() {
    refs.fsWarning.style.display = "flex";
    refs.fsWarningPanel.style.opacity = "1";
    refs.calDot.style.opacity = "0";

    const h3 = refs.fsWarningPanel.querySelector("h3");
    const p = refs.fsWarningPanel.querySelector("p");

    if (refs.overlayStatusText && h3) {
        h3.textContent = refs.overlayStatusText.textContent;
    }
    if (refs.overlayInstructions && p) {
        p.textContent = refs.overlayInstructions.textContent;
    }
}

/**
 * Hides the full-screen warning overlay.
 */
export function hideFsWarning() {
    refs.fsWarning.style.display = "none";
    refs.fsWarningPanel.style.opacity = "0";
}

/**
 * Immediately positions the calibration dot element at specific pixel coordinates.
 * @param {number} x - Left offset in pixels.
 * @param {number} y - Top offset in pixels.
 * @param {boolean} [visible=true] - Whether the dot should be visible.
 */export function placeDot(x, y, visible = true) {
    refs.calDot.style.left = `${x}px`;
    refs.calDot.style.top = `${y}px`;
    refs.calDot.style.opacity = visible ? "1" : "0";
}

/**
 * Animates the calibration dot from its current position to target coordinates.
 * Uses a cubic ease-out function for smooth movement.
 *
 * @param {number} tx - Target X coordinate in pixels.
 * @param {number} ty - Target Y coordinate in pixels.
 * @param {number} [duration=TRANSITION_MS] - Animation duration in milliseconds.
 * @returns {Promise<void>} Resolves when animation completes.
 */
export function animateDotTo(tx, ty, duration = TRANSITION_MS) {
    return new Promise(resolve => {
        const startX = parseFloat(refs.calDot.style.left || "-1000");
        const startY = parseFloat(refs.calDot.style.top || "-1000");
        const t0 = performance.now();
        const ease = t => 1 - Math.pow(1 - t, 3);

        function step(now) {
            if (abortDot) return resolve();
            const t = Math.min(1, (now - t0)/duration);
            const e = ease(t);
            placeDot(startX + (tx - startX)*e, startY + (ty - startY)*e, true);
            if (t < 1) requestAnimationFrame(step);
            else resolve();
        }
        requestAnimationFrame(step);
    });
}

//CHANGED: use iris of eyes vs eyes coordinates (local coordinate)
const EYE_INDICES = {
    // Subject's Left Eye (MediaPipe indices)
    left: { inner: 33, outer: 133, iris: 468 },
    // Subject's Right Eye (MediaPipe indices)
    right: { inner: 362, outer: 263, iris: 473 }
};

const RIGHT_IRIS_CENTER = 473;
const LEFT_IRIS_CENTER = 468;

function computeIrisCenter(landmarks, index) {
    const point = landmarks[index];
    if (!point) return null;
    return { x: point.x, y: point.y };
}

/**
 * Calculates iris position relative to eye corners (Local Coordinates).
 * Returns {x, y} where x=0 is Inner Corner, x=1 is Outer Corner.
 */
// function getRelativeIrisPos(landmarks, eyeSide) {
//     const indices = EYE_INDICES[eyeSide];
//     const pInner = landmarks[indices.inner];
//     const pOuter = landmarks[indices.outer];
//     const pIris = landmarks[indices.iris];
//
//     if (!pInner || !pOuter || !pIris) return null;
//
//     // 1. Calculate Vector Basis (Eye Width line)
//     const vecEye = { x: pOuter.x - pInner.x, y: pOuter.y - pInner.y };
//     const vecIris = { x: pIris.x - pInner.x, y: pIris.y - pInner.y };
//
//     // 2. Eye Width (Magnitude squared for projection)
//     const eyeWidthSq = vecEye.x * vecEye.x + vecEye.y * vecEye.y;
//     // const eyeWidth = Math.sqrt(eyeWidthSq);
//
//     // 3. Project Iris onto horizontal Eye Axis (Scalar Projection)
//     // Formula: (Iris • Eye) / |Eye|^2
//     // This gives a normalized X value: 0.0 (Inner) -> 1.0 (Outer)
//     //let normX = (vecIris.x * vecEye.x + vecIris.y * vecEye.y) / eyeWidthSq;
//
//     const eyeWidthX = pOuter.x - pInner.x;
//     let normX = (pIris.x - pInner.x) / eyeWidthX;
//     // 4.
//     // Calculate iris vertical position as a fraction of eye opening height
//     const eyeTopY = Math.min(pInner.y, pOuter.y);      // Top of eye
//     const eyeBottomY = Math.max(pInner.y, pOuter.y);   // Bottom of eye
//     const eyeHeight = eyeBottomY - eyeTopY;
//
//     // 1.0 = looking up (iris at top), 0.0 = looking down (iris at bottom)
//     let normY = 1.0 - ((pIris.y - eyeTopY) / eyeHeight);
//
//     return { x: normX, y: normY };
// }

function getRelativeIrisPos(landmarks, eyeSide) {
    const indices = eyeSide === 'left'
        ? { inner: 33, outer: 133, iris: 468 }
        : { inner: 362, outer: 263, iris: 473 };

    const pInner = landmarks[indices.inner];
    const pOuter = landmarks[indices.outer];
    const pIris = landmarks[indices.iris];

    if (!pInner || !pOuter || !pIris) return null;

    // ========== HORIZONTAL (X) ==========
    // Simple ratio: where is iris between inner and outer corner?
    const normX = (pIris.x - pInner.x) / (pOuter.x - pInner.x);

    // ========== VERTICAL (Y) ==========
    // Find the ACTUAL vertical span of the eye
    // Use more eye landmark points for accurate bounds
    const eyeContourIndices = eyeSide === 'left'
        ? [33, 160, 158, 133, 153, 144]  // Left eye
        : [362, 385, 387, 263, 373, 380]; // Right eye

    const yCoords = eyeContourIndices
        .map(i => landmarks[i]?.y)
        .filter(y => y !== undefined);

    if (yCoords.length === 0) return null;

    const eyeTopY = Math.min(...yCoords);
    const eyeBottomY = Math.max(...yCoords);
    const eyeHeight = eyeBottomY - eyeTopY;

    // Avoid division by zero AND clamp result
    let normY;
    if (eyeHeight > 0.01) {
        // Where is iris between top and bottom of eye?
        normY = (pIris.y - eyeTopY) / eyeHeight;
        normY = Math.max(0, Math.min(1, normY));  // Clamp!
    } else {
        normY = 0.5;  // Safe default
    }

    return {
        x: Math.max(0, Math.min(1, normX)),
        y: normY
    };
}


/**
 * Calculates the exact screen pixel coordinates for the calibration points.
 * Applies a margin to ensure points are not too close to the screen edge.
 * @returns {Array<Object>} Array of objects with x and y properties.
 */
export function getDotPoints() {
    // The height/width of the screen
    const w = window.innerWidth;
    const h = window.innerHeight;

    const marginLeft = 0.05; // % of screen size
    const mid = 0.5
    const marginRight = 1 - marginLeft;
    // We will take 5% margin for calibration points
    const xMin = w * marginLeft;
    const xMid = w * mid;
    const xMax = w * marginRight;

    const yMin = h * marginLeft;
    const yMid = h * mid;
    const yMax = h * marginRight;

    return [
        { px: xMin, py: yMin, x: 0.05, y: 0.05 },  // Store BOTH pixels and normalized
        { px: xMid, py: yMin, x: 0.50, y: 0.05 },
        { px: xMax, py: yMin, x: 0.95, y: 0.05 },

        { px: xMin, py: yMid, x: 0.05, y: 0.50 },
        { px: xMid, py: yMid, x: 0.50, y: 0.50 },
        { px: xMax, py: yMid, x: 0.95, y: 0.50 },

        { px: xMin, py: yMax, x: 0.05, y: 0.95 },
        { px: xMid, py: yMax, x: 0.50, y: 0.95 },
        { px: xMax, py: yMax, x: 0.95, y: 0.95 }
    ];
}

/**
 * Collects a specified number of gaze samples (iris positions) for a specific calibration point.
 * Handles pausing if face detection or distance fails.
 *
 * @param {number} idx - The index of the calibration point.
 * @param {number} screenX - The normalized X screen coordinate (0-1).
 * @param {number} screenY - The normalized Y screen coordinate (0-1).
 * @returns {Promise<boolean|string>} Returns "RESTART" if flow was interrupted, true on success, false on abort.
 */
export async function collectSamplesForPoint(idx, screenX, screenY) {
    let count = 0;
    let skipCount = 0;
    const SKIP_FIRST_N = 3;
    while (count < SAMPLES_PER_POINT) {
        if (abortDot || !runningDot) return false;

        if (!distanceOK) {
            while (!distanceOK && runningDot && !abortDot) {
                await sleep(200);
            }

            if (abortDot || !runningDot) return false;

            hideFsWarning();
            return "RESTART";
        }

        const r = faceLandmarker.detectForVideo(refs.video, performance.now());
        if (r?.faceLandmarks?.length) {
            const lm = r.faceLandmarks[0];
            // const right = computeIrisCenter(lm, RIGHT_IRIS_CENTER);
            // const left = computeIrisCenter(lm, LEFT_IRIS_CENTER);

            // Use local coordinates (0.0 - 1.0 relative to eye corners)
            // No need for manual "1 - x" flipping here; the corners define the direction.
            const rightRaw = getRelativeIrisPos(lm, "right");
            const leftRaw = getRelativeIrisPos(lm, "left");

            // NOTE: Even with local coords, we ensure the object structure is clean
            const right = rightRaw ? {
                x: 1 - rightRaw.x, // FLIP X to match screen direction
                y: rightRaw.y
            } : null;

            const left = leftRaw ? {
                x: 1 - leftRaw.x, // FLIP X to match screen direction
                y: leftRaw.y
            } : null;
            if (!left && !right) {
                await sleep(SAMPLE_INTERVAL_MS);
                continue;
            }


            if (skipCount < SKIP_FIRST_N) {
                skipCount++;
                await sleep(SAMPLE_INTERVAL_MS);
                continue;
            }

            const raw468left = computeIrisCenter(lm, LEFT_IRIS_CENTER);
            const raw473right = computeIrisCenter(lm, RIGHT_IRIS_CENTER);
            if (count === SKIP_FIRST_N) {
                console.log(`📍 Point ${idx} (target: ${screenX.toFixed(2)}, ${screenY.toFixed(2)}):`, {
                    dotPixels: { x: screenX * window.innerWidth, y: screenY * window.innerHeight },
                    targetNormalized: { x: screenX, y: screenY },

                    // 🔍 RAW LANDMARKS
                    raw_468_frameLeft: raw468left,
                    raw_473_frameRight: raw473right,

                    // After processing
                    irisLeft: left,
                    irisRight: right,

                    totalLandmarks: lm.length
                });
            }

            gazeData.push({
                point_index: idx,
                targetX: screenX,
                targetY: screenY,
                iris_left: left,
                iris_right: right
            });

            count++;
        }
        await sleep(SAMPLE_INTERVAL_MS);
    }
    return true;
}

/**
 * Orchestrates the full dot calibration sequence.
 * Enters fullscreen, animates the dot through points, collects data, and computes the model.
 *
 * @param {Function} onComplete - Callback function invoked with gazeData, model, and metrics upon success.
 */
export async function runDotCalibration(onComplete) {
    if (runningDot) {
        console.warn('⚠️ Calibration already running!');
        return;
    }

    if (!distanceOK) {
        alert("Distance not OK");
        return;
    }

    // console.group('📹 Video Configuration');
    // console.log('Video element:', refs.video);
    // console.log('Video dimensions:', {
    //     videoWidth: refs.video.videoWidth,
    //     videoHeight: refs.video.videoHeight,
    //     clientWidth: refs.video.clientWidth,
    //     clientHeight: refs.video.clientHeight,
    //     offsetWidth: refs.video.offsetWidth,
    //     offsetHeight: refs.video.offsetHeight
    // });
    // console.log('Screen dimensions:', {
    //     innerWidth: window.innerWidth,
    //     innerHeight: window.innerHeight,
    //     screenWidth: window.screen.width,
    //     screenHeight: window.screen.height
    // });
    // console.groupEnd();



    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch {}

    refs.dotStage.style.display = "flex";
    refs.calDot.style.opacity = "1";
    runningDot = true;
    abortDot = false;

    while (runningDot && !abortDot) {
        gazeData = [];
        const points = getDotPoints();
        await placeDot(window.innerWidth/2, window.innerHeight/2);
        await sleep(200);

        let restart = false;

        for (let i=0;i<points.length;i++) {
            if (abortDot) break;
            const p = points[i];
            await animateDotTo(p.px, p.py);

            const result = await collectSamplesForPoint(i, p.x, p.y);

            if (result === "RESTART") {
                restart = true;
                break;
            }
            if (result === false) {
                break;
            }

            await sleep(WAIT_AFTER);
        }

        if (abortDot) break;

        if (restart) {
            continue;
        }

        runningDot = false;
        refs.calDot.style.opacity = "0";
        refs.dotStage.style.display = "none";
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

        stopDistanceCheck();

        const metrics = displayPredictionModel();
        console.log(metrics)

        if (onComplete && typeof onComplete === "function") {
            onComplete({
                gazeData,
                calibrationModel,
                metrics
            });
        }
    }
}