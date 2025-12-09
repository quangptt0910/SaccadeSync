import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDQuoxvbIexN9GVZPDja2xqrFzdKEyhUPM",
  authDomain: "semt-f9b00.firebaseapp.com",
  projectId: "semt-f9b00",
  storageBucket: "semt-f9b00.firebasestorage.app",
  messagingSenderId: "53799890840",
  appId: "1:53799890840:web:8a5ff68ac9a2e72c5785ed",
  measurementId: "G-C2WBZ4T8QY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
