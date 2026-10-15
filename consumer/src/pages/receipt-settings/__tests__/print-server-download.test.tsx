import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { PRINT_SERVER_DOWNLOAD_URL } from "../../../constants/printer.constants";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-PSDL-001] receipt settings offers the print server zip as a download", async () => {
  server.use(
    http.get(`${API}${endpoints.receiptSettingsByType("receipt")}`, () =>
      ok(responseContract("receipt-settings-list")),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  renderWithProviders(<Page />);
  const link = await screen.findByRole("link", {
    name: /Download Print Server/,
  });
  expect(link.getAttribute("href")).toBe(PRINT_SERVER_DOWNLOAD_URL);
  expect(link.hasAttribute("download")).toBe(true);
});
