export const video = document.getElementById("calibration-video");
export const canvas = document.getElementById("calibration-canvas");
export const ctx = canvas.getContext("2d");

export const videoContainer = document.querySelector(".video-container");
export const staticPreview = document.getElementById("static-preview");

export const statusEl = document.getElementById("distance-status");
export const startBtn = document.getElementById("start-calibration-btn");
export const stopBtn = document.getElementById("stop-calibration-btn");

export const distanceOverlay = document.getElementById("distance-overlay");
export const overlayStatusText = document.getElementById("overlay-status-text");
export const overlayInstructions = document.getElementById("overlay-instructions");

export const runCalibBtnOverlay = document.getElementById("run-calibration-btn-overlay");

export const parameterDisplay = document.getElementById("calibration-parameters");

export const dotStage = document.getElementById("dot-stage");
export const calDot = document.getElementById("cal-dot");

export const fsWarning = document.getElementById("fs-warning");
export const fsWarningPanel = fsWarning.querySelector(".panel");