export const refs = {};

export function initDomRefs() {
    refs.video = document.getElementById("calibration-video");
    refs.canvas = document.getElementById("calibration-canvas");
    refs.ctx = refs.canvas.getContext("2d");

    refs.videoContainer = document.querySelector(".video-container");
    refs.staticPreview = document.getElementById("static-preview");

    refs.statusEl = document.getElementById("distance-status");
    refs.startBtn = document.getElementById("start-calibration-btn");
    refs.stopBtn = document.getElementById("stop-calibration-btn");

    refs.distanceOverlay = document.getElementById("distance-overlay");
    refs.overlayStatusText = document.getElementById("overlay-status-text");
    refs.overlayInstructions = document.getElementById("overlay-instructions");
    refs.runCalibBtnOverlay =
        document.getElementById("run-calibration-btn-overlay");

    refs.parameterDisplay =
        document.getElementById("calibration-parameters");

    refs.dotStage = document.getElementById("dot-stage");
    refs.calDot = document.getElementById("cal-dot");

    refs.fsWarning = document.getElementById("fs-warning");
    refs.fsWarningPanel = refs.fsWarning.querySelector(".panel");
}