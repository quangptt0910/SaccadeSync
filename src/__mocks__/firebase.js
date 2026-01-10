// Mock Firebase Authentication
const mockUser = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
};

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: jest.fn((callback) => {
    callback(null);
    return jest.fn(); // unsubscribe function
  }),
};

const mockDb = {};
const mockStorage = {};
const mockApp = {};

// Auth functions
export const createUserWithEmailAndPassword = jest.fn(() => 
  Promise.resolve({ user: mockUser })
);

export const signInWithEmailAndPassword = jest.fn(() => 
  Promise.resolve({ user: mockUser })
);

export const signOut = jest.fn(() => Promise.resolve());

export const updateProfile = jest.fn(() => Promise.resolve());

export const onAuthStateChanged = jest.fn((auth, callback) => {
  callback(null);
  return jest.fn();
});

// Firestore functions
export const doc = jest.fn((db, collection, id) => ({ 
  id, 
  collection,
  path: `${collection}/${id}` 
}));

export const setDoc = jest.fn(() => Promise.resolve());

export const getDoc = jest.fn(() => 
  Promise.resolve({
    exists: () => true,
    data: () => ({ username: 'testuser' }),
  })
);

export const collection = jest.fn();
export const getDocs = jest.fn();
export const addDoc = jest.fn();
export const updateDoc = jest.fn();
export const deleteDoc = jest.fn();

// Firebase exports
export const auth = mockAuth;
export const db = mockDb;
export const storage = mockStorage;
export const app = mockApp;

// Helper to reset all mocks
export const resetFirebaseMocks = () => {
  createUserWithEmailAndPassword.mockClear();
  signInWithEmailAndPassword.mockClear();
  signOut.mockClear();
  updateProfile.mockClear();
  onAuthStateChanged.mockClear();
  doc.mockClear();
  setDoc.mockClear();
  getDoc.mockClear();
};

// Helper to simulate authenticated user
export const mockAuthenticatedUser = (user = mockUser) => {
  mockAuth.currentUser = user;
  onAuthStateChanged.mockImplementation((auth, callback) => {
    callback(user);
    return jest.fn();
  });
};

// Helper to simulate unauthenticated user
export const mockUnauthenticatedUser = () => {
  mockAuth.currentUser = null;
  onAuthStateChanged.mockImplementation((auth, callback) => {
    callback(null);
    return jest.fn();
  });
};

export { mockUser };
