import { analyzeSaccadeData, aggregateTrialStatistics, compareProVsAnti } from '../../views/GameTest/utils/saccadeData';
import { MetricConfig } from '../../views/GameTest/utils/metricConfig';

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

jest.mock('../../views/GameTest/utils/metricConfig', () => {
    const originalModule = jest.requireActual('../../views/GameTest/utils/metricConfig');
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

jest.mock('../../views/GameTest/utils/detectSaccade', () => ({
    calculateAdaptiveThreshold: jest.fn(() => 30)
}));

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
            expect(result.latency).toBe(200);
            expect(result.latencyClassification).toBe('normal');
            expect(result.peakVelocity).toBe(100);
            expect(result.duration).toBe(50);
        });

        test('should classify express saccades', () => {
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

        test('should classify delayed saccades', () => {
            const recordingData = [];
            for (let t = 1000; t < 1800; t += 10) {
                let velocity = 0;
                if (t >= 1700 && t < 1750) velocity = 100;

                recordingData.push({
                    timestamp: t,
                    velocity: velocity,
                    isValid: true
                });
            }

            const result = analyzeSaccadeData(recordingData, dotAppearanceTime, defaultOptions);
            expect(result.latencyClassification).toBe('delayed');
            expect(result.isPhysiologicallyPlausible).toBe(false);
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

        test('should respect anti-saccade latency bounds', () => {
            const antiOptions = { ...defaultOptions, trialType: 'anti' };
            const recordingData = [];
            for (let t = 1000; t < 1400; t += 10) {
                let velocity = 0;
                if (t >= 1160 && t < 1200) velocity = 100;

                recordingData.push({
                    timestamp: t,
                    velocity: velocity,
                    isValid: true
                });
            }

            const result = analyzeSaccadeData(recordingData, dotAppearanceTime, antiOptions);
            expect(result.latencyClassification).toBe('invalid');
        });
    });

    describe('aggregateTrialStatistics', () => {
        test('should aggregate valid trials correctly', () => {
            const trials = [
                {
                    isSaccade: true,
                    isPhysiologicallyPlausible: true,
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
                    latency: 220,
                    peakVelocity: 320,
                    accuracy: 0.8,
                    duration: 60,
                    saccadicGain: 0.9,
                    quality: { binocularDisparityEvents: 1, dataQuality: 1.0 }
                },
                {
                    isSaccade: false,
                    isPhysiologicallyPlausible: false,
                    quality: { dataQuality: 0.5, binocularDisparityEvents: 0 }
                }
            ];

            const stats = aggregateTrialStatistics(trials, 'pro');

            expect(stats.validTrialCount).toBe(2);
            expect(stats.latency.mean).toBe(210);
            expect(stats.peakVelocity.mean).toBe(310);
            expect(stats.accuracy.mean).toBeCloseTo(0.85);
            expect(stats.totalBinocularDisparityEvents).toBe(1);
        });

        test('should handle empty or invalid input', () => {
            const stats = aggregateTrialStatistics([], 'pro');
            expect(stats.validTrialCount).toBe(0);
            expect(stats.warning).toBe('No valid trials found');
        });

        test('should calculate hypometric rate correctly', () => {
            const trials = [
                {
                    isSaccade: true,
                    isPhysiologicallyPlausible: true,
                    latency: 200,
                    peakVelocity: 300,
                    accuracy: 0.9,
                    duration: 50,
                    saccadicGain: 0.7,
                    quality: { binocularDisparityEvents: 0, dataQuality: 1.0 }
                },
                {
                    isSaccade: true,
                    isPhysiologicallyPlausible: true,
                    latency: 220,
                    peakVelocity: 320,
                    accuracy: 0.8,
                    duration: 60,
                    saccadicGain: 0.9,
                    quality: { binocularDisparityEvents: 0, dataQuality: 1.0 }
                }
            ];

            const stats = aggregateTrialStatistics(trials, 'pro');
            expect(stats.gain.hypometricRate).toBe(0.5);
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
                latency: { mean: 350 },
                peakVelocity: { mean: 300 },
                accuracy: { mean: 0.7 },
                gain: { mean: 0.9 },
                averageDataQuality: 0.9
            };

            const comparison = compareProVsAnti(proStats, antiStats);

            expect(comparison.latency.difference).toBe(150);
            expect(comparison.latency.interpretation).toContain('Normal');
            expect(comparison.peakVelocity.ratio).toBeCloseTo(0.75);
            expect(comparison.peakVelocity.interpretation).toContain('Reduced');
            expect(comparison.accuracy.difference).toBeCloseTo(0.2);
            expect(comparison.accuracy.interpretation).toContain('Significant');
            expect(comparison.dataQuality.overall).toBeCloseTo(0.9);
        });

        test('should identify reduced anti-saccade cost', () => {
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
                latency: { mean: 250 },
                peakVelocity: { mean: 400 },
                accuracy: { mean: 0.88 },
                gain: { mean: 0.95 },
                averageDataQuality: 0.9
            };

            const comparison = compareProVsAnti(proStats, antiStats);
            expect(comparison.latency.interpretation).not.toContain('Normal');
        });

        test('should handle insufficient data', () => {
            const comparison = compareProVsAnti({ validTrialCount: 0 }, { validTrialCount: 10 });
            expect(comparison.overallDiagnosis).toContain('Inconclusive');
        });

        test('should handle errors gracefully', () => {
            const comparison = compareProVsAnti(
                { validTrialCount: 10, latency: null },
                { validTrialCount: 10, latency: null }
            );
            expect(comparison.overallDiagnosis).toContain('Inconclusive');
        });
    });
});
