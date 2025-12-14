import React, { useEffect } from "react";
import { initCalibration } from "../../screens/calibration/calibration";
import "./Calibration.css";

export default function Calibration() {
    useEffect(() => {
        initCalibration();
    }, []);

    return (
        <div id="calibration-root">
            <div className="video-container">
                <video id="calibration-video" muted playsInline />
                <canvas id="calibration-canvas" />
            </div>

            <div id="static-preview">Camera preview</div>

            <div id="distance-overlay">
                <h2 id="overlay-status-text"></h2>
                <p id="overlay-instructions"></p>
                <button id="run-calibration-btn-overlay">Run Calibration</button>
            </div>

            <div id="distance-status"></div>

            <button id="start-calibration-btn">Start Check</button>
            <button id="stop-calibration-btn">Stop</button>

            <div id="dot-stage">
                <div id="cal-dot"></div>
            </div>

            <div id="fs-warning">
                <div className="panel">Calibration interrupted</div>
            </div>

            <div id="calibration-parameters"></div>
        </div>
    );
}
