// GameTest\utils\accuracyAdjust.js
/**
 * This implementation to generate a accuracy metrics for saccade tasks that take into accounts of
 *  webcam, low frame rate and calibration drift
 *  Compare to professional Eye Tracker
 **/
import {selectCalibrationMetrics} from "../../../store/calibrationSlice";
import {MetricConfig as metricConfig, MetricConfig} from "./metricConfig";

/**
 * Calculate adaptive ROI based on calibration accuracy and tracker FPS
 * Base start at 10% of screen (~4 - 5 degree)
 * Calibration accuracy penalty -> Roi expands
 * Fps at 30 fps, expands further
 * Return about 5-8 degree (0.12 - 0.25 normalized screen)
 */
const calculateAdaptiveROI = (calibrationAccuracy, trackerFPS) => {
    // Base ROI for perfect calibration: 3° (0.1 screen width)
    const baseROI = 0.10;

    // Adjust for calibration quality
    // 95% accuracy → 1.0x multiplier
    // 90% accuracy → 1.2x multiplier
    // 85% accuracy → 1.4x multiplier
    const qualityMultiplier = 1 + (0.95 - calibrationAccuracy) * 2;

    // Adjust for frame rate (lower FPS = more noise)
    // 60fps → 1.0x
    // 30fps → 1.3x
    const fpsMultiplier = Math.max(1.0, 60 / trackerFPS);

    // Combined adjustment
    const adjustedROI = baseROI * qualityMultiplier * fpsMultiplier;

    // Clamp to reasonable bounds (5-8° visual angle)
    return Math.max(0.12, Math.min(0.25, adjustedROI));
};

/**
 * Calculate per-frame tracking quality score
 * Returns 0.0-1.0 confidence for each frame
 */
const assessFrameQuality = (frame) => {
    let qualityScore = 1.0;

    // Check 1: Do we have binocular data
    // If only left OR right, quality down by half
    if (!frame.calibrated?.left || !frame.calibrated?.right) {
        qualityScore *= 0.5; // Monocular is less reliable
    }

    // Check 2: Binocular consistency (should be similar)
    if (frame.calibrated?.left && frame.calibrated?.right) {
        const dx = Math.abs(frame.calibrated.left.x - frame.calibrated.right.x);
        const dy = Math.abs(frame.calibrated.left.y - frame.calibrated.right.y);
        const disparity = Math.sqrt(dx*dx + dy*dy);

        // Expect <0.05 disparity in screen space
        if (disparity > 0.10) {
            qualityScore *= 0.3; // Large disparity = tracking error
        } else if (disparity > 0.05) {
            qualityScore *= 0.7;
        }
    }

    // Check 3: Velocity plausibility (during fixation should be <30°/s)
    if (frame.velocity && frame.velocity > MetricConfig.SACCADE.STATIC_THRESHOLD_DEG_PER_SEC && !frame.isSaccade) {
        qualityScore *= 0.5; // High velocity during "fixation" = artifact
    }

    return qualityScore;
};

/**
 * WEBCAM-ADJUSTED ACCURACY CALCULATION
 * Uses relaxed thresholds appropriate for low-fps noisy tracking
 * Landing point + gain score + fixation (stability)
 */
export const calculateAccuracy = (
    recordingData,
    dotAppearanceTime,
    saccadeInfo,
    options = {}
) => {
    const {
        calibrationAccuracy = selectCalibrationMetrics?.accuracy?.left || 0.91,    // MediaPipe hardcode accuracy MediaPipe accuracy is 1-3° in ideal conditions
        trackerFPS = 30,                // Webcam frame rate - NEED TO FIX for real but most likely 30 fps
        roiRadius = null,                  // Auto-calculate if null
        fixationDuration = metricConfig.FIXATION.DURATION,         // defines the post-saccade analysis window
        saccadicGainWindow = metricConfig.FIXATION.SACCADE_GAIN_WINDOW,       // INCREASED from 67ms to 100ms
        fixationStabilityThreshold = 0.70  // RELAXED from 0.80 to 0.70
    } = options;

    // Calculate adaptive ROI based on tracking quality
    const adaptiveROI = roiRadius || calculateAdaptiveROI(calibrationAccuracy, trackerFPS);

    console.log(`Accuracy Config: ROI=${(adaptiveROI*100).toFixed(1)}% (${(adaptiveROI * 40).toFixed(1)}° visual angle), Window=${saccadicGainWindow}ms`);

    // Validate inputs
    if (!saccadeInfo.saccadeOffsetTime) {
        return {
            accuracyScore: 0,
            reason: 'no_saccade_detected',
            saccadicGain: null,
            sustainedFixation: false
        };
    }

    // Find fixation point before saccade - before the dot appears 500ms to 1000ms
    let fixationPoint = null;
    for (const frame of recordingData) {
        if (frame.timestamp < dotAppearanceTime - 500 &&
            frame.timestamp > dotAppearanceTime - 1000) {
            if (frame.calibrated?.avg) {
                fixationPoint = { x: frame.calibrated.avg.x, y: frame.calibrated.avg.y };
                break;
            }
        }
    }

    if (!fixationPoint) fixationPoint = { x: 0.5, y: 0.5 }; //fallbacks to perfect value

    // Get target coordinates
    const targetFrame = recordingData.find(f =>
        f.timestamp >= dotAppearanceTime && f.targetX !== null
    );
    if (!targetFrame) {
        return {
            accuracyScore: 0,
            reason: 'no_target_data',
            saccadicGain: null,
            sustainedFixation: false
        };
    }
    const targetX = targetFrame.targetX;
    const targetY = targetFrame.targetY;

    // ADJUSTED LANDING WINDOW: T_offset + 100-150ms (not 67ms)
    const landingWindowStart = saccadeInfo.saccadeOffsetTime + 50;  // Start 50ms after saccade ends
    const landingWindowEnd = saccadeInfo.saccadeOffsetTime + saccadicGainWindow + 50;

    // Find best landing point within window (quality-weighted)
    let bestLandingPoint = null;
    let bestQuality = 0;

    for (const frame of recordingData) {
        if (frame.timestamp < landingWindowStart || frame.timestamp > landingWindowEnd) continue;
        if (!frame.calibrated?.avg) continue;

        const quality = assessFrameQuality(frame);
        if (quality > bestQuality) {
            bestQuality = quality;
            bestLandingPoint = {
                x: frame.calibrated.avg.x,
                y: frame.calibrated.avg.y,
                timestamp: frame.timestamp,
                quality: quality
            };
        }
    }

    if (!bestLandingPoint) {
        // Fallback: use first frame after saccade
        for (const frame of recordingData) {
            if (frame.timestamp > saccadeInfo.saccadeOffsetTime && frame.calibrated?.avg) {
                bestLandingPoint = {
                    x: frame.calibrated.avg.x,
                    y: frame.calibrated.avg.y,
                    timestamp: frame.timestamp,
                    quality: 0.5
                };
                break;
            }
        }
    }

    if (!bestLandingPoint) {
        return {
            accuracyScore: 0,
            reason: 'no_landing_data',
            saccadicGain: null,
            sustainedFixation: false
        };
    }

    // Calculate Saccadic Gain
    const requiredDx = targetX - fixationPoint.x;
    const requiredDy = targetY - fixationPoint.y;
    const requiredAmplitude = Math.sqrt(requiredDx * requiredDx + requiredDy * requiredDy);

    const actualDx = bestLandingPoint.x - fixationPoint.x;
    const actualDy = bestLandingPoint.y - fixationPoint.y;
    const actualAmplitude = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

    const gain = requiredAmplitude > 0 ? actualAmplitude / requiredAmplitude : 1.0;
    const isHypometric = gain < 0.75;
    const isHypermetric = gain > 1.10;

    console.log(`Landing: pos=(${bestLandingPoint.x.toFixed(3)}, ${bestLandingPoint.y.toFixed(3)}), quality=${bestLandingPoint.quality.toFixed(2)}, gain=${gain.toFixed(3)}`);

    // QUALITY-WEIGHTED SUSTAINED FIXATION ANALYSIS
    const fixationStartTime = bestLandingPoint.timestamp;
    const fixationEndTime = fixationStartTime + fixationDuration;

    let weightedInROI = 0;
    let totalWeight = 0;
    let qualityFrameCount = 0;

    const fixationPositions = [];

    for (const frame of recordingData) {
        if (frame.timestamp < fixationStartTime || frame.timestamp > fixationEndTime) continue;
        if (!frame.calibrated?.avg) continue;

        const quality = assessFrameQuality(frame);
        const distance = Math.sqrt(
            Math.pow(frame.calibrated.avg.x - targetX, 2) +
            Math.pow(frame.calibrated.avg.y - targetY, 2)
        );
        const inROI = distance <= adaptiveROI;

        // Weight by frame quality
        if (inROI) {
            weightedInROI += quality;
        }
        totalWeight += quality;
        qualityFrameCount++;

        fixationPositions.push({
            x: frame.calibrated.avg.x,
            y: frame.calibrated.avg.y,
            inROI: inROI,
            quality: quality
        });
    }

    const fixationStability = totalWeight > 0 ? weightedInROI / totalWeight : 0;
    const sustainedFixation = fixationStability >= fixationStabilityThreshold;

    console.log(`📊 Fixation: stability=${(fixationStability*100).toFixed(1)}%, frames=${qualityFrameCount}, sustained=${sustainedFixation}`);

    // INITIAL LANDING CHECK (with adaptive ROI)
    const landingDistance = Math.sqrt(
        Math.pow(bestLandingPoint.x - targetX, 2) +
        Math.pow(bestLandingPoint.y - targetY, 2)
    );
    const initialLandingAccurate = landingDistance <= adaptiveROI;

    // COMPONENT SCORES (adjusted for webcam)
    const gainScore = Math.max(0, 1 - Math.abs(gain - 1.0));
    const landingScore = initialLandingAccurate ? 1.0 : Math.max(0, 1 - (landingDistance / adaptiveROI));
    const stabilityScore = fixationStability;

    //  WEIGHTS: 20% landing, 20% gain, 60% stability
    // Emphasizes stability (ADHD marker) over landing precision (noise-sensitive)
    const accuracyScore = (
        0.20 * landingScore +
        0.20 * gainScore +
        0.60 * stabilityScore
    );

    console.log(`Components: landing=${landingScore.toFixed(3)}, gain=${gainScore.toFixed(3)}, stability=${stabilityScore.toFixed(3)} → final=${accuracyScore.toFixed(3)}`);

    // ADHD markers
    const adhdMarkers = {
        hypometricSaccade: isHypometric,
        poorFixationStability: fixationStability < 0.60,  // Adjusted threshold
        excessiveReorientations: false,  // Would need reorientation detection
        unstableTracking: bestLandingPoint.quality < 0.7
    };

    return {
        accuracyScore: accuracyScore,
        initialLandingAccurate: initialLandingAccurate,
        sustainedFixation: sustainedFixation,

        saccadicGain: gain,
        isHypometric: isHypometric,
        isHypermetric: isHypermetric,

        fixationStability: fixationStability,
        framesInROI: Math.round(weightedInROI),
        totalFramesAnalyzed: qualityFrameCount,

        componentScores: {
            landing: landingScore,
            gain: gainScore,
            stability: stabilityScore
        },

        adhdMarkers: adhdMarkers,

        // Webcam-specific metrics
        trackingQuality: {
            landingPointQuality: bestLandingPoint.quality,
            adaptiveROI: adaptiveROI,
            landingWindow: saccadicGainWindow,
            stabilityThreshold: fixationStabilityThreshold
        },

        debug: {
            fixationPoint: fixationPoint,
            landingPoint: bestLandingPoint,
            target: { x: targetX, y: targetY },
            landingDistance: landingDistance,
            roiRadius: adaptiveROI
        }
    };
};