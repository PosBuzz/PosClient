import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Transfers from "../index";

it("[CO-FLOW-INV-006] completes and cancels pending transfers only after confirmation", async () => {
  const transfers = [81, 82].map((id) => ({
    id,
    transfer_number: `TR-${id}`,
    status: "pending",
    source_branch: { name: "Branch 1" },
    destination_branch: { name: "Branch 2" },
    created_by_user: { name: "Tenant Admin" },
    items: [{ quantity: 1 }],
    created_at: "2026-03-14T12:00:00.000Z",
  }));
  server.use(
    http.get(`${API}${endpoints.inventoryTransfers}`, () =>
      ok({ data: transfers, meta: { total: 2, page: 1, limit: 10 } }),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  const completed = captureRequests(
    "patch",
    endpoints.completeInventoryTransfer(81),
  );
  const cancelled = captureRequests(
    "patch",
    endpoints.cancelInventoryTransfer(82),
  );
  const { user } = renderWithProviders(<Transfers />);
  const first = (await screen.findByText("#81")).closest("tr")!;
  await user.click(
    within(first).getByRole("img", { name: "check" }).closest("button")!,
  );
  expect(completed.calls).toHaveLength(0);
  await user.click(
    await screen.findByRole("button", { name: "Yes, Complete" }),
  );
  await screen.findByText("Transfer completed successfully");
  expect(completed.calls).toHaveLength(1);
  const second = screen.getByText("#82").closest("tr")!;
  await user.click(
    within(second).getByRole("img", { name: "close" }).closest("button")!,
  );
  expect(cancelled.calls).toHaveLength(0);
  await user.click(await screen.findByRole("button", { name: "Yes, Cancel" }));
  await screen.findByText("Transfer cancelled successfully");
  expect(cancelled.calls).toHaveLength(1);
});
