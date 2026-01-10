// Mock Firebase Firestore
module.exports = {
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((db, collection, id) => ({ id, collection, path: `${collection}/${id}` })),
  setDoc: jest.fn(() => Promise.resolve()),
  getDoc: jest.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ username: 'testuser' }),
  })),
  collection: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
};
