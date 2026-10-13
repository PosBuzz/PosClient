import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";
import { saveAs } from "file-saver";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

it("[AD-FLOW-BKP-001] mocks backup and requires file plus confirmation before restore", async () => {
  const append = vi.spyOn(FormData.prototype, "append");
  let backups = 0;
  const restored: File[] = [];
  server.use(
    http.get(`${API}${endpoints.backup}`, () => {
      backups++;
      return new HttpResponse("-- test-only sql", {
        headers: { "Content-Type": "application/sql" },
      });
    }),
    http.post(`${API}${endpoints.restore}`, async ({ request }) => {
      restored.push((await request.formData()).get("file") as File);
      return ok({});
    }),
  );
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Download Backup/ }));
  await screen.findByText("Full database backup completed successfully");
  expect(backups).toBe(1);
  expect(saveAs).toHaveBeenCalledOnce();
  expect(restored).toHaveLength(0);
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  await user.upload(
    input,
    new File(["-- test-only sql"], "test.sql", { type: "application/sql" }),
  );
  const confirm = await screen.findByRole("button", { name: "Restore" });
  expect(restored).toHaveLength(0);
  await user.click(confirm);
  await screen.findByText("Database restored successfully");
  await waitFor(() => expect(restored).toHaveLength(1));
  expect(append).toHaveBeenCalledWith(
    "file",
    expect.objectContaining({ name: "test.sql" }),
    "test.sql",
  );
  expect(await restored[0].text()).toBe("-- test-only sql");
});
