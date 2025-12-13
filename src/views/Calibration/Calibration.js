import React, { useEffect } from "react";
import "../../screens/calibration/calibration";
import "./calibration.css";

const Calibration = () => {
    useEffect(() => {
        if (window.initCalibration) {
            window.initCalibration();
        }
    }, []);

    return (
        <div id="calibration-root">
            <h1>CALIBRATION SCREEN (TEST)</h1>
            <p>calibration mounted correctly</p>

            <button id="finishCalibrationBtn">
                Finish calibration (test)
            </button>
        </div>
    );
};

export default Calibration;
