import React, {useState, useEffect, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal';
import './GameTest.css';
import IrisFaceMeshTracker from "./utils/iris-facemesh";
import {analyzeSaccadeData} from './utils/saccadeData';

const GameTest = () => {

    const navigate = useNavigate();

    // state management
    const [isStarted, setIsStarted] = useState(false);
    const [dotPosition, setDotPosition] = useState('hidden');
    const [trialCount, setTrialCount] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

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
                        message="The test will run in full screen."
                        buttonText="Start Test"
                        onConfirm={() => {handleStartTest()}}
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