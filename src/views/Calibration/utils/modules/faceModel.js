import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const { FaceLandmarker, FilesetResolver } = vision;

/**
 * Global reference to the MediaPipe FaceLandmarker instance.
 * @type {FaceLandmarker|null}
 */
export let faceLandmarker = null;

/**
 * Initializes the MediaPipe FaceLandmarker with GPU delegation.
 * Loads the WASM files and the specific face landmarker model asset.
 *
 * @returns {Promise<void>} Resolves when the model is ready.
 */
export async function initFaceLandmarker() {

    const resolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
    });
}