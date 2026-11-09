import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Inventory from "../index";

it("[CO-INV-VAL-001] shows complete inventory and branch cost values from the summary independently of paginated rows", async () => {
  const summary = responseContract<any>("inventory-summary");
  server.use(
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.getCategories}`, () => ok([])),
    http.get(`${API}${endpoints.inventoryBatches}`, () =>
      ok(responseContract("inventory-batches")),
    ),
    http.get(`${API}${endpoints.inventorySummary}`, ({ request }) => {
      const branch = new URL(request.url).searchParams.get("branch_id");
      return ok({
        ...summary,
        total_inventory_value: branch ? 80 : 110.75,
        branch_values: branch
          ? [{ branch_id: 2, branch_name: "Branch 2", inventory_value: 80 }]
          : [
              { branch_id: 1, branch_name: "Branch 1", inventory_value: 30.75 },
              { branch_id: 2, branch_name: "Branch 2", inventory_value: 80 },
            ],
      });
    }),
  );
  const { user } = renderWithProviders(<Inventory />);
  const card = (await screen.findByText("Total Inventory Value")).closest(
    ".ant-card",
  )!;
  expect(within(card as HTMLElement).getByText(/110.75/)).toBeInTheDocument();
  expect(within(card as HTMLElement).getByText(/30.75/)).toBeInTheDocument();
  expect(within(card as HTMLElement).getByText(/80.00/)).toBeInTheDocument();
  await user.click(
    within(
      screen.getByText("All Branches").closest(".ant-select") as HTMLElement,
    ).getByRole("combobox"),
  );
  await user.click(await screen.findByTitle("Branch 2"));
  const filtered = (
    await screen.findByText("Selected Branch Inventory Value")
  ).closest(".ant-card")!;
  expect(within(filtered as HTMLElement).getAllByText(/80.00/)).toHaveLength(2);
  expect(
    within(filtered as HTMLElement).queryByText(/30.75/),
  ).not.toBeInTheDocument();
});
