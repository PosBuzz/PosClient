import { screen, waitFor } from "@testing-library/react";
import saveAs from "file-saver";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../api/endpoints";
import { API } from "../test/msw/api";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import ExportButton from "./ExportButton";

vi.mock("file-saver", () => ({ default: vi.fn() }));

it("[CO-EXPORT-001] offers PDF only and downloads it", async () => {
  const urls: URL[] = [];
  server.use(
    http.get(`${API}${endpoints.exportProducts}`, ({ request }) => {
      urls.push(new URL(request.url));
      return new Response("%PDF-1.4", {
        headers: { "Content-Type": "application/pdf" },
      });
    }),
  );
  const { user } = renderWithProviders(<ExportButton entity="products" />);
  await user.click(screen.getByRole("button", { name: /export/i }));
  await user.click(await screen.findByText("Export as PDF"));
  expect(screen.queryByText("Export as Excel")).toBeNull();
  await waitFor(() => expect(saveAs).toHaveBeenCalled());
  expect(urls[0].searchParams.get("format")).toBe("pdf");
  expect((saveAs as any).mock.calls[0][1]).toBe("products.pdf");
});
