import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import { selectAntdOption } from "../../../test/antd";
import Modal from "../_ImportDataModal";

it("[AD-FLOW-CONS-004] previews the selected source/target and requires destination confirmation", async () => {
  const errors = vi.spyOn(console, "error");
  const consumers = responseContract<any[]>("admin-consumers");
  const target = {
    ...consumers[0],
    id: consumers[0].id + 1,
    company_name: "Destination Shop",
    subdomain: "destshop",
  };
  server.use(
    http.get(`${API}${endpoints.consumer}`, () => ok([...consumers, target])),
    http.get(`${API}${endpoints.consumerDataImports}`, () => ok([])),
  );
  const preview = captureRequests("post", endpoints.consumerDataImportPreview, {
    counts: { products: 3 },
  });
  const imported = captureRequests("post", endpoints.consumerDataImports, {
    summary: { products: { created: 3, updated: 0, skipped: 0 } },
  });
  const closed = vi.fn();
  const { user } = renderWithProviders(
    <Modal source={consumers[0]} open onClose={closed} onImported={vi.fn()} />,
  );
  await selectAntdOption(
    user,
    screen.getByRole("combobox"),
    `${target.company_name} (${target.subdomain})`,
  );
  expect(screen.getByRole("button", { name: "Import now" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Preview import" }));
  await screen.findByPlaceholderText(target.subdomain);
  expect(preview.calls[0].body).toEqual({
    source_consumer_id: consumers[0].id,
    target_consumer_id: target.id,
    sections: ["PRODUCTS"],
  });
  expect(imported.calls).toHaveLength(0);
  await user.type(
    screen.getByPlaceholderText(target.subdomain),
    target.subdomain,
  );
  await user.click(screen.getByRole("button", { name: "Import now" }));
  await screen.findByText("Import completed: 3 created, 0 updated, 0 skipped");
  expect(imported.calls[0].body).toEqual({
    ...preview.calls[0].body,
    duplicate_strategy: "SKIP",
    confirm_target_subdomain: target.subdomain,
  });
  expect(closed).toHaveBeenCalledOnce();
  expect(errors).not.toHaveBeenCalled();
});
