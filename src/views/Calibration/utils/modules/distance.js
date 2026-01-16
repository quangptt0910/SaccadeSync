import { refs } from "./domRefs.js";

/**
 * Global flag indicating if the user is currently at the correct distance.
 * @type {boolean}
 */
export let distanceOK = false;

const FAR = 0.12;
const CLOSE = 0.25;

/**
 * Computes the Euclidean distance between the left and right eye landmarks.
 * Used as a proxy for the user's physical distance from the camera.
 *
 * @param {Array} lm - The array of face landmarks from MediaPipe.
 * @returns {number} The hypotenuse distance between the two eye points.
 */
export function computeEyeDistance(lm) {
    const l = lm[33];
    const r = lm[263];
    return Math.hypot(l.x - r.x, l.y - r.y);
}

/**
 * Analyzes landmarks to determine if the user is too close, too far, or correctly positioned.
 * Updates the DOM overlay text and buttons accordingly.
 *
 * @param {Array} landmarks - The face landmarks detected by the model.
 * @returns {boolean} True if distance is acceptable, false otherwise.
 */
export function handleDistanceState(landmarks) {
    if (!landmarks) {
        distanceOK = false;
        refs.overlayStatusText.textContent = "NO FACE";
        refs.overlayInstructions.textContent = "Position face in view.";
        refs.runCalibBtnOverlay.style.display = "none";
        return false;
    }

    const d = computeEyeDistance(landmarks);

    if (d < FAR) {
        distanceOK = false;
        refs.overlayStatusText.textContent = "TOO FAR";
        refs.overlayInstructions.textContent = "Move closer.";
        refs.runCalibBtnOverlay.style.display = "none";
        return false;
    }

    if (d > CLOSE) {
        distanceOK = false;
        refs.overlayStatusText.textContent = "TOO CLOSE";
        refs.overlayInstructions.textContent = "Move back.";
        refs.runCalibBtnOverlay.style.display = "none";
        return false;
    }

    distanceOK = true;
    refs.overlayStatusText.textContent = "DISTANCE OK";
    refs.overlayInstructions.textContent = "Click Run Calibration.";
    refs.runCalibBtnOverlay.style.display = "inline-block";
    return true;
}