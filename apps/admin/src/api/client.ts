import type { ApiResponse } from '@apple-business/shared';
import axios, { AxiosError } from 'axios';

export const TOKEN_STORAGE_KEY = 'apple_business_access_token';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function request<TData>(promise: Promise<{ data: ApiResponse<TData> }>) {
  try {
    const response = await promise;
    const body = response.data;

    if (!body.success) {
      throw new Error(body.message);
    }

    return body.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const response = error.response?.data as ApiResponse<unknown> | undefined;
      throw new Error(response?.message ?? error.message, {
        cause: error
      });
    }

    throw error;
  }
}
