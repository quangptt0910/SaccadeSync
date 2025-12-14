import { initDomRefs } from "./modules/domRefs.js";
import { initFaceLandmarker } from "./modules/faceModel.js";
import { startDistanceCheck } from "./modules/video.js";
import { runDotCalibration } from "./modules/dotCalibration.js";

export async function initCalibration() {
    initDomRefs();
    await initFaceLandmarker();

    document
        .getElementById("start-calibration-btn")
        .addEventListener("click", startDistanceCheck);

    document
        .getElementById("run-calibration-btn-overlay")
        .addEventListener("click", runDotCalibration);
}