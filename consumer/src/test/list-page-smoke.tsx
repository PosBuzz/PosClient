import { screen, waitFor } from "@testing-library/react";
import { http, type DefaultBodyType } from "msw";
import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";
import { responseContract } from "./contracts/load";
import { API, ok } from "./msw/api";
import { server } from "./msw/server";
import { renderWithProviders } from "./render";

/** A read-only list's contract must render both an empty result and a real row. */
export function listPageSmoke(config: {
  id: string;
  page: ReactElement;
  path: string;
  contract: string;
  rowsKey?: "data" | "rows";
  rowLabel: (row: any) => string;
  dependencies?: Record<string, DefaultBodyType>;
}) {
  it(`[CO-SMOKE-${config.id}] renders empty and populated backend contracts without console errors`, async () => {
    const errors = vi.spyOn(console, "error");
    const full = responseContract<any>(config.contract);
    const rows = config.rowsKey ? full[config.rowsKey] : full;
    expect(rows.length).toBeGreaterThan(0);
    let response = config.rowsKey ? { ...full, [config.rowsKey]: [] } : [];
    server.use(http.get(`${API}${config.path}`, () => ok(response)));
    for (const [path, body] of Object.entries(config.dependencies ?? {})) {
      server.use(http.get(`${API}${path}`, () => ok(body)));
    }
    const { queryClient } = renderWithProviders(config.page);
    await screen.findByText("No data", { selector: ".ant-empty-description" });
    response = full;
    await queryClient.invalidateQueries();
    await screen.findAllByText(config.rowLabel(rows[0]), { exact: false });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(errors).not.toHaveBeenCalled();
  });
}
