import type { DataDictionary } from '@/types/system';
import { APPLE_ACCOUNT_REGION_DICTIONARY_GROUP } from '@/config/quickSettings';

export type AppleAccountRegionCode = string;
export type AppleAccountCurrencyCode = string;

export interface AppleAccountRegionOption {
  code: AppleAccountRegionCode;
  labelZh: string;
  labelEn: string;
  currency: AppleAccountCurrencyCode;
  currencyLabelZh: string;
  dialCode: string;
  phoneExample: string;
}

type PhoneNormalizeResult =
  | ''
  | {
      valid: true;
      value: string;
    }
  | {
      valid: false;
      message: string;
    };

const regionChineseLabelByCode: Record<string, string> = {
  AE: '阿联酋',
  AR: '阿根廷',
  AT: '奥地利',
  AU: '澳大利亚',
  BD: '孟加拉国',
  BE: '比利时',
  BR: '巴西',
  CA: '加拿大',
  CH: '瑞士',
  CL: '智利',
  CN: '中国',
  CO: '哥伦比亚',
  CZ: '捷克',
  DE: '德国',
  DK: '丹麦',
  EG: '埃及',
  ES: '西班牙',
  EU: '欧元区',
  FI: '芬兰',
  FR: '法国',
  GB: '英国',
  GH: '加纳',
  GR: '希腊',
  HK: '中国香港',
  HU: '匈牙利',
  ID: '印度尼西亚',
  IE: '爱尔兰',
  IL: '以色列',
  IN: '印度',
  IT: '意大利',
  JP: '日本',
  KE: '肯尼亚',
  KR: '韩国',
  MA: '摩洛哥',
  MX: '墨西哥',
  MY: '马来西亚',
  NG: '尼日利亚',
  NL: '荷兰',
  NO: '挪威',
  NZ: '新西兰',
  PE: '秘鲁',
  PH: '菲律宾',
  PK: '巴基斯坦',
  PL: '波兰',
  PT: '葡萄牙',
  RO: '罗马尼亚',
  SA: '沙特阿拉伯',
  SE: '瑞典',
  SG: '新加坡',
  TH: '泰国',
  TR: '土耳其',
  TW: '中国台湾',
  UA: '乌克兰',
  US: '美国',
  VN: '越南',
  ZA: '南非'
};

export const appleAccountRegionOptions: AppleAccountRegionOption[] = [
  {
    code: 'US',
    labelZh: '美国',
    labelEn: 'US',
    currency: 'USD',
    currencyLabelZh: '美元',
    dialCode: '+1',
    phoneExample: '+1 415 555 2671'
  },
  {
    code: 'CN',
    labelZh: '中国',
    labelEn: 'CN',
    currency: 'CNY',
    currencyLabelZh: '人民币',
    dialCode: '+86',
    phoneExample: '+86 138 0013 8000'
  },
  {
    code: 'MY',
    labelZh: '马来西亚',
    labelEn: 'MY',
    currency: 'MYR',
    currencyLabelZh: '马来西亚林吉特',
    dialCode: '+60',
    phoneExample: '+60 12 345 6789'
  }
];

export const appleAccountCurrencyOptions = appleAccountRegionOptions.map((item) => ({
  value: item.currency,
  label: formatCurrencyLabel(item.currency, appleAccountRegionOptions),
  region: item.code
}));

export function getAppleAccountRegionOption(
  region: string | null | undefined,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions
) {
  const normalized = normalizeAppleRegionCode(region);
  return options.find((item) => normalizeAppleRegionCode(item.code) === normalized) ?? null;
}

export function getAppleAccountRegionLabel(
  region: string | null | undefined,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions
) {
  const option = getAppleAccountRegionOption(region, options);
  return option ? formatAppleAccountRegionOptionLabel(option) : formatAppleRegionLabel(region);
}

export function getCurrencyForRegion(
  region: string | null | undefined,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions
) {
  return getAppleAccountRegionOption(region, options)?.currency ?? 'USD';
}

export function formatCurrencyLabel(
  currency: string | null | undefined,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions
) {
  const normalized = String(currency ?? '')
    .trim()
    .toUpperCase();
  const option = options.find((item) => normalizeCurrencyCode(item.currency) === normalized);
  return option ? `${option.currencyLabelZh} ${option.currency}` : (currency ?? '-');
}

export function formatRegionCurrency(
  region: string,
  currency: string,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions
) {
  return formatAppleRegionCurrencyLabel(region, currency, options);
}

export function formatAppleAccountRegionOptionLabel(option: AppleAccountRegionOption) {
  const code = normalizeAppleRegionCode(option.code);
  return `${getRegionChineseLabel(option)} ${code}`;
}

function getRegionChineseLabel(option: AppleAccountRegionOption) {
  const code = normalizeAppleRegionCode(option.code);
  const label = option.labelZh.trim();
  const chineseLabel = label.match(/[\u4e00-\u9fff]+/u)?.[0];

  return chineseLabel || regionChineseLabelByCode[code] || code;
}

export function formatAppleRegionLabel(
  region: string | null | undefined,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions,
  fallback = '-'
) {
  const code = normalizeAppleRegionCode(region);
  if (!code) return fallback;

  const option = options.find((item) => normalizeAppleRegionCode(item.code) === code);
  const label = option ? getRegionChineseLabel(option) : regionChineseLabelByCode[code] || code;

  return label === code ? code : `${label} ${code}`;
}

export function formatAppleRegionCurrencyLabel(
  region: string | null | undefined,
  currency: string | null | undefined,
  options: AppleAccountRegionOption[] = appleAccountRegionOptions,
  fallback = '-'
) {
  const regionLabel = formatAppleRegionLabel(region, options, '');
  const currencyCode = normalizeCurrencyCode(currency);

  if (regionLabel && currencyCode) {
    return `${regionLabel} / ${currencyCode}`;
  }

  return regionLabel || currencyCode || fallback;
}

export function formatAppleRegionListLabel(
  regions: Array<string | null | undefined> | readonly (string | null | undefined)[],
  options: AppleAccountRegionOption[] = appleAccountRegionOptions,
  fallback = '不限'
) {
  const labels = [
    ...new Set(
      regions
        .map((region) => formatAppleRegionLabel(region, options, ''))
        .filter((label) => Boolean(label))
    )
  ];

  return labels.length ? labels.join('、') : fallback;
}

export function buildAppleAccountCurrencyOptions(options: AppleAccountRegionOption[]) {
  const uniqueOptions = new Map<string, { value: string; label: string; region: string }>();

  for (const item of options) {
    const currency = normalizeCurrencyCode(item.currency);
    if (!uniqueOptions.has(currency)) {
      uniqueOptions.set(currency, {
        value: currency,
        label: formatCurrencyLabel(currency, options),
        region: item.code
      });
    }
  }

  return Array.from(uniqueOptions.values());
}

export function encodeAppleAccountRegionValue(option: {
  currency: string;
  dialCode: string;
  phoneExample?: string | null;
}) {
  return JSON.stringify({
    currency: normalizeCurrencyCode(option.currency),
    dialCode: normalizeDialCode(option.dialCode),
    phoneExample: option.phoneExample?.trim() || ''
  });
}

export function parseAppleAccountRegionDictionary(item: DataDictionary): AppleAccountRegionOption {
  const parsed = parseRegionValue(item.value);
  const fallback = getAppleAccountRegionOption(item.code);

  return {
    code: normalizeAppleRegionCode(item.code),
    labelZh: item.label.trim() || item.code.toLowerCase(),
    labelEn: item.label.trim() || item.code.toLowerCase(),
    currency: normalizeCurrencyCode(parsed.currency || fallback?.currency || item.value || 'USD'),
    currencyLabelZh: fallback?.currencyLabelZh ?? parsed.currencyLabelZh ?? '币种',
    dialCode: normalizeDialCode(parsed.dialCode || fallback?.dialCode || '+86'),
    phoneExample: parsed.phoneExample || fallback?.phoneExample || ''
  };
}

export function mergeAppleAccountRegionOptions(dictionaries: DataDictionary[]) {
  const merged = new Map<string, AppleAccountRegionOption>();

  for (const item of appleAccountRegionOptions) {
    merged.set(normalizeAppleRegionCode(item.code), item);
  }

  for (const item of dictionaries) {
    if (item.status !== 'active') {
      continue;
    }
    const option = parseAppleAccountRegionDictionary(item);
    merged.set(normalizeAppleRegionCode(option.code), option);
  }

  return Array.from(merged.values()).sort((left, right) => {
    if (left.code === 'US') return -1;
    if (right.code === 'US') return 1;
    return left.code.localeCompare(right.code);
  });
}

export function getDefaultAppleAccountRegionDictionaries() {
  return appleAccountRegionOptions.map((item, index) => ({
    group: APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
    code: item.code,
    label: item.labelZh,
    value: encodeAppleAccountRegionValue(item),
    sortOrder: index,
    status: 'active' as const,
    remark: '系统默认地区，后续可在快捷设置里调整显示名称、币种和手机号区号'
  }));
}

export function normalizePhoneForRegion(value: string, region: string): PhoneNormalizeResult {
  const raw = value.trim();
  if (!raw) {
    return '';
  }

  const option = getAppleAccountRegionOption(region);
  if (!option) {
    return {
      valid: false,
      message: '请选择支持的地区后再填写手机号。'
    };
  }

  if (option.code === 'CN') {
    return normalizeChinaPhone(raw);
  }

  if (option.code === 'MY') {
    return normalizeMalaysiaPhone(raw);
  }

  return normalizeUnitedStatesPhone(raw);
}

export function normalizeAppleRegionCode(region: string | null | undefined) {
  const raw = String(region ?? '')
    .trim()
    .toUpperCase();
  if (!raw || raw === '-') return '';

  if (regionChineseLabelByCode[raw]) {
    return raw;
  }

  const candidates = raw
    .replace(/[·/:|,，()（）[\]{}]+/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (regionChineseLabelByCode[candidate]) {
      return candidate;
    }
  }

  const regionMatches = raw.match(/\b[A-Z]{2}\b/g) ?? [];
  for (const candidate of regionMatches) {
    if (regionChineseLabelByCode[candidate]) {
      return candidate;
    }
  }

  const suffix = raw.slice(-2);
  return regionChineseLabelByCode[suffix] ? suffix : raw;
}

function normalizeCurrencyCode(currency: string | null | undefined) {
  return String(currency ?? '')
    .trim()
    .toUpperCase();
}

function normalizeDialCode(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '+86';
  }
  return normalized.startsWith('+') ? normalized : `+${normalized.replace(/^00/, '')}`;
}

function normalizeDialInput(value: string) {
  return value.replace(/[()\s.-]/g, '');
}

function parseRegionValue(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return {} as {
      currency?: string;
      currencyLabelZh?: string;
      dialCode?: string;
      phoneExample?: string;
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      currency?: string;
      currencyLabelZh?: string;
      dialCode?: string;
      phoneExample?: string;
    };
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return { currency: raw };
  }
}

function normalizeChinaPhone(value: string): PhoneNormalizeResult {
  let digits = normalizeDialInput(value);
  if (digits.startsWith('+86')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0086')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('86') && digits.length === 13) {
    digits = digits.slice(2);
  }

  if (!/^1[3-9]\d{9}$/.test(digits)) {
    return {
      valid: false,
      message: '中国手机号格式错误，应为 +86 加 11 位大陆手机号，例如 +86 138 0013 8000。'
    };
  }

  return {
    valid: true,
    value: `+86${digits}`
  };
}

function normalizeMalaysiaPhone(value: string): PhoneNormalizeResult {
  let digits = normalizeDialInput(value);
  if (digits.startsWith('+60')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0060')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('60') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^1\d{8,9}$/.test(digits)) {
    return {
      valid: false,
      message: '马来西亚手机号格式错误，应为 +60 开头的手机号，例如 +60 12 345 6789。'
    };
  }

  return {
    valid: true,
    value: `+60${digits}`
  };
}

function normalizeUnitedStatesPhone(value: string): PhoneNormalizeResult {
  let digits = normalizeDialInput(value);
  if (digits.startsWith('+1')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('001')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return {
      valid: false,
      message: '美国手机号格式错误，应为 +1 加 10 位号码，例如 +1 415 555 2671。'
    };
  }

  return {
    valid: true,
    value: `+1${digits}`
  };
}
