import { initDomRefs } from "./modules/domRefs.js";
import { initFaceLandmarker } from "./modules/faceModel.js";
import { startDistanceCheck } from "./modules/video.js";
import { runDotCalibration } from "./modules/dotCalibration.js";

export async function initCalibration() {
    initDomRefs();
    await initFaceLandmarker();

    const startBtn = document.getElementById("start-calibration-btn");
    const runBtn = document.getElementById("run-calibration-btn-overlay");

    startBtn?.addEventListener("click", startDistanceCheck);
    runBtn?.addEventListener("click", runDotCalibration);
}