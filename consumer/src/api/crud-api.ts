import axiosInstance from "./axiosInstance";
import { AxiosRequestConfig } from "axios";

export const get = async (endpoint: string, params?: any, config?: AxiosRequestConfig) => {
  try {
    const requestConfig: AxiosRequestConfig = {
      ...config,
      params: params
    };
    
    const response = await axiosInstance.get(endpoint, requestConfig);
    return response.data;
  } catch (error) {
    console.error("GET request failed:", endpoint, error);
    return Promise.reject(error);
  }
};

export const post = async (endpoint: string, data: any) => {
  try {
    const response = await axiosInstance.post(endpoint, data);
    const code = response.status;
    const resp_data = response.data;
    if (code === 409) {
      return Promise.reject(resp_data);
    }
    return resp_data;
  } catch (e) {
    return Promise.reject(e);
  }
};

export const patch = async (endpoint: string, data: any) => {
  const response = await axiosInstance.patch(endpoint, data);
  return response.data;
};

export const deleteApi = async (endpoint: string, data?: any) => {
  const response = await axiosInstance.delete(endpoint, data ? { data } : undefined);
  return response.data;
};
