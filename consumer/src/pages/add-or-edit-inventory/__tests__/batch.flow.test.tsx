import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Batch from "../index";

it("[CO-FLOW-INV-001] adds an inventory batch with the recorded purchase payload", async () => {
  const products = responseContract<any[]>("inventory-products");
  const variants = responseContract<any[]>("inventory-variants");
  const product = products.find((p) => p.name === "Product 5")!;
  server.use(
    http.get(`${API}${endpoints.inventoryProducts}`, () => ok(products)),
    http.get(`${API}${endpoints.inventoryProductVariants(product.id)}`, () =>
      ok(variants),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.getVendors}`, () => ok([])),
  );
  const captured = captureRequests("post", endpoints.createInventoryBatch, {
    id: 77,
  });
  const { user } = renderWithProviders(<Batch />);
  const select = async (id: string, label: string) => {
    await user.click(document.getElementById(id)!);
    const options = await screen.findAllByText(label);
    await user.click(options[options.length - 1]);
  };
  await waitFor(() =>
    expect(document.getElementById("product_id")).toBeEnabled(),
  );
  await select("product_id", product.name);
  await select("variant_id", variants[0].name);
  await select("branch_id", "Branch 1");
  const batchNumber = screen.getByPlaceholderText(
    "Enter batch number",
  ) as HTMLInputElement;
  await user.type(batchNumber, "C4-BATCH", {
    initialSelectionStart: 0,
    initialSelectionEnd: batchNumber.value.length,
  });
  await user.type(screen.getByPlaceholderText("Enter cost price"), "40");
  await user.type(screen.getByPlaceholderText("Enter quantity to add"), "5");
  await user.click(screen.getByRole("button", { name: /Add to Inventory/ }));
  await screen.findByText("Inventory added successfully");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    variant_id: variants[0].id,
    branch_id: 1,
    batch_number: "C4-BATCH",
    quantity: 5,
    cost_price: "40",
  });
  expectRequestContract("inventory-batch-create", {
    method: "POST",
    path: endpoints.createInventoryBatch,
    auth: "client",
    body: captured.calls[0].body,
  });
});
