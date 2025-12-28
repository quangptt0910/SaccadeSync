import React, {useState, useEffect, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCalibrationModel, selectIsCalibrated, setCalibrationResult } from '../../store/calibrationSlice';
import { selectUser } from '../../store/authSlice';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import Modal from '../../components/Modal';
import './GameTest.css';
import IrisFaceMeshTracker from "./utils/iris-facemesh";
import {analyzeSaccadeData} from './utils/saccadeData';

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

    // calculated results for final report
    const [testResults, setTestResults] = useState([]);

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

    const handleStartTest = async () => {
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
        if (!isStarted) return; // Don't run logic yet

        const runTest = async () => {
            await wait(1000); // Buffer time

            // collect results for the saccade parameters
            const currentSessionResults = []

            for (let i = 0; i < trialsAmount; i++) {
                if (!mounted.current) break;
                setTrialCount(i + 1);

                // 1. Fixation
                setDotPosition('center');
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, 'center');
                }
                await wait(getFixationTime());

                // 2. Gap
                if (!mounted.current) break;
                setDotPosition('hidden');
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, 'gap');
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
                await wait(sideDotShowTime);

                if (irisTracker.current) {
                    // Now get the data, which includes the movement that just happened
                    const allData = irisTracker.current.getTrackingData();

                    // Analyze from the moment the dot appeared until now
                    const analysis = analyzeSaccadeData(allData, dotAppearanceTime);

                    // This should now print a real number (e.g., 200-500 deg/s)
                    console.log(`Trial ${i+1} Peak Velocity:`, analysis.peakVelocity);

                    // Store result if needed
                    // currentSessionResults.push(analysis);
                }

                // 4. Interval
                if (!mounted.current) break;
                setDotPosition('hidden');
                if (irisTracker.current) {
                    irisTracker.current.addTrialContext(i + 1, 'interval');
                }
                await wait(interTrialInterval);
            }

            if (mounted.current) {
                // Stop tracking and export data
                if (irisTracker.current) {
                    irisTracker.current.stopTracking();
                    setTimeout(() => {
                        irisTracker.current.exportCSV();
                    }, 1000); // slight delay to ensure all data is processed
                }
                setIsFinished(true);
            }

            // Optional: Exit full screen when done
            if (document.exitFullscreen) document.exitFullscreen();
        };

        runTest();
    }, [isStarted]);

    return (
        <div className="GameTest">

            {!isStarted && (
                    <Modal
                        show={!isStarted}
                        title="Saccade Test"
                        message={isLoadingCalibration ? "Loading calibration..." : "The test will run in full screen."}
                        buttonText={isLoadingCalibration ? "Please Wait" : "Start Test"}
                        onConfirm={() => {handleStartTest()}}
                        disabled={isLoadingCalibration}
                    />
            )}

            {isStarted && (
                <>
                    <div className="trial-counter">Trial: {trialCount} / {trialsAmount}</div>

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
                onConfirm={() => navigate('/results')}
            />

        </div>
    )
}

export default GameTest;
