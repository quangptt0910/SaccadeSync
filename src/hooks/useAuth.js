import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { login, logout, setLoading } from '../store/authSlice';

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

  return { initialized };
};

export default useAuth;
