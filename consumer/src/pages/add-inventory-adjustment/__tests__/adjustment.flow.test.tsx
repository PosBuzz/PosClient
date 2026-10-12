import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Adjustment from "../index";

it("[CO-FLOW-INV-003] shows the server shortage if stock changes before an inventory removal", async () => {
  const batches = responseContract<any>("inventory-batches");
  const batch = batches.data.find(
    (batch: any) => batch.variant_id === 1 && batch.branch_id === 1,
  );
  server.use(
    http.get(`${API}${endpoints.inventoryProducts}`, () =>
      ok(responseContract("inventory-products")),
    ),
    http.get(`${API}${endpoints.inventoryProductVariants(1)}`, () =>
      ok(responseContract("inventory-variants")),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.inventoryBatches}`, () =>
      ok({ ...batches, data: [batch] }),
    ),
  );
  const captured = captureRequests(
    "post",
    endpoints.createInventoryAdjustment,
    () => fail(400, "Insufficient stock for adjustment"),
  );
  const { user } = renderWithProviders(<Adjustment />);
  const select = async (id: string, label: string) => {
    await user.click(document.getElementById(id)!);
    const options = await screen.findAllByText(label);
    await user.click(options[options.length - 1]);
  };
  await screen.findByText("Product");
  await select("product_id", "Product 5");
  await select("variant_id", "Default");
  await select("branch_id", "Branch 1");
  await select("batch_id", batch.batch_number);
  await user.click(screen.getByText("Remove from Inventory"));
  const reason = document.getElementById("reason")!;
  await user.click(reason);
  const options = document.querySelectorAll(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content",
  );
  await user.click(options[0] as HTMLElement);
  await user.click(screen.getByRole("button", { name: /Create Adjustment/ }));
  await screen.findByText("Insufficient stock for adjustment");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    batch_id: batch.id,
    variant_id: 1,
    branch_id: 1,
    quantity_change: -1,
  });
});
