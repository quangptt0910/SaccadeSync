import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login, logout, setLoading, setError } from '../../store/authSlice';
import calibrationReducer from '../../store/calibrationSlice';

describe('Redux Store', () => {
  let store;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
        calibration: calibrationReducer,
      },
    });
  });

  describe('store configuration', () => {
    it('should have auth reducer', () => {
      const state = store.getState();
      expect(state).toHaveProperty('auth');
    });

    it('should have calibration reducer', () => {
      const state = store.getState();
      expect(state).toHaveProperty('calibration');
    });

    it('should initialize with correct default auth state', () => {
      const state = store.getState();
      expect(state.auth).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      });
    });
  });

  describe('auth actions through store', () => {
    it('should dispatch login action', () => {
      const user = { uid: '123', email: 'test@example.com', displayName: 'Test' };
      store.dispatch(login(user));
      
      const state = store.getState();
      expect(state.auth.user).toEqual(user);
      expect(state.auth.isAuthenticated).toBe(true);
    });

    it('should dispatch logout action', () => {
      // First login
      store.dispatch(login({ uid: '123', email: 'test@example.com' }));
      expect(store.getState().auth.isAuthenticated).toBe(true);
      
      // Then logout
      store.dispatch(logout());
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.user).toBeNull();
    });

    it('should dispatch setLoading action', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().auth.loading).toBe(true);
      
      store.dispatch(setLoading(false));
      expect(store.getState().auth.loading).toBe(false);
    });

    it('should dispatch setError action', () => {
      const errorMsg = 'Test error';
      store.dispatch(setError(errorMsg));
      
      const state = store.getState();
      expect(state.auth.error).toBe(errorMsg);
      expect(state.auth.loading).toBe(false);
    });
  });

  describe('store state immutability', () => {
    it('should not mutate state directly', () => {
      const initialState = store.getState();
      const initialAuthRef = initialState.auth;
      
      store.dispatch(login({ uid: '123', email: 'test@example.com' }));
      
      const newState = store.getState();
      // New state should be different object
      expect(newState.auth).not.toBe(initialAuthRef);
    });
  });
});
