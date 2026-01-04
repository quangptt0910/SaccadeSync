// ============================================================================
// Algorithmic Calculation of Spatial Accuracy
// Saccadic Gain (The Amplitude Ratio) This is the standard metric
// for determining if a subject undershoots (hypometria) or overshoots (hypermetria) the target.
// ALGO: Gain = Actual Visual angle/ desired target amplitude
// ============================================================================
/**
 * Calculate Saccadic Gain (research standard metric)
 * Gain = Actual Eye Movement / Required Eye Movement
 *
 * Perfect saccade: Gain = 1.0
 * Hypometric (undershooting): Gain < 1.0 (common in ADHD)
 * Hypermetric (overshooting): Gain > 1.0
 */
const calculateSaccadicGain = (gazeX, gazeY, startX, startY, targetX, targetY) => {
    // Calculate required movement (from fixation to target)
    const requiredDx = targetX - startX;
    const requiredDy = targetY - startY;
    const requiredAmplitude = Math.sqrt(requiredDx * requiredDx + requiredDy * requiredDy);

    // Calculate actual movement (from fixation to landing point)
    const actualDx = gazeX - startX;
    const actualDy = gazeY - startY;
    const actualAmplitude = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

    if (requiredAmplitude === 0) return 1.0; // Edge case

    const gain = actualAmplitude / requiredAmplitude;

    return {
        gain: gain,
        requiredAmplitude: requiredAmplitude,
        actualAmplitude: actualAmplitude,
        isHypometric: gain < 0.85,  // ADHD marker
        isHypermetric: gain > 1.15
    };
};

/**
 * Check if gaze point is within Region of Interest (ROI)
 * ROI size based on research: typically 2-3° visual angle around target
 */
const isWithinROI = (gazeX, gazeY, targetX, targetY, roiRadius = 0.1) => {
    const distance = Math.sqrt(
        Math.pow(gazeX - targetX, 2) +
        Math.pow(gazeY - targetY, 2)
    );
    return distance <= roiRadius;
};

/**
 * RESEARCH-GRADE ACCURACY CALCULATION
 * Implements methodology from leading ADHD eye-tracking studies
 *
 * @param {Array} recordingData - Full tracking data
 * @param {number} dotAppearanceTime - T0 (stimulus onset)
 * @param {Object} saccadeInfo - Saccade detection results
 * @param {Object} options - Configuration
 * @returns {Object} Comprehensive accuracy metrics
 */
export const calculateAccuracyResearchGrade = (
    recordingData,
    dotAppearanceTime,
    saccadeInfo,
    options = {}
) => {
    const {
        roiRadius = 0.1,              // ~3° visual angle (0.1 = 10% of screen)
        fixationDuration = 300,        // 300ms sustained fixation (https://mhealth.jmir.org/2024/1/e58927)
        saccadicGainWindow = 67,       // 67ms after saccade end (https://pmc.ncbi.nlm.nih.gov/articles/PMC2963044/)
        minLatency = 100               // Ignore first 100ms (anticipatory filter)
    } = options;

    // STEP 0: Validate inputs
    if (!saccadeInfo.saccadeOffsetTime) {
        return {
            accuracyScore: 0,
            reason: 'no_saccade_detected',
            saccadicGain: null,
            sustainedFixation: false
        };
    }

    // STEP 1: Find fixation point BEFORE saccade (baseline)
    let fixationPoint = null;
    for (const frame of recordingData) {
        if (frame.timestamp < dotAppearanceTime - 500 &&
            frame.timestamp > dotAppearanceTime - 1000) {
            if (frame.calibrated?.avg) {
                fixationPoint = {
                    x: frame.calibrated.avg.x,
                    y: frame.calibrated.avg.y
                };
                break;
            }
        }
    }

    if (!fixationPoint) {
        // Fallback: use center point
        fixationPoint = { x: 0.5, y: 0.5 };
    }

    // STEP 2: Get target coordinates
    const targetFrame = recordingData.find(f =>
        f.timestamp >= dotAppearanceTime &&
        f.targetX !== null &&
        f.targetX !== undefined
    );

    if (!targetFrame) {
        console.warn('No target coordinates found');
        return {
            accuracyScore: 0,
            reason: 'no_target_data',
            saccadicGain: null,
            sustainedFixation: false
        };
    }

    const targetX = targetFrame.targetX;
    const targetY = targetFrame.targetY;

    // STEP 3: Capture landing point at T_land + 67ms (Saccadic Gain measurement)
    const landingTime = saccadeInfo.saccadeOffsetTime + saccadicGainWindow;
    let landingPoint = null;

    // Find frame closest to landing time
    let closestFrame = null;
    let minTimeDiff = Infinity;

    for (const frame of recordingData) {
        if (frame.timestamp >= landingTime && frame.calibrated?.avg) {
            const timeDiff = Math.abs(frame.timestamp - landingTime);
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestFrame = frame;
            }
            if (timeDiff > 50) break; // Don't look too far ahead
        }
    }

    if (closestFrame) {
        landingPoint = {
            x: closestFrame.calibrated.avg.x,
            y: closestFrame.calibrated.avg.y,
            timestamp: closestFrame.timestamp
        };
    } else {
        // Fallback: use first frame after saccade
        for (const frame of recordingData) {
            if (frame.timestamp > saccadeInfo.saccadeOffsetTime && frame.calibrated?.avg) {
                landingPoint = {
                    x: frame.calibrated.avg.x,
                    y: frame.calibrated.avg.y,
                    timestamp: frame.timestamp
                };
                break;
            }
        }
    }

    if (!landingPoint) {
        return {
            accuracyScore: 0,
            reason: 'no_landing_data',
            saccadicGain: null,
            sustainedFixation: false
        };
    }

    // STEP 4: Calculate Saccadic Gain
    const gainMetrics = calculateSaccadicGain(
        landingPoint.x, landingPoint.y,
        fixationPoint.x, fixationPoint.y,
        targetX, targetY
    );

    console.log('🎯 Saccadic Gain Analysis:', {
        landingPoint: { x: landingPoint.x.toFixed(3), y: landingPoint.y.toFixed(3) },
        target: { x: targetX.toFixed(3), y: targetY.toFixed(3) },
        gain: gainMetrics.gain.toFixed(3),
        isHypometric: gainMetrics.isHypometric,
        isHypermetric: gainMetrics.isHypermetric
    });

    // STEP 5: Validate Sustained Fixation (300ms in ROI - target area)
    // This is THE KEY ADHD BIOMARKER
    const fixationStartTime = landingPoint.timestamp;
    const fixationEndTime = fixationStartTime + fixationDuration;

    let framesInROI = 0;
    let totalFramesInWindow = 0;
    let consecutiveFramesInROI = 0;
    let maxConsecutiveInROI = 0;
    let leftROICount = 0; // Count of breaks from ROI

    for (const frame of recordingData) {
        if (frame.timestamp < fixationStartTime) continue;
        if (frame.timestamp > fixationEndTime) break;

        if (frame.calibrated?.avg) {
            totalFramesInWindow++;

            const inROI = isWithinROI(
                frame.calibrated.avg.x,
                frame.calibrated.avg.y,
                targetX,
                targetY,
                roiRadius
            );

            if (inROI) {
                framesInROI++;
                consecutiveFramesInROI++;
                maxConsecutiveInROI = Math.max(maxConsecutiveInROI, consecutiveFramesInROI);
            } else {
                if (consecutiveFramesInROI > 0) {
                    leftROICount++;
                }
                consecutiveFramesInROI = 0;
            }
        }
    }

    // Research criteria: >= 80% of frames must be in ROI
    const fixationStability = totalFramesInWindow > 0
        ? framesInROI / totalFramesInWindow
        : 0;

    const sustainedFixation = fixationStability >= 0.80;

    // STEP 6: Calculate final accuracy score (multi-component)
    // Component 1: Initial accuracy (landing within ROI)
    const initialLandingAccurate = isWithinROI(
        landingPoint.x, landingPoint.y,
        targetX, targetY,
        roiRadius
    );

    // Component 2: Saccadic gain (closeness to 1.0)
    const gainScore = Math.max(0, 1 - Math.abs(gainMetrics.gain - 1.0));

    // Component 3: Sustained fixation stability
    const stabilityScore = fixationStability;

    // Weighted composite score (research-validated weights)
    const accuracyScore = (
        0.3 * (initialLandingAccurate ? 1 : 0) +  // 30% initial accuracy
        0.3 * gainScore +                          // 30% gain quality
        0.4 * stabilityScore                       // 40% sustained attention (KEY for ADHD)
    );

    console.log('📊 Accuracy Breakdown:', {
        initialLanding: initialLandingAccurate ? 'YES' : 'NO',
        gainScore: gainScore.toFixed(3),
        stabilityScore: stabilityScore.toFixed(3),
        finalAccuracy: accuracyScore.toFixed(3)
    });

    // STEP 7: ADHD-specific markers
    const adhdMarkers = {
        hypometricSaccade: gainMetrics.isHypometric,
        poorFixationStability: fixationStability < 0.70,
        excessiveReorientations: leftROICount > 2,
        correctiveRefixations: leftROICount >= 1 && sustainedFixation
    };

    return {
        // Primary Accuracy Metrics
        accuracyScore: accuracyScore,                    // 0.0 - 1.0
        initialLandingAccurate: initialLandingAccurate,
        sustainedFixation: sustainedFixation,

        // Saccadic Gain (CRITICAL for ADHD)
        saccadicGain: gainMetrics.gain,
        isHypometric: gainMetrics.isHypometric,
        isHypermetric: gainMetrics.isHypermetric,

        // Fixation Stability (CRITICAL for ADHD)
        fixationStability: fixationStability,           // % time in ROI
        framesInROI: framesInROI,
        totalFramesAnalyzed: totalFramesInWindow,
        numberOfReorientations: leftROICount,
        maxConsecutiveFixation: maxConsecutiveInROI,

        // Component Scores
        componentScores: {
            initialLanding: initialLandingAccurate ? 1 : 0,
            gainQuality: gainScore,
            fixationStability: stabilityScore
        },

        // ADHD Biomarkers
        adhdMarkers: adhdMarkers,

        // Debug info
        debug: {
            fixationPoint: fixationPoint,
            landingPoint: landingPoint,
            target: { x: targetX, y: targetY },
            landingTimestamp: landingPoint.timestamp,
            analysisWindow: {
                start: fixationStartTime,
                end: fixationEndTime,
                duration: fixationDuration
            }
        }
    };
};

