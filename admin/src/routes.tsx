import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import AppLayout from "./layout";
import RequirePermission from "./components/RequirePermission";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/home"));
const Consumers = lazy(() => import("./pages/consumers"));
const Plans = lazy(() => import("./pages/plans"));
const Billings = lazy(() => import("./pages/billings"));
const Roles = lazy(() => import("./pages/roles"));
const Users = lazy(() => import("./pages/users"));
const BackupRestore = lazy(() => import("./pages/backup&restore"));

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
          <RequirePermission permission="consumers">
            <Consumers />
          </RequirePermission>
        ),
      },
      {
        path: "plans",
        element: (
          <RequirePermission permission="plans">
            <Plans />
          </RequirePermission>
        ),
      },
      {
        path: "billings",
        element: (
          <RequirePermission permission="billing">
            <Billings />
          </RequirePermission>
        ),
      },
      {
        path: "roles",
        element: (
          <RequirePermission permission="users">
            <Roles />
          </RequirePermission>
        ),
      },
      {
        path: "users",
        element: (
          <RequirePermission permission="users">
            <Users />
          </RequirePermission>
        ),
      },
      {
        path: "backup&restore",
        element: (
          <RequirePermission permission="backup&restore">
            <BackupRestore />
          </RequirePermission>
        ),
      },
    ],
  },
];
