/**
 * Tests for Accuracy Calculation Utilities
 * Tests accuracy metrics and ADHD marker detection for game tests
 */

describe('Accuracy Calculation', () => {
  describe('calculateAdaptiveROI', () => {
    const calculateAdaptiveROI = (calibrationAccuracy, trackerFPS) => {
      const baseROI = 0.1;
      const qualityMultiplier = 1 + (0.95 - calibrationAccuracy) * 2;
      const fpsMultiplier = Math.max(1.0, 60 / trackerFPS);
      const adjustedROI = baseROI * qualityMultiplier * fpsMultiplier;
      return Math.max(0.12, Math.min(0.25, adjustedROI));
    };

    it('should return base ROI for perfect calibration at 60fps', () => {
      const roi = calculateAdaptiveROI(0.95, 60);

      // Base ROI is 0.10, but clamped to min 0.12
      expect(roi).toBeCloseTo(0.12, 2);
    });

    it('should increase ROI for lower calibration accuracy', () => {
      const roiPerfect = calculateAdaptiveROI(0.95, 60);
      const roiPoor = calculateAdaptiveROI(0.75, 60); // Lower accuracy = higher ROI

      expect(roiPoor).toBeGreaterThan(roiPerfect);
    });

    it('should increase ROI for lower FPS', () => {
      const roi60fps = calculateAdaptiveROI(0.91, 60);
      const roi30fps = calculateAdaptiveROI(0.91, 30);

      expect(roi30fps).toBeGreaterThan(roi60fps);
    });

    it('should clamp ROI to maximum value', () => {
      // Very poor calibration and low FPS
      const roi = calculateAdaptiveROI(0.5, 15);

      expect(roi).toBeLessThanOrEqual(0.25);
    });

    it('should clamp ROI to minimum value', () => {
      // Perfect calibration at high FPS
      const roi = calculateAdaptiveROI(1.0, 120);

      expect(roi).toBeGreaterThanOrEqual(0.12);
    });
  });

  describe('assessFrameQuality', () => {
    const assessFrameQuality = (frame) => {
      let qualityScore = 1.0;

      if (!frame.calibrated?.left || !frame.calibrated?.right) {
        qualityScore *= 0.5;
      }

      if (frame.calibrated?.left && frame.calibrated?.right) {
        const dx = Math.abs(frame.calibrated.left.x - frame.calibrated.right.x);
        const dy = Math.abs(frame.calibrated.left.y - frame.calibrated.right.y);
        const disparity = Math.sqrt(dx * dx + dy * dy);

        if (disparity > 0.1) {
          qualityScore *= 0.3;
        } else if (disparity > 0.05) {
          qualityScore *= 0.7;
        }
      }

      if (frame.velocity && frame.velocity > 20 && !frame.isSaccade) {
        qualityScore *= 0.5;
      }

      return qualityScore;
    };

    it('should return 1.0 for high quality binocular frame', () => {
      const frame = {
        calibrated: {
          left: { x: 0.5, y: 0.5 },
          right: { x: 0.51, y: 0.5 },
        },
        velocity: 5,
        isSaccade: false,
      };

      const quality = assessFrameQuality(frame);

      expect(quality).toBe(1.0);
    });

    it('should penalize monocular data', () => {
      const frame = {
        calibrated: {
          left: { x: 0.5, y: 0.5 },
          right: null,
        },
      };

      const quality = assessFrameQuality(frame);

      expect(quality).toBe(0.5);
    });

    it('should penalize large binocular disparity', () => {
      const frame = {
        calibrated: {
          left: { x: 0.3, y: 0.5 },
          right: { x: 0.5, y: 0.5 }, // 0.2 disparity
        },
      };

      const quality = assessFrameQuality(frame);

      expect(quality).toBeLessThan(0.5);
    });

    it('should penalize moderate binocular disparity', () => {
      const frame = {
        calibrated: {
          left: { x: 0.45, y: 0.5 },
          right: { x: 0.52, y: 0.5 }, // ~0.07 disparity
        },
      };

      const quality = assessFrameQuality(frame);

      expect(quality).toBeCloseTo(0.7, 2);
    });

    it('should penalize high velocity during fixation', () => {
      const frame = {
        calibrated: {
          left: { x: 0.5, y: 0.5 },
          right: { x: 0.5, y: 0.5 },
        },
        velocity: 50,
        isSaccade: false,
      };

      const quality = assessFrameQuality(frame);

      expect(quality).toBe(0.5);
    });

    it('should not penalize high velocity during saccade', () => {
      const frame = {
        calibrated: {
          left: { x: 0.5, y: 0.5 },
          right: { x: 0.5, y: 0.5 },
        },
        velocity: 100,
        isSaccade: true,
      };

      const quality = assessFrameQuality(frame);

      expect(quality).toBe(1.0);
    });
  });

  describe('saccadic gain calculation', () => {
    const calculateSaccadicGain = (fixation, landing, target) => {
      const requiredDx = target.x - fixation.x;
      const requiredDy = target.y - fixation.y;
      const requiredAmplitude = Math.sqrt(requiredDx ** 2 + requiredDy ** 2);

      const actualDx = landing.x - fixation.x;
      const actualDy = landing.y - fixation.y;
      const actualAmplitude = Math.sqrt(actualDx ** 2 + actualDy ** 2);

      if (requiredAmplitude === 0) return 1.0;

      return actualAmplitude / requiredAmplitude;
    };

    it('should return 1.0 for perfect saccade', () => {
      const fixation = { x: 0.5, y: 0.5 };
      const target = { x: 0.8, y: 0.5 };
      const landing = { x: 0.8, y: 0.5 };

      const gain = calculateSaccadicGain(fixation, landing, target);

      expect(gain).toBeCloseTo(1.0, 5);
    });

    it('should detect hypometric saccade (undershoot)', () => {
      const fixation = { x: 0.5, y: 0.5 };
      const target = { x: 0.8, y: 0.5 };
      const landing = { x: 0.72, y: 0.5 }; // Only reached 73% of the way

      const gain = calculateSaccadicGain(fixation, landing, target);

      expect(gain).toBeLessThan(1.0);
      expect(gain).toBeCloseTo(0.733, 2);
    });

    it('should detect hypermetric saccade (overshoot)', () => {
      const fixation = { x: 0.5, y: 0.5 };
      const target = { x: 0.8, y: 0.5 };
      const landing = { x: 0.85, y: 0.5 }; // Overshot by ~17%

      const gain = calculateSaccadicGain(fixation, landing, target);

      expect(gain).toBeGreaterThan(1.0);
      expect(gain).toBeCloseTo(1.167, 2);
    });

    it('should handle diagonal saccades', () => {
      const fixation = { x: 0.3, y: 0.3 };
      const target = { x: 0.7, y: 0.7 };
      const landing = { x: 0.7, y: 0.7 };

      const gain = calculateSaccadicGain(fixation, landing, target);

      expect(gain).toBeCloseTo(1.0, 5);
    });

    it('should return 1.0 when target equals fixation', () => {
      const fixation = { x: 0.5, y: 0.5 };
      const target = { x: 0.5, y: 0.5 };
      const landing = { x: 0.5, y: 0.5 };

      const gain = calculateSaccadicGain(fixation, landing, target);

      expect(gain).toBe(1.0);
    });
  });

  describe('ROI check', () => {
    const isWithinROI = (gaze, target, roiRadius) => {
      const distance = Math.sqrt(
        Math.pow(gaze.x - target.x, 2) + Math.pow(gaze.y - target.y, 2)
      );
      return distance <= roiRadius;
    };

    it('should return true when gaze is on target', () => {
      const gaze = { x: 0.5, y: 0.5 };
      const target = { x: 0.5, y: 0.5 };

      expect(isWithinROI(gaze, target, 0.1)).toBe(true);
    });

    it('should return true when gaze is within ROI', () => {
      const gaze = { x: 0.55, y: 0.55 };
      const target = { x: 0.5, y: 0.5 };

      // Distance = sqrt(0.05² + 0.05²) ≈ 0.071
      expect(isWithinROI(gaze, target, 0.1)).toBe(true);
    });

    it('should return false when gaze is outside ROI', () => {
      const gaze = { x: 0.7, y: 0.5 };
      const target = { x: 0.5, y: 0.5 };

      // Distance = 0.2
      expect(isWithinROI(gaze, target, 0.1)).toBe(false);
    });

    it('should handle edge case exactly on boundary', () => {
      const gaze = { x: 0.6, y: 0.5 };
      const target = { x: 0.5, y: 0.5 };

      // Distance = 0.1, exactly on boundary
      expect(isWithinROI(gaze, target, 0.1)).toBe(true);
    });
  });

  describe('fixation stability', () => {
    const calculateFixationStability = (frames, target, roiRadius) => {
      let inROI = 0;
      let total = 0;

      frames.forEach((frame) => {
        if (frame.calibrated?.avg) {
          const distance = Math.sqrt(
            Math.pow(frame.calibrated.avg.x - target.x, 2) +
              Math.pow(frame.calibrated.avg.y - target.y, 2)
          );
          if (distance <= roiRadius) {
            inROI++;
          }
          total++;
        }
      });

      return total > 0 ? inROI / total : 0;
    };

    it('should return 1.0 for perfect fixation', () => {
      const frames = [
        { calibrated: { avg: { x: 0.5, y: 0.5 } } },
        { calibrated: { avg: { x: 0.51, y: 0.49 } } },
        { calibrated: { avg: { x: 0.49, y: 0.51 } } },
      ];
      const target = { x: 0.5, y: 0.5 };

      const stability = calculateFixationStability(frames, target, 0.1);

      expect(stability).toBe(1.0);
    });

    it('should return 0 for no fixation', () => {
      const frames = [
        { calibrated: { avg: { x: 0.1, y: 0.1 } } },
        { calibrated: { avg: { x: 0.2, y: 0.2 } } },
        { calibrated: { avg: { x: 0.3, y: 0.3 } } },
      ];
      const target = { x: 0.8, y: 0.8 };

      const stability = calculateFixationStability(frames, target, 0.1);

      expect(stability).toBe(0);
    });

    it('should return partial stability for mixed fixation', () => {
      const frames = [
        { calibrated: { avg: { x: 0.5, y: 0.5 } } }, // In ROI
        { calibrated: { avg: { x: 0.55, y: 0.55 } } }, // In ROI
        { calibrated: { avg: { x: 0.3, y: 0.3 } } }, // Out of ROI
        { calibrated: { avg: { x: 0.52, y: 0.48 } } }, // In ROI
      ];
      const target = { x: 0.5, y: 0.5 };

      const stability = calculateFixationStability(frames, target, 0.1);

      expect(stability).toBe(0.75); // 3 out of 4
    });

    it('should handle frames with missing data', () => {
      const frames = [
        { calibrated: { avg: { x: 0.5, y: 0.5 } } },
        { calibrated: null },
        { calibrated: { avg: { x: 0.5, y: 0.5 } } },
      ];
      const target = { x: 0.5, y: 0.5 };

      const stability = calculateFixationStability(frames, target, 0.1);

      expect(stability).toBe(1.0); // 2 out of 2 valid frames
    });
  });

  describe('ADHD markers', () => {
    const detectADHDMarkers = (gain, fixationStability, trackingQuality) => {
      return {
        hypometricSaccade: gain < 0.75,
        poorFixationStability: fixationStability < 0.6,
        unstableTracking: trackingQuality < 0.7,
      };
    };

    it('should detect hypometric saccade', () => {
      const markers = detectADHDMarkers(0.7, 0.8, 0.9);

      expect(markers.hypometricSaccade).toBe(true);
      expect(markers.poorFixationStability).toBe(false);
    });

    it('should detect poor fixation stability', () => {
      const markers = detectADHDMarkers(0.9, 0.5, 0.9);

      expect(markers.hypometricSaccade).toBe(false);
      expect(markers.poorFixationStability).toBe(true);
    });

    it('should detect unstable tracking', () => {
      const markers = detectADHDMarkers(0.9, 0.8, 0.5);

      expect(markers.unstableTracking).toBe(true);
    });

    it('should detect multiple markers', () => {
      const markers = detectADHDMarkers(0.6, 0.4, 0.5);

      expect(markers.hypometricSaccade).toBe(true);
      expect(markers.poorFixationStability).toBe(true);
      expect(markers.unstableTracking).toBe(true);
    });

    it('should return no markers for good performance', () => {
      const markers = detectADHDMarkers(0.95, 0.85, 0.9);

      expect(markers.hypometricSaccade).toBe(false);
      expect(markers.poorFixationStability).toBe(false);
      expect(markers.unstableTracking).toBe(false);
    });
  });

  describe('accuracy score calculation', () => {
    const calculateAccuracyScore = (landingScore, gainScore, stabilityScore) => {
      // Weights: 20% landing, 20% gain, 60% stability
      return 0.2 * landingScore + 0.2 * gainScore + 0.6 * stabilityScore;
    };

    it('should return 1.0 for perfect scores', () => {
      const score = calculateAccuracyScore(1.0, 1.0, 1.0);
      expect(score).toBe(1.0);
    });

    it('should weight stability highest', () => {
      // Same total, different distributions
      const scoreHighStability = calculateAccuracyScore(0.5, 0.5, 1.0);
      const scoreLowStability = calculateAccuracyScore(1.0, 1.0, 0.5);

      expect(scoreHighStability).toBeGreaterThan(scoreLowStability);
    });

    it('should calculate weighted average correctly', () => {
      const score = calculateAccuracyScore(0.8, 0.9, 0.7);

      // 0.2*0.8 + 0.2*0.9 + 0.6*0.7 = 0.16 + 0.18 + 0.42 = 0.76
      expect(score).toBeCloseTo(0.76, 5);
    });

    it('should return 0 for zero scores', () => {
      const score = calculateAccuracyScore(0, 0, 0);
      expect(score).toBe(0);
    });
  });
});
