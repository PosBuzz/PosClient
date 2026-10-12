import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Expiring from "../index";

it("[CO-FLOW-INV-005] renders the expiring inventory contract and its empty state", async () => {
  const data = responseContract<any>("inventory-expiring");
  server.use(
    http.get(`${API}${endpoints.inventoryExpiringBatches}`, () => ok(data)),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  renderWithProviders(<Expiring />);
  expect(
    await screen.findByText("No data", { selector: ".ant-empty-description" }),
  ).toBeInTheDocument();
  expect(data).toHaveLength(0);
});
