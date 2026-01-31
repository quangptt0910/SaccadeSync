import { detectSaccade, calculateAdaptiveThreshold, detectSaccadeRaw } from '../../views/GameTest/utils/detectSaccade';
import { MetricConfig } from '../../views/GameTest/utils/metricConfig';

// Mock MetricConfig to have predictable values
jest.mock('../../views/GameTest/utils/metricConfig', () => {
    const originalModule = jest.requireActual('../../views/GameTest/utils/metricConfig');
    return {
        ...originalModule,
        VelocityConfig: {
            ...originalModule.VelocityConfig,
            SCREEN: {
                WIDTH: 1920,
                HEIGHT: 1080,
                HORIZONTAL_FOV_DEGREES: 40,
                VERTICAL_FOV_DEGREES: 30,
            },
            SACCADE: {
                ...originalModule.VelocityConfig.SACCADE,
                STATIC_THRESHOLD_DEG_PER_SEC: 30,
                MAX_BINOCULAR_DISPARITY_DEG_PER_SEC: 100,
                ADAPTIVE: {
                    ENABLED: true,
                    FIXATION_SD_MULTIPLIER: 3,
                    MIN_FIXATION_SAMPLES: 5,
                    MAX_FIXATION_VELOCITY: 100
                }
            },
            TIME: {
                MAX_DELTA_SEC: 0.5
            }
        },
        getPixelsPerDegree: () => ({
            horizontal: 1920 / 40, // 48 pixels per degree
            vertical: 1080 / 30    // 36 pixels per degree
        })
    };
});

describe('detectSaccade', () => {
    const createPoint = (timestamp, x, y, leftX, leftY, rightX, rightY) => ({
        timestamp,
        calibrated: {
            avg: { x, y },
            left: { x: leftX ?? x, y: leftY ?? y },
            right: { x: rightX ?? x, y: rightY ?? y }
        }
    });

    test('should return invalid if time delta is invalid', () => {
        const p1 = createPoint(1000, 0.5, 0.5);
        const p2 = createPoint(1000, 0.5, 0.5); // Same timestamp -> delta = 0
        
        const result = detectSaccade(p2, p1);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('invalid_time_delta');
    });

    test('should return invalid if calibration data is missing', () => {
        const p1 = { timestamp: 1000 };
        const p2 = { timestamp: 1033 };
        
        const result = detectSaccade(p2, p1);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('no_calibration_data');
    });

    test('should detect saccade when velocity exceeds threshold', () => {
        // 48 pixels per degree horizontal
        // Move 0.1 screen width = 192 pixels = 4 degrees
        // Time delta = 33ms = 0.033s
        // Velocity = 4 / 0.033 = 121 deg/s > 30 deg/s threshold
        
        const p1 = createPoint(1000, 0.4, 0.5);
        const p2 = createPoint(1033, 0.5, 0.5);
        
        const result = detectSaccade(p2, p1);
        
        expect(result.isValid).toBe(true);
        expect(result.isSaccade).toBe(true);
        expect(result.velocity).toBeGreaterThan(30);
    });

    test('should not detect saccade when velocity is below threshold', () => {
        // Move 0.001 screen width = 1.92 pixels = 0.04 degrees
        // Time delta = 33ms
        // Velocity = 0.04 / 0.033 = 1.2 deg/s < 30 deg/s
        
        const p1 = createPoint(1000, 0.500, 0.5);
        const p2 = createPoint(1033, 0.501, 0.5);
        
        const result = detectSaccade(p2, p1);
        
        expect(result.isValid).toBe(true);
        expect(result.isSaccade).toBe(false);
    });

    test('should handle binocular disparity', () => {
        // Left eye moves fast (saccade), Right eye stays still
        // Left: 0.4 -> 0.5 (4 deg / 0.033s = 121 deg/s)
        // Right: 0.5 -> 0.5 (0 deg/s)
        // Disparity: 121 deg/s > 100 deg/s (MAX_BINOCULAR_DISPARITY_DEG_PER_SEC)
        
        const p1 = createPoint(1000, 0.45, 0.5, 0.4, 0.5, 0.5, 0.5);
        const p2 = createPoint(1033, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
        
        const result = detectSaccade(p2, p1);
        
        // The function returns isValid: true but with a reason 'excessive_disparity'
        // This allows velocity calculation but flags it.
        // Wait, looking at the code:
        // if (disparity > maxDisparity) { return { ..., isValid: true, reason: 'excessive_disparity', ... } }
        
        expect(result.isValid).toBe(true);
        expect(result.reason).toBe('excessive_disparity');
        expect(result.metadata.disparity).toBeGreaterThan(100);
    });
});

describe('calculateAdaptiveThreshold', () => {
    test('should return static threshold if not enough samples', () => {
        const velocities = [10, 12, 11]; // 3 samples < 5 min
        const threshold = calculateAdaptiveThreshold(velocities);
        expect(threshold).toBe(30); // Static threshold
    });

    test('should calculate adaptive threshold correctly', () => {
        // Mean = 10, SD = 0 (all same)
        // Threshold = Mean + 3*SD = 10
        // But it's clamped to max(adaptive, STATIC * 0.5) = max(10, 15) = 15
        const velocities1 = [10, 10, 10, 10, 10];
        expect(calculateAdaptiveThreshold(velocities1)).toBe(15);

        // Mean = 20
        // Variance: (-10)^2 + 10^2 = 200 / 2 = 100? No.
        // [10, 30, 10, 30, 20] -> Mean 20.
        // Diffs: -10, 10, -10, 10, 0. Sq: 100, 100, 100, 100, 0. Sum=400. Var=80. SD=8.94
        // Threshold = 20 + 3 * 8.94 = 46.8
        const velocities2 = [10, 30, 10, 30, 20];
        const result = calculateAdaptiveThreshold(velocities2);
        expect(result).toBeCloseTo(46.8, 0);
    });
});

describe('detectSaccadeRaw', () => {
    const createRawPoint = (timestamp, lx, ly, rx, ry) => ({
        timestamp,
        leftIris: { x: lx, y: ly },
        rightIris: { x: rx, y: ry }
    });

    test('should detect saccade using raw iris data', () => {
        // Raw iris gain is 30
        // Movement: 0.01 normalized iris units
        // 0.01 * 40deg * 30 = 12 degrees
        // Time: 0.033s
        // Velocity: 12 / 0.033 = 363 deg/s
        
        const p1 = createRawPoint(1000, 0.5, 0.5, 0.5, 0.5);
        const p2 = createRawPoint(1033, 0.51, 0.5, 0.51, 0.5);
        
        const result = detectSaccadeRaw(p2, p1);
        
        expect(result.isValid).toBe(true);
        expect(result.isSaccade).toBe(true);
        expect(result.isRawData).toBe(true);
    });
});
