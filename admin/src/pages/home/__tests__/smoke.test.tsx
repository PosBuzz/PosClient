import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[AD-SMOKE-home] renders empty and populated account totals without console errors", async () => {
  const errors = vi.spyOn(console, "error");
  let data: any[] = [];
  server.use(http.get(`${API}${endpoints.consumer}`, () => ok(data)));
  const { queryClient } = renderWithProviders(<Page />);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  const total = () =>
    within(
      screen.getByText("Total Users").closest(".ant-statistic")!,
    ).getByText(String(data.length), {
      selector: ".ant-statistic-content-value-int",
    });
  expect(total()).toBeVisible();
  data = responseContract("admin-consumers");
  await queryClient.invalidateQueries();
  await waitFor(() => expect(total()).toBeVisible());
  expect(errors).not.toHaveBeenCalled();
});
