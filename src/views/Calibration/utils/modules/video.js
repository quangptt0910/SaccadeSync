import { refs } from "./domRefs.js";
import { faceLandmarker } from "./faceModel.js";
import { handleDistanceState } from "./distance.js";
import { runningDot, abortDot, showFsWarning } from "./dotCalibration.js";

/** @type {boolean} Flag indicating if the camera loop is currently active. */
export let runningCamera = false;
let lastTime = -1;

/**
 * The main animation loop for processing camera frames.
 * Captures frames from the video element, runs the face landmarker, and checks distance.
 * Also handles warning overlays during calibration if the face is lost.
 */
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

/**
 * Requests camera permissions, initializes the video stream, and starts the processing loop.
 * Also manages UI state to show video elements and hide static previews.
 * @returns {Promise<void>}
 */
export async function startDistanceCheck() {
    if (runningCamera) return;

    runningCamera = true;

    refs.staticPreview.classList.remove("show-flex");
    refs.staticPreview.style.display = "none";

    refs.video.classList.add("show");
    refs.canvas.classList.add("show");

    refs.stopBtn.style.display = "inline-block";
    refs.distanceOverlay.style.display = "flex";

    if (refs.runCalibBtnOverlay) {
        refs.runCalibBtnOverlay.style.display = "none";
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280, min: 1280 },      // Request 1280
                height: { ideal: 720, min: 720 },       // Request 720
                frameRate: { ideal: 30 },
                facingMode: "user"
            },
            audio: false,
        });

        refs.video.srcObject = stream;
        await refs.video.play();
        cameraLoop();
    } catch (err) {
        console.error("Camera error:", err);
        stopDistanceCheck();

        if (refs.permissionModal) {
            refs.permissionModal.style.display = "flex";
        } else {
            alert("Camera access denied. Please enable camera permissions to continue.");
        }
    }
}

/**
 * Stops the camera stream, releases tracks, and resets the UI to the static preview state.
 */
export function stopDistanceCheck() {
    runningCamera = false;

    if (refs.video.srcObject) {
        refs.video.srcObject.getTracks().forEach(t => t.stop());
    }
    refs.video.srcObject = null;

    refs.video.classList.remove("show");
    refs.canvas.classList.remove("show");

    refs.staticPreview.classList.add("show-flex");
    refs.staticPreview.style.display = "flex";

    refs.stopBtn.style.display = "none";
    refs.distanceOverlay.style.display = "none";

    console.log("Distance check stopped")
}