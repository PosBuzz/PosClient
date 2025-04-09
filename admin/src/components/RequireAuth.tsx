import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { JSX } from 'react';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login and pass the current location as state
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}