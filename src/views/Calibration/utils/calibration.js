import { initDomRefs } from "./modules/domRefs.js";
import { initFaceLandmarker } from "./modules/faceModel.js";
import { startDistanceCheck, stopDistanceCheck } from "./modules/video.js";
import { runDotCalibration } from "./modules/dotCalibration.js";

export async function initCalibration(onComplete) {
    initDomRefs();
    await initFaceLandmarker();

    const startBtn = document.getElementById("start-calibration-btn");
    const stopBtn = document.getElementById("stop-calibration-btn");
    const runBtn = document.getElementById("run-calibration-btn-overlay");

    startBtn?.addEventListener("click", startDistanceCheck);
    stopBtn?.addEventListener("click", stopDistanceCheck);
    runBtn?.addEventListener("click", () => runDotCalibration(onComplete));
}