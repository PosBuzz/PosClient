import dayjs from "dayjs";
import type { Return } from "../types/return.types";

const AGENT_PRINT_URL = "http://localhost:8080/print";

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  BANK_TRANSFER: "Transfer",
  MOBILE_MONEY: "Mobile",
  MFS: "MFS",
  CREDIT: "Credit",
  EXCHANGE: "Exchange",
  DELIVERY_PARTNER: "Courier COD",
};

const num = (value: unknown) => Number(value) || 0;

/**
 * Builds the payload for the local printing agent's /print endpoint.
 * The return is sent in the receipt shape with isReturn set, so the agent
 * prints a "RETURN RECEIPT" title and a REFUND total instead of TOTAL/Paid/Change.
 */
export function buildReturnThermalReceipt(ret: Return, saleNumber?: string) {
  const originalSale = saleNumber || ret.original_sale?.sale_number || "";
  const refund = num(ret.total_refund);
  const exchange = num(ret.total_exchange);

  const lineName = (item: {
    product_name?: string;
    variant_name?: string;
    variant?: { name?: string; product?: { name: string } };
  }) =>
    `${item.product_name || item.variant?.product?.name || "Product"} - ${
      item.variant_name || item.variant?.name || ""
    }`.trim();

  const returned = (ret.items || []).map((item) => {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unit_price);
    const lineTotal =
      num(item.refund_amount) || num(item.line_total) || unitPrice * quantity;
    return {
      name: lineName(item),
      quantity,
      unitPrice,
      price: unitPrice,
      grossLineTotal: lineTotal,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal,
      total: lineTotal,
    };
  });

  const exchanged = (ret.exchanges || []).map((item) => {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unit_price);
    const lineTotal = num(item.line_total) || unitPrice * quantity;
    return {
      name: `Exchange: ${lineName(item)}`,
      quantity,
      unitPrice,
      price: unitPrice,
      grossLineTotal: lineTotal,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal,
      total: lineTotal,
    };
  });

  const noteParts = [
    originalSale ? `Original sale: ${originalSale}` : "",
    ret.reason ? `Reason: ${ret.reason}` : "",
    ret.notes || "",
  ].filter(Boolean);

  const returnDate = ret.return_date;
  const netRefund = Math.max(0, refund - exchange);

  return {
    isReturn: true,
    documentType: "RETURN",
    orderId: ret.return_number,
    receiptNumber: ret.return_number,
    saleNumber: ret.return_number,
    sale_number: ret.return_number,
    barcodeValue: ret.return_number,
    date: dayjs(returnDate).format("YYYY-MM-DD"),
    time: dayjs(returnDate).format("HH:mm:ss"),
    sale_date: returnDate,
    cashier: ret.user?.name || ret.user_name || "Staff",
    customer: ret.original_sale?.customer_name || "Walk-in Customer",
    customerName: ret.original_sale?.customer_name || "Walk-in Customer",
    branch: ret.branch
      ? { name: ret.branch.name }
      : ret.branch_name
        ? { name: ret.branch_name }
        : undefined,
    user: ret.user
      ? { name: ret.user.name, id: String(ret.user.id) }
      : undefined,
    items: [...returned, ...exchanged],
    subtotal: refund,
    discount: 0,
    discountAmount: 0,
    shipping: 0,
    shippingCost: 0,
    tax: 0,
    taxAmount: 0,
    total: netRefund,
    totalAmount: netRefund,
    amountPaid: netRefund,
    receivedAmount: netRefund,
    change: 0,
    changeAmount: 0,
    due: 0,
    dueAmount: 0,
    paymentMethod:
      (ret.payments || [])
        .map((p) => PAYMENT_LABELS[p.payment_method] || p.payment_method)
        .join(", ") || "Cash",
    payments: (ret.payments || []).map((p) => ({
      payment_method: PAYMENT_LABELS[p.payment_method] || p.payment_method,
      amount: num(p.amount),
    })),
    paymentStatus: "REFUNDED",
    notes: noteParts.join("\n"),
    openCashDrawer: false,
  };
}

export async function printReturnThermalReceipt(
  ret: Return,
  saleNumber?: string,
): Promise<void> {
  const response = await fetch(AGENT_PRINT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildReturnThermalReceipt(ret, saleNumber)),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
