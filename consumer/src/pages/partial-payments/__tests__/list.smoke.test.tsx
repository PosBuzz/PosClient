import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import List from "../index";

it("[CO-SMOKE-partial-payments] renders balances, filters the list and opens payment entry", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("partial-payments");
  const requests: URL[] = [];
  let response = { ...data, data: [], meta: { ...data.meta, total: 0 } };
  server.use(
    http.get(`${API}${endpoints.getPartiallyPaidSales}`, ({ request }) => {
      requests.push(new URL(request.url));
      return ok(response);
    }),
  );
  const { user, queryClient } = renderWithProviders(<List />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  response = data;
  await queryClient.invalidateQueries();
  const sale = data.data[0];
  await screen.findByText(sale.sale_number);
  expect(
    screen.getByText("Total Remaining").closest(".ant-statistic"),
  ).toHaveTextContent(sale.remaining_amount.toFixed(2));
  await user.type(
    screen.getByPlaceholderText("Search by sale number, customer"),
    "SAL",
  );
  await waitFor(() =>
    expect(requests[requests.length - 1].searchParams.get("search")).toBe(
      "SAL",
    ),
  );
  await user.click(
    within(
      screen
        .getByText("Filter by branch")
        .closest(".ant-select") as HTMLElement,
    ).getByRole("combobox"),
  );
  await user.click(await screen.findByTitle("Branch 1"));
  await waitFor(() =>
    expect(requests[requests.length - 1].searchParams.get("branch_id")).toBe(
      "1",
    ),
  );
  const statusBox = screen
    .getByText("All (Due & Partial)")
    .closest(".ant-select")!;
  await user.click(within(statusBox as HTMLElement).getByRole("combobox"));
  await user.click(await screen.findByTitle("Partial Only"));
  await waitFor(() =>
    expect(
      requests[requests.length - 1].searchParams.get("payment_status"),
    ).toBe("partial"),
  );
  expect(
    screen
      .getAllByRole("link")
      .some((link) => link.getAttribute("href")?.includes(String(sale.id))),
  ).toBe(true);
  expect(errors).not.toHaveBeenCalled();
});
