import React from 'react';
import { useAuth } from '../../hooks';

const AuthProvider = ({ children }) => {
  const { initialized } = useAuth();

  if (!initialized) {
    return null;
  }

  return <>{children}</>;
};

export default AuthProvider;
