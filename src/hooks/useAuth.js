import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { login, logout, setLoading, setError } from '../store/authSlice';

const useAuth = () => {
  const dispatch = useDispatch();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    dispatch(setLoading(true));
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(login({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        }));
      } else {
        dispatch(logout());
      }
      dispatch(setLoading(false));
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [dispatch]);

  const register = useCallback(async (email, password, displayName) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(user, { displayName });
      }
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
