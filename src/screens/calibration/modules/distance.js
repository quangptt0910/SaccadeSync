import {
    overlayInstructions,
    overlayStatusText,
    runCalibBtnOverlay,
    statusEl
} from "./domRefs.js";

export let distanceOK = false;

const DISTANCE_FAR_THRESHOLD = 0.12;
const DISTANCE_CLOSE_THRESHOLD = 0.20;

export function computeEyeDistance(landmarks) {
    const left = landmarks[33];
    const right = landmarks[263];
    return Math.hypot(left.x - right.x, left.y - right.y);
}

export function handleDistanceState(landmarks) {
    if (!landmarks) {
        distanceOK = false;
        runCalibBtnOverlay.style.display = "none";
        overlayStatusText.textContent = "NO FACE";
        overlayInstructions.textContent = "Position face in view.";
        statusEl.textContent = "No face detected";
        statusEl.className = "";
        return false;
    }

    const d = computeEyeDistance(landmarks);

    if (d <= DISTANCE_FAR_THRESHOLD) {
        distanceOK = false;
        runCalibBtnOverlay.style.display = "none";
        overlayStatusText.textContent = "TOO FAR";
        overlayInstructions.textContent = "Move closer (≈ 40–100 cm).";
        statusEl.textContent = "Distance Alert: TOO FAR!";
        statusEl.className = "far";
        return false;
    }

    if (d >= DISTANCE_CLOSE_THRESHOLD) {
        distanceOK = false;
        runCalibBtnOverlay.style.display = "none";
        overlayStatusText.textContent = "TOO CLOSE";
        overlayInstructions.textContent = "Move back (≈ 40–100 cm).";
        statusEl.textContent = "Distance Alert: TOO CLOSE!";
        statusEl.className = "close";
        return false;
    }

    distanceOK = true;
    runCalibBtnOverlay.style.display = "inline-block";
    overlayStatusText.textContent = "DISTANCE OK";
    overlayInstructions.textContent =
        "Click Run Calibration to begin calibration.";
    statusEl.textContent = "Distance OK";
    statusEl.className = "good";

    return true;
}