import type { ReactElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { API, ok } from "./msw/api";
import { captureRequests } from "./msw/capture";
import { server } from "./msw/server";
import { renderWithProviders } from "./render";

/** Real page, table and drawer: empty state → fetched row → create request. */
export function crudPageSmoke(config: {
  id: string;
  page: ReactElement;
  path: string;
  createPath: string;
  entity: string;
  nameLabel: string;
  paginated?: boolean;
  fields?: Record<string, string>;
}) {
  it(`[CO-SMOKE-${config.id}] renders empty and populated lists and creates through the primary action`, async () => {
    const errors = vi.spyOn(console, "error");
    let rows: Record<string, unknown>[] = [];
    server.use(
      http.get(`${API}${config.path}`, () =>
        ok(
          config.paginated
            ? {
                data: rows,
                meta: {
                  total: rows.length,
                  page: 1,
                  limit: 20,
                  total_pages: 1,
                },
              }
            : rows,
        ),
      ),
    );
    const created = captureRequests("post", config.createPath, {
      id: 32,
      name: "Created record",
    });
    const { user, queryClient } = renderWithProviders(config.page);
    await screen.findByText("No data", { selector: ".ant-empty-description" });
    rows = [
      {
        id: 31,
        name: "Existing record",
        phone: "01700000031",
        customer_type: "regular",
        is_main: false,
      },
    ];
    await queryClient.invalidateQueries();
    await screen.findByText("Existing record");
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`Add New ${config.entity}`),
      }),
    );
    await user.type(
      await screen.findByLabelText(config.nameLabel),
      "Created record",
    );
    for (const [label, value] of Object.entries(config.fields ?? {})) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`Create ${config.entity}`),
      }),
    );
    await waitFor(() => expect(created.calls).toHaveLength(1));
    expect(created.calls[0].body).toMatchObject({ name: "Created record" });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(errors).not.toHaveBeenCalled();
  });
}
