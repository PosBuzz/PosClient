import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { beforeEach, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Dashboard from "../index";

const data = responseContract<any>("dashboard");
const requests: URL[] = [];
beforeEach(() => {
  requests.length = 0;
  server.use(
    http.get(`${API}${endpoints.getDashboardAnalytics}`, ({ request }) => {
      requests.push(new URL(request.url));
      return ok(data);
    }),
  );
});
const card = (title: string) => screen.getByText(title).closest(".ant-card")!;
const number = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

it("[CO-FLOW-DASH-001] renders every daily summary field in its labelled card", async () => {
  renderWithProviders(<Dashboard />);
  await screen.findByText("Product 19");
  for (const [title, key] of [
    ["Today's Sale Amount", "today_total_sale"],
    ["Today's Returns", "today_returns_total"],
    ["Today's Net Sale", "today_net_sale"],
  ]) {
    expect(
      card(title).querySelector(".ant-statistic-content-value")?.textContent,
    ).toBe(number(data.summary[key]));
  }
  expect(
    card("Today's Sale Count").querySelector(".ant-statistic-content-value")
      ?.textContent,
  ).toBe(String(data.summary.today_transactions));
  const sale = card("Today's Sale Amount");
  for (const [label, key] of [
    ["Collected:", "today_collected"],
    ["Due:", "today_due"],
  ]) {
    expect(within(sale as HTMLElement).getByText(label).textContent).toContain(
      data.summary[key].toFixed(2),
    );
  }
  const returns = card("Today's Returns");
  for (const [label, key] of [
    ["Refund:", "today_refunds_total"],
    ["Exchange:", "today_exchanges_total"],
  ]) {
    expect(
      within(returns as HTMLElement).getByText(label).textContent,
    ).toContain(data.summary[key].toFixed(2));
  }
  expect(
    returns.querySelector(".ant-statistic-content-suffix")?.textContent,
  ).toBe(`(${data.summary.today_returns_count})`);
});

it("[CO-FLOW-DASH-002] period selectors send independent daily, weekly and monthly query parameters", async () => {
  const { user } = renderWithProviders(<Dashboard />);
  await screen.findByText("Product 19");
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({
    payment_period: "daily",
    return_payment_period: "daily",
    top_products_period: "daily",
  });
  for (const [title, param, period] of [
    ["Payment Breakdown", "payment_period", "Weekly"],
    ["Return Payment Breakdown", "return_payment_period", "Monthly"],
    ["Top 5 Products", "top_products_period", "Weekly"],
  ]) {
    const box = within(card(title) as HTMLElement).getByRole("combobox");
    await user.click(box);
    const options = await screen.findAllByTitle(period);
    await user.click(
      options.find((option) =>
        option.classList.contains("ant-select-item-option"),
      )!,
    );
    await waitFor(() =>
      expect(requests[requests.length - 1]?.searchParams.get(param)).toBe(
        period.toLowerCase(),
      ),
    );
  }
  expect(Object.fromEntries(requests[requests.length - 1].searchParams)).toEqual({
    payment_period: "weekly",
    return_payment_period: "monthly",
    top_products_period: "weekly",
  });
});
