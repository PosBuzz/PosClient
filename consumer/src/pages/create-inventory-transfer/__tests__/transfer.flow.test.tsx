import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Transfer from "../index";

it("[CO-FLOW-INV-002] creates a transfer of a chosen source batch to the destination branch", async () => {
  const batches = responseContract<any>("inventory-batches");
  const source = {
    ...batches,
    data: batches.data.filter((b: any) => b.branch_id === 1),
  };
  server.use(
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.inventoryBatches}`, () => ok(source)),
  );
  const captured = captureRequests("post", endpoints.createInventoryTransfer, {
    id: 81,
  });
  const { user } = renderWithProviders(<Transfer />);
  const select = async (placeholder: string, label: string) => {
    const wrapper = (await screen.findByText(placeholder)).closest(
      ".ant-select",
    )!;
    await user.click(within(wrapper as HTMLElement).getByRole("combobox"));
    const options = await screen.findAllByText(label, { exact: false });
    await user.click(
      options.find(
        (node) =>
          node.closest(".ant-select-item-option") &&
          !node.closest(".ant-select-dropdown-hidden"),
      )!,
    );
  };
  await select("Select source branch", "Branch 1");
  await select("Select destination branch", "Branch 2");
  const batch = source.data[0];
  const row = (await screen.findByText(batch.batch_number)).closest("tr")!;
  await user.click(within(row).getByRole("button", { name: /Add/ }));
  await user.click(screen.getByRole("button", { name: /Create Transfer/ }));
  await screen.findByText("Transfer created successfully");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    source_branch_id: 1,
    destination_branch_id: 2,
    items: [{ batch_id: batch.id, quantity: 1 }],
  });
  expectRequestContract("inventory-transfer-create", {
    method: "POST",
    path: endpoints.createInventoryTransfer,
    auth: "client",
    body: captured.calls[0].body,
  });
});
