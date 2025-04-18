import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import AppLayout from "./layout";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/home"));
const Consumers = lazy(() => import("./pages/consumers"));
const Plans = lazy(() => import("./pages/plans"));
const Billings = lazy(() => import("./pages/billings"));
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
      { path: "consumers", element: <Consumers /> },
      { path: "plans", element: <Plans /> },
      { path: "billings", element: <Billings /> },
      { path: "roles", element: <Roles /> },
      { path: "users", element: <Users /> },
    ],
  },
];
