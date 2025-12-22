import React, { useEffect } from "react";
import { initCalibration } from "./utils/calibration";
import "./Calibration.css";

export default function Calibration() {
    useEffect(() => {
        initCalibration();
    }, []);

    return (
        <div id="calibration-root">
            <div className="calibration-card">

                <h2 className="calibration-title">Gaze Calibration</h2>

                <p className="calibration-intro">
                    Before starting the test, we need to calibrate the system to
                    your gaze. This short process ensures accurate and
                    personalized measurements.
                </p>

                <div className="calibration-section">
                    <h3>Why this is needed</h3>
                    <p>
                        Everyone looks at the screen differently. Calibration
                        allows the system to learn how your eyes move and map
                        your gaze precisely during the experiment.
                    </p>
                </div>

                <div className="calibration-section">
                    <h3>How calibration works</h3>
                    <ol className="calibration-steps">
                        <li>
                            <strong>Distance check</strong>
                            <span>
                                We verify that you are seated at the optimal
                                distance. For best results, keep your face about
                                <strong> 0.5 meters </strong> from the camera.
                            </span>
                        </li>
                        <li>
                            <strong>Dot familiarization</strong>
                            <span>
                                You will follow a dot on the screen while the
                                system collects calibration data.
                            </span>
                        </li>
                        <li>
                            <strong>Personalized model</strong>
                            <span>
                                The collected data is used to personalize gaze
                                tracking for all subsequent tests.
                            </span>
                        </li>
                    </ol>
                </div>

                <div className="calibration-note">
                    Sit still, face the screen directly, and avoid sudden
                    movements during calibration.
                </div>

                <div className="calibration-divider" />

                <p className="instruction-text">Step 1 — Distance Check</p>

                <div className="video-container">
                    <video
                        id="calibration-video"
                        playsInline
                        muted
                    />
                    <canvas id="calibration-canvas" />

                    <div id="static-preview" className="show-flex">
                        <h3>Distance check</h3>
                        <p>
                            Click <strong>Start Check</strong> to begin
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
                        <p id="overlay-instructions">Loading a camera...</p>
                        <button
                            id="run-calibration-btn-overlay"
                            className="btn btn-primary"
                        >
                            Run Calibration
                        </button>
                    </div>
                </div>

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
                        <h3>Distance Failure</h3>
                        <p>Please adjust your distance.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}