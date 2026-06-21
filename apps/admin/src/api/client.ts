import type { ApiResponse } from '@apple-business/shared';
import axios, { AxiosError } from 'axios';
import { notifyAuthSessionExpired, TOKEN_STORAGE_KEY } from '@/auth/session';

export { TOKEN_STORAGE_KEY };

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000
});

const serverMessageMap: Record<string, string> = {
  'Invalid username or password': '账号或密码错误，请检查账号和密码后重试。',
  'MFA code is required': '需要输入动态验证码或恢复码。',
  'MFA code is invalid': '动态验证码或恢复码错误，请重新输入。',
  'MFA is not enabled': '动态验证码还没有开启。',
  'MFA secret is not configured': '动态验证码还没有配置，请先重新绑定。',
  'MFA secret is invalid': '动态验证码配置不正确，请重新绑定。',
  'IP address is not allowed': '当前 IP 不在白名单内，无法登录。',
  'Missing bearer token': '请先登录后再操作。',
  'Session has expired or been revoked': '登录状态已过期或已被下线，请重新登录。',
  'Invalid or expired token': '登录状态无效或已过期，请重新登录。',
  'Permission denied': '没有权限操作，请联系管理员检查角色权限。',
  'Permission check requires authenticated user': '请先登录后再操作。',
  'Export file is not ready': '导出文件还没准备好，请稍后再试。',
  'Export download has expired': '导出文件下载已过期，请重新生成导出任务。',
  'Export file not found': '导出文件不存在或已被清理，请重新生成。',
  'Database is not ready': '数据库还没有准备好，请稍后再试。'
};

const serverTermMap: Record<string, string> = {
  'active session': '在线会话',
  announcement: '系统公告',
  'apple account': 'Apple ID',
  'apple action plan': 'ID 操作计划',
  'apple activation': '开通记录',
  'apple id': 'Apple ID',
  'apple id status': 'Apple ID 状态',
  'apple order': 'Apple ID 订单',
  'apple service': 'Apple ID 业务',
  attachment: '附件',
  'attachment file': '附件文件',
  'automation task': '自动化任务',
  'backup job': '备份任务',
  'code after-sale record': '售后补发记录',
  'code delivery log': '发货记录',
  'code order': '兑换码订单',
  'code platform mapping': '平台商品映射',
  'code service': '兑换码业务',
  customer: '客户',
  'customer phone': '客户手机号',
  'data dictionary': '数据字典',
  'duplicate merge job': '重复合并任务',
  'export job': '导出任务',
  'feature flag': '功能开关',
  'import job': '导入任务',
  'import error report': '导入错误报告',
  'ip whitelist': 'IP 白名单',
  'message template': '发货模板',
  'notification log': '通知日志',
  'notification rule': '通知规则',
  'notification template': '通知模板',
  'platform code order': '平台订单',
  'recycle bin record': '回收站记录',
  'redeem code': '兑换码',
  'redeem code batch': '兑换码批次',
  'renewal task': '续费任务',
  'restore job': '恢复任务',
  role: '角色',
  'sensitive access approval': '敏感信息审批',
  'source platform': '来源平台',
  'system parameter': '系统参数',
  'table view': '保存视图',
  'telegram bot token': 'Telegram Bot Token',
  'telegram chat id': 'Telegram Chat ID',
  'telegram config': 'Telegram 配置',
  user: '用户'
};

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return normalizeServerMessage(error.message);
  }

  return '操作失败，请稍后重试。';
}

function isLikelyEnglishMessage(message: string) {
  return (
    /[A-Za-z]/.test(message) &&
    Array.from(message).every((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
  );
}

function normalizeServerTerm(term: string) {
  const normalized = term
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return serverTermMap[normalized] ?? (isLikelyEnglishMessage(term) ? '参数' : term.trim());
}

function getGenericServerMessage(status?: number) {
  if (status === 400) {
    return '提交内容不正确，请检查后重试。';
  }

  if (status === 401) {
    return '登录状态已过期，请重新登录。';
  }

  if (status === 403) {
    return '没有权限访问该功能，请联系管理员检查角色权限。';
  }

  if (status === 404) {
    return '请求的数据不存在或已被删除。';
  }

  if (status === 409) {
    return '当前数据状态有变化，请刷新后重试。';
  }

  if (status && status >= 500) {
    return `服务器内部错误（${status}），请稍后重试或联系管理员。`;
  }

  return status ? `请求失败，服务器返回 ${status}。` : '操作失败，请稍后重试。';
}

function translateServerMessagePattern(message: string, status?: number) {
  const notFoundMatch = message.match(/^(.+) not found$/i);
  if (notFoundMatch?.[1]) {
    return `${normalizeServerTerm(notFoundMatch[1])}不存在或已被删除。`;
  }

  const alreadyExistsMatch = message.match(/^(.+) already exists$/i);
  if (alreadyExistsMatch?.[1]) {
    return `${normalizeServerTerm(alreadyExistsMatch[1])}已存在。`;
  }

  const disabledMatch = message.match(/^(.+) does not exist or is disabled$/i);
  if (disabledMatch?.[1]) {
    return `${normalizeServerTerm(disabledMatch[1])}不存在或已停用。`;
  }

  const requiredMatch = message.match(/^(.+) is required$/i);
  if (requiredMatch?.[1]) {
    return `请填写${normalizeServerTerm(requiredMatch[1])}。`;
  }

  const invalidPrefixMatch = message.match(/^Invalid (.+)$/i);
  if (invalidPrefixMatch?.[1]) {
    return `${normalizeServerTerm(invalidPrefixMatch[1])}不正确。`;
  }

  const invalidSuffixMatch = message.match(/^(.+) is invalid$/i);
  if (invalidSuffixMatch?.[1]) {
    return `${normalizeServerTerm(invalidSuffixMatch[1])}不正确。`;
  }

  const invalidFormatMatch = message.match(/^(.+) format is invalid$/i);
  if (invalidFormatMatch?.[1]) {
    return `${normalizeServerTerm(invalidFormatMatch[1])}格式不正确。`;
  }

  const mustBeMatch = message.match(/^(.+) must be (.+)$/i);
  if (mustBeMatch?.[1]) {
    return `${normalizeServerTerm(mustBeMatch[1])}格式或取值不正确。`;
  }

  const cannotBeMatch = message.match(/^(.+) cannot be (.+)$/i);
  if (cannotBeMatch?.[1]) {
    return `${normalizeServerTerm(cannotBeMatch[1])}当前不能执行这个操作。`;
  }

  if (isLikelyEnglishMessage(message)) {
    return getGenericServerMessage(status);
  }

  return message;
}

function normalizeServerMessage(message: string, status?: number) {
  const normalized = message.trim();

  if (!normalized) {
    return getGenericServerMessage(status);
  }

  return serverMessageMap[normalized] ?? translateServerMessagePattern(normalized, status);
}

function getAxiosErrorMessage(error: AxiosError<ApiResponse<unknown>>) {
  const response = error.response?.data;
  const status = error.response?.status;

  if (response?.message) {
    return normalizeServerMessage(response.message, status);
  }

  if (status === 401) {
    return getGenericServerMessage(status);
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
      throw new Error(normalizeServerMessage(body.message));
    }

    return body.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const axiosError = error as AxiosError<ApiResponse<unknown>>;
      const message = getAxiosErrorMessage(axiosError);

      if (axiosError.response?.status === 401 && localStorage.getItem(TOKEN_STORAGE_KEY)) {
        notifyAuthSessionExpired({
          message,
          reason: 'unauthorized'
        });
      }

      throw new Error(message, {
        cause: error
      });
    }

    throw error;
  }
}
