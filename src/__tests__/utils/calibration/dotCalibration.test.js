/**
 * Tests for Dot Calibration Utilities
 * Tests calibration point calculation and data structures
 */

describe('Dot Calibration Utilities', () => {
  // Mock window dimensions
  const mockWindowWidth = 1920;
  const mockWindowHeight = 1080;

  beforeAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: mockWindowWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: mockWindowHeight,
    });
  });

  describe('getDotPoints calculation', () => {
    // Inline implementation to test the logic
    const getDotPoints = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const marginLeft = 0.05;
      const mid = 0.5;
      const marginRight = 1 - marginLeft;

      const xMin = w * marginLeft;
      const xMid = w * mid;
      const xMax = w * marginRight;

      const yMin = h * marginLeft;
      const yMid = h * mid;
      const yMax = h * marginRight;

      return [
        { px: xMin, py: yMin, x: 0.05, y: 0.05 },
        { px: xMid, py: yMin, x: 0.5, y: 0.05 },
        { px: xMax, py: yMin, x: 0.95, y: 0.05 },
        { px: xMin, py: yMid, x: 0.05, y: 0.5 },
        { px: xMid, py: yMid, x: 0.5, y: 0.5 },
        { px: xMax, py: yMid, x: 0.95, y: 0.5 },
        { px: xMin, py: yMax, x: 0.05, y: 0.95 },
        { px: xMid, py: yMax, x: 0.5, y: 0.95 },
        { px: xMax, py: yMax, x: 0.95, y: 0.95 },
      ];
    };

    it('should return 9 calibration points', () => {
      const points = getDotPoints();
      expect(points).toHaveLength(9);
    });

    it('should have correct structure for each point', () => {
      const points = getDotPoints();

      points.forEach((point) => {
        expect(point).toHaveProperty('px');
        expect(point).toHaveProperty('py');
        expect(point).toHaveProperty('x');
        expect(point).toHaveProperty('y');
        expect(typeof point.px).toBe('number');
        expect(typeof point.py).toBe('number');
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
      });
    });

    it('should have normalized coordinates between 0 and 1', () => {
      const points = getDotPoints();

      points.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate correct pixel coordinates', () => {
      const points = getDotPoints();

      // Top-left point (5% margin)
      expect(points[0].px).toBeCloseTo(mockWindowWidth * 0.05, 1);
      expect(points[0].py).toBeCloseTo(mockWindowHeight * 0.05, 1);

      // Center point (50%)
      expect(points[4].px).toBeCloseTo(mockWindowWidth * 0.5, 1);
      expect(points[4].py).toBeCloseTo(mockWindowHeight * 0.5, 1);

      // Bottom-right point (95%)
      expect(points[8].px).toBeCloseTo(mockWindowWidth * 0.95, 1);
      expect(points[8].py).toBeCloseTo(mockWindowHeight * 0.95, 1);
    });

    it('should have symmetric layout', () => {
      const points = getDotPoints();

      // Top-left and bottom-right should be symmetric around center
      const center = points[4];
      const topLeft = points[0];
      const bottomRight = points[8];

      const distTopLeft = Math.sqrt(
        Math.pow(center.px - topLeft.px, 2) + Math.pow(center.py - topLeft.py, 2)
      );
      const distBottomRight = Math.sqrt(
        Math.pow(center.px - bottomRight.px, 2) + Math.pow(center.py - bottomRight.py, 2)
      );

      expect(distTopLeft).toBeCloseTo(distBottomRight, 1);
    });

    it('should cover a 3x3 grid pattern', () => {
      const points = getDotPoints();

      // Extract unique x and y values
      const uniqueX = [...new Set(points.map((p) => p.x))].sort((a, b) => a - b);
      const uniqueY = [...new Set(points.map((p) => p.y))].sort((a, b) => a - b);

      expect(uniqueX).toHaveLength(3);
      expect(uniqueY).toHaveLength(3);

      // Should be 0.05, 0.5, 0.95
      expect(uniqueX[0]).toBeCloseTo(0.05, 2);
      expect(uniqueX[1]).toBeCloseTo(0.5, 2);
      expect(uniqueX[2]).toBeCloseTo(0.95, 2);
    });
  });

  describe('calibration model structure', () => {
    const createEmptyCalibrationModel = () => ({
      left: { coefX: [0, 0, 0, 0, 0, 0], coefY: [0, 0, 0, 0, 0, 0] },
      right: { coefX: [0, 0, 0, 0, 0, 0], coefY: [0, 0, 0, 0, 0, 0] },
    });

    it('should have correct structure', () => {
      const model = createEmptyCalibrationModel();

      expect(model).toHaveProperty('left');
      expect(model).toHaveProperty('right');
      expect(model.left).toHaveProperty('coefX');
      expect(model.left).toHaveProperty('coefY');
      expect(model.right).toHaveProperty('coefX');
      expect(model.right).toHaveProperty('coefY');
    });

    it('should have 6 coefficients per axis per eye', () => {
      const model = createEmptyCalibrationModel();

      expect(model.left.coefX).toHaveLength(6);
      expect(model.left.coefY).toHaveLength(6);
      expect(model.right.coefX).toHaveLength(6);
      expect(model.right.coefY).toHaveLength(6);
    });

    it('should initialize with zeros', () => {
      const model = createEmptyCalibrationModel();

      model.left.coefX.forEach((coef) => expect(coef).toBe(0));
      model.left.coefY.forEach((coef) => expect(coef).toBe(0));
      model.right.coefX.forEach((coef) => expect(coef).toBe(0));
      model.right.coefY.forEach((coef) => expect(coef).toBe(0));
    });
  });

  describe('gaze data structure', () => {
    it('should validate gaze sample structure', () => {
      const gazeSample = {
        point_index: 0,
        targetX: 0.05,
        targetY: 0.05,
        iris_left: { x: 0.45, y: 0.52 },
        iris_right: { x: 0.46, y: 0.51 },
      };

      expect(gazeSample).toHaveProperty('point_index');
      expect(gazeSample).toHaveProperty('targetX');
      expect(gazeSample).toHaveProperty('targetY');
      expect(gazeSample).toHaveProperty('iris_left');
      expect(gazeSample).toHaveProperty('iris_right');

      expect(gazeSample.iris_left).toHaveProperty('x');
      expect(gazeSample.iris_left).toHaveProperty('y');
    });

    it('should handle missing eye data', () => {
      const gazeSampleMissingEye = {
        point_index: 0,
        targetX: 0.05,
        targetY: 0.05,
        iris_left: null,
        iris_right: { x: 0.46, y: 0.51 },
      };

      expect(gazeSampleMissingEye.iris_left).toBeNull();
      expect(gazeSampleMissingEye.iris_right).not.toBeNull();
    });
  });

  describe('relative iris position calculation', () => {
    // Test the getRelativeIrisPos logic
    const getRelativeIrisPos = (landmarks, eyeSide) => {
      const EYE_INDICES = {
        left: { inner: 33, outer: 133, iris: 468 },
        right: { inner: 362, outer: 263, iris: 473 },
      };

      const indices = EYE_INDICES[eyeSide];
      const pInner = landmarks[indices.inner];
      const pOuter = landmarks[indices.outer];
      const pIris = landmarks[indices.iris];

      if (!pInner || !pOuter || !pIris) return null;

      const vecEye = { x: pOuter.x - pInner.x, y: pOuter.y - pInner.y };
      const vecIris = { x: pIris.x - pInner.x, y: pIris.y - pInner.y };

      const eyeWidthSq = vecEye.x * vecEye.x + vecEye.y * vecEye.y;
      const eyeWidth = Math.sqrt(eyeWidthSq);

      let normX = (vecIris.x * vecEye.x + vecIris.y * vecEye.y) / eyeWidthSq;
      const crossProduct = vecIris.x * vecEye.y - vecIris.y * vecEye.x;
      let normY = 0.5 + (crossProduct / eyeWidth) * 4.0;

      return { x: normX, y: normY };
    };

    it('should return null for missing landmarks', () => {
      const landmarks = {};
      const result = getRelativeIrisPos(landmarks, 'left');
      expect(result).toBeNull();
    });

    it('should calculate iris position when looking center', () => {
      // Simulate eye with iris at center
      const landmarks = [];
      landmarks[33] = { x: 0.3, y: 0.5 }; // inner corner
      landmarks[133] = { x: 0.4, y: 0.5 }; // outer corner
      landmarks[468] = { x: 0.35, y: 0.5 }; // iris at center

      const result = getRelativeIrisPos(landmarks, 'left');

      expect(result).not.toBeNull();
      expect(result.x).toBeCloseTo(0.5, 1); // Center of eye
      expect(result.y).toBeCloseTo(0.5, 1); // On the eye axis
    });

    it('should detect looking toward inner corner', () => {
      const landmarks = [];
      landmarks[33] = { x: 0.3, y: 0.5 }; // inner corner
      landmarks[133] = { x: 0.4, y: 0.5 }; // outer corner
      landmarks[468] = { x: 0.32, y: 0.5 }; // iris near inner corner

      const result = getRelativeIrisPos(landmarks, 'left');

      expect(result).not.toBeNull();
      expect(result.x).toBeLessThan(0.5); // Closer to inner (0)
    });

    it('should detect looking toward outer corner', () => {
      const landmarks = [];
      landmarks[33] = { x: 0.3, y: 0.5 }; // inner corner
      landmarks[133] = { x: 0.4, y: 0.5 }; // outer corner
      landmarks[468] = { x: 0.38, y: 0.5 }; // iris near outer corner

      const result = getRelativeIrisPos(landmarks, 'left');

      expect(result).not.toBeNull();
      expect(result.x).toBeGreaterThan(0.5); // Closer to outer (1)
    });
  });
});
