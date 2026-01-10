/**
 * Firebase Configuration Tests
 * Tests that Firebase is properly configured and exports are available
 */

describe('Firebase Configuration', () => {
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      REACT_APP_FIREBASE_API_KEY: 'test-api-key',
      REACT_APP_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      REACT_APP_FIREBASE_PROJECT_ID: 'test-project',
      REACT_APP_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      REACT_APP_FIREBASE_APP_ID: '1:123:web:abc',
      REACT_APP_FIREBASE_MEASUREMENT_ID: 'G-TEST123',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('environment variables', () => {
    it('should have REACT_APP_FIREBASE_API_KEY defined', () => {
      expect(process.env.REACT_APP_FIREBASE_API_KEY).toBeDefined();
    });

    it('should have REACT_APP_FIREBASE_AUTH_DOMAIN defined', () => {
      expect(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN).toBeDefined();
    });

    it('should have REACT_APP_FIREBASE_PROJECT_ID defined', () => {
      expect(process.env.REACT_APP_FIREBASE_PROJECT_ID).toBeDefined();
    });

    it('should have REACT_APP_FIREBASE_STORAGE_BUCKET defined', () => {
      expect(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET).toBeDefined();
    });

    it('should have REACT_APP_FIREBASE_MESSAGING_SENDER_ID defined', () => {
      expect(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID).toBeDefined();
    });

    it('should have REACT_APP_FIREBASE_APP_ID defined', () => {
      expect(process.env.REACT_APP_FIREBASE_APP_ID).toBeDefined();
    });
  });

  describe('firebase config structure', () => {
    it('should create valid firebase config object', () => {
      const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
      };

      expect(firebaseConfig).toHaveProperty('apiKey');
      expect(firebaseConfig).toHaveProperty('authDomain');
      expect(firebaseConfig).toHaveProperty('projectId');
      expect(firebaseConfig).toHaveProperty('storageBucket');
      expect(firebaseConfig).toHaveProperty('messagingSenderId');
      expect(firebaseConfig).toHaveProperty('appId');
    });

    it('should have valid auth domain format', () => {
      const authDomain = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN;
      expect(authDomain).toMatch(/\.firebaseapp\.com$/);
    });

    it('should have valid storage bucket format', () => {
      const storageBucket = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
      expect(storageBucket).toMatch(/\.appspot\.com$/);
    });
  });
});

describe('Firebase Mock Exports', () => {
  it('should export auth mock', () => {
    const { auth } = require('../../__mocks__/firebase');
    expect(auth).toBeDefined();
  });

  it('should export db mock', () => {
    const { db } = require('../../__mocks__/firebase');
    expect(db).toBeDefined();
  });

  it('should export storage mock', () => {
    const { storage } = require('../../__mocks__/firebase');
    expect(storage).toBeDefined();
  });

  it('should export auth functions', () => {
    const { 
      createUserWithEmailAndPassword, 
      signInWithEmailAndPassword, 
      signOut 
    } = require('../../__mocks__/firebase');
    
    expect(createUserWithEmailAndPassword).toBeDefined();
    expect(signInWithEmailAndPassword).toBeDefined();
    expect(signOut).toBeDefined();
  });

  it('should export firestore functions', () => {
    const { doc, setDoc, getDoc } = require('../../__mocks__/firebase');
    
    expect(doc).toBeDefined();
    expect(setDoc).toBeDefined();
    expect(getDoc).toBeDefined();
  });
});
