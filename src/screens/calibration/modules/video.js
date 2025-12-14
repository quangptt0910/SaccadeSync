import {
    video,
    canvas,
    ctx,
    videoContainer,
    staticPreview,
    stopBtn,
    distanceOverlay
} from "./domRefs.js";

import { faceLandmarker } from "./faceModel.js";
import { handleDistanceState, distanceOK } from "./distance.js";
import { runningDot, abortDot, showFsWarning } from "./dotCalibration.js";

export let runningCamera = false;
let lastVideoTime = -1;

export function setCanvasSizeToVideo() {
    if (!video.videoWidth || !video.videoHeight) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(video.videoWidth * dpr);
    canvas.height = Math.round(video.videoHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    canvas.style.width = `${video.clientWidth}px`;
    canvas.style.height = `${video.clientHeight}px`;
}

export function adjustVideoContainerHeight() {
    if (!video.videoWidth || !video.videoHeight) return;
    video.style.width = "100%";
    video.style.height = "auto";
    videoContainer.style.height = `${video.clientHeight}px`;
}

export function cameraLoop() {
    if (!runningCamera) return;
    requestAnimationFrame(cameraLoop);

    if (!faceLandmarker) return;
    if (lastVideoTime === video.currentTime) return;
    lastVideoTime = video.currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    if (!video.paused && !video.ended) {
        ctx.drawImage(
            video, 0, 0,
            video.videoWidth, video.videoHeight,
            0, 0,
            canvas.width / dpr, canvas.height / dpr
        );
    }

    const results = faceLandmarker.detectForVideo(video, performance.now());

    if (!results?.faceLandmarks?.length) {
        handleDistanceState(null);
        if (runningDot && !abortDot) showFsWarning();
        return;
    }

    const landmarks = results.faceLandmarks[0];
    const ok = handleDistanceState(landmarks);

    if (runningDot && !ok && !abortDot) showFsWarning();
}

export async function startDistanceCheck() {
    if (runningCamera) return;

    runningCamera = true;

    staticPreview.classList.remove("show-flex");
    staticPreview.style.display = "none";

    distanceOverlay.classList.add("show-flex");

    stopBtn.style.display = "inline-block";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = stream;

        await new Promise(resolve =>
            video.addEventListener("loadedmetadata", resolve, { once: true })
        );

        adjustVideoContainerHeight();
        setCanvasSizeToVideo();

        video.classList.add("show");
        canvas.classList.add("show");

        await video.play();

        cameraLoop();
    } catch (err) {
        console.error("Camera error:", err);
        runningCamera = false;

        staticPreview.style.display = "flex";
        distanceOverlay.classList.remove("show-flex");
        stopBtn.style.display = "none";
        video.classList.remove("show");
        canvas.classList.remove("show");
    }
}

export function stopDistanceCheck(resetUI = true) {
    if (!runningCamera) return;

    const tracks = video.srcObject?.getTracks() || [];
    tracks.forEach(t => t.stop());
    video.srcObject = null;

    runningCamera = false;

    if (resetUI) {
        staticPreview.style.display = "flex";
        stopBtn.style.display = "none";
        distanceOverlay.classList.remove("show-flex");
        video.classList.remove("show");
        canvas.classList.remove("show");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    videoContainer.style.height = "";
}