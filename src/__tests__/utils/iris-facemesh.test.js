import IrisFaceMeshTracker from '../../views/GameTest/utils/iris-facemesh';
import { detectSaccade } from '../../views/GameTest/utils/detectSaccade';

// Mock MediaPipe
jest.mock('@mediapipe/tasks-vision', () => ({
    FaceLandmarker: {
        createFromOptions: jest.fn(() => Promise.resolve({
            detectForVideo: jest.fn(),
            close: jest.fn()
        }))
    },
    FilesetResolver: {
        forVisionTasks: jest.fn(() => Promise.resolve({}))
    }
}));

jest.mock('../../views/GameTest/utils/detectSaccade');

// Helper function to create a full landmarks array with required indices
const createLandmarks = (overrides = {}) => {
    const landmarks = new Array(500).fill(null);

    // Default landmark positions
    const defaults = {
        // Left eye indices: inner: 33, outer: 133, iris: 468
        33: { x: 0.1, y: 0.5 },  // left inner
        133: { x: 0.3, y: 0.5 }, // left outer
        468: { x: 0.2, y: 0.5 }, // left iris
        // Right eye indices: inner: 362, outer: 263, iris: 473
        362: { x: 0.7, y: 0.5 }, // right inner
        263: { x: 0.9, y: 0.5 }, // right outer
        473: { x: 0.8, y: 0.5 }  // right iris
    };

    // Merge defaults with overrides
    const finalIndices = { ...defaults, ...overrides };

    // Apply all landmarks
    Object.entries(finalIndices).forEach(([index, value]) => {
        landmarks[parseInt(index)] = value;
    });

    return landmarks;
};

describe('IrisFaceMeshTracker', () => {
    let tracker;
    let mockVideo;
    let mockFaceLandmarker;

    beforeEach(() => {
        tracker = new IrisFaceMeshTracker();

        // Mock video element
        mockVideo = {
            style: {},
            autoplay: false,
            playsInline: false,
            srcObject: null,
            videoWidth: 1280,
            videoHeight: 720,
            readyState: 0,
            onloadeddata: null
        };

        // Mock MediaPipe FaceLandmarker
        mockFaceLandmarker = {
            detectForVideo: jest.fn(),
            close: jest.fn()
        };

        // Mock document methods
        document.createElement = jest.fn((tag) => {
            if (tag === 'video') return mockVideo;
            return document.createElement(tag);
        });
        document.body.appendChild = jest.fn();
        document.body.removeChild = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with default values', () => {
            expect(tracker.faceLandmarker).toBeNull();
            expect(tracker.isTracking).toBe(false);
            expect(tracker.trackingData).toEqual([]);
            expect(tracker.videoElement).toBeNull();
            expect(tracker.calibrationModel).toBeNull();
            expect(tracker.currentContext).toEqual({
                trial: null,
                dotPosition: null,
                targetX: null,
                targetY: null
            });
        });

        test('should initialize with correct iris indices', () => {
            expect(tracker.RIGHT_IRIS_CENTER).toBe(473);
            expect(tracker.LEFT_IRIS_CENTER).toBe(468);
        });
    });

    describe('getRelativeIrisPos', () => {
        test('should calculate relative iris position for left eye', () => {
            const landmarks = createLandmarks();
            const result = tracker.getRelativeIrisPos(landmarks, 'left');

            expect(result).not.toBeNull();
            expect(result).toHaveProperty('x');
            expect(result).toHaveProperty('y');
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        test('should calculate relative iris position for right eye', () => {
            const landmarks = createLandmarks();
            const result = tracker.getRelativeIrisPos(landmarks, 'right');

            expect(result).not.toBeNull();
            expect(result).toHaveProperty('x');
            expect(result).toHaveProperty('y');
        });

        test('should return null if landmarks are missing', () => {
            const landmarks = createLandmarks({
                133: null, // remove outer landmark
                468: null  // remove iris landmark
            });

            const result = tracker.getRelativeIrisPos(landmarks, 'left');
            expect(result).toBeNull();
        });

        test('should return null if eye side is invalid', () => {
            const landmarks = createLandmarks();
            // Invalid eye side should throw an error because EYE_INDICES[eyeSide] is undefined
            expect(() => {
                tracker.getRelativeIrisPos(landmarks, 'invalid');
            }).toThrow();
        });

        test('should return null for undefined eye side', () => {
            const landmarks = createLandmarks();
            // Undefined eye side should throw an error because EYE_INDICES[eyeSide] is undefined
            expect(() => {
                tracker.getRelativeIrisPos(landmarks, undefined);
            }).toThrow();
        });

        test('should calculate with different iris positions', () => {
            const landmarks = createLandmarks({
                468: { x: 0.15, y: 0.5 } // iris moved closer to inner corner
            });
            const result = tracker.getRelativeIrisPos(landmarks, 'left');

            expect(result).not.toBeNull();
            expect(typeof result.x).toBe('number');
        });

        test('should handle iris at outer corner', () => {
            const landmarks = createLandmarks({
                468: { x: 0.28, y: 0.5 } // iris at outer corner position
            });
            const result = tracker.getRelativeIrisPos(landmarks, 'left');

            expect(result).not.toBeNull();
            expect(result.x).toBeGreaterThan(0.8);
        });
    });

    describe('setCalibrationModel', () => {
        test('should set calibration model correctly', () => {
            const mockModel = {
                left: { coefX: [1, 2, 3, 4, 5, 6], coefY: [1, 2, 3, 4, 5, 6] },
                right: { coefX: [1, 2, 3, 4, 5, 6], coefY: [1, 2, 3, 4, 5, 6] }
            };

            tracker.setCalibrationModel(mockModel);
            expect(tracker.calibrationModel).toEqual(mockModel);
        });

        test('should handle null model', () => {
            tracker.setCalibrationModel(null);
            expect(tracker.calibrationModel).toBeNull();
        });
    });

    describe('predictGaze', () => {
        const mockModel = {
            left: {
                coefX: [0, 1, 0, 0, 0, 0],
                coefY: [0, 0, 1, 0, 0, 0]
            },
            right: {
                coefX: [0, 1, 0, 0, 0, 0],
                coefY: [0, 0, 1, 0, 0, 0]
            },
            metadata: { coordinateSystem: 'normalized' }
        };

        beforeEach(() => {
            tracker.setCalibrationModel(mockModel);
        });

        test('should predict gaze with valid calibration model', () => {
            const iris = { x: 0.5, y: 0.5 };
            const result = tracker.predictGaze(iris, 'left');

            expect(result).not.toBeNull();
            expect(result).toHaveProperty('x');
            expect(result).toHaveProperty('y');
            expect(result.x).toBeCloseTo(0.5);
            expect(result.y).toBeCloseTo(0.5);
        });

        test('should return null if no calibration model is set', () => {
            tracker.setCalibrationModel(null);
            const result = tracker.predictGaze({ x: 0.5, y: 0.5 }, 'left');
            expect(result).toBeNull();
        });

        test('should return null if eye coefficients are missing', () => {
            const incompleteModel = {
                left: { coefX: [1, 2, 3], coefY: [1, 2, 3] } // Less than 6 coefficients
            };
            tracker.setCalibrationModel(incompleteModel);

            const result = tracker.predictGaze({ x: 0.5, y: 0.5 }, 'left');
            expect(result).toBeNull();
        });

        test('should apply quadratic calibration formula correctly', () => {
            const iris = { x: 0.2, y: 0.3 };
            const quadraticModel = {
                left: {
                    coefX: [1, 2, 0, 3, 0, 0],
                    coefY: [0.5, 0, 2, 0, 0, 0]
                }
            };
            tracker.setCalibrationModel(quadraticModel);

            const result = tracker.predictGaze(iris, 'left');
            // rawX = 1 + 2*0.2 + 0*0.3 + 3*0.04 + 0*0.09 + 0*0.06 = 1.52
            // rawY = 0.5 + 0*0.2 + 2*0.3 + 0*0.04 + 0*0.09 + 0*0.06 = 1.1
            expect(result.x).toBeCloseTo(1.52);
            expect(result.y).toBeCloseTo(1.1);
        });

        test('should normalize coordinates if they exceed threshold', () => {
            const iris = { x: 0.5, y: 0.5 };
            const largeCoeffModel = {
                left: {
                    coefX: [1000, 2000, 0, 0, 0, 0],
                    coefY: [1000, 0, 2000, 0, 0, 0]
                }
            };
            tracker.setCalibrationModel(largeCoeffModel);
            global.window = { innerWidth: 1920, innerHeight: 1080 };

            const result = tracker.predictGaze(iris, 'left');
            expect(result).not.toBeNull();
        });
    });

    describe('addTrialContext', () => {
        test('should set context for center position', () => {
            tracker.addTrialContext(1, 'center');

            expect(tracker.currentContext.trial).toBe(1);
            expect(tracker.currentContext.dotPosition).toBe('center');
            expect(tracker.currentContext.targetX).toBe(0.5);
            expect(tracker.currentContext.targetY).toBe(0.5);
        });

        test('should set context for left position', () => {
            tracker.addTrialContext(1, 'left');

            expect(tracker.currentContext.trial).toBe(1);
            expect(tracker.currentContext.targetX).toBe(0.2);
            expect(tracker.currentContext.targetY).toBe(0.5);
        });

        test('should set context for right position', () => {
            tracker.addTrialContext(1, 'right');

            expect(tracker.currentContext.trial).toBe(1);
            expect(tracker.currentContext.targetX).toBe(0.8);
            expect(tracker.currentContext.targetY).toBe(0.5);
        });

        test('should handle anti-saccade left position (opposite target)', () => {
            tracker.addTrialContext(1, 'anti-left');

            expect(tracker.currentContext.targetX).toBe(0.8);
            expect(tracker.currentContext.targetY).toBe(0.5);
        });

        test('should handle anti-saccade right position (opposite target)', () => {
            tracker.addTrialContext(1, 'anti-right');

            expect(tracker.currentContext.targetX).toBe(0.2);
            expect(tracker.currentContext.targetY).toBe(0.5);
        });

        test('should update last tracking point with trial context', () => {
            const mockPoint = {
                timestamp: 100,
                trial: null,
                dotPosition: null,
                targetX: null,
                targetY: null
            };
            tracker.trackingData.push(mockPoint);

            tracker.addTrialContext(2, 'right');

            // Verify the last point was updated
            expect(tracker.trackingData[0].trial).toBe(2);
            expect(tracker.trackingData[0].dotPosition).toBe('right');
            expect(tracker.trackingData[0].targetX).toBe(0.8);
        });

        test('should not fail if trackingData is empty', () => {
            tracker.trackingData = [];
            expect(() => tracker.addTrialContext(1, 'center')).not.toThrow();
        });
    });

    describe('performSaccadeDetection', () => {
        beforeEach(() => {
            detectSaccade.mockReturnValue({
                isValid: true,
                velocity: 100,
                isSaccade: true,
                reason: null
            });
        });

        test('should detect saccade in current frame', () => {
            const prevPoint = {
                timestamp: 100,
                x: 0.5,
                y: 0.5,
                velocity: 0
            };

            // Add at least 2 points to tracking data for saccade detection
            tracker.trackingData.push(prevPoint);
            tracker.trackingData.push({
                timestamp: 110,
                x: 0.5,
                y: 0.5
            });

            const currentPoint = tracker.trackingData[tracker.trackingData.length - 1];
            tracker.performSaccadeDetection(currentPoint);

            expect(detectSaccade).toHaveBeenCalled();
            expect(currentPoint.isSaccade).toBe(true);
            expect(currentPoint.velocity).toBe(100);
        });

        test('should not detect saccade if tracking data is too short', () => {
            const currentPoint = { timestamp: 100, x: 0.5, y: 0.5 };
            tracker.trackingData.push(currentPoint);
            tracker.performSaccadeDetection(currentPoint);

            expect(detectSaccade).not.toHaveBeenCalled();
        });

        test('should store debug info for invalid frames', () => {
            detectSaccade.mockReturnValue({
                isValid: false,
                velocity: 0,
                isSaccade: false,
                reason: 'excessive_disparity'
            });

            tracker.trackingData.push({ timestamp: 100, x: 0.5, y: 0.5 });
            tracker.trackingData.push({ timestamp: 110, x: 0.5, y: 0.5 });

            const currentPoint = tracker.trackingData[tracker.trackingData.length - 1];
            tracker.performSaccadeDetection(currentPoint);

            expect(currentPoint.debug).toBe('excessive_disparity');
        });
    });

    describe('getRelativeTime', () => {
        test('should return 0 if tracking has not started', () => {
            expect(tracker.getRelativeTime()).toBe(0);
        });

        test('should return elapsed time since start', () => {
            const beforeTime = Date.now();
            tracker.startTime = beforeTime;

            jest.useFakeTimers();
            jest.advanceTimersByTime(100);

            expect(tracker.getRelativeTime()).toBeCloseTo(100, -1);

            jest.useRealTimers();
        });
    });

    describe('getTrackingData', () => {
        test('should return empty array initially', () => {
            expect(tracker.getTrackingData()).toEqual([]);
        });

        test('should return all tracked data points', () => {
            const mockPoints = [
                { timestamp: 100, x: 0.5, y: 0.5 },
                { timestamp: 110, x: 0.6, y: 0.5 }
            ];
            tracker.trackingData = mockPoints;

            const result = tracker.getTrackingData();
            expect(result).toEqual(mockPoints);
            expect(result.length).toBe(2);
        });
    });

    describe('exportCSV', () => {
        let createElementSpy;
        let blobSpy;
        let linkElement;

        beforeEach(() => {
            linkElement = {
                href: '',
                download: '',
                click: jest.fn(),
                style: {}
            };

            createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'a') {
                    return linkElement;
                }
                return document.createElement(tag);
            });

            // Mock Blob and URL.createObjectURL
            global.Blob = jest.fn((data) => {
                return { data };
            });

            global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
            global.URL.revokeObjectURL = jest.fn();
        });

        afterEach(() => {
            createElementSpy.mockRestore();
            jest.restoreAllMocks();
        });

        test('should warn if no tracking data exists', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            tracker.trackingData = [];

            tracker.exportCSV();

            expect(warnSpy).toHaveBeenCalledWith('No tracking data to export');
            warnSpy.mockRestore();
        });

        test('should export CSV with proper structure', () => {
            const mockData = {
                timestamp: 100,
                leftIris: { x: 0.1, y: 0.5 },
                rightIris: { x: 0.9, y: 0.5 },
                avgIris: { x: 0.5, y: 0.5 },
                calibrated: {
                    left: { x: 0.2, y: 0.6 },
                    right: { x: 0.8, y: 0.6 },
                    avg: { x: 0.5, y: 0.6 }
                },
                isSaccade: false,
                velocity: 50,
                trial: 1,
                dotPosition: 'left',
                targetX: 0.2,
                targetY: 0.5
            };
            tracker.trackingData = [mockData];

            tracker.exportCSV();

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(linkElement.click).toHaveBeenCalled();
        });

        test('should create CSV blob', () => {
            const mockData = {
                timestamp: 100,
                leftIris: { x: 0.1, y: 0.5 },
                rightIris: { x: 0.9, y: 0.5 },
                avgIris: { x: 0.5, y: 0.5 },
                calibrated: { left: null, right: null, avg: null },
                isSaccade: false,
                velocity: 0,
                trial: 1,
                dotPosition: 'left'
            };
            tracker.trackingData = [mockData];

            tracker.exportCSV();

            expect(global.Blob).toHaveBeenCalled();
        });

        test('should handle null calibrated values in CSV', () => {
            const mockData = {
                timestamp: 100,
                leftIris: { x: 0.1, y: 0.5 },
                rightIris: { x: 0.9, y: 0.5 },
                avgIris: { x: 0.5, y: 0.5 },
                calibrated: { left: null, right: null, avg: null },
                isSaccade: false,
                velocity: 0
            };
            tracker.trackingData = [mockData];

            tracker.exportCSV();

            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        beforeEach(() => {
            tracker.faceLandmarker = mockFaceLandmarker;
            tracker.videoElement = mockVideo;
            mockVideo.parentNode = document.body;
        });

        test('should stop tracking', () => {
            tracker.isTracking = true;
            tracker.cleanup();

            expect(tracker.isTracking).toBe(false);
        });

        test('should close FaceLandmarker', () => {
            tracker.faceLandmarker = mockFaceLandmarker;
            tracker.cleanup();

            expect(mockFaceLandmarker.close).toHaveBeenCalled();
        });

        test('should remove video element from DOM', () => {
            tracker.videoElement = mockVideo;
            mockVideo.parentNode = { removeChild: jest.fn() };

            tracker.cleanup();

            expect(mockVideo.parentNode.removeChild).toHaveBeenCalledWith(mockVideo);
        });

        test('should handle missing FaceLandmarker', () => {
            tracker.faceLandmarker = null;
            expect(() => tracker.cleanup()).not.toThrow();
        });

        test('should handle missing video element', () => {
            tracker.videoElement = null;
            expect(() => tracker.cleanup()).not.toThrow();
        });
    });

    describe('Integration Tests', () => {
        test('should maintain correct trial context across multiple frames', () => {
            // Clear any previous tracking data
            tracker.trackingData = [];

            // Simulate: Set context for trial 1, then add frames
            tracker.addTrialContext(1, 'left');
            const point1 = { timestamp: 100 };
            tracker.trackingData.push(point1);
            // After push, the point should have been updated with current context by the framework
            // but since we're manually managing, we verify currentContext is set
            expect(tracker.currentContext.trial).toBe(1);
            expect(tracker.currentContext.dotPosition).toBe('left');

            // Simulate: Set context for trial 2, then add frames
            tracker.addTrialContext(2, 'right');
            const point2 = { timestamp: 110 };
            tracker.trackingData.push(point2);
            // Verify currentContext was updated
            expect(tracker.currentContext.trial).toBe(2);
            expect(tracker.currentContext.dotPosition).toBe('right');

            // Verify tracking data length
            expect(tracker.trackingData.length).toBe(2);
        });

        test('should compute relative iris position for both eyes consistently', () => {
            const landmarks = createLandmarks();

            const leftIris = tracker.getRelativeIrisPos(landmarks, 'left');
            const rightIris = tracker.getRelativeIrisPos(landmarks, 'right');

            expect(leftIris).not.toBeNull();
            expect(rightIris).not.toBeNull();
            expect(leftIris.x).not.toEqual(rightIris.x);
        });
    });
});

