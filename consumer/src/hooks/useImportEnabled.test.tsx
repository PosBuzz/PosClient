import { http } from "msw";
import { describe, expect, it } from "vitest";
import { endpoints } from "../api/endpoints";
import { API, ok } from "../test/msw/api";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { useImportEnabled } from "./useImportEnabled";

function Probe() {
  return <span>{useImportEnabled() ? "import on" : "import off"}</span>;
}

describe("useImportEnabled", () => {
  it("[CO-HOOK-IMP-001] shows import only when the server says it is enabled", async () => {
    server.use(
      http.get(`${API}${endpoints.importStatus}`, () => ok({ enabled: true })),
    );
    const { findByText } = renderWithProviders(<Probe />);
    expect(await findByText("import on")).toBeTruthy();
  });

  it("[CO-HOOK-IMP-002] stays hidden while the server says it is disabled", async () => {
    server.use(
      http.get(`${API}${endpoints.importStatus}`, () => ok({ enabled: false })),
    );
    const { findByText, queryByText } = renderWithProviders(<Probe />);
    expect(await findByText("import off")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByText("import on")).toBeNull();
  });
});
