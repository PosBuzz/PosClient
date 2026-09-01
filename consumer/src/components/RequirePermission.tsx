import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import CenterLoader from "./CenterLoader";

export default function RequirePermission({
  children,
  permission,
}: {
  children: JSX.Element;
  permission?: string;
}) {
  const { user } = useAuthStore();

  if (!user) {
    return <CenterLoader />;
  }
  // Check if the user has the required permission
  if (permission && !user?.permissions?.includes(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
