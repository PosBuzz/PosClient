import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentReceiptData } from "../constants/printer.constants";
import { server } from "../test/msw/server";
import { PrintingAgentAPI } from "./printing-agent-api";

const AGENT = "http://localhost:8080";
const receipt: AgentReceiptData = {
  sale_number: "SAL-20260314-0001",
  customer_name: "Walk-in Customer",
  items: [
    {
      name: "Tea",
      quantity: 2,
      unit_price: 100,
      line_total: 210,
      discount_amount: 0,
    },
  ],
  subtotal: 200,
  tax_amount: 10,
  total_amount: 210,
  payments: [{ payment_method: "CASH", amount: 210 }],
  openCashDrawer: true,
};

describe("printing agent client", () => {
  beforeEach(() => {
    for (const method of ["log", "error"] as const)
      {vi.spyOn(console, method).mockImplementation(() => {});}
  });
  afterEach(() => vi.useRealTimers());

  it("[CO-PRINT-001] a healthy agent reports its store name", async () => {
    server.use(
      http.get(`${AGENT}/status`, () =>
        HttpResponse.json({ status: "ok", storeName: "Corner Shop" }),
      ),
    );
    expect(await new PrintingAgentAPI().testConnection()).toEqual({
      success: true,
      message: "Connected to printing agent: Corner Shop",
    });
  });

  it("[CO-PRINT-002] a print request sends the receipt as JSON and returns the agent's answer", async () => {
    let seen: unknown;
    let contentType: string | null = null;
    server.use(
      http.post(`${AGENT}/print`, async ({ request }) => {
        seen = await request.json();
        contentType = request.headers.get("content-type");
        return HttpResponse.json({ success: true, message: "Printed" });
      }),
    );
    const result = await new PrintingAgentAPI().printReceipt(receipt);
    expect(result).toEqual({ success: true, message: "Printed" });
    expect(seen).toEqual(receipt);
    expect(contentType).toContain("application/json");
  });

  it("[CO-PRINT-003] an agent that is down gives a readable answer and never throws", async () => {
    server.use(
      http.post(`${AGENT}/print`, () => HttpResponse.error()),
      http.get(`${AGENT}/status`, () => HttpResponse.error()),
    );
    const printed = await new PrintingAgentAPI().printReceipt(receipt);
    expect(printed.success).toBe(false);
    expect(printed.message).toMatch(/Failed to print|not running/);
    const tested = await new PrintingAgentAPI().testConnection();
    expect(tested.success).toBe(false);
    expect(tested.message).toMatch(/Failed to connect|not running/);
  });

  it("[CO-PRINT-003] an agent that answers with an error status reports the status", async () => {
    server.use(
      http.post(
        `${AGENT}/print`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    expect(await new PrintingAgentAPI().printReceipt(receipt)).toEqual({
      success: false,
      message: "Failed to print: Agent responded with status: 500",
    });
    server.use(
      http.post(`${AGENT}/print`, () =>
        HttpResponse.json({ success: false, error: "Out of paper" }),
      ),
    );
    expect(await new PrintingAgentAPI().printReceipt(receipt)).toEqual({
      success: false,
      message: "Out of paper",
    });
  });

  it("[CO-PRINT-004] a silent agent times out after 5 seconds with the 'not running' message", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.post(`${AGENT}/print`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    const pending = new PrintingAgentAPI().printReceipt(receipt);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toEqual({
      success: false,
      message:
        "Printing agent is not running. Please start the printing agent and try again.",
    });
  });

  it("[CO-PRINT-005] the agent address can be changed and is used for later calls", async () => {
    const api = new PrintingAgentAPI();
    expect(api.getAgentUrl()).toBe(AGENT);
    api.setAgentUrl("http://192.168.0.20:9000");
    let hit = false;
    server.use(
      http.get("http://192.168.0.20:9000/status", () => {
        hit = true;
        return HttpResponse.json({ status: "ok" });
      }),
    );
    const result = await api.testConnection();
    expect(hit).toBe(true);
    expect(result.message).toBe("Connected to printing agent: Unknown Store");
  });

  it("[CO-PRINT-006] the test print never opens the cash drawer", async () => {
    let seen: AgentReceiptData | undefined;
    server.use(
      http.post(`${AGENT}/print`, async ({ request }) => {
        seen = (await request.json()) as AgentReceiptData;
        return HttpResponse.json({ success: true });
      }),
    );
    await new PrintingAgentAPI().testPrint();
    expect(seen).toMatchObject({
      sale_number: "TEST-001",
      openCashDrawer: false,
      total_amount: 10.8,
    });
  });

  it("[CO-PRINT-007] the agent configuration can be read and updated; failures are reported, not thrown", async () => {
    const api = new PrintingAgentAPI();
    server.use(
      http.get(`${AGENT}/config`, () =>
        HttpResponse.json({ storeName: "Shop" }),
      ),
      http.post(`${AGENT}/config`, () => HttpResponse.json({ success: true })),
    );
    expect(await api.getConfig()).toEqual({ storeName: "Shop" });
    expect(await api.updateConfig({ storeName: "New" })).toEqual({
      success: true,
      message: "Configuration updated successfully",
    });
    server.use(
      http.get(
        `${AGENT}/config`,
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.post(`${AGENT}/config`, () => HttpResponse.error()),
    );
    expect(await api.getConfig()).toBeNull();
    expect((await api.updateConfig({ storeName: "New" })).success).toBe(false);
  });
});
