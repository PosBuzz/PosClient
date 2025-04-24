import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import AppLayout from "./layout";
import RequirePermission from "./components/RequirePermission";
import { AdminPermission } from "./constants/adminPermissions";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/home"));
const Consumers = lazy(() => import("./pages/consumers"));
const Plans = lazy(() => import("./pages/plans"));
const Billings = lazy(() => import("./pages/billings"));
const Roles = lazy(() => import("./pages/roles"));
const Users = lazy(() => import("./pages/users"));
const BackupRestore = lazy(() => import("./pages/backup&restore"));
const AccountSecurity = lazy(() => import("./pages/profile"));

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
        path: "consumers",
        element: (
          <RequirePermission permission={AdminPermission.consumers}>
            <Consumers />
          </RequirePermission>
        ),
      },
      {
        path: "plans",
        element: (
          <RequirePermission permission={AdminPermission.plans}>
            <Plans />
          </RequirePermission>
        ),
      },
      {
        path: "billings",
        element: (
          <RequirePermission permission={AdminPermission.billings}>
            <Billings />
          </RequirePermission>
        ),
      },
      {
        path: "roles",
        element: (
          <RequirePermission permission={AdminPermission.users}>
            <Roles />
          </RequirePermission>
        ),
      },
      {
        path: "users",
        element: (
          <RequirePermission permission={AdminPermission.users}>
            <Users />
          </RequirePermission>
        ),
      },
      {
        path: "backup&restore",
        element: (
          <RequirePermission permission={AdminPermission.backupRestore}>
            <BackupRestore />
          </RequirePermission>
        ),
      },
      {
        path: "account&security",
        element: (
          <RequirePermission permission={AdminPermission.profile}>
            <AccountSecurity />
          </RequirePermission>
        ),
      },
    ],
  },
];
