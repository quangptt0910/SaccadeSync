import { refs } from "./domRefs.js";
import { faceLandmarker } from "./faceModel.js";
import { distanceOK } from "./distance.js";
import { displayCalibrationParameters, displayPredictionModel } from "./display.js";
import { stopDistanceCheck } from "./video.js";

export let gazeData = [];
export let calibrationModel = {
    left: { coefX: [0,0,0,0,0,0], coefY: [0,0,0,0,0,0] },
    right: { coefX: [0,0,0,0,0,0], coefY: [0,0,0,0,0,0] }
};

export let runningDot = false;
export let abortDot = false;

// utils points (screen ratios)
export const CALIBRATION_POINTS = [
    { x: 0.1, y: 0.1, label: "Top-Left" },
    { x: 0.5, y: 0.1, label: "Top-Center" },
    { x: 0.9, y: 0.1, label: "Top-Right" },
    { x: 0.1, y: 0.5, label: "Mid-Left" },
    { x: 0.5, y: 0.5, label: "Center" },
    { x: 0.9, y: 0.5, label: "Mid-Right" },
    { x: 0.1, y: 0.9, label: "Bottom-Left" },
    { x: 0.5, y: 0.9, label: "Bottom-Center" },
    { x: 0.9, y: 0.9, label: "Bottom-Right" }
];

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

// compute iris center + radius
const RIGHT_IRIS_START = 469, RIGHT_IRIS_END = 474;
const LEFT_IRIS_START = 474, LEFT_IRIS_END = 479;

function computeCenterAndRadius(points) {
    if (!points?.length) return null;
    const cx = points.reduce((s,p)=>s+p.x,0)/points.length;
    const cy = points.reduce((s,p)=>s+p.y,0)/points.length;
    const r = points.reduce((s,p)=>s+Math.hypot(p.x-cx,p.y-cy),0)/points.length;
    return { x: cx, y: cy, r };
}

// dot positions in pixels
export function getDotPoints() {
    const w = window.innerWidth, h = window.innerHeight;
    const margin = Math.max(60, Math.min(200, Math.round(Math.min(w,h)*0.08)));
    return [
        { x: margin, y: margin },
        { x: w/2, y: margin },
        { x: w-margin, y: margin },
        { x: margin, y: h/2 },
        { x: w/2, y: h/2 },
        { x: w-margin, y: h/2 },
        { x: margin, y: h-margin },
        { x: w/2, y: h-margin },
        { x: w-margin, y: h-margin }
    ];
}

// collect iris samples for a point
export async function collectSamplesForPoint(idx, screenX, screenY) {
    let count = 0;
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
            const right = computeCenterAndRadius(lm.slice(RIGHT_IRIS_START, RIGHT_IRIS_END));
            const left = computeCenterAndRadius(lm.slice(LEFT_IRIS_START, LEFT_IRIS_END));

            if (!left && !right) {
                await sleep(SAMPLE_INTERVAL_MS);
                continue;
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

export async function runDotCalibration(onComplete) {
    if (!distanceOK) {
        alert("Distance not OK");
        return;
    }

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
            await animateDotTo(p.x, p.y);

            const result = await collectSamplesForPoint(i, p.x/window.innerWidth, p.y/window.innerHeight);

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

        displayCalibrationParameters();
        const metrics = displayPredictionModel();

        if (onComplete && typeof onComplete === "function") {
            onComplete({
                gazeData,
                calibrationModel,
                metrics
            });
        }
    }
}