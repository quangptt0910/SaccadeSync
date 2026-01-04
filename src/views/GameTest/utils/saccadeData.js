// saccadeData.js - Enhanced post-processing analysis for ADHD research
import { calculateAccuracyResearchGrade} from "./accuracy";
import { VelocityConfig } from "./velocityConfig";
import { calculateAdaptiveThreshold } from "./detectSaccade";

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
        requireValidData = true,
        minLatency = 50,
        maxLatency = 600,
        postSaccadeWindow = 300,
        adaptiveThreshold = null
    } = options;

    // STEP 1: ADAPTIVE THRESHOLD CALCULATION
    let threshold;

    if (adaptiveThreshold !== null) {
        threshold = adaptiveThreshold;
        console.log(`Using pre-calculated threshold: ${threshold.toFixed(2)} deg/s`);
    } else {
        // Fallback: Calculate from this trial's fixation period only
        const fixationVelocities = [];
        for (const frame of recordingData) {
            // Only use frames from CENTER fixation period (safe window)
            if (frame.timestamp < dotAppearanceTime - 200 && // At least 200ms before dot
                frame.timestamp > dotAppearanceTime - 2000 && // No more than 2s before
                frame.velocity !== undefined &&
                frame.velocity < 100) { // Filter spurious movements
                fixationVelocities.push(frame.velocity);
            }
        }

        if (fixationVelocities.length >= 10) {
            const mean = fixationVelocities.reduce((s, v) => s + v, 0) / fixationVelocities.length;
            const variance = fixationVelocities.reduce((s, v) => s + (v - mean) ** 2, 0) / fixationVelocities.length;
            const sd = Math.sqrt(variance);
            threshold = Math.max(30, mean + 3 * sd);
            console.log(`Calculated threshold from trial data: ${threshold.toFixed(2)} deg/s (${fixationVelocities.length} samples)`);
        } else {
            threshold = 30;
            console.log(`Using default threshold: 30 deg/s (insufficient fixation data: ${fixationVelocities.length} samples)`);
        }
    }

    // STEP 2: Saccade Detection (existing logic)
    let peakVelocity = 0;
    let saccadeOnsetTime = null;
    let saccadeOffsetTime = null;
    let saccadeDetected = false;
    let validFrameCount = 0;
    let invalidFrameCount = 0;
    let binocularDisparityCount = 0;
    let inSaccade = false;

    for (let i = 0; i < recordingData.length; i++) {
        const currentFrame = recordingData[i];

        if (currentFrame.timestamp < dotAppearanceTime) continue;

        if (requireValidData && currentFrame.isValid === false) {
            invalidFrameCount++;
            if (currentFrame.invalidReason === 'excessive_disparity') {
                binocularDisparityCount++;
            }
            continue;
        }

        validFrameCount++;

        const velocity = currentFrame.velocity || 0;
        const isSaccade = velocity > threshold;

        if (isSaccade) {
            saccadeDetected = true;

            if (!inSaccade && saccadeOnsetTime === null) {
                saccadeOnsetTime = currentFrame.timestamp;
                inSaccade = true;
            }

            if (velocity > peakVelocity) {
                peakVelocity = velocity;
            }

            saccadeOffsetTime = currentFrame.timestamp;
        } else {
            if (inSaccade) {
                inSaccade = false;
            }
        }
    }

    // STEP 3: Latency Calculation
    let latency = null;
    let isPhysiologicallyPlausible = false;

    if (saccadeOnsetTime !== null) {
        latency = saccadeOnsetTime - dotAppearanceTime;
        isPhysiologicallyPlausible = latency >= minLatency && latency <= maxLatency;

        if (!isPhysiologicallyPlausible) {
            console.warn(`⚠Latency ${latency}ms outside range [${minLatency}, ${maxLatency}]`);
        }
    }

    // STEP 4: Duration Calculation
    let duration = null;
    if (saccadeOnsetTime !== null && saccadeOffsetTime !== null) {
        duration = saccadeOffsetTime - saccadeOnsetTime;
    }

    // STEP 5: NEW RESEARCH-GRADE ACCURACY CALCULATION
    const saccadeInfo = {
        saccadeOnsetTime,
        saccadeOffsetTime,
        duration
    };

    const accuracyResults = calculateAccuracyResearchGrade(
        recordingData,
        dotAppearanceTime,
        saccadeInfo,
        {
            roiRadius: 0.1,           // 10% of screen (~3° visual angle)
            fixationDuration: 300,     // 300ms research standard
            saccadicGainWindow: 67,    // 67ms after landing
            minLatency: minLatency
        }
    );

    // STEP 6: Data Quality
    const totalFramesAnalyzed = validFrameCount + invalidFrameCount;
    const dataQuality = totalFramesAnalyzed > 0
        ? validFrameCount / totalFramesAnalyzed
        : 0;

    // STEP 7: Compile Results
    return {
        // Primary Saccade Metrics
        isSaccade: saccadeDetected,
        peakVelocity: peakVelocity,
        latency: latency,
        duration: duration,
        isPhysiologicallyPlausible: isPhysiologicallyPlausible,
        usedThreshold: threshold,

        // ENHANCED Accuracy Metrics (Research-Grade)
        accuracy: accuracyResults.accuracyScore,
        accuracyBreakdown: accuracyResults.componentScores,
        saccadicGain: accuracyResults.saccadicGain,
        sustainedFixation: accuracyResults.sustainedFixation,
        fixationStability: accuracyResults.fixationStability,

        // ADHD Biomarkers
        adhdMarkers: accuracyResults.adhdMarkers,

        // Data Quality
        quality: {
            validFrames: validFrameCount,
            invalidFrames: invalidFrameCount,
            totalFrames: totalFramesAnalyzed,
            dataQuality: dataQuality,
            binocularDisparityEvents: binocularDisparityCount
        },

        // Timing
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