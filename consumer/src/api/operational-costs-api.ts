import { deleteApi, get, patch, post } from "./crud-api";
import { endpoints } from "./endpoints";

export interface OperationalCost {
  id: number;
  name: string;
  amount: number;
  incurred_on: string;
  branch_id?: number;
  notes?: string;
  branch?: { id: number; name: string };
  creator?: { id: number; name: string };
}

export interface OperationalCostInput {
  name: string;
  amount: number;
  incurred_on: string;
  branch_id?: number;
  notes?: string;
}

export const operationalCostsApi = {
  list: (params: { from: string; to: string; branch_id?: number }) =>
    get(endpoints.operationalCosts, params) as Promise<OperationalCost[]>,
  create: (data: OperationalCostInput) =>
    post(endpoints.operationalCosts, data),
  update: (id: number, data: OperationalCostInput) =>
    patch(endpoints.operationalCost(id), data),
  remove: (id: number) => deleteApi(endpoints.operationalCost(id)),
};
