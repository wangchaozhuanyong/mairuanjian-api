import type { AppleServicePeriodType } from '@prisma/client';

export type OfficialPriceProviderKey = 'chatgpt' | 'gemini' | 'claude';

export interface OfficialPriceProviderPlan {
  aliases: string[];
  category: string;
  currencyPrices: Record<string, string>;
  periodType: AppleServicePeriodType;
  periodValue: number;
  planCode: string;
  preferCatalogPrice?: boolean;
  serviceName: string;
}

export interface OfficialPriceProviderRegion {
  currency: string;
  region: string;
  sourceUrl?: string | null;
}

export interface OfficialPriceProviderSourcePreset {
  checkIntervalHours: number;
  currency: string;
  name: string;
  provider: OfficialPriceProviderKey;
  region: string;
  remark: string;
  sourceUrl: string;
}

interface OfficialPriceProviderProfile {
  defaultRegions: OfficialPriceProviderRegion[];
  hosts: string[];
  label: string;
  plans: OfficialPriceProviderPlan[];
  sourceUrl: string;
}

const COMMON_OFFICIAL_PRICE_REGIONS: OfficialPriceProviderRegion[] = [
  { region: 'US', currency: 'USD' },
  { region: 'MY', currency: 'MYR' },
  { region: 'SG', currency: 'SGD' },
  { region: 'HK', currency: 'HKD' },
  { region: 'TW', currency: 'TWD' },
  { region: 'JP', currency: 'JPY' },
  { region: 'KR', currency: 'KRW' },
  { region: 'GB', currency: 'GBP' },
  { region: 'EU', currency: 'EUR' },
  { region: 'AU', currency: 'AUD' },
  { region: 'CA', currency: 'CAD' },
  { region: 'TH', currency: 'THB' },
  { region: 'PH', currency: 'PHP' },
  { region: 'ID', currency: 'IDR' },
  { region: 'VN', currency: 'VND' },
  { region: 'IN', currency: 'INR' },
  { region: 'TR', currency: 'TRY' },
  { region: 'BR', currency: 'BRL' },
  { region: 'MX', currency: 'MXN' }
];

export const OFFICIAL_PRICE_PROVIDER_KEYS: OfficialPriceProviderKey[] = [
  'chatgpt',
  'gemini',
  'claude'
];

export const OFFICIAL_PRICE_PROVIDER_PROFILES: Record<
  OfficialPriceProviderKey,
  OfficialPriceProviderProfile
> = {
  chatgpt: {
    label: 'ChatGPT / OpenAI',
    sourceUrl: 'https://openai.com/chatgpt/pricing/',
    hosts: ['openai.com'],
    defaultRegions: COMMON_OFFICIAL_PRICE_REGIONS,
    plans: [
      {
        planCode: 'chatgpt_go_monthly',
        serviceName: 'ChatGPT Go 1个月',
        category: 'ChatGPT',
        aliases: ['ChatGPT Go', 'Go'],
        currencyPrices: { USD: '8' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'chatgpt_plus_monthly',
        serviceName: 'ChatGPT Plus 1个月',
        category: 'ChatGPT',
        aliases: ['ChatGPT Plus', 'Plus'],
        currencyPrices: { USD: '20' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'chatgpt_pro_5x_monthly',
        serviceName: 'ChatGPT Pro 5x 1个月',
        category: 'ChatGPT',
        aliases: ['ChatGPT Pro 5x', 'Pro 5x', 'Pro $100', '5x higher usage'],
        currencyPrices: { USD: '100' },
        periodType: 'month',
        periodValue: 1,
        preferCatalogPrice: true
      },
      {
        planCode: 'chatgpt_pro_20x_monthly',
        serviceName: 'ChatGPT Pro 20x 1个月',
        category: 'ChatGPT',
        aliases: ['ChatGPT Pro 20x', 'Pro 20x', 'Pro $200', '20x usage', 'ChatGPT Pro'],
        currencyPrices: { USD: '200' },
        periodType: 'month',
        periodValue: 1,
        preferCatalogPrice: true
      }
    ]
  },
  gemini: {
    label: 'Gemini / Google',
    sourceUrl: 'https://one.google.com/intl/en_us/about/google-ai-plans/',
    hosts: ['one.google.com', 'gemini.google'],
    defaultRegions: COMMON_OFFICIAL_PRICE_REGIONS,
    plans: [
      {
        planCode: 'google_ai_plus_monthly',
        serviceName: 'Google AI Plus 1个月',
        category: 'Gemini',
        aliases: ['Google AI Plus', 'AI Plus', 'Gemini Plus'],
        currencyPrices: { USD: '4.99' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'google_ai_pro_monthly',
        serviceName: 'Google AI Pro 1个月',
        category: 'Gemini',
        aliases: ['Google AI Pro', 'AI Pro', 'Gemini Pro'],
        currencyPrices: { USD: '19.99' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'google_ai_ultra_5x_monthly',
        serviceName: 'Google AI Ultra 5x 1个月',
        category: 'Gemini',
        aliases: ['Google AI Ultra 5x', 'AI Ultra 5x', 'Ultra 5x', '5x higher usage'],
        currencyPrices: { USD: '99.99' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'google_ai_ultra_20x_monthly',
        serviceName: 'Google AI Ultra 20x 1个月',
        category: 'Gemini',
        aliases: ['Google AI Ultra 20x', 'AI Ultra 20x', 'Ultra 20x', '20x higher usage'],
        currencyPrices: { USD: '199.99' },
        periodType: 'month',
        periodValue: 1
      }
    ]
  },
  claude: {
    label: 'Claude / Anthropic',
    sourceUrl: 'https://www.anthropic.com/pricing',
    hosts: ['anthropic.com', 'claude.ai'],
    defaultRegions: COMMON_OFFICIAL_PRICE_REGIONS,
    plans: [
      {
        planCode: 'claude_pro_monthly',
        serviceName: 'Claude Pro 1个月',
        category: 'Claude',
        aliases: ['Claude Pro', 'Pro'],
        currencyPrices: { USD: '20' },
        periodType: 'month',
        periodValue: 1,
        preferCatalogPrice: true
      },
      {
        planCode: 'claude_pro_annual',
        serviceName: 'Claude Pro 1年',
        category: 'Claude',
        aliases: ['Claude Pro annual', 'Pro annual', 'annual subscription'],
        currencyPrices: { USD: '200' },
        periodType: 'month',
        periodValue: 12,
        preferCatalogPrice: true
      },
      {
        planCode: 'claude_max_5x_monthly',
        serviceName: 'Claude Max 5x 1个月',
        category: 'Claude',
        aliases: ['Max 5x', 'Claude Max 5x'],
        currencyPrices: { USD: '100' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'claude_max_20x_monthly',
        serviceName: 'Claude Max 20x 1个月',
        category: 'Claude',
        aliases: ['Max 20x', 'Claude Max 20x'],
        currencyPrices: { USD: '200' },
        periodType: 'month',
        periodValue: 1
      }
    ]
  }
};

export function normalizeOfficialPriceProvider(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'chatgpt' || normalized === 'openai') return 'chatgpt';
  if (normalized === 'gemini' || normalized === 'google') return 'gemini';
  if (normalized === 'claude' || normalized === 'anthropic') return 'claude';
  return null;
}

export function buildOfficialPriceProviderPreset(
  provider: OfficialPriceProviderKey,
  region: OfficialPriceProviderRegion
): OfficialPriceProviderSourcePreset {
  const profile = OFFICIAL_PRICE_PROVIDER_PROFILES[provider];
  const normalizedRegion = region.region.trim().toUpperCase();
  const normalizedCurrency = region.currency.trim().toUpperCase();
  return {
    provider,
    region: normalizedRegion,
    currency: normalizedCurrency,
    sourceUrl: region.sourceUrl || getProviderRegionSourceUrl(provider, normalizedRegion),
    name: `${profile.label} 官方价格 ${normalizedRegion}/${normalizedCurrency}`,
    checkIntervalHours: 24,
    remark: '系统内置官方价格自动采集来源'
  };
}

function getProviderRegionSourceUrl(provider: OfficialPriceProviderKey, region: string) {
  if (provider !== 'gemini') return OFFICIAL_PRICE_PROVIDER_PROFILES[provider].sourceUrl;
  const locale = getGoogleOneLocale(region);
  return `https://one.google.com/intl/${locale}/about/google-ai-plans/`;
}

function getGoogleOneLocale(region: string) {
  const localeByRegion: Record<string, string> = {
    AU: 'en_au',
    BR: 'pt-BR_br',
    CA: 'en_ca',
    EU: 'en_ie',
    GB: 'en_gb',
    HK: 'en_hk',
    ID: 'id_id',
    IN: 'en_in',
    JP: 'ja_jp',
    KR: 'ko_kr',
    MX: 'es-419_mx',
    MY: 'en_my',
    PH: 'en_ph',
    SG: 'en_sg',
    TH: 'th_th',
    TR: 'tr_tr',
    TW: 'zh_tw',
    US: 'en_us',
    VN: 'vi_vn'
  };
  return localeByRegion[region] ?? 'en_us';
}
