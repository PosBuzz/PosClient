import { screen } from "@testing-library/react";
import { http } from "msw";
import { Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import List from "../../receipt-settings";
import Editor from "../index";

it("[CO-SMOKE-add-or-edit-receipt-settings] opens receipt creation from the list and saves the preset", async () => {
  const errors = vi.spyOn(console, "error");
  server.use(
    http.get(`${API}${endpoints.receiptSettingsByType("receipt")}`, () =>
      ok(responseContract("receipt-settings-list")),
    ),
    http.get(`${API}${endpoints.receiptSettingDefaults("receipt")}`, () =>
      ok(responseContract("receipt-defaults")),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  const created = captureRequests(
    "post",
    endpoints.receiptSettings,
    responseContract("receipt-setting-detail"),
  );
  const { user } = renderWithProviders(
    <Routes>
      <Route path="/printer-settings" element={<List />} />
      <Route path="/printer-settings/add" element={<Editor />} />
    </Routes>,
    { route: "/printer-settings" },
  );
  await screen.findByText("C4 receipt");
  await user.click(screen.getByRole("button", { name: /Create Setting/ }));
  await user.type(
    await screen.findByLabelText("Setting Name"),
    "C4 custom receipt",
  );
  await user.click(
    screen.getByRole("button", { name: /Create Setting|Save Setting/ }),
  );
  await screen.findByText("Setting created successfully");
  expect(created.calls).toHaveLength(1);
  expect(created.calls[0].body).toMatchObject({
    name: "C4 custom receipt",
    type: "receipt",
    settings: { currencySymbol: "৳" },
  });
  expect(errors).not.toHaveBeenCalled();
});
