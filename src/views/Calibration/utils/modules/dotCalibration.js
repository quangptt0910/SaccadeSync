// Calibration/dotCalibration.js
import { refs } from "./domRefs.js";
import { faceLandmarker } from "./faceModel.js";
import { distanceOK } from "./distance.js";
import { stopDistanceCheck } from "./video.js";
import {displayPredictionModel} from "./display";

export let gazeData = [];
export let calibrationModel = {
    left: { coefX: [0,0,0,0,0,0], coefY: [0,0,0,0,0,0] },
    right: { coefX: [0,0,0,0,0,0], coefY: [0,0,0,0,0,0] }
};

export let runningDot = false;
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

export function hideFsWarning() {
    refs.fsWarning.style.display = "none";
    refs.fsWarningPanel.style.opacity = "0";
}

// dot animation and placement
export function placeDot(x, y, visible = true) {
    refs.calDot.style.left = `${x}px`;
    refs.calDot.style.top = `${y}px`;
    refs.calDot.style.opacity = visible ? "1" : "0";
}

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

//CHANGED: use only center points for iris
const RIGHT_IRIS_CENTER = 473;
const LEFT_IRIS_CENTER = 468;

function computeIrisCenter(landmarks, index) {
    const point = landmarks[index];
    if (!point) return null;
    return { x: point.x, y: point.y };
}

// function computeCenterAndRadius(points) {
//     if (!points?.length) return null;
//     const cx = points.reduce((s,p)=>s+p.x,0)/points.length;
//     const cy = points.reduce((s,p)=>s+p.y,0)/points.length;
//     const r = points.reduce((s,p)=>s+Math.hypot(p.x-cx,p.y-cy),0)/points.length;
//     return { x: cx, y: cy, r };
// }

// dot positions in pixels
export function getDotPoints() {
    // The height/width of the screen
    const w = window.innerWidth;
    const h = window.innerHeight;
    //const margin = Math.max(60, Math.min(200, Math.round(Math.min(w,h)*0.08))); // we got some magic numbers here :))
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

// collect iris samples for a point
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
            const rightRaw = computeIrisCenter(lm, RIGHT_IRIS_CENTER);
            const leftRaw = computeIrisCenter(lm, LEFT_IRIS_CENTER);

            if (!leftRaw && !rightRaw) {
                await sleep(SAMPLE_INTERVAL_MS);
                continue;
            }

            if (skipCount < SKIP_FIRST_N) {
                skipCount++;
                await sleep(SAMPLE_INTERVAL_MS);
                continue;
            }


            // 🔧 FIX: Un-mirror the X coordinates
            const right = rightRaw ? {
                x: 1 - rightRaw.x,  // Flip horizontal
                y: rightRaw.y
            } : null;

            const left = leftRaw ? {
                x: 1 - leftRaw.x,   // Flip horizontal
                y: leftRaw.y
            } : null;

            // 🔍 COMPREHENSIVE LANDMARK DEBUG
            if (count === 0 && idx === 0) {
                console.group('🔬 LANDMARK EXTRACTION TEST');

                // Test different landmark indices
                console.log('Landmark 468 (LEFT iris center):', lm[468]);
                console.log('Landmark 473 (RIGHT iris center):', lm[473]);
                console.log('Landmark 469 (LEFT iris edge):', lm[469]);
                console.log('Landmark 474 (RIGHT iris edge):', lm[474]);

                // Test face landmarks for comparison
                console.log('Landmark 0 (face point):', lm[0]);
                console.log('Landmark 10 (face point):', lm[10]);

                // What you're ACTUALLY extracting
                console.log('Total landmarks available:', lm.length);

                console.groupEnd();
            }

            if (count === 0) {
                console.log(`📍 Calibration Point ${idx}:`, {
                    dotPixels: {
                        x: screenX * window.innerWidth,
                        y: screenY * window.innerHeight
                    },
                    targetNormalized: { x: screenX, y: screenY },
                    irisLeft: left,
                    irisRight: right,
                    videoSize: {
                        width: refs.video.videoWidth,
                        height: refs.video.videoHeight
                    },
                    totalLandmarks: lm.length
                });
            }

            gazeData.push({
                point_index: idx,
                targetX: screenX, // Normalized in the runDotCalibration
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

export async function runDotCalibration(onComplete) {
    if (runningDot) {
        console.warn('⚠️ Calibration already running!');
        return;
    }

    if (!distanceOK) {
        alert("Distance not OK");
        return;
    }

    console.group('📹 Video Configuration');
    console.log('Video element:', refs.video);
    console.log('Video dimensions:', {
        videoWidth: refs.video.videoWidth,
        videoHeight: refs.video.videoHeight,
        clientWidth: refs.video.clientWidth,
        clientHeight: refs.video.clientHeight,
        offsetWidth: refs.video.offsetWidth,
        offsetHeight: refs.video.offsetHeight
    });
    console.log('Screen dimensions:', {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height
    });
    console.groupEnd();

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