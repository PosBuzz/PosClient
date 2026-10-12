import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-view-return] renders the return and its original sale from the backend contracts", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("return-detail");
  server.use(
    http.get(`${API}${endpoints.getReturn(data.id)}`, () => ok(data)),
    http.get(`${API}${endpoints.getSale(data.original_sale_id)}`, () =>
      ok(responseContract("sale-by-number")),
    ),
  );
  renderWithProviders(<Page />, {
    route: `/returns/view/${data.id}`,
    path: "/returns/view/:id",
  });
  expect(
    await screen.findByText(`Return #${data.return_number}`, {
      selector: "h4",
    }),
  ).toBeInTheDocument();
  expect(
    screen
      .getAllByRole("link")
      .some(
        (link) =>
          link.getAttribute("href") === `/sales/view/${data.original_sale_id}`,
      ),
  ).toBe(true);
  expect(errors).not.toHaveBeenCalled();
});
