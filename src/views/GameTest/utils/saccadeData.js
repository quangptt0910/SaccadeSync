import {calculateInstantVelocity} from "./velocity";

// speed threshold to consider a movement to be a saccade
// deg/s
const SACCADE_VELOCITY_THRESHOLD = 30;

export const analyzeSaccadeData = (recordingData, dotAppearanceTime) => {
    let peakVelocity = 0;
    let startTime = 0;
    let saccadeDetected = false;

    // We start at i=1 because we need i-1 to calculate speed
    for (let i = 1; i < recordingData.length; i++) {
        const currentFrame = recordingData[i];
        const prevFrame = recordingData[i - 1];

        // 1. TIMING FILTER
        // Ignore any eye movement that happened BEFORE the dot appeared
        if (currentFrame.timestamp < dotAppearanceTime) continue;

        // 2. CALCULATE VELOCITY
        // We calculate it right here on the fly using the helper above
        const velocity = calculateInstantVelocity(currentFrame, prevFrame);

        // 3. CHECK THRESHOLD
        if (velocity > SACCADE_VELOCITY_THRESHOLD) {
            saccadeDetected = true;

            // Capture the first moment velocity crossed the threshold (Latency)
            if (startTime === 0) {
                startTime = currentFrame.timestamp;
            }

            // Track the highest speed reached during this movement
            if (velocity > peakVelocity) {
                peakVelocity = velocity;
            }
        }
    }

    return {
        isSaccade: saccadeDetected,
        peakVelocity: peakVelocity, // Max speed (deg/s)
        latency: saccadeDetected ? (startTime - dotAppearanceTime) : null // Reaction time in ms
    };
};