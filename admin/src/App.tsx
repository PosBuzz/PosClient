import { Spin } from "antd";
import { Suspense } from "react";
import { useRoutes } from "react-router-dom";
import { routes } from "./routes";

function App() {
  const routing = useRoutes(routes);
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
