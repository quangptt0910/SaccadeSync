import React, { useEffect } from "react";
import { initCalibration } from "../../screens/calibration/calibration";
import "./Calibration.css";

export default function Calibration() {
    useEffect(() => {
        initCalibration();
    }, []);

    return (
        <div id="calibration-root">
            <div className="calibration-card">
                <h2>Gaze Calibration Setup</h2>
                <p className="instruction-text">Step 1: Distance Check.</p>

                <div className="video-container">
                    <video
                        id="calibration-video"
                        autoPlay
                        playsInline
                        muted
                    />
                    <canvas id="calibration-canvas" />

                    <div id="static-preview" className="show-flex">
                        <h3>CAMERA PREVIEW</h3>
                        <p>
                            Click <strong>'Start Check'</strong> to begin gaze calibration.
                        </p>
                        <button
                            id="start-calibration-btn"
                            className="btn btn-primary"
                        >
                            Start Check
                        </button>
                    </div>

                    <div id="distance-overlay">
                        <p id="overlay-status-text">SYSTEM INACTIVE</p>
                        <p id="overlay-instructions">Click Start Check</p>

                        <button
                            id="run-calibration-btn-overlay"
                            className="btn btn-primary"
                        >
                            Run Calibration
                        </button>
                    </div>
                </div>

                <p id="distance-status">STATUS: AWAITING START</p>

                <button
                    id="stop-calibration-btn"
                    className="btn btn-danger"
                    style={{ display: "none" }}
                >
                    Stop Check
                </button>

                <div id="calibration-parameters" />
            </div>

            <div id="dot-stage">
                <div id="cal-dot" />

                <div id="fs-warning">
                    <div className="panel">
                        <h3>DISTANCE FAILURE</h3>
                        <p>Please adjust distance.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}