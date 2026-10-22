import type {
  DeliveryPartnerListItem,
  LedgerEntryType,
  PartnerOrder,
} from "../types/delivery-partner.types";

/** Payment method the backend records when a partner collected the customer's cash. */
export const PARTNER_PAYMENT_METHOD = "DELIVERY_PARTNER";
export const PARTNER_PAYMENT_LABEL = "Delivery Partner (COD)";

const cents = (value: unknown) => Math.round(Number(value || 0) * 100);

/** Who owes whom, in words. Balance > 0: the partner owes the shop. */
export function balanceLabel(balance: number): {
  text: string;
  tone: "success" | "danger" | "secondary";
} {
  const c = cents(balance);
  if (c > 0) return { text: "Partner owes you", tone: "success" };
  if (c < 0) return { text: "You owe partner", tone: "danger" };
  return { text: "All settled", tone: "secondary" };
}

export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  COD_COLLECTED: "Cash collected",
  DELIVERY_CHARGE: "Delivery charge",
  COD_FEE: "COD fee",
  RETURN_CHARGE: "Return charge",
  PAYOUT_RECEIVED: "Payout received",
  PAYMENT_MADE: "Paid to partner",
  ADJUSTMENT: "Adjustment",
  PAYOUT_VOIDED: "Payout voided",
};

/** Sum of the chosen orders' net, which is what a payout covering them should be. */
export function expectedPayout(orders: Pick<PartnerOrder, "net">[]): number {
  return orders.reduce((sum, order) => sum + cents(order.net), 0) / 100;
}

/** What the partner should collect: what the customer still owes, not counting earlier partner cash. */
export function owedByCustomer(sale: {
  total_amount?: number | string;
  payments?: { amount: number | string; payment_method: string }[];
}): number {
  const paid = (sale.payments || [])
    .filter((p) => p.payment_method !== PARTNER_PAYMENT_METHOD)
    .reduce((sum, p) => sum + cents(p.amount), 0);
  return Math.max(0, cents(sale.total_amount) - paid) / 100;
}

/** The COD fee for an amount at a percentage, rounded to the paisa. */
export function codFee(amount: number, percent: number): number {
  return Math.round((cents(amount) * Number(percent || 0)) / 100) / 100;
}

/** Net effect of one delivered order on the balance. */
export function deliveredNet(values: {
  cod_amount?: number;
  delivery_charge?: number;
  cod_fee?: number;
}): number {
  return (
    (cents(values.cod_amount) -
      cents(values.delivery_charge) -
      cents(values.cod_fee)) /
    100
  );
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote everything; a leading = + - @ would run as a formula in a spreadsheet
  const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of the partner list with balances, for a spreadsheet. */
export function partnersCsv(partners: DeliveryPartnerListItem[]): string {
  const header = [
    "Partner",
    "Phone",
    "Active",
    "Balance (BDT)",
    "Who owes",
    "Unsettled orders",
    "Unsettled amount (BDT)",
  ];
  const rows = partners.map((p) => [
    p.name,
    p.phone ?? "",
    p.is_active ? "Yes" : "No",
    Number(p.balance).toFixed(2),
    balanceLabel(p.balance).text,
    p.unsettled_orders,
    Number(p.unsettled_net).toFixed(2),
  ]);
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
