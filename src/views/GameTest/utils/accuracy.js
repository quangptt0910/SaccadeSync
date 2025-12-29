/**
 * Calculates the Euclidean distance between two points (x1, y1) and (x2, y2).
 */
const calculateDistance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

/**
 * Calculates the accuracy of the gaze relative to the target dot.
 * Accuracy is defined as 1 - (average error distance), clamped between 0 and 1.
 * 
 * @param {Array} recordingData - Array of tracking data points
 * @param {number} dotAppearanceTime - Timestamp when the dot appeared
 * @returns {Object} { averageError: number, accuracyScore: number }
 */
export const calculateAccuracy = (recordingData, dotAppearanceTime) => {
    let totalError = 0;
    let count = 0;

    // We only care about data AFTER the saccade has likely finished (fixation on target)
    // A simple heuristic is to look at data e.g. 200ms after dot appearance, 
    // or just average all data while the dot is visible.
    // For simplicity, let's consider all frames after dot appearance where target is defined.
    
    // Ideally, we should filter for the "fixation" period after the saccade.
    // Let's assume the user fixates within 500ms. 
    // But to keep it simple and robust, let's average error for all valid frames after appearance.

    for (const frame of recordingData) {
        if (frame.timestamp < dotAppearanceTime) continue;

        // Ensure we have both target and calibrated gaze data
        if (
            frame.targetX !== null && frame.targetX !== undefined &&
            frame.targetY !== null && frame.targetY !== undefined &&
            frame.calibrated && frame.calibrated.avg &&
            frame.calibrated.avg.x !== null && frame.calibrated.avg.x !== undefined
        ) {
            const error = calculateDistance(
                frame.calibrated.avg.x, 
                frame.calibrated.avg.y, 
                frame.targetX, 
                frame.targetY
            );
            
            totalError += error;
            count++;
        }
    }

    if (count === 0) {
        return { averageError: null, accuracyScore: null };
    }

    const averageError = totalError / count;
    
    // Accuracy Score: 1.0 is perfect. 
    // Error is in normalized screen coordinates (0-1).
    // If error is 0, accuracy is 1. If error is >= 1 (off screen), accuracy is 0.
    const accuracyScore = Math.max(0, 1 - averageError);

    return {
        averageError: averageError, // Average distance from target (0.0 - 1.0+)
        accuracyScore: accuracyScore // 0.0 - 1.0
    };
};
