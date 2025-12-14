import { faceLandmarker } from "./faceModel.js";
import { distanceOK } from "./distance.js";
import {
    calDot,
    dotStage,
    fsWarning,
    fsWarningPanel,
    video,
    canvas
} from "./domRefs.js";

import { displayCalibrationParameters, displayPredictionModel } from "./display.js";

export let gazeData = [];
export let calibrationModel = {
    left: {
        coefX: [0, 0, 0, 0, 0, 0], // a0..a5
        coefY: [0, 0, 0, 0, 0, 0]
    },
    right: {
        coefX: [0, 0, 0, 0, 0, 0],
        coefY: [0, 0, 0, 0, 0, 0]
    }
};

export let runningDot = false;
export let abortDot = false;

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
    fsWarning.style.display = "flex";
    fsWarningPanel.style.opacity = "1";
    calDot.style.opacity = "0";
}

export function hideFsWarning() {
    fsWarning.style.display = "none";
    fsWarningPanel.style.opacity = "0";
}

export function getDotPoints() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const margin = Math.max(60, Math.min(200, Math.round(Math.min(w, h) * 0.08)));

    return [
        { x: margin, y: margin },
        { x: w / 2, y: margin },
        { x: w - margin, y: margin },
        { x: margin, y: h / 2 },
        { x: w / 2, y: h / 2 },
        { x: w - margin, y: h / 2 },
        { x: margin, y: h - margin },
        { x: w / 2, y: h - margin },
        { x: w - margin, y: h - margin }
    ];
}

export function placeDot(x, y, visible = true) {
    calDot.style.left = `${x}px`;
    calDot.style.top = `${y}px`;
    calDot.style.opacity = visible ? "1" : "0";
}

export function animateDotTo(tx, ty, duration = TRANSITION_MS) {
    return new Promise(resolve => {
        const startX = parseFloat(calDot.style.left || "-1000");
        const startY = parseFloat(calDot.style.top || "-1000");
        const t0 = performance.now();

        const ease = (t) => 1 - Math.pow(1 - t, 3);

        function step(now) {
            if (abortDot) return resolve();

            const t = Math.min(1, (now - t0) / duration);
            const e = ease(t);

            placeDot(startX + (tx - startX) * e, startY + (ty - startY) * e, true);

            if (t < 1) requestAnimationFrame(step);
            else resolve();
        }

        requestAnimationFrame(step);
    });
}

/**
 * - right iris: 469..473 (5 points)
 * - left iris: 474..478 (5 points)
 * using slices that match these ranges (slice(start, endExclusive)).
 */
const RIGHT_IRIS_START = 469; // inclusive
const RIGHT_IRIS_END = 474;   // exclusive
const LEFT_IRIS_START = 474;  // inclusive
const LEFT_IRIS_END = 479;    // exclusive

function computeCenterAndRadius(points) {
    if (!points || !points.length) return null;
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const radius =
        points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / points.length;
    return { x: cx, y: cy, r: radius };
}

export async function collectSamplesForPoint(idx, screenX, screenY) {
    let count = 0;

    while (count < SAMPLES_PER_POINT) {
        if (abortDot || !runningDot) break;
        if (!distanceOK) {
            abortDot = true;
            break;
        }

        const r = faceLandmarker.detectForVideo(video, performance.now());
        if (r?.faceLandmarks?.length) {
            const landmarks = r.faceLandmarks[0];

            // extract right iris landmarks (469..473)
            const rightIris = landmarks.slice(RIGHT_IRIS_START, RIGHT_IRIS_END);
            // extract left iris landmarks (474..478)
            const leftIris = landmarks.slice(LEFT_IRIS_START, LEFT_IRIS_END);

            const left = computeCenterAndRadius(leftIris);
            const right = computeCenterAndRadius(rightIris);

            // if both are null, skip
            if (!left && !right) {
                await sleep(SAMPLE_INTERVAL_MS);
                continue;
            }

            // store both (may have one null if occluded)
            gazeData.push({
                point_index: idx,
                targetX: screenX,
                targetY: screenY,
                iris_left: left,    // {x,y,r} or null
                iris_right: right   // {x,y,r} or null
            });

            count++;
        }

        await sleep(SAMPLE_INTERVAL_MS);
    }
}

export async function runDotCalibration() {
    if (!distanceOK) {
        alert("Distance not OK.");
        return;
    }

    try {
        if (!document.fullscreenElement)
            await document.documentElement.requestFullscreen();
    } catch {}

    dotStage.style.display = "flex";
    video.classList.remove("show");
    canvas.classList.remove("show");

    const points = getDotPoints();

    abortDot = false;
    runningDot = true;
    gazeData = [];

    placeDot(window.innerWidth / 2, window.innerHeight / 2, true);
    await sleep(200);

    for (let i = 0; i < points.length; i++) {
        if (abortDot) break;
        const p = points[i];

        await animateDotTo(p.x, p.y);
        if (abortDot) break;

        placeDot(p.x, p.y, true);
        await collectSamplesForPoint(
            i,
            p.x / window.innerWidth,
            p.y / window.innerHeight
        );

        await sleep(WAIT_AFTER);
    }

    runningDot = false;
    calDot.style.opacity = "0";

    if (abortDot) {
        showFsWarning();
        return;
    }

    if (document.fullscreenElement)
        document.exitFullscreen().catch(() => {});

    hideFsWarning();
    dotStage.style.display = "none";
    video.classList.add("show");
    canvas.classList.add("show");

    displayCalibrationParameters();
    displayPredictionModel();
}