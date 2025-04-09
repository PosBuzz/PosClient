import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import AppLayout from "./layout";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/home"));

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
      { path: "user", element: <Home /> },
    ],
  },
];
