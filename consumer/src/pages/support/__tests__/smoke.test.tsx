import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Support from "../index";

it("[CO-SMOKE-support] renders empty and populated tickets and submits a support request", async () => {
  const errors = vi.spyOn(console, "error");
  const ticket = {
    id: 31,
    subject: "Printer issue",
    category: "TECHNICAL",
    priority: "MEDIUM",
    status: "OPEN",
    created_at: "2026-03-14T12:00:00Z",
    messages: [],
  };
  let rows: any[] = [];
  server.use(
    http.get(`${API}${endpoints.supportTickets}`, () => ok(rows)),
    http.get(`${API}${endpoints.supportTicket(31)}`, () => ok(ticket)),
  );
  const captured = captureRequests("post", endpoints.supportTickets, ticket);
  const { user, queryClient } = renderWithProviders(<Support />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  rows = [ticket];
  await queryClient.invalidateQueries();
  await screen.findByText(ticket.subject);
  await user.click(screen.getByRole("button", { name: /New ticket/ }));
  await user.type(await screen.findByLabelText("Subject"), "Printer issue");
  await user.type(
    screen.getByLabelText("Describe the problem"),
    "The printer does not connect.",
  );
  await user.click(screen.getByRole("button", { name: /Submit ticket/ }));
  await screen.findByText("Support ticket created");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    subject: "Printer issue",
    message: "The printer does not connect.",
    category: "TECHNICAL",
  });
  expect(errors).not.toHaveBeenCalled();
});
