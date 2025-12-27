import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { initCalibration } from "./utils/calibration";
import { setCalibrationResult } from "../../store/calibrationSlice";
import { selectUser } from "../../store/authSlice";
import Button from "../../components/Button";
import "./Calibration.css";

export default function Calibration() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const user = useSelector(selectUser);
    const [calibrationStatus, setCalibrationStatus] = useState("idle"); // 'idle' | 'success' | 'failed'

    useEffect(() => {
        // Structured helper to handle Firebase persistence
        const saveCalibrationToFirebase = async (uid, data) => {
            try {
                const calibrationRef = collection(db, "users", uid, "calibrations");
                await addDoc(calibrationRef, {
                    timestamp: serverTimestamp(),
                    model: data.calibrationModel,
                    metrics: data.metrics,
                    userAgent: navigator.userAgent
                });
                console.log("Calibration data successfully saved to Firebase.");
            } catch (error) {
                console.error("Error saving calibration data:", error);
                // dispatch an error toast action here
            }
        };

        const handleCalibrationComplete = async (data) => {
            console.log("Calibration finished:", data);

            // Ensure the test was actually performed and generated sufficient data
            // If gazeData is empty or very small, it likely means the test was aborted or failed early.
            if (!data || !data.gazeData || data.gazeData.length < 10) {
                console.log("Calibration aborted or insufficient data collected. Skipping save and accuracy check.");
                return;
            }

            // 1. Save to Redux Store (Global State)
            dispatch(setCalibrationResult(data));

            // 2. Save to Firebase (Persistence)
            if (user?.uid) {
                await saveCalibrationToFirebase(user.uid, data);
            }

            // 3. Check Accuracy Threshold
            // Note: data.metrics.details contains the raw accuracy numbers (0.0 - 1.0)
            const leftAcc = data.metrics?.details?.left || 0;
            const rightAcc = data.metrics?.details?.right || 0;
            const threshold = 0.8;

            if (leftAcc > threshold || rightAcc > threshold) {
                setCalibrationStatus("success");
            } else {
                setCalibrationStatus("failed");
            }
        };

        initCalibration(handleCalibrationComplete);
    }, [dispatch, user]);

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

                {/* Post-Calibration Actions */}
                {calibrationStatus === "success" && (
                    <div className="calibration-actions" style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>
                        <p style={{ color: '#27ae60', fontWeight: 'bold', marginBottom: '1rem' }}>
                            Calibration Successful! You may proceed.
                        </p>
                        <Button 
                            className="btn--primary" 
                            onClick={() => navigate("/gameTest")}
                        >
                            Proceed to Game Test
                        </Button>
                    </div>
                )}

                {calibrationStatus === "failed" && (
                    <div className="calibration-actions" style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>
                        <p style={{ color: '#c0392b', fontWeight: 'bold', marginBottom: '1rem' }}>
                            Accuracy too low. Please try again.
                        </p>
                        <Button className="btn--secondary" onClick={() => window.location.reload()}>Retry Calibration</Button>
                    </div>
                )}
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