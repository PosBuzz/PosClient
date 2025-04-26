import { Spin } from "antd";
import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export default function RequirePermission({
  children,
  permission,
}: {
  children: JSX.Element;
  permission?: string;
}) {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-112px)]">
        <Spin />
      </div>
    );
  }
  // Check if the user has the required permission
  if (permission && !user?.permissions?.includes(permission)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
