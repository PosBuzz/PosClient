import axiosInstance from "./axiosInstance";
import { endpoints } from "./endpoints";
import {
  RewardsSettings,
  CreateRewardsSettingsDto,
  CustomerRewardsPoints,
  RewardsPointTransaction,
  RedeemPointsDto,
  AdjustPointsDto,
  RewardsFilters,
  RewardsListResponse,
  CanRedeemResponse,
  RedemptionValueResponse,
} from "../types/rewards.types";

export const rewardsApi = {
  // Settings
  getSettings: async (): Promise<RewardsSettings> => {
    const response = await axiosInstance.get(endpoints.getRewardsSettings);
    return response.data;
  },

  createSettings: async (data: CreateRewardsSettingsDto): Promise<RewardsSettings> => {
    const response = await axiosInstance.post(endpoints.createRewardsSettings, data);
    return response.data;
  },

  updateSettings: async (data: CreateRewardsSettingsDto): Promise<RewardsSettings> => {
    const response = await axiosInstance.put(endpoints.updateRewardsSettings, data);
    return response.data;
  },

  // Customer Points
  getCustomersWithPoints: async (filters?: RewardsFilters): Promise<RewardsListResponse<CustomerRewardsPoints>> => {
    const response = await axiosInstance.get(endpoints.getCustomersWithPoints, { params: filters });
    return response.data;
  },

  getCustomerPoints: async (customerId: number): Promise<CustomerRewardsPoints> => {
    const response = await axiosInstance.get(endpoints.getCustomerPoints(customerId));
    return response.data;
  },

  redeemPoints: async (customerId: number, data: RedeemPointsDto): Promise<RewardsPointTransaction> => {
    const response = await axiosInstance.post(endpoints.redeemCustomerPoints(customerId), data);
    return response.data;
  },

  adjustPoints: async (customerId: number, data: AdjustPointsDto): Promise<RewardsPointTransaction> => {
    const response = await axiosInstance.post(endpoints.adjustCustomerPoints(customerId), data);
    return response.data;
  },

  canRedeemPoints: async (customerId: number, points: number): Promise<CanRedeemResponse> => {
    const response = await axiosInstance.get(endpoints.canRedeemPoints(customerId, points));
    return response.data;
  },

  // Transactions
  getTransactions: async (filters?: RewardsFilters): Promise<RewardsListResponse<RewardsPointTransaction>> => {
    const response = await axiosInstance.get(endpoints.getRewardsTransactions, { params: filters });
    return response.data;
  },

  getCustomerTransactions: async (customerId: number, filters?: RewardsFilters): Promise<RewardsListResponse<RewardsPointTransaction>> => {
    const response = await axiosInstance.get(endpoints.getCustomerTransactions(customerId), { params: filters });
    return response.data;
  },

  // Utilities
  expirePoints: async (): Promise<{ expired: number }> => {
    const response = await axiosInstance.post(endpoints.expirePoints);
    return response.data;
  },

  getRedemptionValue: async (points: number): Promise<RedemptionValueResponse> => {
    const response = await axiosInstance.get(endpoints.getRedemptionValue(points));
    return response.data;
  },
};
