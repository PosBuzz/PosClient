import { Suspense } from "react";
import { useRoutes } from "react-router-dom";
import { routes } from "./routes";
import { Spin } from "antd";

function App() {
  const routing = useRoutes(routes);

  return (
    <Suspense
      fallback={
        <div className="h-screen flex justify-center items-center">
          <Spin size="large" />
        </div>
      }
    >
      {routing}
    </Suspense>
  );
}

export default App;
