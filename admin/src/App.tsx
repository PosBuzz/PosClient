import { Spin } from "antd";
import { Suspense } from "react";
import { useRoutes } from "react-router-dom";
import { routes } from "./routes";

function App() {
  const routing = useRoutes(routes);
  console.log("API BASE:", import.meta.env.VITE_API_BASE_URL);
  return (
    <Suspense
      fallback={
        <div className="h-screen flex justify-center items-center dark:bg-black">
          <Spin size="large" />
        </div>
      }
    >
      {routing}
    </Suspense>
  );
}

export default App;
