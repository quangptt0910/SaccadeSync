import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import GameTest from '../../views/GameTest';
import calibrationReducer from '../../store/calibrationSlice';
import authReducer from '../../store/authSlice';
import IrisFaceMeshTracker from '../../views/GameTest/utils/iris-facemesh';

// --- Mocks ---

// Mock IrisFaceMeshTracker class
jest.mock('../../views/GameTest/utils/iris-facemesh');
const mockTrackerInstance = {
  initialize: jest.fn().mockResolvedValue(true),
  setCalibrationModel: jest.fn(),
  startTracking: jest.fn().mockResolvedValue(true),
  stopTracking: jest.fn(),
  cleanup: jest.fn(),
  getRelativeTime: jest.fn(() => 1000),
  addTrialContext: jest.fn(),
  getTrackingData: jest.fn(() => []),
  exportCSV: jest.fn(),
};
IrisFaceMeshTracker.mockImplementation(() => mockTrackerInstance);

// Mock saccadeData utils
jest.mock('../../views/GameTest/utils/saccadeData', () => ({
  analyzeSaccadeData: jest.fn(() => ({
    peakVelocity: 400,
    isSaccade: true,
    latency: 200,
    quality: { dataQuality: 1 }
  })),
  aggregateTrialStatistics: jest.fn(() => ({
    latency: { mean: 200 },
    accuracy: { mean: 0.9 }
  })),
  compareProVsAnti: jest.fn(() => ({
    latency: { difference: 100 }
  }))
}));

// Mock velocityConfig
jest.mock('../../views/GameTest/utils/velocityConfig', () => ({
  calculatePerTrialThreshold: jest.fn(() => 30)
}));

// Mock Firebase
jest.mock('../../firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ empty: true })),
  serverTimestamp: jest.fn(),
}));

// Mock Fullscreen API
document.documentElement.requestFullscreen = jest.fn();
document.exitFullscreen = jest.fn();


const renderGameTest = (initialState) => {
  const store = configureStore({
    reducer: {
      calibration: calibrationReducer,
      auth: authReducer
    },
    preloadedState: initialState
  });

  return render(
    <Provider store={store}>
      <BrowserRouter>
        <GameTest />
      </BrowserRouter>
    </Provider>
  );
};

describe('GameTest View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the start modal initially', () => {
    renderGameTest({
      auth: { user: { uid: '123' } },
      calibration: { 
        isCalibrated: true, 
        model: { left: { coefX: [1] } } // Valid model structure
      }
    });

    expect(screen.getByText(/Saccade Test/i)).toBeInTheDocument();
    expect(screen.getByText(/The test will run in full screen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Test/i })).toBeInTheDocument();
  });

  it('attempts to start the test when start button is clicked', async () => {
    renderGameTest({
      auth: { user: { uid: '123' } },
      calibration: { isCalibrated: true, model: { left: { coefX: [1] } } }
    });

    const startButton = screen.getByRole('button', { name: /Start Test/i });
    fireEvent.click(startButton);

    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
  });
});