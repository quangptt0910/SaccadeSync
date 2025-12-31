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
        let cleanupFunc = null;

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

            // Check Accuracy Threshold
            // Note: data.metrics.details contains the raw accuracy numbers (0.0 - 1.0)
            const leftAcc = data.metrics?.details?.left || 0;
            const rightAcc = data.metrics?.details?.right || 0;
            const threshold = 0.85;

            if (leftAcc > threshold || rightAcc > threshold) {
                // 1. Save to Redux Store (Global State)
                dispatch(setCalibrationResult(data));

                // 2. Save to Firebase (Persistence)
                if (user?.uid) {
                    await saveCalibrationToFirebase(user.uid, data);
                }
                setCalibrationStatus("success");
            } else {
                setCalibrationStatus("failed");
            }
        };

        const init = async () => {
            cleanupFunc = await initCalibration(handleCalibrationComplete);
        };

        init();

        return () => {
            if (cleanupFunc) cleanupFunc();
        };
    }, [dispatch, user]);

    return (
        <div className="calibration-page">
            <div className="calibration-container">

                <section>
                    <h1 className="cal-section-title">Gaze Calibration</h1>
                    <p className="cal-intro-text">
                        Before starting the test, we need to calibrate the system to your gaze.
                        This short process ensures accurate and personalized measurements for the experiments.
                    </p>
                </section>

                <hr className="cal-divider" />

                <section>
                    <h2 className="cal-section-title">How it works</h2>
                    <div className="cal-instruction-text">
                        <ul className="cal-steps-list">
                            <li>
                                <strong>1. Distance Check:</strong> We verify you are seated at the optimal distance (approx. 0.5 meters).
                            </li>
                            <li>
                                <strong>2. Follow the Dot:</strong> You will follow a red dot on the screen while keeping your head still.
                            </li>
                            <li>
                                <strong>3. Personalization:</strong> The system builds a custom model for your eyes.
                            </li>
                        </ul>
                    </div>
                </section>

                <hr className="cal-divider" />

                <section>
                    <h2 className="cal-section-title">Step 1: Distance Check</h2>
                    <p className="cal-instruction-text" style={{marginBottom: '20px'}}>
                        Please center your face in the camera view below.
                    </p>

                    <div className="cal-video-wrapper">
                        <div className="video-box">
                            <div className="video-container">
                                <video id="calibration-video" playsInline muted />
                                <canvas id="calibration-canvas" />

                                <div id="static-preview" className="show-flex">
                                    <h3>Camera Access</h3>
                                    <p style={{marginBottom:'1rem', color:'#666'}}>
                                        Click Start to activate your camera for the distance check.
                                    </p>

                                    <button
                                        id="start-calibration-btn"
                                        className="btn btn-primary"
                                    >
                                        Start Check
                                    </button>
                                </div>

                                <div id="distance-overlay">
                                    <p id="overlay-status-text" style={{fontSize: '1.2rem', fontWeight:'bold', marginBottom:'0.5rem'}}>SYSTEM INACTIVE</p>
                                    <p id="overlay-instructions" style={{marginBottom:'1.5rem'}}>Loading camera...</p>

                                    <button
                                        id="run-calibration-btn-overlay"
                                        className="btn btn-primary"
                                    >
                                        Run Calibration
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="cal-action-area">
                            <button
                                id="stop-calibration-btn"
                                className="btn btn-danger"
                                style={{
                                    display: "none",
                                    marginTop: '15px'
                                }}
                            >
                                Stop Check
                            </button>
                        </div>
                    </div>
                </section>

                {calibrationStatus === "success" && (
                    <div className="calibration-feedback feedback-success">
                        <h3 style={{color: '#065f46', marginBottom: '10px', fontSize: '1.5rem'}}>Calibration Successful</h3>
                        <p style={{marginBottom: '20px', color: '#374151'}}>
                            Your gaze data has been recorded accurately. You are ready to proceed.
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => navigate("/instructions")}
                        >
                            Proceed to Instructions
                        </Button>
                    </div>
                )}

                {calibrationStatus === "failed" && (
                    <div className="calibration-feedback feedback-failed">
                        <h3 style={{color: '#991b1b', marginBottom: '10px', fontSize: '1.5rem'}}>Calibration Inaccurate</h3>
                        <p style={{marginBottom: '20px', color: '#374151'}}>
                            We couldn't get a clear reading. Please ensure you are well lit and sitting still.
                        </p>
                        <button
                            className="btn btn-secondary"
                            onClick={() => window.location.reload()}
                            style={{backgroundColor: '#f3f4f6', color: '#1f2937', border: '1px solid #d1d5db'}}
                        >
                            Retry Calibration
                        </button>
                    </div>
                )}

                <div id="calibration-parameters" style={{ display: 'none'}} />
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