// Mirrors consumer/src/test/msw/server.ts — keep in sync
import { setupServer } from "msw/node";
import { defaultHandlers } from "./handlers";
export const server = setupServer(...defaultHandlers);
