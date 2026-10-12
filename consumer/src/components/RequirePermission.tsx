import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import CenterLoader from "./CenterLoader";

export default function RequirePermission({
  children,
  permission,
}: {
  children: JSX.Element;
  /** One permission, or several of which the user needs ANY one (like the sidebar menu) */
  permission?: string | string[];
}) {
  const { user } = useAuthStore();

  if (!user) {
    return <CenterLoader />;
  }
  // Check if the user has the required permission
  const wanted = permission === undefined ? [] : [permission].flat();
  if (
    wanted.length > 0 &&
    !wanted.some((perm) => user?.permissions?.includes(perm))
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}
