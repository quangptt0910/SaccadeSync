import React from "react";
import { Helmet } from "react-helmet";
import Button from "../../components/Button";
import { useNavigate } from "react-router-dom";
import "./CalibrationIntro.css";

const CalibrationIntro = () => {
    const navigate = useNavigate();

    return (
        <>
            <Helmet>
                <title>Calibration Instructions | Saccade Sync</title>
            </Helmet>

            <div className="calibration-intro-page">
                <main className="calibration-intro-container">

                    <h1>Eye Tracking Calibration</h1>

                    <p>
                        Before starting the eye movement tests, we need to calibrate the eye-tracking system.
                        This allows us to accurately track where you are looking on the screen.
                    </p>

                    <p>
                        Please make sure:
                    </p>

                    <ul>
                        <li>You are sitting comfortably, facing the screen</li>
                        <li>Your face is clearly visible to the camera</li>
                        <li>The lighting in the room is stable</li>
                        <li>You keep your head as still as possible</li>
                    </ul>

                    <p>
                        During calibration, dots will appear on the screen.
                        Please look directly at each dot until it disappears.
                    </p>

                    <div className="action-area">
                        <Button
                            variant="primary"
                            onClick={() => navigate("/calibration")}
                        >
                            Start calibration
                        </Button>
                    </div>

                </main>
            </div>
        </>
    );
};

export default CalibrationIntro;