import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { responseContract } from "../../../test/contracts/load";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import { balanceLabel } from "../../../utils/delivery-partner.utils";
import DeliveryPartners from "../index";

process.env.TZ = "Asia/Dhaka";

const list = responseContract<any[]>("delivery-partners-list");
const partner = list[0];

beforeEach(() => {
  server.use(http.get(`${API}/consumer/delivery-partners`, () => ok(list)));
});

it("[CO-DP-010] the backend list renders each partner with who owes whom and what waits for a payout", async () => {
  const errors = vi.spyOn(console, "error");
  renderWithProviders(<DeliveryPartners />);
  const link = await screen.findByRole("link", { name: partner.name });
  expect(link).toHaveAttribute("href", `/delivery-partners/view/${partner.id}`);
  const row = link.closest("tr")!;
  const label = balanceLabel(partner.balance).text;
  expect(within(row).getByText(label)).toBeInTheDocument();
  expect(
    within(row).getByText(`${partner.unsettled_orders} order(s)`),
  ).toBeInTheDocument();
  expect(
    screen
      .getByText(partner.balance > 0 ? "Partners owe you" : "You owe partners")
      .closest(".ant-statistic"),
  ).toHaveTextContent(Math.abs(partner.balance).toFixed(2));
  expect(errors).not.toHaveBeenCalled();
});

it("[CO-DP-011] adding a partner sends its name and default charges", async () => {
  const captured = captureRequests("post", "/consumer/delivery-partners", {
    ...partner,
    id: 99,
  });
  const { user } = renderWithProviders(<DeliveryPartners />);
  await screen.findByRole("link", { name: partner.name });
  await user.click(screen.getByRole("button", { name: /Add Partner/ }));
  await user.type(await screen.findByLabelText("Partner name"), "Steadfast");
  const charge = screen.getByLabelText("Default delivery charge");
  await user.clear(charge);
  await user.type(charge, "70");
  const fee = screen.getByLabelText("Default COD fee");
  await user.clear(fee);
  await user.type(fee, "1.5");
  await user.click(screen.getByRole("button", { name: "Add partner" }));
  await screen.findByText("Delivery partner added");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    name: "Steadfast",
    default_delivery_charge: 70,
    default_cod_fee_percent: 1.5,
    is_active: true,
  });
});

it("[CO-DP-012] a blank name is refused before anything is sent", async () => {
  const captured = captureRequests("post", "/consumer/delivery-partners");
  const { user } = renderWithProviders(<DeliveryPartners />);
  await screen.findByRole("link", { name: partner.name });
  await user.click(screen.getByRole("button", { name: /Add Partner/ }));
  await user.type(await screen.findByLabelText("Partner name"), "   ");
  await user.click(screen.getByRole("button", { name: "Add partner" }));
  await screen.findByText("Name is required");
  await waitFor(() => expect(captured.calls).toHaveLength(0));
});

it("[CO-DP-013] a refused delete shows the backend's reason", async () => {
  server.use(
    http.delete(`${API}/consumer/delivery-partners/${partner.id}`, () =>
      fail(
        400,
        "This partner has 1 order(s). Deactivate it instead so its history is kept.",
      ),
    ),
  );
  const { user } = renderWithProviders(<DeliveryPartners />);
  await screen.findByRole("link", { name: partner.name });
  await user.click(screen.getByRole("button", { name: "Delete" }));
  const confirm = await screen.findByRole("tooltip");
  await user.click(within(confirm).getByRole("button", { name: "Delete" }));
  await screen.findByText(/Deactivate it instead/);
});
