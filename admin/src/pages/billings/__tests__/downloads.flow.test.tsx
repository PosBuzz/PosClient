import { screen, within, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";
import Consumers from "../../consumers";
import { saveAs } from "file-saver";

vi.mock("file-saver", () => ({ default: vi.fn(), saveAs: vi.fn() }));

it("[AD-FLOW-BILL-002] invoice/history PDFs and Excel use the selected row ids", async () => {
  const opened = vi.spyOn(window, "open").mockImplementation(() => null);
  const bills = responseContract<any[]>("admin-billings");
  const consumers = responseContract<any[]>("admin-consumers");
  const excel: string[] = [];
  server.use(
    http.get(`${API}${endpoints.billing}`, () => ok(bills)),
    http.get(
      `${API}${endpoints.downloadBillingHistoryExcel}/:id`,
      ({ request }) => {
        excel.push(request.url);
        return new HttpResponse("test excel", {
          headers: { "Content-Type": "application/octet-stream" },
        });
      },
    ),
  );
  const first = renderWithProviders(<Page />);
  await first.user.click(
    await screen.findByRole("button", { name: "download" }),
  );
  expect(opened).toHaveBeenCalledWith(
    `${endpoints.downloadBillingInvoice}/${bills[0].id}`,
    "_blank",
  );
  first.unmount();
  const { user } = renderWithProviders(<Consumers />);
  const row = (await screen.findByText(consumers[0].company_name)).closest(
    "tr",
  )!;
  await user.click(within(row).getByRole("button", { name: "download" }));
  expect(opened).toHaveBeenLastCalledWith(
    `${endpoints.downloadBillingHistoryPDF}/${consumers[0].id}`,
    "_blank",
  );
  await user.click(within(row).getByRole("button", { name: "file-excel" }));
  await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
  expect(excel).toEqual([
    `${API}${endpoints.downloadBillingHistoryExcel}/${consumers[0].id}`,
  ]);
});
