import { createSlice } from '@reduxjs/toolkit';

// Calibration DATA to be saved in DB and used in GameTEST
const initialState = {
  model: {
    left: { coefX: [0, 0, 0, 0, 0, 0], coefY: [0, 0, 0, 0, 0, 0] },
    right: { coefX: [0, 0, 0, 0, 0, 0], coefY: [0, 0, 0, 0, 0, 0] }
  },
  metrics: {
    accuracy: 0,
    rmse: 0
  },
  gazeData: [],
  isCalibrated: false,
  timestamp: null
};

const calibrationSlice = createSlice({
  name: 'calibration',
  initialState,
  reducers: {
    setCalibrationResult: (state, action) => {
      const { model, gazeData, metrics } = action.payload;
      
      if (model) state.model = model;
      if (gazeData) state.gazeData = gazeData;
      // Default metrics if not provided, or update if they are
      if (metrics) state.metrics = metrics;
      
      state.isCalibrated = true;
      state.timestamp = new Date().toISOString();
    },
    resetCalibration: (state) => {
      state.model = initialState.model;
      state.metrics = initialState.metrics;
      state.gazeData = initialState.gazeData;
      state.isCalibrated = false;
      state.timestamp = null;
    }
  }
});

export const { setCalibrationResult, resetCalibration } = calibrationSlice.actions;

export const selectCalibrationModel = (state) => state.calibration.model;
export const selectCalibrationMetrics = (state) => state.calibration.metrics;
export const selectIsCalibrated = (state) => state.calibration.isCalibrated;
export const selectCalibrationData = (state) => state.calibration;

export default calibrationSlice.reducer;