
/**
 * Configuration constants for velocity calculations in eye-tracking
 * Based on ADHD research standards and visual science principles
 */

export const MetricConfig = {
    // Screen and Visual Field Parameters
    SCREEN: {
        WIDTH: window.innerWidth || 1920,
        HEIGHT: window.innerHeight || 1080,
        // Typical viewing distance: 60cm, screen width: ~50cm
        HORIZONTAL_FOV_DEGREES: 40, // Horizontal field of view
        VERTICAL_FOV_DEGREES: 30,   // Vertical field of view
    },

    // Saccade Detection Thresholds
    SACCADE: {
        // Static threshold (fallback when adaptive isn't available)
        STATIC_THRESHOLD_DEG_PER_SEC: 30,

        // Onset/Offset thresholds
        ONSET_THRESHOLD_DEG_PER_SEC: 35,   // Movement start (slightly higher than I-VT)
        OFFSET_THRESHOLD_DEG_PER_SEC: 25,  // Movement end (hysteresis)

        // Peak velocity validation
        MIN_PEAK_VELOCITY_DEG_PER_SEC: 40,

        // Adaptive threshold parameters
        ADAPTIVE: {
            ENABLED: true,
            FIXATION_SD_MULTIPLIER: 2.5, // Mean + 2.5*SD
            MIN_FIXATION_SAMPLES: 20,  // Minimum samples needed for adaptive calculation
            MAX_FIXATION_VELOCITY: 100, // Filter out spurious movements
        },

        // Validity check: Maximum allowed difference between left/right eye velocities
        MAX_BINOCULAR_DISPARITY_DEG_PER_SEC: 100,
    },

    FIXATION: {
        DURATION: 200, // Softer compare to desktop eye tracker at 70 - 100ms
        SACCADE_GAIN_WINDOW: 100, // Increase from 67ms
    },

    LATENCY_VALIDATION: {
        PRO_SACCADE: {
            MIN_MS: 90,  // Not 80ms - too aggressive for webcam
            MAX_MS: 600,  // Upper limit for normal reaction
            EXPRESS_THRESHOLD_MS: 120,  // Flag as express if <120ms
        },
        ANTI_SACCADE: {
            MIN_MS: 90,  // Inhibition takes longer
            MAX_MS: 800,  // Upper limit for antisaccades
            EXPRESS_THRESHOLD_MS: 180,
        }
    },

    // AMPLITUDE VALIDATION
    MIN_AMPLITUDE_DEGREES: 2.0,
    MIN_DURATION_MS: 30,  // 1 frame at 30fps (not 20-25ms from desktop)
    MAX_DURATION_MS: 150, // Typical max for 40° saccade
    // Time window validation
    TIME: {
        MIN_DELTA_MS: 1,      // Minimum time between frames
        MAX_DELTA_MS: 500,    // Maximum time between frames (detect gaps)
        MAX_DELTA_SEC: 0.5,   // Same as above in seconds
    },

    // Raw iris movement gain (when calibration unavailable)
    RAW_IRIS_GAIN: 30,

    // Savitzky-Golay Filter Parameters (for future implementation)
    SAVITZKY_GOLAY: {
        ENABLED: false,        // Set to true when implemented
        POLYNOMIAL_ORDER: 2,   // Quadratic polynomial
        WINDOW_SIZE_MS: 15,    // ~10-20ms window recommended
    }
};

/**
 * Calculates pixels per degree for the current screen setup
 * @returns {Object} { horizontal: number, vertical: number }
 */
export const getPixelsPerDegree = () => ({
    horizontal: MetricConfig.SCREEN.WIDTH / MetricConfig.SCREEN.HORIZONTAL_FOV_DEGREES,
    vertical: MetricConfig.SCREEN.HEIGHT / MetricConfig.SCREEN.VERTICAL_FOV_DEGREES,
});

/**
 * Calculate adaptive threshold from fixation period velocities
 * This should be called DURING each trial's center fixation
 */
export const calculatePerTrialThreshold = (fixationVelocities) => {
    const { ADAPTIVE, STATIC_THRESHOLD_DEG_PER_SEC } = MetricConfig.SACCADE;

    // Filter out spurious movements during "fixation"
    const cleanFixationVelocities = fixationVelocities.filter(v =>
        v < ADAPTIVE.MAX_FIXATION_VELOCITY && v >= 0
    );

    // Need minimum samples for robust statistics
    if (cleanFixationVelocities.length < ADAPTIVE.MIN_FIXATION_SAMPLES) {
        console.warn(`Insufficient fixation samples (${cleanFixationVelocities.length}/${ADAPTIVE.MIN_FIXATION_SAMPLES}). Using static threshold.`);
        return STATIC_THRESHOLD_DEG_PER_SEC;
    }

    // Calculate mean and standard deviation
    const mean = cleanFixationVelocities.reduce((sum, v) => sum + v, 0) / cleanFixationVelocities.length;
    const variance = cleanFixationVelocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / cleanFixationVelocities.length;
    const sd = Math.sqrt(variance);

    // Adaptive threshold: Mean + 2.5/3*SD (Engbert & Kliegl, 2003)
    const adaptiveThreshold = mean + (ADAPTIVE.FIXATION_SD_MULTIPLIER * sd);

    // Safety bounds: never go below 25°/s or above 100°/s
    const boundedThreshold = Math.max(25, Math.min(100, adaptiveThreshold));

    console.log(`Per-trial threshold: ${boundedThreshold.toFixed(2)}°/s (mean=${mean.toFixed(2)}, sd=${sd.toFixed(2)}, n=${cleanFixationVelocities.length})`);

    return boundedThreshold;
};
