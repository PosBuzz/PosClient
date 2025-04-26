import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import AppLayout from "./layout";
import RequirePermission from "./components/RequirePermission";
import { Permissions } from "./constants/permissions";
import Roles from "./pages/roles";
import Users from "./pages/users";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/dashboard"));
const AccountSecurity = lazy(() => import("./pages/account-security"));

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
      // {
      //   path: "users",
      //   element: (
      //     <RequirePermission permission={Permissions.users}>
      //       <Users />
      //     </RequirePermission>
      //   ),
      // },
    ],
  },
];
