import axiosInstance from "./axiosInstance";

export const get = async (endpoint: string) => {
  const response = await axiosInstance.get(endpoint);
  return response.data;
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
  return await axiosInstance.patch(endpoint, data);
};

export const deleteApi = async (endpoint: string) => {
  return await axiosInstance.delete(endpoint);
};
