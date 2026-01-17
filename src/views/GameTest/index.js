/**
 * GameTest View Component
 *
 * This is the core testing component of the application. It orchestrates the visual stimuli
 * and records the user's eye movements using the webcam (via IrisFaceMeshTracker).
 *
 * Test Flow:
 * 1. Checks for valid calibration.
 * 2. Pro-Saccade Phase: User looks AT the target.
 * 3. Break.
 * 4. Anti-Saccade Phase: User looks AWAY from the target.
 * 5. Data Analysis & Saving to Firebase.
 *
 * It handles full-screen management and trial timing (Fixation -> Gap -> Target).
 */
import React, {useState, useEffect, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCalibrationModel, selectIsCalibrated, setCalibrationResult } from '../../store/calibrationSlice';
import { selectUser } from '../../store/authSlice';
import { db } from '../../firebase';
import {collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp} from 'firebase/firestore';
import Modal from '../../components/Modal';
import './GameTest.css';
import {
    analyzeSaccadeData,
    aggregateTrialStatistics,
    compareProVsAnti
} from './utils/saccadeData';
import IrisFaceMeshTracker from "./utils/iris-facemesh";
import {calculatePerTrialThreshold} from "./utils/velocityConfig";


const GameTest = () => {

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const calibrationModel = useSelector(selectCalibrationModel);
    const isCalibrated = useSelector(selectIsCalibrated);
    const user = useSelector(selectUser);

    // state management
    const [isStarted, setIsStarted] = useState(false);
    const [dotPosition, setDotPosition] = useState('hidden');
    const [trialCount, setTrialCount] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [isLoadingCalibration, setIsLoadingCalibration] = useState(false);

    // track which test it will be and the break
    const [testPhase, setTestPhase] = useState('pro');
    const [showBreak, setShowBreak] = useState(false);

    // calculated results for final report
    // Structure: { pro: { trials: [], stats: {} }, anti: { trials: [], stats: {} }, comparison: {} }
    const [testResults, setTestResults] = useState({
        pro: { trials: [], stats: null },
        anti: { trials: [], stats: null },
        comparison: null
    });

    const irisTracker = useRef(null);

    // trial parameters
    const trialsAmount = 10;
    const breakTime = 60000;
    const interTrialInterval = 1000;

    // test parameters
    const gapTimeBetweenCenterDot = 200;
    const maxFixation = 2500;
    const minFixation = 1000;
    const sideDotShowTime = 1000;
    const sideDotHideTime = 1000;

    // This tracks if the component is currently on the screen
    const mounted = useRef(true);

    // Helper to check if model is valid (not all zeros)
    const isModelValid = (model) => {
        if (!model || !model.left || !model.left.coefX) return false;
        // Check if at least one coefficient in left eye X is non-zero
        return model.left.coefX.some(c => c !== 0);
    };



    // Fetch calibration from Firebase if not in Redux
    useEffect(() => {
        const fetchCalibration = async () => {
            console.log("Fetching calibration. isCalibrated:", isCalibrated, "model valid:", isModelValid(calibrationModel));

            // If we are already calibrated and model is valid, no need to fetch
            if (isCalibrated && isModelValid(calibrationModel)) return;
            
            if (!user?.uid) return;

            // Load the latest calibration
            setIsLoadingCalibration(true);
            try {
                console.log("Fetching calibration from Firebase for user:", user.uid);
                const q = query(
                    collection(db, "users", user.uid, "calibrations"),
                    orderBy("timestamp", "desc"),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const docData = querySnapshot.docs[0].data();
                    console.log("Calibration found in Firebase:", docData);
                    
                    if (docData.model && isModelValid(docData.model)) {
                        dispatch(setCalibrationResult({
                            model: docData.model,
                            metrics: docData.metrics || {},
                            gazeData: [] // Gaze data not needed for game
                        }));
                        console.log("Restored calibration to Redux");
                    } else {
                        console.warn("Fetched calibration model is invalid (zeros)");
                    }
                } else {
                    console.log("No calibration found in Firebase");
                }
            } catch (e) {
                console.error("Error fetching calibration:", e);
            } finally {
                setIsLoadingCalibration(false);
            }
        };

        fetchCalibration();
    }, [isCalibrated, user, dispatch]); // Removed calibrationModel from deps to avoid loops, relying on isCalibrated


    // Save calculated metric data to Firebase Firestore
    const saveMetricsToFirebase = async (uid, data) => {
        try {
            const metricsRef = collection(db, "users", uid, "saccadeMetrics");
            await addDoc(metricsRef, {
                timestamp: serverTimestamp(),
                comparison: data.comparison,
                pro: data.pro,
                anti: data.anti,
                totalTrials: trialsAmount * 2
            });

            console.log("Saccade metrics successfully saved to Firebase");
        } catch (error) {
            console.error("Error saving saccade metric data", error);
        }
    }


    // full screen logic
    const enterFullScreen = () => {
        const elem = document.documentElement; // The whole page
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
        }
    };

    // Initialize and start the Pro-Saccade test phase
    const handleStartProTest = async () => {
        enterFullScreen(); // 1. Go Full Screen

        // Wait for calibration to be ready
        let attempts = 0;
        while ((!isCalibrated || !isModelValid(calibrationModel)) && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        // 2. Initialize and start iris tracking
        if (!irisTracker.current) {
            irisTracker.current = new IrisFaceMeshTracker();
            await irisTracker.current.initialize();
        }

        // Pass calibration model if available and valid
        // We check Redux state again here
        const currentModel = calibrationModel;
        if (isCalibrated && isModelValid(currentModel)) {
            console.log("Using calibration model:", currentModel);
            irisTracker.current.setCalibrationModel(currentModel);
        } else {
            console.error("NO VALID CALIBRATION - Will use raw data");
            // Add user warning here
        }

        await irisTracker.current.startTracking();

        setIsStarted(true); // 3. Start the logic

    };


    // Initialize and start the Anti-Saccade test phase (after break)
    const handleStartAntiTest = async () => {
        enterFullScreen();

        setTrialCount(0);

        // change the phase to be anti
        setTestPhase('anti');
        setShowBreak(false);
    };


    // Cleanup function: sets mounted to false when you leave the page
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (irisTracker.current) {
                irisTracker.current.cleanup();
            }
        };
    }, []);

    // helper to get random time per trial that center dot stays on the screen
    const getFixationTime = () =>
        Math.floor(Math.random() * (maxFixation - minFixation) + minFixation);

    // the wait function
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // use a ref to store data
    const resultsRef = useRef({
        pro: {state: null },
        anti: {state: null },
        comparison: null
    })

    // Main Test Loop: Handles the timing and logic for each trial
    useEffect(() => {
        if (!isStarted || isFinished || showBreak) return; // Don't run logic yet

        const runTest = async () => {
            await wait(1000); // Buffer time

            // collect results for the saccade parameters
            const currentPhaseTrials = [];

            if (irisTracker.current) {
                // Useful marker in your CSV to know where phase 2 starts
                irisTracker.current.addTrialContext(0, `START_${testPhase.toUpperCase()}_PHASE`);
            }


            for (let i = 0; i < trialsAmount; i++) {
                if (!mounted.current) break;
                setTrialCount(i + 1);

                // 1. Fixation
                setDotPosition('center');
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, `${testPhase} - center`);
                }
                // Record when fixation starts
                const fixationStartTime = irisTracker.current.getRelativeTime();

                await wait(getFixationTime());

                // Record when fixation ends
                const fixationEndTime = irisTracker.current.getRelativeTime();

                let trialThreshold = 30;

                if (irisTracker.current) {
                    const allData = irisTracker.current.getTrackingData();

                    console.log("Fixation Window:", fixationStartTime, "-", fixationEndTime);
                    console.log("Data sample:", allData.slice(-1)[0]?.timestamp);

                    const fixationVelocities = allData
                        .filter(frame =>
                            frame.timestamp >= fixationStartTime &&
                            frame.timestamp <= fixationEndTime &&
                            frame.velocity !== undefined &&
                            frame.velocity !== null &&
                            !isNaN(frame.velocity) &&
                            frame.velocity < 300
                        )
                        .map(frame => frame.velocity);

                    if (fixationVelocities.length >= 20) {
                        trialThreshold = calculatePerTrialThreshold(fixationVelocities);
                    } else {
                        console.warn(`Trial ${i+1}: Insufficient fixation data (${fixationVelocities.length} samples). Using default threshold: 30 deg/s`);
                    }
                }

                // 2. Gap
                if (!mounted.current) break;
                setDotPosition('hidden');
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, `${testPhase} - gap`);
                }
                await wait(gapTimeBetweenCenterDot);

                // 3. Target
                if (!mounted.current) break;
                const side = Math.random() > 0.5 ? 'left' : 'right';

                setDotPosition(side);

                const dotAppearanceTime = irisTracker.current.getRelativeTime();

                // if (irisTracker.current) {
                //     irisTracker.current.addTrialContext(i + 1, side);
                // }
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, `${testPhase}-${side}`);
                }
                await wait(sideDotShowTime);

                if (irisTracker.current) {
                    // Now get the data, which includes the movement that just happened
                    const allData = irisTracker.current.getTrackingData();

                    const analysis = analyzeSaccadeData(allData, dotAppearanceTime, {
                        requireValidData: true,
                        minLatency: 50,
                        maxLatency: 600,
                        adaptiveThreshold: trialThreshold
                    });

                    analysis.trailId = i + 1;
                    analysis.targetSide = side;

                    // This should now print a real number (e.g., 200-500 deg/s)
                    console.log(`Phase: ${testPhase}, Trial ${i+1}, Peak Velocity: ${analysis.peakVelocity}, isSaccade: ${analysis.isSaccade}`);

                    // Store result
                    currentPhaseTrials.push(analysis);
                }

                // 4. Interval
                if (!mounted.current) break;
                setDotPosition('hidden');
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, `${testPhase} - interval`);
                }
                await wait(interTrialInterval);
            }

            if (mounted.current) {
                // Calculate statistics for this phase
                const phaseStats = aggregateTrialStatistics(currentPhaseTrials, testPhase);
                console.log(`${testPhase} Phase Stats:`, phaseStats);

                setTestResults(prev => ({
                    ...prev,
                    [testPhase]: {
                        trials: currentPhaseTrials,
                        stats: phaseStats
                    }
                }));

                // Update results state
                resultsRef.current = {
                    ...resultsRef.current,
                    [testPhase]: {
                        stats: phaseStats
                    }
                };

                if (testPhase === 'pro') {
                    // If we just finished Pro-Saccade, trigger break time
                    console.log("Saccade Analysis Data:", currentPhaseTrials);
                    setShowBreak(true);
                } else {
                    // If we just finished Anti-Saccade, Finish the game
                    console.log("Anti-Saccade Analysis Data:", currentPhaseTrials);
                    const proStats = resultsRef.current.pro.stats;
                    const antiStats = phaseStats;
                    const comparison = compareProVsAnti(proStats, antiStats);

                    resultsRef.current.comparison = comparison;
                    
                    setTestResults(prev => ({ ...prev, comparison }));

                    await saveMetricsToFirebase(user.uid, resultsRef.current);

                    if (irisTracker.current) {
                        irisTracker.current.stopTracking();
                        setTimeout(() => {
                            irisTracker.current.exportCSV();
                        }, 1000);
                    }
                    setIsFinished(true);
                    if (document.exitFullscreen) await document.exitFullscreen();
                }
            }
        };

        runTest();
    }, [isStarted, testPhase, showBreak, isFinished]);

    return (
        <div className="GameTest">

            {!isStarted && !isFinished && (
                    <Modal
                        show={!isStarted}
                        title="Saccade Test"
                        message={isLoadingCalibration ? "Loading calibration..." : "The test will run in full screen. You will start with the Pro-Saccade test. When the dot appears on the screen, you need to look at the dot."}
                        buttonText={isLoadingCalibration ? "Please Wait" : "Start Test"}
                        onConfirm={() => {handleStartProTest()}}
                        disabled={isLoadingCalibration}
                    />
            )}

            <Modal
                show={showBreak}
                title="Pro-Saccade Test Completed"
                message={"The first phase is completed. Now you will start the Anti-Saccade test. When the dot appears on the screen, you need to look in the opposite direction of the dot."}
                buttonText={isLoadingCalibration ? "Please Wait" : "Start Test"}
                onConfirm={() => {handleStartAntiTest()}}
                disabled={isLoadingCalibration}
            />

            {isStarted && !showBreak && !isFinished && (
                <>
                    <div className="trial-counter">
                        Phase: {testPhase === 'pro' ? 'Pro-Saccade' : 'Anti-Saccade'}
                        Trial: {trialCount} / {trialsAmount}
                    </div>

                    {!isFinished && (
                        <>
                            {dotPosition === 'center' && <div className="dot center-dot"></div>}
                            {dotPosition === 'left'   && <div className="dot left-dot"></div>}
                            {dotPosition === 'right'  && <div className="dot right-dot"></div>}
                        </>
                    )}
                </>
            )}

            <Modal
                show={isFinished}
                title="Test Complete!"
                message="You have successfully completed the Saccade test. Click below to view your analysis."
                buttonText="View Results"
                onConfirm={() => navigate('/results', { state: { results: testResults } })}
            />

        </div>
    )
}

export default GameTest;