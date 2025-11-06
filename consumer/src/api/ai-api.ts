import { post } from "./crud-api";
import { endpoints } from "./endpoints";

export const aiApi = {
  generateDescription: async (data: {
    product: string;
    force_refresh: boolean;
  }): Promise<{ description: string }> => {
    return post(endpoints.generateDescription, data);
  },

  submitFeedback: async (data: {
    product: string;
    description: string;
    rating: number;
    comment: string;
    user_edited_description: string;
  }): Promise<void> => {
    return post(endpoints.submitFeedback, data);
  },
};
