// velocityConfig.js
/**
 * Configuration constants for velocity calculations in eye-tracking
 * Based on ADHD research standards and visual science principles
 */

export const VelocityConfig = {
    // Screen and Visual Field Parameters
    SCREEN: {
        WIDTH: window.screen.width || 1920,
        HEIGHT: window.screen.height || 1080,
        // Typical viewing distance: 60cm, screen width: ~50cm
        HORIZONTAL_FOV_DEGREES: 40, // Horizontal field of view
        VERTICAL_FOV_DEGREES: 30,   // Vertical field of view
    },

    // Saccade Detection Thresholds
    SACCADE: {
        // Static threshold (fallback when adaptive isn't available)
        STATIC_THRESHOLD_DEG_PER_SEC: 30,

        // Adaptive threshold parameters
        ADAPTIVE: {
            ENABLED: true,
            FIXATION_SD_MULTIPLIER: 3, // Mean + 3*SD
            MIN_FIXATION_SAMPLES: 10,  // Minimum samples needed for adaptive calculation
        },

        // Validity check: Maximum allowed difference between left/right eye velocities
        MAX_BINOCULAR_DISPARITY_DEG_PER_SEC: 100,
    },

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
    horizontal: VelocityConfig.SCREEN.WIDTH / VelocityConfig.SCREEN.HORIZONTAL_FOV_DEGREES,
    vertical: VelocityConfig.SCREEN.HEIGHT / VelocityConfig.SCREEN.VERTICAL_FOV_DEGREES,
});

/**
 * Converts pixel distance to visual degrees
 * @param {number} pixelDistance - Distance in pixels
 * @param {string} axis - 'horizontal' or 'vertical'
 * @returns {number} Distance in degrees
 */
export const pixelsToDegrees = (pixelDistance, axis = 'horizontal') => {
    const ppd = getPixelsPerDegree();
    return pixelDistance / ppd[axis];
};