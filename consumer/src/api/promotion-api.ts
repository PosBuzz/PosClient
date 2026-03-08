import { deleteApi, get, patch, post } from './crud-api';
import { endpoints } from './endpoints';
import {
  Promotion,
  PromotionValidationResponse,
  PromotionOptionsResponse,
  PromotionPayload,
  ValidatePromotionPayload,
} from '../types/promotion.types';

export const promotionApi = {
  getPromotions: async (): Promise<Promotion[]> => {
    return await get(endpoints.getPromotions);
  },

  getPromotion: async (id: number): Promise<Promotion> => {
    return await get(endpoints.getPromotion(id));
  },

  createPromotion: async (payload: PromotionPayload): Promise<Promotion> => {
    return await post(endpoints.createPromotion, payload);
  },

  updatePromotion: async (
    id: number,
    payload: Partial<PromotionPayload>,
  ): Promise<Promotion> => {
    return await patch(endpoints.updatePromotion(id), payload);
  },

  deletePromotion: async (id: number) => {
    return await deleteApi(endpoints.deletePromotion(id));
  },

  getOptions: async (): Promise<PromotionOptionsResponse> => {
    return await get(endpoints.promotionOptions);
  },

  getActivePromotions: async (branchId?: number): Promise<Promotion[]> => {
    const params = branchId ? { branch_id: branchId } : undefined;
    return await get(endpoints.activePromotions, params);
  },

  validatePromotionCart: async (
    promotionId: number,
    payload: ValidatePromotionPayload,
  ): Promise<PromotionValidationResponse> => {
    return await post(endpoints.validatePromotionCart(promotionId), payload);
  },
};
