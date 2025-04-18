import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spin } from "antd";

export default function RequirePermission({
  children,
  permission,
}: {
  children: JSX.Element;
  permission?: string;
}) {
  const { user } = useAuth();


  if (!user) {
    return <Spin/>
  }
  // Check if the user has the required permission
  if (permission && !user?.permissions?.includes(permission)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
