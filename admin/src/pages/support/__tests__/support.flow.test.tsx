import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import { selectAntdOption } from "../../../test/antd";
import Page from "../index";

it("[AD-FLOW-SUP-001] opens a ticket, sends a reply and changes status", async () => {
  const errors = vi.spyOn(console, "error");
  const ticket = responseContract<any>("admin-support-detail");
  server.use(
    http.get(`${API}${endpoints.supportTickets}`, () =>
      ok(responseContract("admin-support-populated")),
    ),
    http.get(`${API}${endpoints.supportTicketStats}`, () =>
      ok(responseContract("admin-support-stats")),
    ),
    http.get(`${API}${endpoints.supportTicket(ticket.id)}`, () => ok(ticket)),
  );
  const replies = captureRequests(
    "post",
    endpoints.supportTicketMessages(ticket.id),
  );
  const updates = captureRequests("patch", endpoints.supportTicket(ticket.id));
  const { user } = renderWithProviders(<Page />);
  await user.click(await screen.findByRole("button", { name: ticket.subject }));
  const reply = await screen.findByPlaceholderText("Reply to the customer…");
  await user.type(reply, "We can help with your receipt");
  await user.click(screen.getByRole("button", { name: "Send reply" }));
  await screen.findByText("Reply sent");
  expect(replies.calls[0].body).toEqual({
    body: "We can help with your receipt",
  });
  const drawer = document.querySelector(".ant-drawer-body") as HTMLElement;
  await selectAntdOption(
    user,
    within(drawer).getAllByRole("combobox")[0],
    "Resolved",
  );
  await screen.findByText("Ticket updated");
  expect(updates.calls[0].body).toEqual({ status: "RESOLVED" });
  expect(errors).not.toHaveBeenCalled();
});
