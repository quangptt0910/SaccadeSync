// saccadeData.js - Enhanced post-processing analysis for ADHD research
import { calculateAccuracy } from "./accuracyAdjust";
import { VelocityConfig } from "./velocityConfig";
import { calculateAdaptiveThreshold } from "./detectSaccade";
import {selectCalibrationMetrics} from "../../../store/calibrationSlice";

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
        adaptiveThreshold = 30,
        trialType = 'pro'
    } = options;



    // Get task-specific latency bounds
    const latencyConfig = trialType === 'pro'
        ? VelocityConfig.LATENCY_VALIDATION.PRO_SACCADE
        : VelocityConfig.LATENCY_VALIDATION.ANTI_SACCADE;
    console.log(`Trial Analysis (${trialType}): Threshold=${adaptiveThreshold.toFixed(2)}°/s, Latency Window=[${latencyConfig.MIN_MS}, ${latencyConfig.MAX_MS}]ms`);

    // Saccade Detection (existing logic)
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
        const isSaccade = velocity > adaptiveThreshold;

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

    //  Latency Calculation & Validation
    let latency = null;
    let latencyClassification = 'none';

    if (saccadeOnsetTime !== null) {
        latency = saccadeOnsetTime - dotAppearanceTime;

        if (latency < latencyConfig.EXPRESS_THRESHOLD_MS) {
            latencyClassification = 'express';  // Very fast, possibly anticipatory
        } else if (latency >= latencyConfig.MIN_MS && latency <= latencyConfig.MAX_MS) {
            latencyClassification = 'normal';   // Valid reaction
        } else if (latency > latencyConfig.MAX_MS) {
            latencyClassification = 'delayed';  // Attention lapse
        } else {
            latencyClassification = 'invalid';  // Too fast (< 90ms)
        }

        console.log(`Latency: ${latency}ms [${latencyClassification}]`);
    }

    let isPhysiologicallyPlausible = false;

    if (saccadeOnsetTime !== null) {
        latency = saccadeOnsetTime - dotAppearanceTime;
        isPhysiologicallyPlausible = latency >= minLatency && latency <= maxLatency;

        if (!isPhysiologicallyPlausible) {
            console.warn(`⚠Latency ${latency}ms outside range [${minLatency}, ${maxLatency}]`);
        }
    }

    //  Duration Calculation
    let duration = null;
    if (saccadeOnsetTime !== null && saccadeOffsetTime !== null) {
        duration = saccadeOffsetTime - saccadeOnsetTime;
    }

    //  NEW RESEARCH-GRADE ACCURACY CALCULATION
    const saccadeInfo = {
        saccadeOnsetTime,
        saccadeOffsetTime,
        duration
    };

    const accuracyResults = calculateAccuracy(
        recordingData,
        dotAppearanceTime,
        saccadeInfo,
        {
            calibrationAccuracy: selectCalibrationMetrics?.accuracy?.left || 0.91, //fallback value
            trackerFPS: 30,             // webcam frame rate
            roiRadius: null,
            fixationDuration: 300,
            saccadicGainWindow: 100,
            minLatency: minLatency,
            fixationStabilityThreshold: 0.70
        }
    );

    //  Data Quality
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
        latencyClassification: latencyClassification,
        duration: duration,
        isPhysiologicallyPlausible: isPhysiologicallyPlausible,
        usedThreshold: adaptiveThreshold,

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
    const gain = validTrials.map(t => t.saccadicGain).filter(g => g !== null);

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

        gain: {
            mean: mean(gains),
            std: std(gains),
            median: median(gains),
            // Count how many were hypometric (undershoots < 0.85)
            hypometricRate: gains.filter(g => g < 0.85).length / gains.length
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
    // Safety check
    if (!proStats || !antiStats || proStats.validTrialCount === 0 || antiStats.validTrialCount === 0) {
        console.warn("⚠️ Cannot compare phases: Insufficient valid trials.");
        return {
            latencyDifference: 0,
            errorRateComparison: 0,
            impulsivityIndex: 0,
            overallDiagnosis: "Inconclusive (Low Data Quality)"
        };
    }
    // ADHD Research Indicators:
    // 1. Anti-saccade latency typically 50-100ms longer than pro-saccade
    // 2. Anti-saccade peak velocity may be reduced in ADHD
    // 3. Anti-saccade accuracy typically lower (requires inhibition)

    try {
        const proLatency = proStats.latency?.mean || 0;
        const antiLatency = antiStats.latency?.mean || 0;
        const latencyDifference = antiLatency - proLatency;
        const velocityRatio = antiStats.peakVelocity.mean / proStats.peakVelocity.mean;
        const accuracyDifference = proStats.accuracy.mean - antiStats.accuracy.mean;

        const proGain = proStats.gain?.mean || 0;
        const antiGain = antiStats.gain?.mean || 0;
        const gainDifference = proGain - antiGain;

        return {
            latency: {
                pro: proStats.latency.mean,
                anti: antiStats.latency.mean,
                difference: latencyDifference,
                interpretation: latencyDifference > 100 // magic number
                    ? 'Normal (anti > pro by >100ms)'
                    : 'Reduced anti-saccade cost'
            },

            peakVelocity: {
                pro: proStats.peakVelocity.mean,
                anti: antiStats.peakVelocity.mean,
                ratio: velocityRatio,
                interpretation: velocityRatio < 0.85 // magic number
                    ? 'Reduced anti-saccade velocity'
                    : 'Normal velocity'
            },

            accuracy: {
                pro: proStats.accuracy.mean,
                anti: antiStats.accuracy.mean,
                difference: accuracyDifference,
                interpretation: accuracyDifference > 0.15 // magic number
                    ? 'Significant anti-saccade accuracy reduction'
                    : 'Normal accuracy pattern'
            },
            gain: {
                pro: proGain,
                anti: antiGain,
                difference: gainDifference,
                interpretation: proGain < 0.8 // a soften magic number from the literature
                    ? 'Significant Hypometria (Undershoot)'
                    : 'Normal Gain'
            },
            dataQuality: {
                pro: proStats.averageDataQuality,
                anti: antiStats.averageDataQuality,
                overall: (proStats.averageDataQuality + antiStats.averageDataQuality) / 2
            }
        };
    } catch (error) {
        console.error("Error comparing pro vs anti saccade stats:", error);
        return {
            latencyDifference: 0,
            errorRateComparison: 0,
            impulsivityIndex: 0,
            overallDiagnosis: "Inconclusive (Error in Comparison)"
        };
    }

};