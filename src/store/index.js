import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import calibrationReducer from './calibrationSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    calibration: calibrationReducer,
  },
});

export default store;