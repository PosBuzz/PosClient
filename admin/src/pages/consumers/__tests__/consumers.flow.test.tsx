import { screen, within, waitFor } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, fail, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import { selectAntdOption } from "../../../test/antd";
import Page from "../index";

it("[AD-FLOW-CONS-001] a taken subdomain blocks consumer creation", async () => {
  const checked: string[] = [];
  server.use(
    http.get(`${API}${endpoints.checkSubdomain}`, ({ request }) => {
      checked.push(new URL(request.url).searchParams.get("value")!);
      return ok({ available: false });
    }),
  );
  const created = captureRequests("post", endpoints.consumer);
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  await user.type(screen.getByLabelText("Subdomain"), "taken");
  await screen.findByText("Subdomain is already taken");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(checked).toContain("taken"));
  expect(created.calls).toHaveLength(0);
});

it("[AD-FLOW-CONS-002] creates a consumer with the selected plan", async () => {
  const errors = vi.spyOn(console, "error");
  server.use(
    http.get(`${API}${endpoints.checkSubdomain}`, () =>
      ok({ available: true }),
    ),
  );
  const created = captureRequests("post", endpoints.consumer);
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  for (const [label, value] of Object.entries({
    "Company Name": "Flow Shop",
    Subdomain: "flowshop",
    "Owner Name": "Flow Owner",
    "Primary Email": "flow@example.test",
    Password: "PosBuzz!234",
  })) {
    await user.type(screen.getByLabelText(label), value);
  }
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Plan" }),
    "Plan 1",
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved Successfully");
  expect(created.calls).toHaveLength(1);
  expectRequestContract("admin-consumer-create", {
    method: "POST",
    path: endpoints.consumer,
    auth: "admin",
    body: created.calls[0].body,
  });
  expect(errors).not.toHaveBeenCalled();
});

it("[AD-FLOW-CONS-003] confirms soft deletion and refreshes the list", async () => {
  const consumers = responseContract<any[]>("admin-consumers");
  let reads = 0;
  server.use(
    http.get(`${API}${endpoints.consumer}`, () => {
      reads++;
      return ok(consumers);
    }),
  );
  const deleted = captureRequests(
    "delete",
    `${endpoints.consumer}/${consumers[0].id}`,
  );
  const { user } = renderWithProviders(<Page />);
  const row = (await screen.findByText(consumers[0].company_name)).closest(
    "tr",
  )!;
  await user.click(within(row).getByRole("button", { name: "delete" }));
  expect(deleted.calls).toHaveLength(0);
  await user.click(await screen.findByRole("button", { name: "Yes" }));
  await screen.findByText("Deleted Successfully");
  expect(deleted.calls).toHaveLength(1);
  await waitFor(() => expect(reads).toBeGreaterThan(1));
});

it("[AD-ERR-020] a duplicate subdomain refused by the server shows its message", async () => {
  const message = "A consumer with this subdomain already exists.";
  server.use(
    http.get(`${API}${endpoints.checkSubdomain}`, () =>
      ok({ available: true }),
    ),
  );
  captureRequests("post", endpoints.consumer, () => fail(409, message));
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  for (const [label, value] of Object.entries({
    "Company Name": "Flow Shop",
    Subdomain: "flowshop",
    "Owner Name": "Flow Owner",
    "Primary Email": "flow@example.test",
    Password: "PosBuzz!234",
  })) {
    await user.type(screen.getByLabelText(label), value);
  }
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Plan" }),
    "Plan 1",
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
});
