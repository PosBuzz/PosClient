import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import List from "../index";

it("[CO-SMOKE-returns] renders empty and populated return lists and exposes the create action", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("returns-list");
  let response = { ...data, data: [] };
  server.use(http.get(`${API}${endpoints.getReturns}`, () => ok(response)));
  const { queryClient } = renderWithProviders(<List />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  response = data;
  await queryClient.invalidateQueries();
  for (const ret of data.data) {
    expect(await screen.findByText(ret.return_number)).toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: /Create Return/ })).toBeEnabled();
  expect(errors).not.toHaveBeenCalled();
});
