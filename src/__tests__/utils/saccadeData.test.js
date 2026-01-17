import { analyzeSaccadeData, aggregateTrialStatistics, compareProVsAnti } from '../../views/GameTest/utils/saccadeData';
import { VelocityConfig } from '../../views/GameTest/utils/velocityConfig';

// Mock dependencies
jest.mock('../../views/GameTest/utils/accuracyAdjust', () => ({
    calculateAccuracy: jest.fn(() => ({
        accuracyScore: 0.9,
        componentScores: { landing: 0.9, gain: 0.9, stability: 0.9 },
        saccadicGain: 1.0,
        sustainedFixation: true,
        fixationStability: 0.9,
        adhdMarkers: { hypometricSaccade: false }
    }))
}));

jest.mock('../../store/calibrationSlice', () => ({
    selectCalibrationMetrics: {
        accuracy: { left: 0.95 }
    }
}));

// Mock VelocityConfig
jest.mock('../../views/GameTest/utils/velocityConfig', () => {
    const originalModule = jest.requireActual('../../views/GameTest/utils/velocityConfig');
    return {
        ...originalModule,
        VelocityConfig: {
            ...originalModule.VelocityConfig,
            LATENCY_VALIDATION: {
                PRO_SACCADE: { MIN_MS: 90, MAX_MS: 600, EXPRESS_THRESHOLD_MS: 120 },
                ANTI_SACCADE: { MIN_MS: 150, MAX_MS: 800, EXPRESS_THRESHOLD_MS: 180 }
            }
        }
    };
});

describe('saccadeData Analysis', () => {
    describe('analyzeSaccadeData', () => {
        const dotAppearanceTime = 1000;
        const defaultOptions = {
            requireValidData: true,
            minLatency: 50,
            maxLatency: 600,
            adaptiveThreshold: 30,
            trialType: 'pro'
        };

        test('should detect saccade and calculate latency correctly', () => {
            // Create data: 
            // 1000-1200ms: Fixation (velocity 0)
            // 1200ms: Saccade start (velocity 100)
            // 1250ms: Saccade end (velocity 0)
            
            const recordingData = [];
            for (let t = 1000; t < 1300; t += 10) {
                let velocity = 0;
                if (t >= 1200 && t < 1250) velocity = 100;
                
                recordingData.push({
                    timestamp: t,
                    velocity: velocity,
                    isValid: true
                });
            }

            const result = analyzeSaccadeData(recordingData, dotAppearanceTime, defaultOptions);

            expect(result.isSaccade).toBe(true);
            expect(result.latency).toBe(200); // 1200 - 1000
            expect(result.latencyClassification).toBe('normal');
            expect(result.peakVelocity).toBe(100);
            expect(result.duration).toBe(50); // 1250 - 1200
        });

        test('should classify express saccades', () => {
            // Saccade at 1100ms (100ms latency) -> Express (<120ms)
            const recordingData = [];
            for (let t = 1000; t < 1300; t += 10) {
                let velocity = 0;
                if (t >= 1100 && t < 1150) velocity = 100;
                
                recordingData.push({
                    timestamp: t,
                    velocity: velocity,
                    isValid: true
                });
            }

            const result = analyzeSaccadeData(recordingData, dotAppearanceTime, defaultOptions);
            expect(result.latencyClassification).toBe('express');
        });

        test('should handle invalid frames', () => {
            const recordingData = [
                { timestamp: 1000, isValid: false, invalidReason: 'excessive_disparity' },
                { timestamp: 1010, isValid: true, velocity: 0 }
            ];

            const result = analyzeSaccadeData(recordingData, dotAppearanceTime, defaultOptions);
            
            expect(result.quality.invalidFrames).toBe(1);
            expect(result.quality.binocularDisparityEvents).toBe(1);
            expect(result.quality.dataQuality).toBe(0.5);
        });
    });

    describe('aggregateTrialStatistics', () => {
        test('should aggregate valid trials correctly', () => {
            const trials = [
                {
                    isSaccade: true,
                    isPhysiologicallyPlausible: true,
                    quality: { dataQuality: 1.0 },
                    latency: 200,
                    peakVelocity: 300,
                    accuracy: 0.9,
                    duration: 50,
                    saccadicGain: 1.0,
                    quality: { binocularDisparityEvents: 0, dataQuality: 1.0 }
                },
                {
                    isSaccade: true,
                    isPhysiologicallyPlausible: true,
                    quality: { dataQuality: 1.0 },
                    latency: 220,
                    peakVelocity: 320,
                    accuracy: 0.8,
                    duration: 60,
                    saccadicGain: 0.9,
                    quality: { binocularDisparityEvents: 1, dataQuality: 1.0 }
                },
                {
                    isSaccade: false, // Invalid trial
                    isPhysiologicallyPlausible: false,
                    quality: { dataQuality: 0.5 }
                }
            ];

            const stats = aggregateTrialStatistics(trials, 'pro');

            expect(stats.validTrialCount).toBe(2);
            expect(stats.latency.mean).toBe(210);
            expect(stats.peakVelocity.mean).toBe(310);
            expect(stats.accuracy.mean).toBe(0.85);
            expect(stats.totalBinocularDisparityEvents).toBe(1);
        });

        test('should handle empty or invalid input', () => {
            const stats = aggregateTrialStatistics([], 'pro');
            expect(stats.validTrialCount).toBe(0);
            expect(stats.warning).toBe('No valid trials found');
        });
    });

    describe('compareProVsAnti', () => {
        test('should compare pro and anti stats correctly', () => {
            const proStats = {
                validTrialCount: 10,
                latency: { mean: 200 },
                peakVelocity: { mean: 400 },
                accuracy: { mean: 0.9 },
                gain: { mean: 1.0 },
                averageDataQuality: 0.9
            };

            const antiStats = {
                validTrialCount: 10,
                latency: { mean: 350 }, // 150ms difference
                peakVelocity: { mean: 300 }, // 0.75 ratio
                accuracy: { mean: 0.7 }, // 0.2 difference
                gain: { mean: 0.9 },
                averageDataQuality: 0.9
            };

            const comparison = compareProVsAnti(proStats, antiStats);

            expect(comparison.latency.difference).toBe(150);
            expect(comparison.latency.interpretation).toContain('Normal');
            
            expect(comparison.peakVelocity.ratio).toBe(0.75);
            expect(comparison.peakVelocity.interpretation).toContain('Reduced');

            expect(comparison.accuracy.difference).toBeCloseTo(0.2);
            expect(comparison.accuracy.interpretation).toContain('Significant');
        });

        test('should handle insufficient data', () => {
            const comparison = compareProVsAnti({ validTrialCount: 0 }, { validTrialCount: 10 });
            expect(comparison.overallDiagnosis).toContain('Inconclusive');
        });
    });
});
