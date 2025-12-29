// saccadeData.js - Enhanced post-processing analysis for ADHD research
import { calculateAccuracy } from "./accuracy";
import { VelocityConfig } from "./velocityConfig";
/**
 * Analyzes saccade data for a single trial
 * Uses pre-calculated velocities from real-time detection
 *
 * @param {Array} recordingData - Array of tracking data points with velocity already calculated
 * @param {number} dotAppearanceTime - Timestamp when the target dot appeared
 * @param {Object} options - Analysis options
 * @returns {Object} Comprehensive saccade metrics
 */
export const analyzeSaccadeData = (recordingData, dotAppearanceTime, options = {}) => {
    const {
        requireValidData = true,      // Skip invalid frames
        minLatency = 50,               // Minimum physiologically plausible latency (ms)
        maxLatency = 600,              // Maximum expected latency (ms)
        postSaccadeWindow = 200        // Window after saccade for accuracy (ms)
    } = options;

    // Metrics to calculate
    let peakVelocity = 0;
    let saccadeOnsetTime = null;
    let saccadeOffsetTime = null;
    let saccadeDetected = false;
    let validFrameCount = 0;
    let invalidFrameCount = 0;
    let binocularDisparityCount = 0;

    // Track saccade state
    let inSaccade = false;

    // Process frames after dot appearance
    for (let i = 0; i < recordingData.length; i++) {
        const currentFrame = recordingData[i];

        // 1. TIMING FILTER: Only analyze data after dot appeared
        if (currentFrame.timestamp < dotAppearanceTime) continue;

        // 2. VALIDITY FILTER: Check if frame is valid
        if (requireValidData && currentFrame.isValid === false) {
            invalidFrameCount++;
            if (currentFrame.invalidReason === 'excessive_disparity') {
                binocularDisparityCount++;
            }
            continue;
        }

        validFrameCount++;

        // 3. USE PRE-CALCULATED SACCADE DETECTION
        // The velocity and isSaccade were already calculated in real-time
        if (currentFrame.isSaccade && currentFrame.velocity) {
            saccadeDetected = true;

            // Track saccade onset (first frame above threshold)
            if (!inSaccade && saccadeOnsetTime === null) {
                saccadeOnsetTime = currentFrame.timestamp;
                inSaccade = true;
            }

            // Track peak velocity during entire saccade
            if (currentFrame.velocity > peakVelocity) {
                peakVelocity = currentFrame.velocity;
            }

            // Update offset time (last frame of saccade)
            saccadeOffsetTime = currentFrame.timestamp;
        } else {
            // Exited saccade
            if (inSaccade) {
                inSaccade = false;
            }
        }
    }

    // 4. CALCULATE LATENCY
    let latency = null;
    let isPhysiologicallyPlausible = false;

    if (saccadeOnsetTime !== null) {
        latency = saccadeOnsetTime - dotAppearanceTime;

        // Validate latency is within physiological bounds
        isPhysiologicallyPlausible = latency >= minLatency && latency <= maxLatency;

        if (!isPhysiologicallyPlausible) {
            console.warn(`Latency ${latency}ms outside physiological range [${minLatency}, ${maxLatency}]`);
        }
    }

    // 5. CALCULATE SACCADE DURATION
    let duration = null;
    if (saccadeOnsetTime !== null && saccadeOffsetTime !== null) {
        duration = saccadeOffsetTime - saccadeOnsetTime;
    }

    // 6. CALCULATE ACCURACY
    // Use post-saccade fixation period for accuracy measurement
    const accuracyStartTime = saccadeOffsetTime || dotAppearanceTime + 200; // Default 200ms after dot
    const accuracyResults = calculateAccuracy(recordingData, accuracyStartTime);

    // 7. DATA QUALITY METRICS
    const totalFramesAnalyzed = validFrameCount + invalidFrameCount;
    const dataQuality = totalFramesAnalyzed > 0
        ? validFrameCount / totalFramesAnalyzed
        : 0;

    // 8. COMPILE RESULTS
    return {
        // Primary Saccade Metrics (for ADHD research)
        isSaccade: saccadeDetected,
        peakVelocity: peakVelocity,                    // deg/s - Key ADHD biomarker
        latency: latency,                              // ms - Key ADHD biomarker
        duration: duration,                            // ms
        isPhysiologicallyPlausible: isPhysiologicallyPlausible,

        // Accuracy Metrics
        accuracy: accuracyResults.accuracyScore,       // 0.0 - 1.0
        averageError: accuracyResults.averageError,    // Normalized distance

        // Data Quality Metrics
        quality: {
            validFrames: validFrameCount,
            invalidFrames: invalidFrameCount,
            totalFrames: totalFramesAnalyzed,
            dataQuality: dataQuality,                  // 0.0 - 1.0
            binocularDisparityEvents: binocularDisparityCount
        },

        // Timing Breakdown (for debugging)
        timing: {
            dotAppearance: dotAppearanceTime,
            saccadeOnset: saccadeOnsetTime,
            saccadeOffset: saccadeOffsetTime,
            analysisWindow: {
                start: dotAppearanceTime,
                end: recordingData[recordingData.length - 1]?.timestamp || dotAppearanceTime
            }
        }
    };
};

/**
 * Analyzes multiple trials and aggregates statistics
 * Useful for pro-saccade vs anti-saccade comparisons
 *
 * @param {Array} trialsData - Array of trial results from analyzeSaccadeData
 * @param {string} trialType - 'pro' or 'anti'
 * @returns {Object} Aggregated statistics
 */
export const aggregateTrialStatistics = (trialsData, trialType = 'unknown') => {
    const validTrials = trialsData.filter(t =>
        t.isSaccade &&
        t.isPhysiologicallyPlausible &&
        t.quality.dataQuality > 0.7 // Only include high-quality trials
    );

    if (validTrials.length === 0) {
        return {
            trialType,
            validTrialCount: 0,
            warning: 'No valid trials found'
        };
    }

    // Calculate statistics
    const latencies = validTrials.map(t => t.latency);
    const peakVelocities = validTrials.map(t => t.peakVelocity);
    const accuracies = validTrials.map(t => t.accuracy);
    const durations = validTrials.map(t => t.duration).filter(d => d !== null);

    const mean = (arr) => arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const std = (arr) => {
        const m = mean(arr);
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
        return Math.sqrt(variance);
    };
    const median = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    };

    return {
        trialType,
        validTrialCount: validTrials.length,
        totalTrialCount: trialsData.length,

        // Latency Statistics (ms)
        latency: {
            mean: mean(latencies),
            std: std(latencies),
            median: median(latencies),
            min: Math.min(...latencies),
            max: Math.max(...latencies)
        },

        // Peak Velocity Statistics (deg/s) - Critical for ADHD
        peakVelocity: {
            mean: mean(peakVelocities),
            std: std(peakVelocities),
            median: median(peakVelocities),
            min: Math.min(...peakVelocities),
            max: Math.max(...peakVelocities)
        },

        // Accuracy Statistics (0-1)
        accuracy: {
            mean: mean(accuracies),
            std: std(accuracies),
            median: median(accuracies)
        },

        // Duration Statistics (ms)
        duration: durations.length > 0 ? {
            mean: mean(durations),
            std: std(durations),
            median: median(durations)
        } : null,

        // Quality Metrics
        averageDataQuality: mean(validTrials.map(t => t.quality.dataQuality)),
        totalBinocularDisparityEvents: validTrials.reduce(
            (sum, t) => sum + t.quality.binocularDisparityEvents, 0
        )
    };
};

/**
 * Compares pro-saccade vs anti-saccade performance
 * Returns metrics relevant to ADHD assessment
 *
 * @param {Object} proStats - Aggregated pro-saccade statistics
 * @param {Object} antiStats - Aggregated anti-saccade statistics
 * @returns {Object} Comparison metrics
 */
export const compareProVsAnti = (proStats, antiStats) => {
    if (!proStats || !antiStats) {
        return { error: 'Both pro and anti statistics required' };
    }

    // ADHD Research Indicators:
    // 1. Anti-saccade latency typically 50-100ms longer than pro-saccade
    // 2. Anti-saccade peak velocity may be reduced in ADHD
    // 3. Anti-saccade accuracy typically lower (requires inhibition)

    const latencyDifference = antiStats.latency.mean - proStats.latency.mean;
    const velocityRatio = antiStats.peakVelocity.mean / proStats.peakVelocity.mean;
    const accuracyDifference = proStats.accuracy.mean - antiStats.accuracy.mean;

    return {
        latency: {
            pro: proStats.latency.mean,
            anti: antiStats.latency.mean,
            difference: latencyDifference,
            interpretation: latencyDifference > 100
                ? 'Normal (anti > pro by >100ms)'
                : 'Reduced anti-saccade cost'
        },

        peakVelocity: {
            pro: proStats.peakVelocity.mean,
            anti: antiStats.peakVelocity.mean,
            ratio: velocityRatio,
            interpretation: velocityRatio < 0.85
                ? 'Reduced anti-saccade velocity'
                : 'Normal velocity'
        },

        accuracy: {
            pro: proStats.accuracy.mean,
            anti: antiStats.accuracy.mean,
            difference: accuracyDifference,
            interpretation: accuracyDifference > 0.15
                ? 'Significant anti-saccade accuracy reduction'
                : 'Normal accuracy pattern'
        },

        dataQuality: {
            pro: proStats.averageDataQuality,
            anti: antiStats.averageDataQuality,
            overall: (proStats.averageDataQuality + antiStats.averageDataQuality) / 2
        }
    };
};