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

export function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '操作失败，请稍后重试。';
}

function normalizeServerMessage(message: string, status?: number) {
  const normalized = message.trim();

  if (!normalized) {
    return status ? `请求失败，服务器返回 ${status}。` : '请求失败，请稍后重试。';
  }

  const authMessageMap: Record<string, string> = {
    'Invalid username or password': '账号或密码错误，请检查账号和密码后重试。',
    'MFA code is required': '需要输入动态验证码或恢复码。',
    'MFA code is invalid': '动态验证码或恢复码错误，请重新输入。',
    'IP address is not allowed': '当前 IP 不在白名单内，无法登录。'
  };

  return authMessageMap[normalized] ?? normalized;
}

function getAxiosErrorMessage(error: AxiosError<ApiResponse<unknown>>) {
  const response = error.response?.data;
  const status = error.response?.status;

  if (response?.message) {
    return normalizeServerMessage(response.message, status);
  }

  if (status === 401) {
    return '账号或密码错误，请检查账号和密码后重试。';
  }

  if (status === 403) {
    return '没有权限访问该功能，请联系管理员检查角色权限。';
  }

  if (status === 404) {
    return '请求的接口不存在，请确认后端服务和前端版本是否匹配。';
  }

  if (status && status >= 500) {
    return `服务器内部错误（${status}），请稍后重试或联系管理员。`;
  }

  if (error.code === 'ECONNABORTED') {
    return '请求超时，后端服务响应太慢，请稍后重试。';
  }

  if (error.message === 'Network Error' || !error.response) {
    return '无法连接后端 API，请检查服务器是否已启动、域名是否正确或网络是否可用。';
  }

  return normalizeServerMessage(error.message, status);
}

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
      throw new Error(getAxiosErrorMessage(error as AxiosError<ApiResponse<unknown>>), {
        cause: error
      });
    }

    throw error;
  }
}
