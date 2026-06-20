import { BadRequestException } from '@nestjs/common';

export type AppleAccountRegionCode = 'CN' | 'MY' | 'US';
export type AppleAccountCurrencyCode = 'CNY' | 'MYR' | 'USD';

interface AppleAccountRegionRule {
  code: AppleAccountRegionCode;
  label: string;
  currency: AppleAccountCurrencyCode;
  dialCode: string;
}

const REGION_RULES: AppleAccountRegionRule[] = [
  {
    code: 'CN',
    label: '中国 China（CN）',
    currency: 'CNY',
    dialCode: '+86'
  },
  {
    code: 'MY',
    label: '马来西亚 Malaysia（MY）',
    currency: 'MYR',
    dialCode: '+60'
  },
  {
    code: 'US',
    label: '美国 United States（US）',
    currency: 'USD',
    dialCode: '+1'
  }
];

export function normalizeAppleAccountRegion(value?: string | null) {
  const normalized = (value || 'US').trim().toUpperCase();
  const rule = REGION_RULES.find((item) => item.code === normalized);

  if (!rule) {
    throw new BadRequestException('地区暂只支持中国（CN）、马来西亚（MY）、美国（US）');
  }

  return rule.code;
}

export function getAppleAccountCurrencyForRegion(region: string) {
  return getRegionRule(region).currency;
}

export function normalizeAppleAccountCurrency(region: string, value?: string | null) {
  const rule = getRegionRule(region);
  const normalized = (value || rule.currency).trim().toUpperCase();

  if (normalized !== rule.currency) {
    throw new BadRequestException(`${rule.label} 只能使用币种 ${rule.currency}`);
  }

  return rule.currency;
}

export function normalizeAppleAccountPhone(value: string | null | undefined, region: string) {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  const rule = getRegionRule(region);
  const raw = value.trim();

  if (rule.code === 'CN') {
    return normalizeChinaPhone(raw);
  }

  if (rule.code === 'MY') {
    return normalizeMalaysiaPhone(raw);
  }

  return normalizeUnitedStatesPhone(raw);
}

function getRegionRule(region: string) {
  const normalized = region.trim().toUpperCase();
  const rule = REGION_RULES.find((item) => item.code === normalized);

  if (!rule) {
    throw new BadRequestException('地区暂只支持中国（CN）、马来西亚（MY）、美国（US）');
  }

  return rule;
}

function normalizeDialInput(value: string) {
  return value.replace(/[()\s.-]/g, '');
}

function normalizeChinaPhone(value: string) {
  let digits = normalizeDialInput(value);

  if (digits.startsWith('+86')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0086')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('86') && digits.length === 13) {
    digits = digits.slice(2);
  }

  if (!/^1[3-9]\d{9}$/.test(digits)) {
    throw new BadRequestException(
      '中国手机号格式错误，应为 +86 加 11 位大陆手机号，例如 +86 138 0013 8000'
    );
  }

  return `+86${digits}`;
}

function normalizeMalaysiaPhone(value: string) {
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
    throw new BadRequestException(
      '马来西亚手机号格式错误，应为 +60 开头的手机号，例如 +60 12 345 6789'
    );
  }

  return `+60${digits}`;
}

function normalizeUnitedStatesPhone(value: string) {
  let digits = normalizeDialInput(value);

  if (digits.startsWith('+1')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('001')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    throw new BadRequestException('美国手机号格式错误，应为 +1 加 10 位号码，例如 +1 415 555 2671');
  }

  return `+1${digits}`;
}
