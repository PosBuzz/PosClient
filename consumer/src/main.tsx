import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Providers from "./Providers.tsx";
import { registerChunkErrorReload, registerSWUpdateHandler } from "./swUpdate.ts";

registerChunkErrorReload();
registerSWUpdateHandler();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
);
