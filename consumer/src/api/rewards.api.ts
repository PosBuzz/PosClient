import {
  AdjustPointsDto,
  CanRedeemResponse,
  CreateRewardsSettingsDto,
  CustomerRewardsPoints,
  RedeemPointsDto,
  RedemptionValueResponse,
  RewardsFilters,
  RewardsListResponse,
  RewardsPointTransaction,
  RewardsSettings,
} from "../types/rewards.types";
import { get, patch, post } from "./crud-api";
import { endpoints } from "./endpoints";

export const rewardsApi = {
  // Settings
  getSettings: async (): Promise<RewardsSettings> => {
    return get(endpoints.getRewardsSettings);
  },

  createSettings: async (
    data: CreateRewardsSettingsDto
  ): Promise<RewardsSettings> => {
    return post(endpoints.createRewardsSettings, data);
  },

  updateSettings: async (
    data: CreateRewardsSettingsDto
  ): Promise<RewardsSettings> => {
    return patch(endpoints.updateRewardsSettings, data);
  },

  // Customer Points
  getCustomersWithPoints: async (
    filters?: RewardsFilters
  ): Promise<RewardsListResponse<CustomerRewardsPoints>> => {
    return get(endpoints.getCustomersWithPoints, { params: filters });
  },

  getCustomerPoints: async (
    customerId: number
  ): Promise<CustomerRewardsPoints> => {
    return get(endpoints.getCustomerPoints(customerId));
  },

  redeemPoints: async (
    customerId: number,
    data: RedeemPointsDto
  ): Promise<RewardsPointTransaction> => {
    return post(endpoints.redeemCustomerPoints(customerId), data);
  },

  adjustPoints: async (
    customerId: number,
    data: AdjustPointsDto
  ): Promise<RewardsPointTransaction> => {
    return post(endpoints.adjustCustomerPoints(customerId), data);
  },

  canRedeemPoints: async (
    customerId: number,
    points: number
  ): Promise<CanRedeemResponse> => {
    return get(endpoints.canRedeemPoints(customerId, points));
  },

  // Transactions
  getTransactions: async (
    filters?: RewardsFilters
  ): Promise<RewardsListResponse<RewardsPointTransaction>> => {
    return get(endpoints.getRewardsTransactions, { params: filters });
  },

  getCustomerTransactions: async (
    customerId: number,
    filters?: RewardsFilters
  ): Promise<RewardsListResponse<RewardsPointTransaction>> => {
    return get(endpoints.getCustomerTransactions(customerId), {
      params: filters,
    });
  },

  // Utilities
  expirePoints: async (): Promise<{ expired: number }> => {
    return post(endpoints.expirePoints, {});
  },

  getRedemptionValue: async (
    points: number
  ): Promise<RedemptionValueResponse> => {
    return get(endpoints.getRedemptionValue(points));
  },
};
