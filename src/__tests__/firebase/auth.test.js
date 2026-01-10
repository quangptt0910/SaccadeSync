/**
 * Firebase Authentication Tests
 * Tests authentication functions using mocks
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  mockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from '../../__mocks__/firebase';

describe('Firebase Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations to defaults
    createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    signOut.mockResolvedValue(undefined);
    updateProfile.mockResolvedValue(undefined);
  });

  describe('createUserWithEmailAndPassword', () => {
    it('should create a new user with email and password', async () => {
      const email = 'newuser@example.com';
      const password = 'password123';
      
      const result = await createUserWithEmailAndPassword(null, email, password);
      
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(null, email, password);
      expect(result.user).toBeDefined();
      expect(result.user.uid).toBeDefined();
    });

    it('should return user object with expected properties', async () => {
      const result = await createUserWithEmailAndPassword(null, 'test@test.com', 'pass');
      
      expect(result.user).toHaveProperty('uid');
      expect(result.user).toHaveProperty('email');
    });

    it('should handle registration errors', async () => {
      const errorMessage = 'Email already in use';
      createUserWithEmailAndPassword.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(
        createUserWithEmailAndPassword(null, 'existing@test.com', 'pass')
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('signInWithEmailAndPassword', () => {
    it('should sign in user with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'validpassword';
      
      const result = await signInWithEmailAndPassword(null, email, password);
      
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(null, email, password);
      expect(result.user).toBeDefined();
    });

    it('should return user with correct email', async () => {
      const result = await signInWithEmailAndPassword(null, 'test@example.com', 'pass');
      
      expect(result.user.email).toBe('test@example.com');
    });

    it('should handle invalid credentials error', async () => {
      const errorMessage = 'Invalid email or password';
      signInWithEmailAndPassword.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(
        signInWithEmailAndPassword(null, 'wrong@test.com', 'wrongpass')
      ).rejects.toThrow(errorMessage);
    });

    it('should handle user not found error', async () => {
      const errorMessage = 'User not found';
      signInWithEmailAndPassword.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(
        signInWithEmailAndPassword(null, 'nonexistent@test.com', 'pass')
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('signOut', () => {
    it('should sign out the current user', async () => {
      await signOut();
      
      expect(signOut).toHaveBeenCalled();
    });

    it('should resolve successfully', async () => {
      const result = await signOut();
      expect(result).toBeUndefined();
    });

    it('should handle sign out errors', async () => {
      const errorMessage = 'Sign out failed';
      signOut.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(signOut()).rejects.toThrow(errorMessage);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const profileData = { displayName: 'New Name' };
      
      await updateProfile(mockUser, profileData);
      
      expect(updateProfile).toHaveBeenCalledWith(mockUser, profileData);
    });

    it('should resolve successfully', async () => {
      const result = await updateProfile(mockUser, { displayName: 'Test' });
      expect(result).toBeUndefined();
    });
  });

  describe('onAuthStateChanged', () => {
    it('should call callback with null for unauthenticated user', () => {
      mockUnauthenticatedUser();
      const callback = jest.fn();
      
      onAuthStateChanged(null, callback);
      
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should call callback with user for authenticated user', () => {
      mockAuthenticatedUser();
      const callback = jest.fn();
      
      onAuthStateChanged(null, callback);
      
      expect(callback).toHaveBeenCalledWith(mockUser);
    });

    it('should be callable as a function', () => {
      const callback = jest.fn();
      expect(() => onAuthStateChanged(null, callback)).not.toThrow();
    });
  });

  describe('authentication flow', () => {
    it('should complete full registration flow', async () => {
      const email = 'newuser@example.com';
      const password = 'securepass123';
      const displayName = 'New User';
      
      // Register
      const { user } = await createUserWithEmailAndPassword(null, email, password);
      expect(user).toBeDefined();
      
      // Update profile
      await updateProfile(user, { displayName });
      expect(updateProfile).toHaveBeenCalledWith(user, { displayName });
    });

    it('should complete full login/logout flow', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      
      // Login
      const { user } = await signInWithEmailAndPassword(null, email, password);
      expect(user).toBeDefined();
      
      // Logout
      await signOut();
      expect(signOut).toHaveBeenCalled();
    });
  });
});
