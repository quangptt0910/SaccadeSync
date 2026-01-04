import { VelocityConfig, getPixelsPerDegree } from './velocityConfig';

/**
 * Validates time delta between frames
 */
const isValidTimeDelta = (timeDeltaSec) => {
    return timeDeltaSec > 0 && timeDeltaSec <= VelocityConfig.TIME.MAX_DELTA_SEC;
};

/**
 * STEP 1: Convert normalized coordinates to visual degrees
 * Converts screen-normalized coordinates (0-1) to visual angle in degrees
 *
 * @param {Object} point1 - First point {x, y} in normalized coordinates (0-1)
 * @param {Object} point2 - Second point {x, y} in normalized coordinates (0-1)
 * @returns {Object} { distanceDegrees: number, dx: number, dy: number }
 */
const calculateVisualAngleDistance = (point1, point2) => {
    const { SCREEN, HORIZONTAL_FOV_DEGREES, VERTICAL_FOV_DEGREES } = VelocityConfig;

    // Convert normalized difference to pixel difference
    const dxPixels = (point2.x - point1.x) * SCREEN.WIDTH;
    const dyPixels = (point2.y - point1.y) * SCREEN.HEIGHT;

    // Convert pixels to visual degrees
    const ppd = getPixelsPerDegree();
    const dxDegrees = dxPixels / ppd.horizontal;
    const dyDegrees = dyPixels / ppd.vertical;

    // Euclidean distance in visual degrees
    const distanceDegrees = Math.sqrt(dxDegrees ** 2 + dyDegrees ** 2);

    return { distanceDegrees, dxDegrees, dyDegrees };
};

/**
 * STEP 2: Calculate individual eye velocity and validate binocular consistency
 * Prevents artifacts from one-eye blinks or tracking errors
 *
 * @param {Object} currentPoint - Current tracking data
 * @param {Object} prevPoint - Previous tracking data
 * @param {number} timeDeltaSec - Time difference in seconds
 * @returns {Object} { leftVelocity, rightVelocity, isValid, reason }
 */
const validateBinocularData = (currentPoint, prevPoint, timeDeltaSec) => {
    let leftVelocity = null;
    let rightVelocity = null;

    // Calculate velocity for each eye independently
    if (currentPoint.calibrated?.left && prevPoint.calibrated?.left) {
        const leftDist = calculateVisualAngleDistance(
            prevPoint.calibrated.left,
            currentPoint.calibrated.left
        );
        leftVelocity = leftDist.distanceDegrees / timeDeltaSec;
    }

    if (currentPoint.calibrated?.right && prevPoint.calibrated?.right) {
        const rightDist = calculateVisualAngleDistance(
            prevPoint.calibrated.right,
            currentPoint.calibrated.right
        );
        rightVelocity = rightDist.distanceDegrees / timeDeltaSec;
    }

    // Validity check: At least one eye must be tracked (Relaxed from requiring both)
    if (leftVelocity === null && rightVelocity === null) {
        return {
            leftVelocity,
            rightVelocity,
            isValid: false,
            reason: 'no_data'
        };
    }

    // Check binocular disparity only if both eyes are available
    let disparity = 0;
    if (leftVelocity !== null && rightVelocity !== null) {
        disparity = Math.abs(leftVelocity - rightVelocity);
        const maxDisparity = VelocityConfig.SACCADE.MAX_BINOCULAR_DISPARITY_DEG_PER_SEC;

        if (disparity > maxDisparity) {
            // We allow the data but mark it with a reason. 
            // Returning isValid: true ensures we still get a velocity value (from the average).
            return {
                leftVelocity,
                rightVelocity,
                isValid: true, 
                reason: 'excessive_disparity',
                disparity
            };
        }
    }

    return {
        leftVelocity,
        rightVelocity,
        isValid: true,
        disparity
    };
};

/**
 * STEP 3: Calculate Cyclopean (averaged) gaze position velocity
 * Averages positions first, then calculates velocity (reduces noise)
 *
 * @param {Object} currentPoint - Current tracking data
 * @param {Object} prevPoint - Previous tracking data
 * @param {number} timeDeltaSec - Time difference in seconds
 * @returns {number} Velocity in degrees per second
 */
const calculateCyclopeanVelocity = (currentPoint, prevPoint, timeDeltaSec) => {
    // Use pre-averaged calibrated gaze if available
    if (currentPoint.calibrated?.avg && prevPoint.calibrated?.avg) {
        const dist = calculateVisualAngleDistance(
            prevPoint.calibrated.avg,
            currentPoint.calibrated.avg
        );
        return dist.distanceDegrees / timeDeltaSec;
    }

    return 0;
};

/**
 * STEP 4: Calculate velocity using simple differentiation
 * NOTE: This uses P(t) - P(t-1) approach
 * See documentation for Savitzky-Golay implementation requirements
 *
 * @param {Object} currentPoint - Current tracking data
 * @param {Object} prevPoint - Previous tracking data
 * @returns {number} Velocity in degrees/second
 */
const calculateSimpleDifferentiationVelocity = (currentPoint, prevPoint) => {
    const timeDeltaSec = (currentPoint.timestamp - prevPoint.timestamp) / 1000;

    if (!isValidTimeDelta(timeDeltaSec)) {
        return 0;
    }

    // For now, use cyclopean velocity with simple differentiation
    return calculateCyclopeanVelocity(currentPoint, prevPoint, timeDeltaSec);
};

/**
 * STEP 5: Adaptive threshold calculation
 * Calculates dynamic threshold based on fixation statistics
 * Falls back to static threshold if insufficient data
 *
 * @param {Array} recentVelocities - Array of recent velocity values during fixation
 * @returns {number} Threshold in degrees/second
 */
export const calculateAdaptiveThreshold = (recentVelocities = []) => {
    const { ADAPTIVE, STATIC_THRESHOLD_DEG_PER_SEC } = VelocityConfig.SACCADE;

    if (!ADAPTIVE.ENABLED || recentVelocities.length < ADAPTIVE.MIN_FIXATION_SAMPLES) {
        return STATIC_THRESHOLD_DEG_PER_SEC;
    }

    // Calculate mean and standard deviation of fixation velocities
    const mean = recentVelocities.reduce((sum, v) => sum + v, 0) / recentVelocities.length;
    const variance = recentVelocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / recentVelocities.length;
    const sd = Math.sqrt(variance);

    // Adaptive threshold: Mean + 3*SD
    const adaptiveThreshold = mean + (ADAPTIVE.FIXATION_SD_MULTIPLIER * sd);

    // Ensure it's reasonable (not too low)
    return Math.max(adaptiveThreshold, STATIC_THRESHOLD_DEG_PER_SEC * 0.5);
};

/**
 * Main saccade detection function with research-grade pipeline
 *
 * @param {Object} currentPoint - Current tracking data point
 * @param {Object} prevPoint - Previous tracking data point
 * @param {Object} options - Optional parameters
 * @param {number} options.adaptiveThreshold - Pre-calculated adaptive threshold
 * @returns {Object} Detection result
 */
export const detectSaccade = (currentPoint, prevPoint, options = {}) => {
    const timeDeltaSec = (currentPoint.timestamp - prevPoint.timestamp) / 1000;

    // Validation: Time delta must be reasonable
    if (!isValidTimeDelta(timeDeltaSec)) {
        return {
            velocity: 0,
            isSaccade: false,
            isValid: false,
            reason: 'invalid_time_delta',
            metadata: {
                timeDeltaMs: timeDeltaSec * 1000
            }
        };
    }

    // Check if we have calibrated data
    if (!currentPoint.calibrated?.avg || !prevPoint.calibrated?.avg) {
        return {
            velocity: 0,
            isSaccade: false,
            isValid: false,
            reason: 'no_calibration_data',
            debug: {
                currentHasCalibrated: !!currentPoint.calibrated,
                currentHasAvg: !!currentPoint.calibrated?.avg,
                prevHasCalibrated: !!prevPoint.calibrated,
                prevHasAvg: !!prevPoint.calibrated?.avg
            }
        };
    }

    // STEP 2: Validate binocular data
    const validation = validateBinocularData(currentPoint, prevPoint, timeDeltaSec);

    if (!validation.isValid) {
        return {
            velocity: 0,
            isSaccade: false,
            isValid: false,
            reason: validation.reason,
            metadata: {
                leftVelocity: validation.leftVelocity,
                rightVelocity: validation.rightVelocity,
                disparity: validation.disparity
            }
        };
    }

    // STEP 3 & 4: Calculate cyclopean velocity
    const velocity = calculateCyclopeanVelocity(currentPoint, prevPoint, timeDeltaSec);

    // STEP 5: Apply threshold (adaptive or static)
    const threshold = options.adaptiveThreshold || VelocityConfig.SACCADE.STATIC_THRESHOLD_DEG_PER_SEC;
    const isSaccade = velocity > threshold;

    return {
        velocity,
        isSaccade,
        isValid: true,
        metadata: {
            leftVelocity: validation.leftVelocity,
            rightVelocity: validation.rightVelocity,
            disparity: validation.disparity,
            threshold,
            thresholdType: options.adaptiveThreshold ? 'adaptive' : 'static'
        }
    };
};

/**
 * Fallback velocity calculation using raw iris data
 * Used when calibration is not available
 *
 * @param {Object} currentPoint - Current tracking data
 * @param {Object} prevPoint - Previous tracking data
 * @returns {Object} { velocity, isSaccade }
 */
export const detectSaccadeRaw = (currentPoint, prevPoint) => {
    const timeDeltaSec = (currentPoint.timestamp - prevPoint.timestamp) / 1000;

    if (!isValidTimeDelta(timeDeltaSec)) {
        return { velocity: 0, isSaccade: false, isValid: false };
    }

    const { HORIZONTAL_FOV_DEGREES, VERTICAL_FOV_DEGREES, RAW_IRIS_GAIN } = VelocityConfig;

    // Calculate for left eye
    const dLx = currentPoint.leftIris.x - prevPoint.leftIris.x;
    const dLy = currentPoint.leftIris.y - prevPoint.leftIris.y;
    const leftDistDeg = Math.sqrt(
        (dLx * HORIZONTAL_FOV_DEGREES * RAW_IRIS_GAIN) ** 2 +
        (dLy * VERTICAL_FOV_DEGREES * RAW_IRIS_GAIN) ** 2
    );

    // Calculate for right eye
    const dRx = currentPoint.rightIris.x - prevPoint.rightIris.x;
    const dRy = currentPoint.rightIris.y - prevPoint.rightIris.y;
    const rightDistDeg = Math.sqrt(
        (dRx * HORIZONTAL_FOV_DEGREES * RAW_IRIS_GAIN) ** 2 +
        (dRy * VERTICAL_FOV_DEGREES * RAW_IRIS_GAIN) ** 2
    );

    // Average velocities
    const velocity = (leftDistDeg + rightDistDeg) / 2 / timeDeltaSec;
    const threshold = VelocityConfig.SACCADE.STATIC_THRESHOLD_DEG_PER_SEC;

    return {
        velocity,
        isSaccade: velocity > threshold,
        isValid: true,
        isRawData: true
    };
};