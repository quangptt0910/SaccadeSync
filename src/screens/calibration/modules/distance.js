import { refs } from "./domRefs.js";

export let distanceOK = false;

const FAR = 0.12;
const CLOSE = 0.20;

export function computeEyeDistance(lm) {
    const l = lm[33];
    const r = lm[263];
    return Math.hypot(l.x - r.x, l.y - r.y);
}

export function handleDistanceState(landmarks) {
    if (!landmarks) {
        distanceOK = false;
        refs.overlayStatusText.textContent = "NO FACE";
        refs.overlayInstructions.textContent = "Position face in view.";
        refs.statusEl.textContent = "No face";
        refs.runCalibBtnOverlay.style.display = "none";
        return false;
    }

    const d = computeEyeDistance(landmarks);

    if (d < FAR) {
        distanceOK = false;
        refs.overlayStatusText.textContent = "TOO FAR";
        refs.overlayInstructions.textContent = "Move closer.";
        refs.statusEl.textContent = "Too far";
        refs.runCalibBtnOverlay.style.display = "none";
        return false;
    }

    if (d > CLOSE) {
        distanceOK = false;
        refs.overlayStatusText.textContent = "TOO CLOSE";
        refs.overlayInstructions.textContent = "Move back.";
        refs.statusEl.textContent = "Too close";
        refs.runCalibBtnOverlay.style.display = "none";
        return false;
    }

    distanceOK = true;
    refs.overlayStatusText.textContent = "DISTANCE OK";
    refs.overlayInstructions.textContent = "Click Run Calibration.";
    refs.statusEl.textContent = "Distance OK";
    refs.runCalibBtnOverlay.style.display = "inline-block";
    return true;
}