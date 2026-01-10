/**
 * Firestore Tests
 * Tests Firestore operations using mocks
 */

import {
  doc,
  setDoc,
  getDoc,
  db,
} from '../../__mocks__/firebase';

describe('Firestore Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations to defaults
    doc.mockImplementation((db, collection, id) => ({ 
      id, 
      collection,
      path: `${collection}/${id}` 
    }));
    setDoc.mockResolvedValue(undefined);
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ username: 'testuser' }),
    });
  });

  describe('doc', () => {
    it('should create document reference', () => {
      const docRef = doc(db, 'users', 'user123');
      
      expect(doc).toHaveBeenCalledWith(db, 'users', 'user123');
      expect(docRef).toBeDefined();
      expect(docRef.id).toBe('user123');
    });

    it('should create document reference with correct path', () => {
      const docRef = doc(db, 'users', 'testuser');
      
      expect(docRef.collection).toBe('users');
      expect(docRef.path).toBe('users/testuser');
    });
  });

  describe('setDoc', () => {
    it('should set document data', async () => {
      const docRef = doc(db, 'users', 'user123');
      const data = {
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date().toISOString(),
      };
      
      await setDoc(docRef, data);
      
      expect(setDoc).toHaveBeenCalledWith(docRef, data);
    });

    it('should resolve successfully', async () => {
      const docRef = doc(db, 'users', 'user123');
      const result = await setDoc(docRef, { test: 'data' });
      
      expect(result).toBeUndefined();
    });

    it('should handle set errors', async () => {
      const errorMessage = 'Permission denied';
      setDoc.mockRejectedValueOnce(new Error(errorMessage));
      
      const docRef = doc(db, 'users', 'user123');
      
      await expect(setDoc(docRef, {})).rejects.toThrow(errorMessage);
    });
  });

  describe('getDoc', () => {
    it('should get document data', async () => {
      const docRef = doc(db, 'users', 'user123');
      
      const docSnap = await getDoc(docRef);
      
      expect(getDoc).toHaveBeenCalledWith(docRef);
      expect(docSnap.exists()).toBe(true);
    });

    it('should return document data', async () => {
      const docRef = doc(db, 'users', 'user123');
      const docSnap = await getDoc(docRef);
      
      const data = docSnap.data();
      expect(data).toBeDefined();
      expect(data.username).toBe('testuser');
    });

    it('should handle non-existent document', async () => {
      getDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });
      
      const docRef = doc(db, 'users', 'nonexistent');
      const docSnap = await getDoc(docRef);
      
      expect(docSnap.exists()).toBe(false);
    });

    it('should handle get errors', async () => {
      const errorMessage = 'Network error';
      getDoc.mockRejectedValueOnce(new Error(errorMessage));
      
      const docRef = doc(db, 'users', 'user123');
      
      await expect(getDoc(docRef)).rejects.toThrow(errorMessage);
    });
  });

  describe('user data operations', () => {
    it('should create user document on registration', async () => {
      const userId = 'new-user-123';
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        medications: '',
        familyHistory: 'none',
        conditions: '',
        createdAt: new Date().toISOString(),
      };
      
      const docRef = doc(db, 'users', userId);
      await setDoc(docRef, userData);
      
      expect(setDoc).toHaveBeenCalledWith(docRef, userData);
    });

    it('should retrieve user data on login', async () => {
      const userId = 'existing-user-123';
      const docRef = doc(db, 'users', userId);
      
      const docSnap = await getDoc(docRef);
      
      expect(docSnap.exists()).toBe(true);
      expect(docSnap.data()).toHaveProperty('username');
    });

    it('should handle user without additional data', async () => {
      getDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });
      
      const docRef = doc(db, 'users', 'basic-user');
      const docSnap = await getDoc(docRef);
      
      // User exists in auth but no firestore document
      expect(docSnap.exists()).toBe(false);
    });
  });
});
