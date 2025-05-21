import { post } from "./crud-api";
import { endpoints } from "./endpoints";

export interface GenerateDescriptionRequest {
  product: string;
  force_refresh?: boolean;
}

export interface GenerateDescriptionResponse {
  description: string;
  id?: string;
}

export interface SubmitFeedbackRequest {
  product: string;
  description: string;
  rating: number;
  comment?: string;
  user_edited_description: string;
}

export const aiApi = {
  generateDescription: async (data: GenerateDescriptionRequest) => {
    return await post(endpoints.generateDescription, data);
  },

  submitFeedback: async (feedbackData: SubmitFeedbackRequest) => {
    return await post(endpoints.submitFeedback, feedbackData);
  },
};
