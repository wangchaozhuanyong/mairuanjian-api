import { getApiErrorMessage } from '@/api/client';

const genericFallbackMessage = '操作失败，请稍后重试。';

export function getLoadErrorMessage(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error);
  return message && message !== genericFallbackMessage ? message : fallback;
}
