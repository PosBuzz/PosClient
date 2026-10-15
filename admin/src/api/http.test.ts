import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { get, post, patch, deleteApi } from "./http";
import { endpoints } from "./endpoints";
import { API, ok } from "../test/msw/api";
import { server } from "../test/msw/server";

it("[AD-API-020] a conflict rejects with the axios error (characterization: confirm intent)", async () => {
  server.use(
    http.post(`${API}${endpoints.plan}`, () =>
      HttpResponse.json({ message: "Duplicate plan" }, { status: 409 }),
    ),
  );
  await expect(post(endpoints.plan, {})).rejects.toMatchObject({
    isAxiosError: true,
    response: { status: 409, data: { message: "Duplicate plan" } },
  });
});

it("[AD-API-021] get/post return bodies while patch/delete return responses", async () => {
  server.use(
    ...[http.get, http.post, http.patch, http.delete].map((method) =>
      method(`${API}${endpoints.plan}`, () => ok({ id: 42 })),
    ),
  );
  expect(await get(endpoints.plan)).toEqual({ id: 42 });
  expect(await post(endpoints.plan, {})).toEqual({ id: 42 });
  expect(await patch(endpoints.plan, {})).toMatchObject({
    status: 200,
    data: { id: 42 },
  });
  expect(await deleteApi(endpoints.plan)).toMatchObject({
    status: 200,
    data: { id: 42 },
  });
});

it("[AD-API-022] absolute downloads normalize missing prefixes and trailing slashes", async () => {
  for (const base of ["http://x", "http://x/api/v1/"]) {
    vi.stubEnv("VITE_API_BASE_URL", base);
    vi.resetModules();
    const { endpoints: urls } = await import("./endpoints");
    expect(urls.downloadBillingInvoice).toBe(
      "http://x/api/v1/admin/billing/invoice/pdf",
    );
    expect(urls.downloadBillingHistoryPDF).toBe(
      "http://x/api/v1/admin/billing/history/pdf",
    );
  }
  vi.unstubAllEnvs();
});
