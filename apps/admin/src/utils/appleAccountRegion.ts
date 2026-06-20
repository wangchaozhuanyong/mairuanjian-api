export type AppleAccountRegionCode = 'CN' | 'MY' | 'US';
export type AppleAccountCurrencyCode = 'CNY' | 'MYR' | 'USD';

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

export const appleAccountRegionOptions: AppleAccountRegionOption[] = [
  {
    code: 'CN',
    labelZh: '中国',
    labelEn: 'China',
    currency: 'CNY',
    currencyLabelZh: '人民币',
    dialCode: '+86',
    phoneExample: '+86 138 0013 8000'
  },
  {
    code: 'MY',
    labelZh: '马来西亚',
    labelEn: 'Malaysia',
    currency: 'MYR',
    currencyLabelZh: '马来西亚林吉特',
    dialCode: '+60',
    phoneExample: '+60 12 345 6789'
  },
  {
    code: 'US',
    labelZh: '美国',
    labelEn: 'United States',
    currency: 'USD',
    currencyLabelZh: '美元',
    dialCode: '+1',
    phoneExample: '+1 415 555 2671'
  }
];

export const appleAccountCurrencyOptions = appleAccountRegionOptions.map((item) => ({
  value: item.currency,
  label: formatCurrencyLabel(item.currency),
  region: item.code
}));

export function getAppleAccountRegionOption(region: string | null | undefined) {
  const normalized = normalizeRegionCode(region);
  return appleAccountRegionOptions.find((item) => item.code === normalized) ?? null;
}

export function getAppleAccountRegionLabel(region: string | null | undefined) {
  const option = getAppleAccountRegionOption(region);
  return option ? `${option.labelZh} ${option.labelEn}（${option.code}）` : (region ?? '-');
}

export function getCurrencyForRegion(region: string | null | undefined) {
  return getAppleAccountRegionOption(region)?.currency ?? 'USD';
}

export function formatCurrencyLabel(currency: string | null | undefined) {
  const normalized = String(currency ?? '')
    .trim()
    .toUpperCase();
  const option = appleAccountRegionOptions.find((item) => item.currency === normalized);
  return option ? `${option.currencyLabelZh} ${option.currency}` : (currency ?? '-');
}

export function formatRegionCurrency(region: string, currency: string) {
  return `${getAppleAccountRegionLabel(region)} / ${formatCurrencyLabel(currency)}`;
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

function normalizeRegionCode(region: string | null | undefined) {
  return String(region ?? '')
    .trim()
    .toUpperCase();
}

function normalizeDialInput(value: string) {
  return value.replace(/[()\s.-]/g, '');
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
