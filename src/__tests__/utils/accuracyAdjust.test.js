import { calculateAccuracy } from '../../views/GameTest/utils/accuracyAdjust';

// Mock the store dependency
jest.mock('../../store/calibrationSlice', () => ({
    selectCalibrationMetrics: {
        accuracy: {
            left: 0.95
        }
    }
}));

describe('calculateAccuracy', () => {
    const defaultOptions = {
        calibrationAccuracy: 0.95,
        trackerFPS: 30,
        roiRadius: 0.15,
        fixationDuration: 300,
        saccadicGainWindow: 100,
        minLatency: 100,
        fixationStabilityThreshold: 0.70
    };

    const createFrame = (timestamp, x, y, targetX = 0.8, targetY = 0.5, velocity = 0, isSaccade = false) => ({
        timestamp,
        targetX,
        targetY,
        calibrated: {
            left: { x, y },
            right: { x, y },
            avg: { x, y }
        },
        velocity,
        isSaccade
    });

    test('should return 0 score when no saccade detected', () => {
        const result = calculateAccuracy([], 1000, {}, defaultOptions);
        expect(result.accuracyScore).toBe(0);
        expect(result.reason).toBe('no_saccade_detected');
    });

    test('should return 0 score when no target data found', () => {
        const saccadeInfo = { saccadeOffsetTime: 1200 };
        const recordingData = [createFrame(1000, 0.5, 0.5, null, null)]; // No target data
        
        const result = calculateAccuracy(recordingData, 1000, saccadeInfo, defaultOptions);
        expect(result.accuracyScore).toBe(0);
        expect(result.reason).toBe('no_target_data');
    });

    test('should calculate perfect accuracy for ideal conditions', () => {
        const dotAppearanceTime = 1000;
        const saccadeOffsetTime = 1200;
        const targetX = 0.8;
        const targetY = 0.5;
        
        // Setup frames:
        // 1. Pre-saccade fixation at (0.2, 0.5)
        // 2. Saccade happens
        // 3. Post-saccade fixation at target (0.8, 0.5)
        
        const recordingData = [];
        
        // Pre-saccade fixation (500ms to 1000ms before dot appearance is checked in code, 
        // but logic says: frame.timestamp < dotAppearanceTime - 500 && frame.timestamp > dotAppearanceTime - 1000)
        // Let's add frames in that window
        for (let t = 100; t < 500; t += 33) {
             recordingData.push(createFrame(t, 0.2, 0.5, 0.2, 0.5));
        }

        // Target appears at 1000
        // Saccade ends at 1200
        // Landing window starts at 1200 + 50 = 1250
        // Landing window ends at 1200 + 100 + 50 = 1350
        
        // Add target frames
        for (let t = 1000; t < 2000; t += 33) {
            // Perfect tracking at target after saccade
            const x = t > 1200 ? targetX : 0.2;
            recordingData.push(createFrame(t, x, 0.5, targetX, targetY));
        }

        const saccadeInfo = { saccadeOffsetTime };
        
        const result = calculateAccuracy(recordingData, dotAppearanceTime, saccadeInfo, defaultOptions);
        
        expect(result.accuracyScore).toBeGreaterThan(0.9);
        expect(result.saccadicGain).toBeCloseTo(1.0, 1);
        expect(result.sustainedFixation).toBe(true);
        expect(result.isHypometric).toBe(false);
        expect(result.isHypermetric).toBe(false);
    });

    test('should detect hypometric saccade (undershoot)', () => {
        const dotAppearanceTime = 1000;
        const saccadeOffsetTime = 1200;
        const targetX = 0.8;
        const startX = 0.2;
        
        // Undershoot: lands at 0.6 instead of 0.8
        // Distance required: 0.6, Actual: 0.4 -> Gain ~0.66
        const landingX = 0.6; 

        const recordingData = [];
        
        // Pre-saccade
        for (let t = 100; t < 500; t += 33) {
             recordingData.push(createFrame(t, startX, 0.5, startX, 0.5));
        }

        // Post-saccade
        for (let t = 1000; t < 2000; t += 33) {
            const x = t > 1200 ? landingX : startX;
            recordingData.push(createFrame(t, x, 0.5, targetX, 0.5));
        }

        const saccadeInfo = { saccadeOffsetTime };
        const result = calculateAccuracy(recordingData, dotAppearanceTime, saccadeInfo, defaultOptions);

        expect(result.isHypometric).toBe(true);
        expect(result.saccadicGain).toBeLessThan(0.75);
    });

    test('should detect hypermetric saccade (overshoot)', () => {
        const dotAppearanceTime = 1000;
        const saccadeOffsetTime = 1200;
        const targetX = 0.8;
        const startX = 0.2;
        
        // Overshoot: lands at 0.95 instead of 0.8
        // Distance required: 0.6, Actual: 0.75 -> Gain ~1.25
        const landingX = 0.95; 

        const recordingData = [];
        
        // Pre-saccade
        for (let t = 100; t < 500; t += 33) {
             recordingData.push(createFrame(t, startX, 0.5, startX, 0.5));
        }

        // Post-saccade
        for (let t = 1000; t < 2000; t += 33) {
            const x = t > 1200 ? landingX : startX;
            recordingData.push(createFrame(t, x, 0.5, targetX, 0.5));
        }

        const saccadeInfo = { saccadeOffsetTime };
        const result = calculateAccuracy(recordingData, dotAppearanceTime, saccadeInfo, defaultOptions);

        expect(result.isHypermetric).toBe(true);
        expect(result.saccadicGain).toBeGreaterThan(1.10);
    });

    test('should handle poor fixation stability', () => {
        const dotAppearanceTime = 1000;
        const saccadeOffsetTime = 1200;
        const targetX = 0.8;
        
        const recordingData = [];
        
        // Pre-saccade
        for (let t = 100; t < 500; t += 33) {
             recordingData.push(createFrame(t, 0.2, 0.5, 0.2, 0.5));
        }

        // Post-saccade: Jittery movement around target
        // Alternating inside and outside ROI
        for (let t = 1000; t < 2000; t += 33) {
            let x = 0.2;
            if (t > 1200) {
                // Jitter: 0.8 (target) then 0.4 (far away)
                x = (t % 66 === 0) ? targetX : 0.4; 
            }
            recordingData.push(createFrame(t, x, 0.5, targetX, 0.5));
        }

        const saccadeInfo = { saccadeOffsetTime };
        const result = calculateAccuracy(recordingData, dotAppearanceTime, saccadeInfo, defaultOptions);

        expect(result.sustainedFixation).toBe(false);
        expect(result.fixationStability).toBeLessThan(0.70);
        expect(result.adhdMarkers.poorFixationStability).toBe(true);
    });

    test('should adjust quality score based on binocular disparity', () => {
        // This test indirectly checks assessFrameQuality logic via calculateAccuracy
        const dotAppearanceTime = 1000;
        const saccadeOffsetTime = 1200;
        const targetX = 0.8;

        const recordingData = [];
        
        // Pre-saccade
        for (let t = 100; t < 500; t += 33) {
             recordingData.push(createFrame(t, 0.2, 0.5, 0.2, 0.5));
        }

        // Post-saccade with high disparity
        for (let t = 1000; t < 2000; t += 33) {
            const frame = createFrame(t, targetX, 0.5, targetX, 0.5);
            if (t > 1200) {
                // Large disparity between left and right eye
                frame.calibrated.left = { x: targetX, y: 0.5 };
                frame.calibrated.right = { x: targetX + 0.2, y: 0.5 }; // 0.2 disparity
                // avg is still somewhat close but quality should be low
                frame.calibrated.avg = { x: targetX + 0.1, y: 0.5 };
            }
            recordingData.push(frame);
        }

        const saccadeInfo = { saccadeOffsetTime };
        const result = calculateAccuracy(recordingData, dotAppearanceTime, saccadeInfo, defaultOptions);

        // Tracking quality should be low due to disparity
        expect(result.trackingQuality.landingPointQuality).toBeLessThan(1.0);
    });
});
