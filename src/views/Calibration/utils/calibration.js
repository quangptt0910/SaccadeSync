import { initDomRefs } from "./modules/domRefs.js";
import { initFaceLandmarker } from "./modules/faceModel.js";
import { startDistanceCheck, stopDistanceCheck } from "./modules/video.js";
import { runDotCalibration } from "./modules/dotCalibration.js";

/**
 * Flag to track if the calibration process is currently running.
 * Prevents multiple calibration sessions from starting simultaneously.
 * @type {boolean}
 */
let calibrationRunning = false;

/**
 * Initializes the entire calibration subsystem.
 * Sets up DOM references, loads the AI model, and attaches event listeners to UI buttons.
 *
 * @param {Function} onComplete - Callback executed when the calibration sequence finishes successfully.
 * @returns {Promise<Function>} A cleanup function that removes event listeners.
 */
export async function initCalibration(onComplete) {
    initDomRefs();
    await initFaceLandmarker();

    const startBtn = document.getElementById("start-calibration-btn");
    const stopBtn = document.getElementById("stop-calibration-btn");
    const runBtn = document.getElementById("run-calibration-btn-overlay");

    const handleRunClick = () => {
        if (calibrationRunning) {
            console.warn('⚠️ Calibration already in progress (initCalibration level)');
            return;
        }

        calibrationRunning = true;

        runDotCalibration((result) => {
            calibrationRunning = false;  // Reset flag when complete
            if (onComplete) onComplete(result);
        });
    }



    startBtn?.addEventListener("click", startDistanceCheck);
    stopBtn?.addEventListener("click", stopDistanceCheck);
    runBtn?.addEventListener("click", handleRunClick);

    // Return a cleanup function
    return () => {
        startBtn?.removeEventListener("click", startDistanceCheck);
        stopBtn?.removeEventListener("click", stopDistanceCheck);
        runBtn?.removeEventListener("click", handleRunClick);
        calibrationRunning = false;  // Reset on cleanup
    };
}