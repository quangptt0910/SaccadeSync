import React, {useState, useEffect, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCalibrationModel, selectIsCalibrated, setCalibrationResult } from '../../store/calibrationSlice';
import { selectUser } from '../../store/authSlice';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import Modal from '../../components/Modal';
import './GameTest.css';
import {
    analyzeSaccadeData,
    aggregateTrialStatistics,
    compareProVsAnti
} from './utils/saccadeData';
import IrisFaceMeshTracker from "./utils/iris-facemesh";


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

    // start the test with the pro saccades
    const handleStartProTest = async () => {
        enterFullScreen(); // 1. Go Full Screen

        // 2. Initialize and start iris tracking
        if (!irisTracker.current) {
            irisTracker.current = new IrisFaceMeshTracker();
            await irisTracker.current.initialize();
        }

        // Pass calibration model if available and valid
        // We check Redux state again here
        if (isCalibrated && isModelValid(calibrationModel)) {
            console.log("Using calibration model:", calibrationModel);
            irisTracker.current.setCalibrationModel(calibrationModel);
        } else {
            console.warn("No valid calibration found (isCalibrated=" + isCalibrated + "). Using raw iris data.");
        }

        await irisTracker.current.startTracking();

        setIsStarted(true); // 3. Start the logic

    };


    // start the second phase which is the anti saccades
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
                await wait(getFixationTime());

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
                const dotAppearanceTime = irisTracker.current
                    ? Date.now() - irisTracker.current.startTime
                    : Date.now();

                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, side);
                }
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, `${testPhase}-${side}`);
                }
                await wait(sideDotShowTime);

                if (irisTracker.current) {
                    // Now get the data, which includes the movement that just happened
                    const allData = irisTracker.current.getTrackingData();

                    // Analyze from the moment the dot appeared until now
                    // Using new analyzeSaccadeData from saccadeData.js
                    const analysis = analyzeSaccadeData(allData, dotAppearanceTime, {
                        requireValidData: true,
                        minLatency: 50,
                        maxLatency: 600
                    });

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

                // Update results state
                setTestResults(prev => ({
                    ...prev,
                    [testPhase]: {
                        trials: currentPhaseTrials,
                        stats: phaseStats
                    }
                }));

                if (testPhase === 'pro') {
                    // If we just finished Pro-Saccade, trigger break time
                    setShowBreak(true);
                } else {
                    // If we just finished Anti-Saccade, Finish the game
                    
                    // Perform final comparison
                    // Note: We need to use the functional update of setTestResults or a ref to access the 'pro' stats we just saved
                    // But since setTestResults is async, we can't rely on 'testResults.pro' being updated yet in this closure.
                    // However, we have 'currentPhaseTrials' (which is anti) and we can assume 'testResults.pro' was set in the previous run.
                    // Actually, 'testResults' in this closure is stale (from render start).
                    // Better to use a ref for immediate access or just calculate comparison later/in a separate effect.
                    // For simplicity, let's just finish here and let the Results page handle display, 
                    // or calculate comparison using the functional update pattern if we want to save it now.
                    
                    setTestResults(prev => {
                        const proStats = prev.pro.stats;
                        const antiStats = phaseStats; // current phase is anti
                        const comparison = compareProVsAnti(proStats, antiStats);
                        console.log("Final Comparison:", comparison);
                        
                        return {
                            ...prev,
                            [testPhase]: {
                                trials: currentPhaseTrials,
                                stats: phaseStats
                            },
                            comparison: comparison
                        };
                    });

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
