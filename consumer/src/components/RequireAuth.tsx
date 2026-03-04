import { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import FullScreenLoader from "./FullScreenLoader";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isAuthLoading } = useAuthStore();
  const location = useLocation();

  if (isAuthLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    // Redirect to login and pass the current location as state
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
