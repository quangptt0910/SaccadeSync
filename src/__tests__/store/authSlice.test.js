import authReducer, {
  login,
  logout,
  setLoading,
  setError,
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from '../../store/authSlice';

describe('authSlice', () => {
  const initialState = {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  };

  describe('reducer', () => {
    it('should return the initial state', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should handle login', () => {
      const user = { uid: '123', email: 'test@example.com', displayName: 'Test' };
      const actual = authReducer(initialState, login(user));
      
      expect(actual.user).toEqual(user);
      expect(actual.isAuthenticated).toBe(true);
      expect(actual.error).toBeNull();
    });

    it('should handle logout', () => {
      const loggedInState = {
        user: { uid: '123', email: 'test@example.com' },
        isAuthenticated: true,
        loading: false,
        error: null,
      };
      const actual = authReducer(loggedInState, logout());
      
      expect(actual.user).toBeNull();
      expect(actual.isAuthenticated).toBe(false);
    });

    it('should handle setLoading', () => {
      const actual = authReducer(initialState, setLoading(true));
      expect(actual.loading).toBe(true);

      const actualFalse = authReducer(actual, setLoading(false));
      expect(actualFalse.loading).toBe(false);
    });

    it('should handle setError', () => {
      const errorMessage = 'Authentication failed';
      const actual = authReducer(initialState, setError(errorMessage));
      
      expect(actual.error).toBe(errorMessage);
      expect(actual.loading).toBe(false);
    });

    it('should clear error on login', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error',
      };
      const user = { uid: '123', email: 'test@example.com' };
      const actual = authReducer(stateWithError, login(user));
      
      expect(actual.error).toBeNull();
    });
  });

  describe('selectors', () => {
    const mockState = {
      auth: {
        user: { uid: '123', email: 'test@example.com', displayName: 'Test User' },
        isAuthenticated: true,
        loading: false,
        error: null,
      },
    };

    it('selectUser should return the user', () => {
      expect(selectUser(mockState)).toEqual(mockState.auth.user);
    });

    it('selectIsAuthenticated should return authentication status', () => {
      expect(selectIsAuthenticated(mockState)).toBe(true);
    });

    it('selectAuthLoading should return loading status', () => {
      expect(selectAuthLoading(mockState)).toBe(false);
    });

    it('selectAuthError should return error', () => {
      expect(selectAuthError(mockState)).toBeNull();
    });

    it('selectUser should return null when not authenticated', () => {
      const unauthState = {
        auth: { ...initialState },
      };
      expect(selectUser(unauthState)).toBeNull();
      expect(selectIsAuthenticated(unauthState)).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should handle full login flow', () => {
      let state = authReducer(initialState, setLoading(true));
      expect(state.loading).toBe(true);

      const user = { uid: '123', email: 'test@example.com' };
      state = authReducer(state, login(user));
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);

      state = authReducer(state, setLoading(false));
      expect(state.loading).toBe(false);
    });

    it('should handle login error flow', () => {
      let state = authReducer(initialState, setLoading(true));
      expect(state.loading).toBe(true);

      state = authReducer(state, setError('Invalid credentials'));
      expect(state.error).toBe('Invalid credentials');
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle logout flow', () => {
      const loggedInState = {
        user: { uid: '123', email: 'test@example.com' },
        isAuthenticated: true,
        loading: false,
        error: null,
      };

      let state = authReducer(loggedInState, setLoading(true));
      state = authReducer(state, logout());
      state = authReducer(state, setLoading(false));

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
    });
  });
});
