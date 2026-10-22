import { deleteApi, get, patch, post } from "./crud-api";
import { endpoints } from "./endpoints";
import type {
  DeliveryPartner,
  DeliveryPartnerInput,
  DeliveryPartnerListItem,
  DeliveryPartnerSummary,
  LedgerEntry,
  Paged,
  PartnerOrder,
  Settlement,
  SettlementInput,
} from "../types/delivery-partner.types";

const base = endpoints.deliveryPartners;

export const deliveryPartnersApi = {
  list: (): Promise<DeliveryPartnerListItem[]> => get(base),
  get: (id: number): Promise<DeliveryPartner> => get(`${base}/${id}`),
  create: (data: DeliveryPartnerInput): Promise<DeliveryPartner> =>
    post(base, data),
  update: (
    id: number,
    data: Partial<DeliveryPartnerInput>,
  ): Promise<DeliveryPartner> => patch(`${base}/${id}`, data),
  remove: (id: number): Promise<{ success: boolean }> =>
    deleteApi(`${base}/${id}`),
  summary: (id: number): Promise<DeliveryPartnerSummary> =>
    get(`${base}/${id}/summary`),
  ledger: (
    id: number,
    params: { page?: number; limit?: number } = {},
  ): Promise<Paged<LedgerEntry>> => get(`${base}/${id}/ledger`, params),
  orders: (
    id: number,
    params: {
      page?: number;
      limit?: number;
      settlement?: "unsettled" | "settled" | "all";
    } = {},
  ): Promise<Paged<PartnerOrder>> => get(`${base}/${id}/orders`, params),
  settlements: (
    id: number,
    params: { page?: number; limit?: number } = {},
  ): Promise<Paged<Settlement>> => get(`${base}/${id}/settlements`, params),
  createSettlement: (id: number, data: SettlementInput): Promise<Settlement> =>
    post(`${base}/${id}/settlements`, data),
  voidSettlement: (
    id: number,
    settlementId: number,
    reason: string,
  ): Promise<{ success: boolean }> =>
    post(`${base}/${id}/settlements/${settlementId}/void`, { reason }),
  createAdjustment: (
    id: number,
    data: { amount: number; note: string },
  ): Promise<LedgerEntry> => post(`${base}/${id}/adjustments`, data),
};
