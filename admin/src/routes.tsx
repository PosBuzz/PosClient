import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";

const NotFound = lazy(() => import("./pages/NotFound"));
const Home = lazy(() => import("./pages/home"));
const Login = lazy(() => import("./pages/login"));

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
        <Home />
      </RequireAuth>
    ),
  },
];
