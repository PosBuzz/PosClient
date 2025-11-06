export interface RewardsSettings {
  id?: number;
  consumer_id: number;
  is_enabled: boolean;
  points_per_currency: number;
  minimum_purchase_amount: number;
  maximum_points_per_sale?: number;
  redemption_value: number;
  minimum_redemption: number;
  maximum_redemption?: number;
  points_expire_days?: number;
  allow_partial_redemption: boolean;
  earn_on_sale_only: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRewardsSettingsDto {
  is_enabled?: boolean;
  points_per_currency: number;
  minimum_purchase_amount: number;
  maximum_points_per_sale?: number;
  redemption_value: number;
  minimum_redemption: number;
  maximum_redemption?: number;
  points_expire_days?: number;
  allow_partial_redemption?: boolean;
  earn_on_sale_only?: boolean;
}

export interface CustomerRewardsPoints {
  id: number;
  customer_id: number;
  consumer_id: number;
  total_points: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  last_earned_at?: string;
  last_redeemed_at?: string;
  created_at: string;
  updated_at: string;
  customer: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
}

export enum RewardsTransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  EXPIRE = 'EXPIRE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export interface RewardsPointTransaction {
  id: number;
  customer_id: number;
  consumer_id: number;
  type: RewardsTransactionType;
  points: number;
  balance_before: number;
  balance_after: number;
  sale_id?: number;
  description?: string;
  reference?: string;
  expiry_date?: string;
  created_by_user_id?: number;
  notes?: string;
  created_at: string;
  customer: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
  sale?: {
    id: number;
    sale_number: string;
    total_amount: number;
  };
  created_by?: {
    id: number;
    name: string;
  };
}

export interface RedeemPointsDto {
  points: number;
  reference?: string;
  notes?: string;
}

export interface AdjustPointsDto {
  points: number;
  description: string;
  notes?: string;
}

export interface RewardsFilters {
  page?: number;
  limit?: number;
  customer_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  type?: RewardsTransactionType;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface RewardsListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface CanRedeemResponse {
  canRedeem: boolean;
  reason?: string;
}

export interface RedemptionValueResponse {
  points: number;
  value: number;
  redemption_rate: number;
}
