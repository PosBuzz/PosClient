/** A courier the shop hands online orders to. Money is in BDT. */
export interface DeliveryPartner {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  notes: string | null;
  default_delivery_charge: number;
  default_cod_fee_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** List row: > 0 balance means the partner owes the shop, < 0 the shop owes the partner. */
export interface DeliveryPartnerListItem extends DeliveryPartner {
  balance: number;
  unsettled_orders: number;
  unsettled_net: number;
}

export interface DeliveryPartnerInput {
  name: string;
  contact?: string;
  phone?: string;
  notes?: string;
  default_delivery_charge?: number;
  default_cod_fee_percent?: number;
  is_active?: boolean;
}

export interface DeliveryPartnerSummary {
  partner: DeliveryPartner;
  balance: number;
  totals: {
    cod_collected: number;
    delivery_charges: number;
    cod_fees: number;
    return_charges: number;
    payouts_received: number;
    payments_made: number;
    adjustments: number;
    voided: number;
  };
  unsettled: { orders: number; net: number };
  last_settlement: {
    id: number;
    direction: SettlementDirection;
    amount: number;
    settlement_date: string;
  } | null;
}

export type LedgerEntryType =
  | "COD_COLLECTED"
  | "DELIVERY_CHARGE"
  | "COD_FEE"
  | "RETURN_CHARGE"
  | "PAYOUT_RECEIVED"
  | "PAYMENT_MADE"
  | "ADJUSTMENT"
  | "PAYOUT_VOIDED";

export interface LedgerEntry {
  id: number;
  type: LedgerEntryType;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  sale: { id: number; sale_number: string } | null;
  settlement: {
    id: number;
    direction: SettlementDirection;
    voided_at: string | null;
  } | null;
}

export interface PartnerOrder {
  id: number;
  sale_number: string;
  sale_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  payment_status: string;
  online_order_status: string | null;
  cod_amount: number;
  delivery_charge: number;
  cod_fee: number;
  partner_settlement_id: number | null;
  branch: { id: number; name: string };
  /** What this order adds to the balance: > 0 the partner owes the shop */
  net: number;
}

export type SettlementDirection = "RECEIVED" | "PAID";

export interface Settlement {
  id: number;
  direction: SettlementDirection;
  amount: number;
  payment_method: string;
  reference: string | null;
  note: string | null;
  settlement_date: string;
  voided_at: string | null;
  void_reason: string | null;
  orders: number;
}

export interface SettlementInput {
  direction: SettlementDirection;
  amount: number;
  payment_method: string;
  reference?: string;
  note?: string;
  settlement_date?: string;
  sale_ids?: number[];
  adjust_difference?: boolean;
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}
