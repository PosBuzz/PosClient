import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import RequirePermission from "./components/RequirePermission";
import { Permissions } from "./constants/permissions";
import AppLayout from "./layout";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/dashboard"));
const AccountSecurity = lazy(() => import("./pages/account-security"));
const Roles = lazy(() => import("./pages/roles"));
const Users = lazy(() => import("./pages/users"));

export const routes = [
  {
    path: "*",
    element: <NotFound />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      {
        path: "account&security",
        element: (
          <RequirePermission permission={Permissions.profile}>
            <AccountSecurity />
          </RequirePermission>
        ),
      },
      {
        path: "roles",
        element: (
          <RequirePermission permission={Permissions.users}>
            <Roles />
          </RequirePermission>
        ),
      },
      {
        path: "users",
        element: (
          <RequirePermission permission={Permissions.users}>
            <Users />
          </RequirePermission>
        ),
      },
    ],
  },
];
