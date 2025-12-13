console.log("calibration.js loaded");

function initCalibration() {
    console.log("Calibration initialized");

    const finishBtn = document.getElementById("finishCalibrationBtn");

    if (finishBtn) {
        finishBtn.addEventListener("click", () => {
            console.log("Calibration finished (test)");
            window.location.href = "/instructions";
        });
    } else {
        console.warn("Finish button not found");
    }
}

window.initCalibration = initCalibration;
