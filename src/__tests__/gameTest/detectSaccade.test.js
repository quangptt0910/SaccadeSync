/**
 * Tests for Saccade Detection Utilities
 * Tests velocity calculation and saccade detection algorithms
 */

describe('Saccade Detection', () => {
  describe('VelocityConfig', () => {
    // Inline config for testing
    const VelocityConfig = {
      SCREEN: {
        WIDTH: 1920,
        HEIGHT: 1080,
        HORIZONTAL_FOV_DEGREES: 40,
        VERTICAL_FOV_DEGREES: 30,
      },
      SACCADE: {
        STATIC_THRESHOLD_DEG_PER_SEC: 30,
        ONSET_THRESHOLD_DEG_PER_SEC: 35,
        OFFSET_THRESHOLD_DEG_PER_SEC: 25,
        MIN_PEAK_VELOCITY_DEG_PER_SEC: 40,
        MAX_BINOCULAR_DISPARITY_DEG_PER_SEC: 100,
        ADAPTIVE: {
          ENABLED: true,
          FIXATION_SD_MULTIPLIER: 2.5,
          MIN_FIXATION_SAMPLES: 20,
          MAX_FIXATION_VELOCITY: 100,
        },
      },
      LATENCY_VALIDATION: {
        PRO_SACCADE: {
          MIN_MS: 90,
          MAX_MS: 600,
          EXPRESS_THRESHOLD_MS: 120,
        },
        ANTI_SACCADE: {
          MIN_MS: 90,
          MAX_MS: 800,
          EXPRESS_THRESHOLD_MS: 180,
        },
      },
      MIN_AMPLITUDE_DEGREES: 2.0,
      MIN_DURATION_MS: 30,
      MAX_DURATION_MS: 150,
      TIME: {
        MIN_DELTA_MS: 1,
        MAX_DELTA_SEC: 0.1,
      },
    };

    it('should have valid saccade thresholds', () => {
      expect(VelocityConfig.SACCADE.ONSET_THRESHOLD_DEG_PER_SEC).toBeGreaterThan(0);
      expect(VelocityConfig.SACCADE.OFFSET_THRESHOLD_DEG_PER_SEC).toBeGreaterThan(0);
      expect(VelocityConfig.SACCADE.ONSET_THRESHOLD_DEG_PER_SEC).toBeGreaterThan(
        VelocityConfig.SACCADE.OFFSET_THRESHOLD_DEG_PER_SEC
      );
    });

    it('should have hysteresis between onset and offset', () => {
      const hysteresis =
        VelocityConfig.SACCADE.ONSET_THRESHOLD_DEG_PER_SEC -
        VelocityConfig.SACCADE.OFFSET_THRESHOLD_DEG_PER_SEC;
      expect(hysteresis).toBeGreaterThan(0);
    });

    it('should have valid latency ranges', () => {
      const proSaccade = VelocityConfig.LATENCY_VALIDATION.PRO_SACCADE;
      expect(proSaccade.MIN_MS).toBeLessThan(proSaccade.MAX_MS);
      expect(proSaccade.EXPRESS_THRESHOLD_MS).toBeGreaterThan(proSaccade.MIN_MS);
    });

    it('should have longer latency range for anti-saccades', () => {
      const pro = VelocityConfig.LATENCY_VALIDATION.PRO_SACCADE;
      const anti = VelocityConfig.LATENCY_VALIDATION.ANTI_SACCADE;
      expect(anti.MAX_MS).toBeGreaterThanOrEqual(pro.MAX_MS);
    });
  });

  describe('calculateVisualAngleDistance', () => {
    const calculateVisualAngleDistance = (point1, point2, config) => {
      const dxPixels = (point2.x - point1.x) * config.SCREEN.WIDTH;
      const dyPixels = (point2.y - point1.y) * config.SCREEN.HEIGHT;

      const ppdH = config.SCREEN.WIDTH / config.SCREEN.HORIZONTAL_FOV_DEGREES;
      const ppdV = config.SCREEN.HEIGHT / config.SCREEN.VERTICAL_FOV_DEGREES;

      const dxDegrees = dxPixels / ppdH;
      const dyDegrees = dyPixels / ppdV;

      const distanceDegrees = Math.sqrt(dxDegrees ** 2 + dyDegrees ** 2);

      return { distanceDegrees, dxDegrees, dyDegrees };
    };

    const config = {
      SCREEN: {
        WIDTH: 1920,
        HEIGHT: 1080,
        HORIZONTAL_FOV_DEGREES: 40,
        VERTICAL_FOV_DEGREES: 30,
      },
    };

    it('should return 0 for identical points', () => {
      const point = { x: 0.5, y: 0.5 };
      const result = calculateVisualAngleDistance(point, point, config);

      expect(result.distanceDegrees).toBe(0);
      expect(result.dxDegrees).toBe(0);
      expect(result.dyDegrees).toBe(0);
    });

    it('should calculate horizontal movement correctly', () => {
      const point1 = { x: 0.4, y: 0.5 };
      const point2 = { x: 0.6, y: 0.5 };

      const result = calculateVisualAngleDistance(point1, point2, config);

      // 20% of screen width = 0.2 * 40° = 8°
      expect(result.dxDegrees).toBeCloseTo(8, 1);
      expect(result.dyDegrees).toBeCloseTo(0, 5);
      expect(result.distanceDegrees).toBeCloseTo(8, 1);
    });

    it('should calculate vertical movement correctly', () => {
      const point1 = { x: 0.5, y: 0.4 };
      const point2 = { x: 0.5, y: 0.6 };

      const result = calculateVisualAngleDistance(point1, point2, config);

      // 20% of screen height = 0.2 * 30° = 6°
      expect(result.dxDegrees).toBeCloseTo(0, 5);
      expect(result.dyDegrees).toBeCloseTo(6, 1);
      expect(result.distanceDegrees).toBeCloseTo(6, 1);
    });

    it('should calculate diagonal movement correctly', () => {
      const point1 = { x: 0.4, y: 0.4 };
      const point2 = { x: 0.6, y: 0.6 };

      const result = calculateVisualAngleDistance(point1, point2, config);

      // Diagonal = sqrt(8² + 6²) = 10°
      expect(result.distanceDegrees).toBeCloseTo(10, 1);
    });
  });

  describe('velocity calculation', () => {
    const calculateVelocity = (distance, timeDeltaSec) => {
      if (timeDeltaSec <= 0) return null;
      return distance / timeDeltaSec;
    };

    it('should calculate velocity from distance and time', () => {
      const distance = 10; // degrees
      const timeDelta = 0.1; // seconds

      const velocity = calculateVelocity(distance, timeDelta);

      expect(velocity).toBe(100); // 100 deg/sec
    });

    it('should return null for zero time delta', () => {
      const velocity = calculateVelocity(10, 0);
      expect(velocity).toBeNull();
    });

    it('should return null for negative time delta', () => {
      const velocity = calculateVelocity(10, -0.1);
      expect(velocity).toBeNull();
    });

    it('should handle small movements', () => {
      const distance = 0.5; // degrees (small fixational movement)
      const timeDelta = 0.033; // 30fps

      const velocity = calculateVelocity(distance, timeDelta);

      expect(velocity).toBeCloseTo(15.15, 1); // Should be below saccade threshold
    });
  });

  describe('saccade detection logic', () => {
    const ONSET_THRESHOLD = 35;
    const OFFSET_THRESHOLD = 25;
    const MIN_PEAK_VELOCITY = 40;

    const detectSaccadeInSequence = (velocities) => {
      let inSaccade = false;
      let saccadeStart = null;
      let saccadeEnd = null;
      let peakVelocity = 0;

      for (let i = 0; i < velocities.length; i++) {
        const v = velocities[i];

        if (!inSaccade && v >= ONSET_THRESHOLD) {
          inSaccade = true;
          saccadeStart = i;
          peakVelocity = v;
        } else if (inSaccade) {
          if (v > peakVelocity) {
            peakVelocity = v;
          }
          if (v < OFFSET_THRESHOLD) {
            inSaccade = false;
            saccadeEnd = i;
            break;
          }
        }
      }

      if (saccadeStart !== null && saccadeEnd !== null && peakVelocity >= MIN_PEAK_VELOCITY) {
        return {
          detected: true,
          startIndex: saccadeStart,
          endIndex: saccadeEnd,
          peakVelocity: peakVelocity,
        };
      }

      return { detected: false };
    };

    it('should detect valid saccade', () => {
      // Velocity profile: fixation -> saccade -> fixation
      const velocities = [10, 12, 15, 40, 80, 120, 90, 50, 30, 20, 15, 10];

      const result = detectSaccadeInSequence(velocities);

      expect(result.detected).toBe(true);
      expect(result.startIndex).toBe(3); // First above 35
      expect(result.peakVelocity).toBe(120);
    });

    it('should not detect saccade with low peak velocity', () => {
      // Peak just below threshold
      const velocities = [10, 15, 36, 38, 35, 30, 20, 15];

      const result = detectSaccadeInSequence(velocities);

      expect(result.detected).toBe(false);
    });

    it('should not detect saccade during fixation', () => {
      // All velocities below onset threshold
      const velocities = [10, 12, 15, 18, 20, 15, 12, 10];

      const result = detectSaccadeInSequence(velocities);

      expect(result.detected).toBe(false);
    });

    it('should handle incomplete saccade at end of data', () => {
      // Saccade starts but never ends (data truncated)
      const velocities = [10, 15, 40, 80, 100];

      const result = detectSaccadeInSequence(velocities);

      expect(result.detected).toBe(false); // No offset detected
    });
  });

  describe('binocular validation', () => {
    const MAX_DISPARITY = 100;

    const validateBinocularData = (leftVelocity, rightVelocity) => {
      if (leftVelocity === null && rightVelocity === null) {
        return { isValid: false, reason: 'no_data' };
      }

      if (leftVelocity === null || rightVelocity === null) {
        return { isValid: true, reason: 'monocular' };
      }

      const disparity = Math.abs(leftVelocity - rightVelocity);

      if (disparity > MAX_DISPARITY) {
        return { isValid: true, reason: 'excessive_disparity', disparity };
      }

      return { isValid: true, disparity };
    };

    it('should accept matching binocular data', () => {
      const result = validateBinocularData(100, 105);

      expect(result.isValid).toBe(true);
      expect(result.disparity).toBe(5);
    });

    it('should flag excessive disparity', () => {
      const result = validateBinocularData(50, 200);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('excessive_disparity');
    });

    it('should accept monocular data', () => {
      const result = validateBinocularData(100, null);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('monocular');
    });

    it('should reject when no eye data available', () => {
      const result = validateBinocularData(null, null);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no_data');
    });
  });

  describe('latency validation', () => {
    const validateLatency = (latencyMs, isAntiSaccade = false) => {
      const limits = isAntiSaccade
        ? { min: 90, max: 800, express: 180 }
        : { min: 90, max: 600, express: 120 };

      if (latencyMs < limits.min) {
        return { valid: false, reason: 'anticipatory' };
      }
      if (latencyMs > limits.max) {
        return { valid: false, reason: 'too_slow' };
      }

      return {
        valid: true,
        isExpress: latencyMs < limits.express,
      };
    };

    it('should accept normal latency', () => {
      const result = validateLatency(200);

      expect(result.valid).toBe(true);
      expect(result.isExpress).toBe(false);
    });

    it('should flag express saccade', () => {
      const result = validateLatency(100);

      expect(result.valid).toBe(true);
      expect(result.isExpress).toBe(true);
    });

    it('should reject anticipatory saccade', () => {
      const result = validateLatency(50);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('anticipatory');
    });

    it('should reject too slow response', () => {
      const result = validateLatency(700);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('too_slow');
    });

    it('should use longer limits for anti-saccades', () => {
      const result = validateLatency(700, true);

      expect(result.valid).toBe(true); // 700ms OK for anti-saccade
    });
  });
});
