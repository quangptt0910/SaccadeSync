import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { login, logout, setLoading, setError } from '../store/authSlice';

const useAuth = () => {
  const dispatch = useDispatch();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    dispatch(setLoading(true));
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        dispatch(login({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          name: userData.name || null,
        }));
      } else {
        dispatch(logout());
      }
      dispatch(setLoading(false));
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [dispatch]);

  const register = useCallback(async (email, password, profileData) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = `${profileData.name} ${profileData.surname}`;
      await updateProfile(user, { displayName });
      
      await setDoc(doc(db, 'users', user.uid), {
        email,
        name: profileData.name,
        surname: profileData.surname,
        dateOfBirth: profileData.dateOfBirth,
        gender: profileData.gender,
        medications: profileData.medications,
        familyHistory: profileData.familyHistory,
        conditions: profileData.conditions,
        createdAt: new Date().toISOString(),
      });
      
      return user;
    } catch (error) {
      dispatch(setError(error.message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const signIn = useCallback(async (email, password) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    } catch (error) {
      dispatch(setError(error.message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const logOut = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      await signOut(auth);
    } catch (error) {
      dispatch(setError(error.message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  return { initialized, register, signIn, logOut };
};

export default useAuth;
