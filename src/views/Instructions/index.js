/**
 * Instructions View Component
 *
 * Displays step-by-step instructions for the user before they begin the eye-tracking tests.
 * It explains the difference between Pro-Saccade and Anti-Saccade tasks using visual aids.
 */
import React from 'react';
import { Helmet } from 'react-helmet';
import Button from '../../components/Button';
import { useNavigate } from "react-router-dom";
import './Instructions.css';

const Instructions = () => {
    const navigate = useNavigate();

    return (
        <>
            <Helmet>
                <title>Eye Movement Test Instructions | Pro-Saccade & Anti-Saccade Tests | Saccade Sync</title>
                <meta name="description" content="Complete step-by-step instructions for Saccade Sync eye movement testing." />
            </Helmet>

            <div className="instructions-page">
                <main className="instructions-container">

                    {/* Introduction Section */}
                    <section className="intro-section">
                        <p className="intro-text">
                            Thank you for completing the calibration! You are now ready to begin the eye movement tests.
                            Please ensure you are sitting comfortably and are focused only on the monitor.
                            During the test, a red dot will appear randomly across the screen.
                            Your only job is to move your eyes to look directly at the red dot as quickly as you can,
                            every time it appears. There will be a short break between the two types of tests.
                        </p>
                    </section>

                    <hr className="divider" />

                    {/* Pro-Saccade Test Instructions */}
                    <section className="test-section">
                        <div className="section-header">
                            <h1 className="section-title">Pro-Saccade Test Instructions</h1>
                        </div>

                        <div className="visual-guide-container">
                            {/*  */}
                            <img
                                src="/assets/prosaccades.png"
                                alt="Pro-Saccade Test Visual Guide"
                                className="visual-guide-img"
                            />
                        </div>

                        <div className="instruction-details">
                            <p className="instruction-text">
                                <span className="highlight">
                                    This is the Pro-Saccade Test. This measures your basic ability to quickly move your eyes toward a target.
                                </span>
                                <br /><br />
                                <span className="bold-instruction">
                                    What to Do: A central cross will appear. Wait patiently. When the red dot flashes on the screen,
                                    immediately move your eyes to look at the dot. When the dot disappears, return your focus to the
                                    center cross to prepare for the next trial. Remember: Look at the dot as fast as possible.
                                </span>
                            </p>
                        </div>
                    </section>

                    <hr className="divider" />

                    {/* Anti-Saccade Test Instructions */}
                    <section className="test-section">
                        <div className="section-header">
                            <h2 className="section-title">Anti-Saccade Test Instructions</h2>
                        </div>

                        <div className="visual-guide-container">
                            {/*  */}
                            <img
                                src="/assets/antisaccades.png"
                                alt="Anti-Saccade Test Visual Guide"
                                className="visual-guide-img"
                            />
                        </div>

                        <div className="instruction-details">
                            <p className="instruction-text">
                                <span className="highlight">
                                    This is the Anti-Saccade Test. This is a more challenging task that measures your ability
                                    to suppress a reflex and voluntarily control your eye movements.
                                </span>
                                <br /><br />
                                <span className="bold-instruction">
                                    What to Do: A central cross will appear. Wait patiently. When the red dot flashes on the screen,
                                    you must actively ignore the dot and immediately look in the exact opposite direction.
                                    For example, if the dot appears on the left, you must look to the right.
                                    Remember: Look in the opposite direction as fast as possible.
                                </span>
                            </p>
                        </div>
                    </section>

                    {/* Start Test Button */}
                    <div className="action-area">
                        <Button
                            variant="primary"
                            onClick={() => navigate('/gameTest')}
                            fullWidth={false} // Set to true if you want it to stretch on mobile
                        >
                            Start the test
                        </Button>
                    </div>

                </main>
            </div>
        </>
    );
};

export default Instructions;