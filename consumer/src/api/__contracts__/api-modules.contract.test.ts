import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aiApi } from "../ai-api";
import { exportApi } from "../export-api";
import { importApi } from "../import-api";
import { inventoryApi } from "../inventory-api";
import { operationalCostsApi } from "../operational-costs-api";
import { paymentsApi } from "../payments-api";
import { productApi } from "../product-api";
import { productAuditApi } from "../product-audit-api";
import { promotionApi } from "../promotion-api";
import { purchasePaymentsApi } from "../purchase-payments-api";
import { receiptSettingsApi } from "../receipt-settings-api";
import { returnsApi } from "../returns-api";
import { rewardsApi } from "../rewards.api";
import { salesApi } from "../sales-api";
import { supportApi } from "../support-api";
import { endpoints } from "../endpoints";
import { server } from "../../test/msw/server";
import { API } from "../../test/msw/api";

type Route = { method: string; path: string; guards: string[] };
const routes: Route[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../contracts/routes.json"), "utf8"),
);
const toRegex = (template: string) =>
  new RegExp(`^${template.replace(/:\w+/g, "[^/]+")}$`);

type Captured = {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
};
let captured: Captured[] = [];
const called = new Set<string>(); // "METHOD /api/v1/template" for every route some API function really reached
const FILE = new File(["x"], "sheet.xlsx");

beforeEach(() => {
  captured = [];
  server.use(
    http.all(`${API}/*`, async ({ request }) => {
      const url = new URL(request.url);
      let body: unknown;
      const type = request.headers.get("content-type") ?? "";
      if (type.includes("application/json")) body = await request.json();
      else if (type.includes("multipart/form-data")) body = "multipart";
      captured.push({
        method: request.method,
        path: url.pathname.replace("/api/v1", ""),
        query: Object.fromEntries(url.searchParams),
        body,
      });
      const isFile =
        /\/pdf$|\/template$|\/receipt\/|\/receipt-settings\/preview$/.test(
          url.pathname.replace("/api/v1", ""),
        ) || url.pathname.endsWith("/receipt-settings/preview");
      if (isFile) {
        return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="report.pdf"',
          },
        });
      }
      return HttpResponse.json({});
    }),
  );
});

type Expect = {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
};
type Case = [id: string, call: () => Promise<unknown>, expected: Expect];
const body = { a: 1 };
const dates = { startDate: "2026-03-01", endDate: "2026-03-31" };

const CASES: Case[] = [
  // ---- sales
  [
    "salesApi.getSales",
    () => salesApi.getSales({ page: 2, limit: 10 } as never),
    {
      method: "GET",
      path: "/consumer/sales",
      query: { page: "2", limit: "10" },
    },
  ],
  [
    "salesApi.getSale",
    () => salesApi.getSale(5),
    { method: "GET", path: "/consumer/sales/5", query: {} },
  ],
  [
    "salesApi.getSale (deleted)",
    () => salesApi.getSale(5, true),
    {
      method: "GET",
      path: "/consumer/sales/5",
      query: { include_deleted: "true" },
    },
  ],
  [
    "salesApi.updateSaleNote",
    () => salesApi.updateSaleNote(5, "n"),
    { method: "PATCH", path: "/consumer/sales/5/note", body: { notes: "n" } },
  ],
  [
    "salesApi.deleteSale",
    () => salesApi.deleteSale(5, "why"),
    { method: "DELETE", path: "/consumer/sales/5", body: { reason: "why" } },
  ],
  [
    "salesApi.restoreSale",
    () => salesApi.restoreSale(5),
    { method: "POST", path: "/consumer/sales/5/restore", body: {} },
  ],
  [
    "salesApi.createSale",
    () => salesApi.createSale(body as never),
    { method: "POST", path: "/consumer/sales", body },
  ],
  [
    "salesApi.getSalesStats",
    () => salesApi.getSalesStats(3),
    { method: "GET", path: "/consumer/sales/stats", query: { branch_id: "3" } },
  ],
  [
    "salesApi.getUserSalesStats",
    () => salesApi.getUserSalesStats({ ...dates, branch_id: 3 }),
    {
      method: "GET",
      path: "/consumer/sales/user-sales-stats",
      query: { ...dates, branch_id: "3" },
    },
  ],
  [
    "salesApi.getUserSalesDetail",
    () => salesApi.getUserSalesDetail(9, { ...dates, page: 1, limit: 5 }),
    {
      method: "GET",
      path: "/consumer/sales/user-sales-stats/9",
      query: { ...dates, page: "1", limit: "5" },
    },
  ],
  [
    "salesApi.getBranchOptions",
    () => salesApi.getBranchOptions(),
    { method: "GET", path: "/consumer/branches/options" },
  ],
  [
    "salesApi.getVariantSalesStats",
    () =>
      salesApi.getVariantSalesStats({
        ...dates,
        branch_id: 2,
        page: 1,
        limit: 20,
      }),
    {
      method: "GET",
      path: "/consumer/sales/variant-sales-stats",
      query: { ...dates, branch_id: "2", page: "1", limit: "20" },
    },
  ],
  [
    "salesApi.getVariantSalesDetail",
    () => salesApi.getVariantSalesDetail(4, { ...dates, page: 1, limit: 5 }),
    {
      method: "GET",
      path: "/consumer/sales/variant-sales-stats/4",
      query: { ...dates, page: "1", limit: "5" },
    },
  ],
  [
    "salesApi.getProductsForSale",
    () => salesApi.getProductsForSale(2, "tea"),
    {
      method: "GET",
      path: "/consumer/sales/products",
      query: { branch_id: "2", search: "tea" },
    },
  ],
  [
    "salesApi.getProductByBarcode",
    () => salesApi.getProductByBarcode(2, "123"),
    {
      method: "GET",
      path: "/consumer/sales/product-by-barcode",
      query: { branch_id: "2", barcode: "123" },
    },
  ],
  [
    "salesApi.generateReceipt",
    () => salesApi.generateReceipt(5),
    { method: "GET", path: "/consumer/sales/receipt/5" },
  ],
  [
    "salesApi.generateReceipt (chalan)",
    () => salesApi.generateReceipt(5, "chalan" as never),
    {
      method: "GET",
      path: "/consumer/sales/receipt/5",
      query: { type: "chalan" },
    },
  ],
  [
    "salesApi.generatePaymentReceipt",
    () => salesApi.generatePaymentReceipt(5, 7),
    { method: "GET", path: "/consumer/sales/receipt/5/payment/7" },
  ],
  [
    "salesApi.getSaleBySaleNumber",
    () => salesApi.getSaleBySaleNumber("SAL-1"),
    { method: "GET", path: "/consumer/sales/search/SAL-1" },
  ],
  [
    "salesApi.getDailyTargetReport",
    () =>
      salesApi.getDailyTargetReport({
        date: "2026-03-14",
        branch_id: 2,
        page: 1,
        limit: 10,
      }),
    {
      method: "GET",
      path: "/consumer/sales/reports/daily-target",
      query: { date: "2026-03-14", branch_id: "2", page: "1", limit: "10" },
    },
  ],
  [
    "salesApi.getDashboardAnalytics",
    () =>
      salesApi.getDashboardAnalytics({
        branch_id: 2,
        payment_period: "weekly",
      }),
    {
      method: "GET",
      path: "/consumer/dashboard/analytics",
      query: { branch_id: "2", payment_period: "weekly" },
    },
  ],
  [
    "salesApi.getEODReport",
    () =>
      salesApi.getEODReport({
        date: "2026-03-14",
        branch_id: 2,
        period: "month",
      }),
    {
      method: "GET",
      path: "/consumer/sales/reports/eod",
      query: { date: "2026-03-14", branch_id: "2", period: "month" },
    },
  ],
  [
    "salesApi.getBusinessReportPdf",
    () =>
      salesApi.getBusinessReportPdf({
        date: "2026-03-14",
        period: "day",
        branch_id: 2,
      }),
    {
      method: "GET",
      path: "/consumer/sales/reports/business/pdf",
      query: { date: "2026-03-14", period: "day", branch_id: "2" },
    },
  ],
  [
    "salesApi.getQuotations",
    () => salesApi.getQuotations({ page: 1 } as never),
    {
      method: "GET",
      path: "/consumer/sales/quotations/list",
      query: { page: "1" },
    },
  ],
  [
    "salesApi.getQuotation",
    () => salesApi.getQuotation(3),
    { method: "GET", path: "/consumer/sales/quotations/3" },
  ],
  [
    "salesApi.createQuotation",
    () => salesApi.createQuotation(body as never),
    {
      method: "POST",
      path: "/consumer/sales",
      body: { a: 1, sale_type: "quotation" },
    },
  ],
  [
    "salesApi.downloadQuotationPdf",
    () => salesApi.downloadQuotationPdf(3),
    { method: "GET", path: "/consumer/sales/quotations/3/pdf" },
  ],
  [
    "salesApi.getOnlineOrders",
    () => salesApi.getOnlineOrders({ branch_id: 2 }),
    {
      method: "GET",
      path: "/consumer/sales/online-orders/list",
      query: { branch_id: "2" },
    },
  ],
  [
    "salesApi.getOnlineOrderStats",
    () => salesApi.getOnlineOrderStats(2),
    {
      method: "GET",
      path: "/consumer/sales/online-orders/stats",
      query: { branch_id: "2" },
    },
  ],
  [
    "salesApi.updateOnlineOrderStatus",
    () => salesApi.updateOnlineOrderStatus(5, "CONFIRMED" as never, "Pathao"),
    {
      method: "PATCH",
      path: "/consumer/sales/online-orders/5/status",
      body: { status: "CONFIRMED", delivery_partner: "Pathao" },
    },
  ],
  [
    "salesApi.getPendingDeliveries",
    () => salesApi.getPendingDeliveries({ page: 1 }),
    {
      method: "GET",
      path: "/consumer/sales/pending-deliveries/list",
      query: { page: "1" },
    },
  ],
  [
    "salesApi.completePendingDelivery",
    () => salesApi.completePendingDelivery(5),
    {
      method: "PATCH",
      path: "/consumer/sales/pending-deliveries/5/complete",
      body: {},
    },
  ],
  [
    "salesApi.cancelPendingDelivery",
    () => salesApi.cancelPendingDelivery(5),
    {
      method: "PATCH",
      path: "/consumer/sales/pending-deliveries/5/cancel",
      body: {},
    },
  ],
  // ---- returns
  [
    "returnsApi.getReturns",
    () => returnsApi.getReturns({ page: 1 } as never),
    { method: "GET", path: "/consumer/returns", query: { page: "1" } },
  ],
  [
    "returnsApi.getReturn",
    () => returnsApi.getReturn(4),
    { method: "GET", path: "/consumer/returns/4" },
  ],
  [
    "returnsApi.createReturn",
    () => returnsApi.createReturn(body as never),
    { method: "POST", path: "/consumer/returns", body },
  ],
  [
    "returnsApi.getSaleForReturn",
    () => returnsApi.getSaleForReturn(4),
    { method: "GET", path: "/consumer/sales/4" },
  ],
  [
    "returnsApi.downloadReturnPdf",
    () => returnsApi.downloadReturnPdf(4),
    { method: "GET", path: "/consumer/returns/4/pdf" },
  ],
  // ---- payments
  [
    "paymentsApi.getPartiallyPaidSales",
    () => paymentsApi.getPartiallyPaidSales({ page: 1 } as never),
    {
      method: "GET",
      path: "/consumer/payments/partial-sales",
      query: { page: "1" },
    },
  ],
  [
    "paymentsApi.getSaleForPayment",
    () => paymentsApi.getSaleForPayment(4),
    { method: "GET", path: "/consumer/payments/sales/4" },
  ],
  [
    "paymentsApi.makePayment",
    () => paymentsApi.makePayment(body as never),
    { method: "POST", path: "/consumer/payments/make-payment", body },
  ],
  [
    "paymentsApi.getSalePayments",
    () => paymentsApi.getSalePayments(4),
    { method: "GET", path: "/consumer/payments/sales/4/payments" },
  ],
  // ---- purchase payments
  [
    "purchasePaymentsApi.getPurchaseBatches",
    () => purchasePaymentsApi.getPurchaseBatches({ page: 1 } as never),
    {
      method: "GET",
      path: "/consumer/purchase-payments/batches",
      query: { page: "1" },
    },
  ],
  [
    "purchasePaymentsApi.getBatchForPayment",
    () => purchasePaymentsApi.getBatchForPayment(4),
    { method: "GET", path: "/consumer/purchase-payments/batches/4" },
  ],
  [
    "purchasePaymentsApi.makePayment",
    () => purchasePaymentsApi.makePayment(body as never),
    { method: "POST", path: "/consumer/purchase-payments/make-payment", body },
  ],
  [
    "purchasePaymentsApi.getBatchPayments",
    () => purchasePaymentsApi.getBatchPayments(4),
    { method: "GET", path: "/consumer/purchase-payments/batches/4/payments" },
  ],
  // ---- promotions
  [
    "promotionApi.getPromotions",
    () => promotionApi.getPromotions(),
    { method: "GET", path: "/consumer/promotions" },
  ],
  [
    "promotionApi.getPromotion",
    () => promotionApi.getPromotion(4),
    { method: "GET", path: "/consumer/promotions/4" },
  ],
  [
    "promotionApi.createPromotion",
    () => promotionApi.createPromotion(body as never),
    { method: "POST", path: "/consumer/promotions", body },
  ],
  [
    "promotionApi.updatePromotion",
    () => promotionApi.updatePromotion(4, body as never),
    { method: "PATCH", path: "/consumer/promotions/4", body },
  ],
  [
    "promotionApi.deletePromotion",
    () => promotionApi.deletePromotion(4),
    { method: "DELETE", path: "/consumer/promotions/4" },
  ],
  [
    "promotionApi.getOptions",
    () => promotionApi.getOptions(),
    { method: "GET", path: "/consumer/promotions/options" },
  ],
  [
    "promotionApi.getActivePromotions",
    () => promotionApi.getActivePromotions(2),
    {
      method: "GET",
      path: "/consumer/promotions/active/list",
      query: { branch_id: "2" },
    },
  ],
  // ---- rewards
  [
    "rewardsApi.getSettings",
    () => rewardsApi.getSettings(),
    { method: "GET", path: "/consumer/rewards/settings" },
  ],
  [
    "rewardsApi.createSettings",
    () => rewardsApi.createSettings(body as never),
    { method: "POST", path: "/consumer/rewards/settings", body },
  ],
  [
    "rewardsApi.updateSettings",
    () => rewardsApi.updateSettings(body as never),
    { method: "PATCH", path: "/consumer/rewards/settings", body },
  ],
  [
    "rewardsApi.getCustomersWithPoints",
    () => rewardsApi.getCustomersWithPoints({ page: 1 } as never),
    {
      method: "GET",
      path: "/consumer/rewards/customers",
      query: { page: "1" },
    },
  ],
  [
    "rewardsApi.getCustomerPoints",
    () => rewardsApi.getCustomerPoints(4),
    { method: "GET", path: "/consumer/rewards/customers/4/points" },
  ],
  [
    "rewardsApi.redeemPoints",
    () => rewardsApi.redeemPoints(4, body as never),
    { method: "POST", path: "/consumer/rewards/customers/4/redeem", body },
  ],
  [
    "rewardsApi.adjustPoints",
    () => rewardsApi.adjustPoints(4, body as never),
    { method: "POST", path: "/consumer/rewards/customers/4/adjust", body },
  ],
  [
    "rewardsApi.canRedeemPoints",
    () => rewardsApi.canRedeemPoints(4, 100),
    { method: "GET", path: "/consumer/rewards/customers/4/can-redeem/100" },
  ],
  [
    "rewardsApi.getTransactions",
    () => rewardsApi.getTransactions({ page: 1 } as never),
    {
      method: "GET",
      path: "/consumer/rewards/transactions",
      query: { page: "1" },
    },
  ],
  [
    "rewardsApi.getCustomerTransactions",
    () => rewardsApi.getCustomerTransactions(4, { page: 1 } as never),
    {
      method: "GET",
      path: "/consumer/rewards/customers/4/transactions",
      query: { page: "1" },
    },
  ],
  [
    "rewardsApi.expirePoints",
    () => rewardsApi.expirePoints(),
    { method: "POST", path: "/consumer/rewards/expire-points", body: {} },
  ],
  [
    "rewardsApi.getRedemptionValue",
    () => rewardsApi.getRedemptionValue(100),
    { method: "GET", path: "/consumer/rewards/redemption-value/100" },
  ],
  // ---- operational costs, support, ai
  [
    "operationalCostsApi.list",
    () =>
      operationalCostsApi.list({
        from: "2026-03-01",
        to: "2026-03-31",
        branch_id: 2,
      }),
    {
      method: "GET",
      path: "/consumer/operational-costs",
      query: { from: "2026-03-01", to: "2026-03-31", branch_id: "2" },
    },
  ],
  [
    "operationalCostsApi.create",
    () => operationalCostsApi.create(body as never),
    { method: "POST", path: "/consumer/operational-costs", body },
  ],
  [
    "operationalCostsApi.update",
    () => operationalCostsApi.update(4, body as never),
    { method: "PATCH", path: "/consumer/operational-costs/4", body },
  ],
  [
    "operationalCostsApi.remove",
    () => operationalCostsApi.remove(4),
    { method: "DELETE", path: "/consumer/operational-costs/4" },
  ],
  [
    "supportApi.list",
    () => supportApi.list({ status: "OPEN", search: "x" }),
    {
      method: "GET",
      path: "/consumer/support/tickets",
      query: { status: "OPEN", search: "x" },
    },
  ],
  [
    "supportApi.detail",
    () => supportApi.detail(4),
    { method: "GET", path: "/consumer/support/tickets/4" },
  ],
  [
    "supportApi.create",
    () => supportApi.create(body as never),
    { method: "POST", path: "/consumer/support/tickets", body },
  ],
  [
    "supportApi.reply",
    () => supportApi.reply(4, "hi"),
    {
      method: "POST",
      path: "/consumer/support/tickets/4/messages",
      body: { body: "hi" },
    },
  ],
  [
    "supportApi.close",
    () => supportApi.close(4),
    { method: "PATCH", path: "/consumer/support/tickets/4/close", body: {} },
  ],
  [
    "supportApi.reopen",
    () => supportApi.reopen(4),
    { method: "PATCH", path: "/consumer/support/tickets/4/reopen", body: {} },
  ],
  [
    "aiApi.generateDescription",
    () => aiApi.generateDescription({ product: "Tea", force_refresh: false }),
    {
      method: "POST",
      path: "/ai/auto-description",
      body: { product: "Tea", force_refresh: false },
    },
  ],
  [
    "aiApi.submitFeedback",
    () => aiApi.submitFeedback(body as never),
    { method: "POST", path: "/ai/description-feedback", body },
  ],
  // ---- product audit, import
  [
    "productAuditApi.getAuditData",
    () =>
      productAuditApi.getAuditData({
        variant_id: 4,
        start_date: "2026-03-01",
        end_date: "2026-03-31",
        branch_id: 2,
      }),
    {
      method: "GET",
      path: "/consumer/inventory/audit",
      query: {
        variant_id: "4",
        start_date: "2026-03-01",
        end_date: "2026-03-31",
        branch_id: "2",
      },
    },
  ],
  [
    "exportApi.download",
    () => exportApi.download("customers", "pdf"),
    {
      method: "GET",
      path: "/consumer/export/customers",
      query: { format: "pdf" },
    },
  ],
  [
    "importApi.getStatus",
    () => importApi.getStatus(),
    { method: "GET", path: "/consumer/import/status" },
  ],
  [
    "importApi.getColumns",
    () => importApi.getColumns("products"),
    { method: "GET", path: "/consumer/import/products/columns" },
  ],
  [
    "importApi.downloadTemplate",
    () => importApi.downloadTemplate("inventory"),
    { method: "GET", path: "/consumer/import/inventory/template" },
  ],
  [
    "importApi.preview",
    () => importApi.preview("customers", FILE),
    {
      method: "POST",
      path: "/consumer/import/customers/preview",
      body: "multipart",
    },
  ],
  [
    "importApi.import",
    () => importApi.import("customers", FILE),
    { method: "POST", path: "/consumer/import/customers", body: "multipart" },
  ],
  // ---- products and master data
  [
    "productApi.getProducts",
    () =>
      productApi.getProducts({
        page: 1,
        categoryIds: [1, 2],
        brandIds: [3],
        tagIds: [4, 5],
      }),
    {
      method: "GET",
      path: "/consumer/products",
      query: { page: "1", categoryIds: "1,2", brandIds: "3", tagIds: "4,5" },
    },
  ],
  [
    "productApi.getProductLimit",
    () => productApi.getProductLimit(),
    { method: "GET", path: "/consumer/products/limit" },
  ],
  [
    "productApi.getProduct",
    () => productApi.getProduct(4),
    { method: "GET", path: "/consumer/products/4" },
  ],
  [
    "productApi.createProduct",
    () => productApi.createProduct(body as never),
    { method: "POST", path: "/consumer/products", body },
  ],
  [
    "productApi.updateProduct",
    () => productApi.updateProduct(4, body as never),
    { method: "PATCH", path: "/consumer/products/4", body },
  ],
  [
    "productApi.deleteProduct",
    () => productApi.deleteProduct(4),
    { method: "DELETE", path: "/consumer/products/4" },
  ],
  ...(["Category", "Brand", "Unit", "Tag"] as const).flatMap((kind): Case[] => {
    const plural = {
      Category: "categories",
      Brand: "brands",
      Unit: "units",
      Tag: "tags",
    }[kind];
    const api = productApi as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    return [
      [
        `productApi.get${plural[0].toUpperCase()}${plural.slice(1)}`,
        () => api[`get${kind === "Category" ? "Categories" : `${kind}s`}`](),
        { method: "GET", path: `/consumer/${plural}` },
      ],
      [
        `productApi.create${kind}`,
        () => api[`create${kind}`]("N"),
        { method: "POST", path: `/consumer/${plural}`, body: { name: "N" } },
      ],
      [
        `productApi.update${kind}`,
        () => api[`update${kind}`](4, "N"),
        { method: "PATCH", path: `/consumer/${plural}/4`, body: { name: "N" } },
      ],
      [
        `productApi.delete${kind}`,
        () => api[`delete${kind}`](4),
        { method: "DELETE", path: `/consumer/${plural}/4` },
      ],
    ];
  }),
  // ---- inventory
  [
    "inventoryApi.downloadTransferPdf",
    () => inventoryApi.downloadTransferPdf(6, "transfer_chalan"),
    {
      method: "GET",
      path: "/consumer/inventory/transfers/6/pdf",
      query: { type: "transfer_chalan" },
    },
  ],
  [
    "inventoryApi.getSummary",
    () => inventoryApi.getSummary(2),
    {
      method: "GET",
      path: "/consumer/inventory/summary",
      query: { branch_id: "2" },
    },
  ],
  [
    "inventoryApi.getProductsForInventory",
    () => inventoryApi.getProductsForInventory(),
    { method: "GET", path: "/consumer/inventory/products" },
  ],
  [
    "inventoryApi.getVariants",
    () => inventoryApi.getVariants(4),
    { method: "GET", path: "/consumer/inventory/products/4/variants" },
  ],
  [
    "inventoryApi.getBatches",
    () => inventoryApi.getBatches({ page: 1, branch_id: 2 }),
    {
      method: "GET",
      path: "/consumer/inventory/batches",
      query: { page: "1", branch_id: "2" },
    },
  ],
  [
    "inventoryApi.getBatch",
    () => inventoryApi.getBatch(4),
    { method: "GET", path: "/consumer/inventory/batches/4" },
  ],
  [
    "inventoryApi.createBatch",
    () => inventoryApi.createBatch(body as never),
    { method: "POST", path: "/consumer/inventory/batches", body },
  ],
  [
    "inventoryApi.updateBatch",
    () => inventoryApi.updateBatch(4, body as never),
    { method: "PATCH", path: "/consumer/inventory/batches/4", body },
  ],
  [
    "inventoryApi.getBranches",
    () => inventoryApi.getBranches(),
    { method: "GET", path: "/consumer/branches" },
  ],
  [
    "inventoryApi.getVendors",
    () => inventoryApi.getVendors(),
    { method: "GET", path: "/consumer/vendors" },
  ],
  [
    "inventoryApi.createVendor",
    () => inventoryApi.createVendor({ name: "V" }),
    { method: "POST", path: "/consumer/vendors", body: { name: "V" } },
  ],
  [
    "inventoryApi.updateVendor",
    () => inventoryApi.updateVendor(4, { name: "V" }),
    { method: "PATCH", path: "/consumer/vendors/4", body: { name: "V" } },
  ],
  [
    "inventoryApi.deleteVendor",
    () => inventoryApi.deleteVendor(4),
    { method: "DELETE", path: "/consumer/vendors/4" },
  ],
  [
    "inventoryApi.getTransfers",
    () => inventoryApi.getTransfers({ status: "pending" }),
    {
      method: "GET",
      path: "/consumer/inventory/transfers",
      query: { status: "pending" },
    },
  ],
  [
    "inventoryApi.getTransfer",
    () => inventoryApi.getTransfer(4),
    { method: "GET", path: "/consumer/inventory/transfers/4" },
  ],
  [
    "inventoryApi.createTransfer",
    () => inventoryApi.createTransfer(body as never),
    { method: "POST", path: "/consumer/inventory/transfers", body },
  ],
  [
    "inventoryApi.completeTransfer",
    () => inventoryApi.completeTransfer(4),
    {
      method: "PATCH",
      path: "/consumer/inventory/transfers/4/complete",
      body: {},
    },
  ],
  [
    "inventoryApi.cancelTransfer",
    () => inventoryApi.cancelTransfer(4),
    {
      method: "PATCH",
      path: "/consumer/inventory/transfers/4/cancel",
      body: {},
    },
  ],
  [
    "inventoryApi.getBranchBatches",
    () => inventoryApi.getBranchBatches(2),
    {
      method: "GET",
      path: "/consumer/inventory/batches",
      query: { branch_id: "2" },
    },
  ],
  [
    "inventoryApi.getAdjustments",
    () => inventoryApi.getAdjustments({ variant_id: 4 }),
    {
      method: "GET",
      path: "/consumer/inventory/adjustments",
      query: { variant_id: "4" },
    },
  ],
  [
    "inventoryApi.getAdjustment",
    () => inventoryApi.getAdjustment(4),
    { method: "GET", path: "/consumer/inventory/adjustments/4" },
  ],
  [
    "inventoryApi.createAdjustment",
    () => inventoryApi.createAdjustment(body as never),
    { method: "POST", path: "/consumer/inventory/adjustments", body },
  ],
  [
    "inventoryApi.getStockByVariant",
    () => inventoryApi.getStockByVariant({ low_stock_only: true }),
    {
      method: "GET",
      path: "/consumer/inventory/stock-by-variant",
      query: { low_stock_only: "true" },
    },
  ],
  [
    "inventoryApi.getExpiringBatches",
    () => inventoryApi.getExpiringBatches({ days: 30 }),
    {
      method: "GET",
      path: "/consumer/inventory/expiring",
      query: { days: "30" },
    },
  ],
  [
    "inventoryApi.getVariantStock",
    () => inventoryApi.getVariantStock(4, { branch_id: 2 }),
    {
      method: "GET",
      path: "/consumer/inventory/variants/4/stock",
      query: { branch_id: "2" },
    },
  ],
  [
    "inventoryApi.getLowStockItems",
    () => inventoryApi.getLowStockItems({ branch_id: 2 }),
    {
      method: "GET",
      path: "/consumer/inventory/low-stock",
      query: { branch_id: "2" },
    },
  ],
  [
    "inventoryApi.getInventoryMovementHistory",
    () => inventoryApi.getInventoryMovementHistory(4, { page: 1 }),
    {
      method: "GET",
      path: "/consumer/inventory/movement-history/4",
      query: { page: "1" },
    },
  ],
  // ---- receipt settings
  [
    "receiptSettingsApi.list",
    () => receiptSettingsApi.list({ type: "receipt" as never }),
    { method: "GET", path: "/receipt-settings", query: { type: "receipt" } },
  ],
  [
    "receiptSettingsApi.listByType",
    () => receiptSettingsApi.listByType("receipt" as never),
    { method: "GET", path: "/receipt-settings/by-type/receipt" },
  ],
  [
    "receiptSettingsApi.getDefaults",
    () => receiptSettingsApi.getDefaults("receipt" as never),
    { method: "GET", path: "/receipt-settings/defaults/receipt" },
  ],
  [
    "receiptSettingsApi.getById",
    () => receiptSettingsApi.getById(4),
    { method: "GET", path: "/receipt-settings/4" },
  ],
  [
    "receiptSettingsApi.create",
    () =>
      receiptSettingsApi.create({
        name: "N",
        type: "receipt" as never,
        branchId: 2,
        settings: {} as never,
        isActive: true,
      }),
    {
      method: "POST",
      path: "/receipt-settings",
      body: {
        name: "N",
        type: "receipt",
        branchId: 2,
        settings: {},
        isActive: true,
      },
    },
  ],
  [
    "receiptSettingsApi.update",
    () => receiptSettingsApi.update(4, body as never),
    { method: "PATCH", path: "/receipt-settings/4", body },
  ],
  [
    "receiptSettingsApi.activate",
    () => receiptSettingsApi.activate(4),
    { method: "PATCH", path: "/receipt-settings/4/activate", body: {} },
  ],
  [
    "receiptSettingsApi.deactivate",
    () => receiptSettingsApi.deactivate(4),
    { method: "PATCH", path: "/receipt-settings/4/deactivate", body: {} },
  ],
  [
    "receiptSettingsApi.remove",
    () => receiptSettingsApi.remove(4),
    { method: "DELETE", path: "/receipt-settings/4" },
  ],
  [
    "receiptSettingsApi.copyToBranch",
    () => receiptSettingsApi.copyToBranch(4, 2),
    { method: "POST", path: "/receipt-settings/4/copy-to-branch/2", body: {} },
  ],
  [
    "receiptSettingsApi.generatePreview",
    () =>
      receiptSettingsApi.generatePreview({
        settings: {} as never,
        type: "receipt" as never,
      }),
    {
      method: "POST",
      path: "/receipt-settings/preview",
      body: { settings: {}, type: "receipt" },
    },
  ],
];

const MODULES: Record<string, object> = {
  salesApi,
  returnsApi,
  paymentsApi,
  purchasePaymentsApi,
  promotionApi,
  rewardsApi,
  operationalCostsApi,
  supportApi,
  aiApi,
  importApi,
  exportApi,
  productApi,
  inventoryApi,
  receiptSettingsApi,
  productAuditApi,
};

describe("API modules against the backend route manifest", () => {
  it.each(CASES.map((c) => [c[0], c] as const))(
    "[CO-APIM] %s sends the request the backend serves",
    async (_id, [, call, expected]) => {
      await call();
      expect(captured).toHaveLength(1);
      const { method, path, query, body: sent } = captured[0];
      expect({ method, path }).toEqual({
        method: expected.method,
        path: expected.path,
      });
      if (expected.query) expect(query).toEqual(expected.query);
      if ("body" in expected) expect(sent).toEqual(expected.body);
      // The route must exist on the backend with that very method (contracts/routes.json)
      const route = routes.find(
        (r) => r.method === method && toRegex(r.path).test(`/api/v1${path}`),
      );
      expect({ request: `${method} ${path}`, served: !!route }).toEqual({
        request: `${method} ${path}`,
        served: true,
      });
      called.add(`${route!.method} ${route!.path}`);
    },
  );

  it("[CO-APIM-COVER] every exported API function has a case above, and every case names a real function", () => {
    const cases = new Set(CASES.map((c) => c[0].replace(/ \(.*\)$/, "")));
    const exported = Object.entries(MODULES).flatMap(([name, api]) =>
      Object.keys(api).map((fn) => `${name}.${fn}`),
    );
    const exempt = new Set(["productAuditApi.downloadAuditPdf"]); // builds a download link in the DOM; covered by the page tests (C4)
    expect(exported.filter((fn) => !cases.has(fn) && !exempt.has(fn))).toEqual(
      [],
    );
    expect([...cases].filter((fn) => !exported.includes(fn))).toEqual([]);
  });

  it("[CO-APIM-PRODUCT] a missing barcode is a null, other failures are thrown", async () => {
    server.use(
      http.get(`${API}${endpoints.getProductByBarcode}`, () =>
        HttpResponse.json({ message: "no" }, { status: 404 }),
      ),
    );
    expect(await salesApi.getProductByBarcode(1, "x")).toBeNull();
    server.use(
      http.get(`${API}${endpoints.getProductByBarcode}`, () =>
        HttpResponse.json({ message: "no" }, { status: 500 }),
      ),
    );
    await expect(salesApi.getProductByBarcode(1, "x")).rejects.toBeDefined();
  });

  it("[CO-APIM-PDF] the business report PDF returns the blob and the server's file name", async () => {
    const result = await salesApi.getBusinessReportPdf({
      date: "2026-03-14",
      period: "day",
    });
    expect(result.fileName).toBe("report.pdf");
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it("[X-ENDP-004] every tenant route is reached by the app, or listed (contracts/unused-routes.json) with the reason nobody calls it", () => {
    // Routes the pages call through the generic helpers with an endpoint constant count as reached too
    const reachedByPages = (route: Route) =>
      Object.values(endpoints).some((value) => {
        const sample =
          typeof value === "function"
            ? (value as (...a: unknown[]) => string)(1, 1)
            : value;
        return toRegex(route.path).test(
          `/api/v1${String(sample).split("?")[0]}`,
        );
      });
    let allowed: Record<string, string> = {};
    try {
      allowed = JSON.parse(
        readFileSync(
          resolve(__dirname, "../../../../contracts/unused-routes.json"),
          "utf8",
        ),
      );
    } catch {
      /* none yet */
    }
    const tenant = routes.filter((r) => r.guards.includes("ClientAuthGuard"));
    const unreached = tenant
      .map((r) => `${r.method} ${r.path}`)
      .filter((key) => {
        const route = tenant.find((r) => `${r.method} ${r.path}` === key)!;
        return !called.has(key) && !reachedByPages(route) && !(key in allowed);
      });
    expect(unreached).toEqual([]);
    const stale = Object.keys(allowed).filter(
      (key) =>
        called.has(key) || !tenant.some((r) => `${r.method} ${r.path}` === key),
    );
    expect(stale).toEqual([]);
  });
});
