// Mirrors consumer/src/test/msw/capture.ts — keep in sync
import { http, type HttpHandler } from "msw";
import { API, ok } from "./api";
import { server } from "./server";

export type Captured = { body: any; headers: Headers; url: URL };

/** Answers `method path` with `response` and records every call so a test can assert the exact payload. */
export function captureRequests(
  method: "post" | "patch" | "put" | "delete",
  path: string,
  response: unknown | ((n: number) => Response) = {},
) {
  const calls: Captured[] = [];
  const handler: HttpHandler = http[method](
    `${API}${path}`,
    async ({ request }) => {
      const text = await request.text();
      calls.push({
        body: text ? JSON.parse(text) : undefined,
        headers: request.headers,
        url: new URL(request.url),
      });
      return typeof response === "function"
        ? (response as (n: number) => Response)(calls.length)
        : ok(response as any);
    },
  );
  server.use(handler);
  return { calls };
}
