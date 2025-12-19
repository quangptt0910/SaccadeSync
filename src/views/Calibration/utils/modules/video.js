import { refs } from "./domRefs.js";
import { faceLandmarker } from "./faceModel.js";
import { handleDistanceState } from "./distance.js";
import { runningDot, abortDot, showFsWarning } from "./dotCalibration.js";

export let runningCamera = false;
let lastTime = -1;

export function cameraLoop() {
    if (!runningCamera) return;
    requestAnimationFrame(cameraLoop);

    if (!faceLandmarker) return;
    if (refs.video.currentTime === lastTime) return;
    lastTime = refs.video.currentTime;

    refs.ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);

    const res = faceLandmarker.detectForVideo(
        refs.video,
        performance.now()
    );

    if (!res?.faceLandmarks?.length) {
        handleDistanceState(null);
        if (runningDot && !abortDot) showFsWarning();
        return;
    }

    const ok = handleDistanceState(res.faceLandmarks[0]);
    if (runningDot && !ok && !abortDot) showFsWarning();
}

export async function startDistanceCheck() {
    if (runningCamera) return;

    runningCamera = true;
    refs.stopBtn.style.display = "inline-block";
    refs.distanceOverlay.style.display = "flex";

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
    });

    refs.video.srcObject = stream;
    await refs.video.play();
    cameraLoop();
}

export function stopDistanceCheck() {
    runningCamera = false;
    refs.video.srcObject?.getTracks().forEach(t => t.stop());
    refs.video.srcObject = null;
}