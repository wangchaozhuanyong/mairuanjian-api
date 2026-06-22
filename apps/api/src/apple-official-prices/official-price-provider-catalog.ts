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
  { region: 'DE', currency: 'EUR' },
  { region: 'FR', currency: 'EUR' },
  { region: 'ES', currency: 'EUR' },
  { region: 'IT', currency: 'EUR' },
  { region: 'NL', currency: 'EUR' },
  { region: 'IE', currency: 'EUR' },
  { region: 'BE', currency: 'EUR' },
  { region: 'AT', currency: 'EUR' },
  { region: 'PT', currency: 'EUR' },
  { region: 'FI', currency: 'EUR' },
  { region: 'GR', currency: 'EUR' },
  { region: 'PL', currency: 'PLN' },
  { region: 'SE', currency: 'SEK' },
  { region: 'NO', currency: 'NOK' },
  { region: 'DK', currency: 'DKK' },
  { region: 'CH', currency: 'CHF' },
  { region: 'CZ', currency: 'CZK' },
  { region: 'RO', currency: 'RON' },
  { region: 'HU', currency: 'HUF' },
  { region: 'UA', currency: 'UAH' },
  { region: 'AU', currency: 'AUD' },
  { region: 'NZ', currency: 'NZD' },
  { region: 'CA', currency: 'CAD' },
  { region: 'TH', currency: 'THB' },
  { region: 'PH', currency: 'PHP' },
  { region: 'ID', currency: 'IDR' },
  { region: 'VN', currency: 'VND' },
  { region: 'IN', currency: 'INR' },
  { region: 'PK', currency: 'PKR' },
  { region: 'BD', currency: 'BDT' },
  { region: 'TR', currency: 'TRY' },
  { region: 'AE', currency: 'AED' },
  { region: 'SA', currency: 'SAR' },
  { region: 'IL', currency: 'ILS' },
  { region: 'BR', currency: 'BRL' },
  { region: 'MX', currency: 'MXN' },
  { region: 'AR', currency: 'ARS' },
  { region: 'CL', currency: 'CLP' },
  { region: 'CO', currency: 'COP' },
  { region: 'PE', currency: 'PEN' },
  { region: 'NG', currency: 'NGN' },
  { region: 'GH', currency: 'GHS' },
  { region: 'ZA', currency: 'ZAR' },
  { region: 'KE', currency: 'KES' },
  { region: 'EG', currency: 'EGP' },
  { region: 'MA', currency: 'MAD' }
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
        currencyPrices: { USD: '4.99', MYR: '23.99' },
        periodType: 'month',
        periodValue: 1
      },
      {
        planCode: 'google_ai_pro_monthly',
        serviceName: 'Google AI Pro 1个月',
        category: 'Gemini',
        aliases: ['Google AI Pro', 'AI Pro', 'Gemini Pro'],
        currencyPrices: { USD: '19.99', MYR: '97.99' },
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
    AE: 'ar_ae',
    AR: 'es-419_ar',
    AT: 'de_at',
    AU: 'en_au',
    BD: 'en_bd',
    BE: 'fr_be',
    BR: 'pt-BR_br',
    CA: 'en_ca',
    CH: 'de_ch',
    CL: 'es-419_cl',
    CO: 'es-419_co',
    CZ: 'cs_cz',
    DE: 'de_de',
    DK: 'da_dk',
    EG: 'ar_eg',
    ES: 'es_es',
    EU: 'en_ie',
    FI: 'fi_fi',
    FR: 'fr_fr',
    GB: 'en_gb',
    GH: 'en_gh',
    GR: 'el_gr',
    HK: 'en_hk',
    HU: 'hu_hu',
    ID: 'id_id',
    IE: 'en_ie',
    IL: 'he_il',
    IN: 'en_in',
    IT: 'it_it',
    JP: 'ja_jp',
    KE: 'en_ke',
    KR: 'ko_kr',
    MA: 'fr_ma',
    MX: 'es-419_mx',
    MY: 'en_my',
    NG: 'en_ng',
    NL: 'nl_nl',
    NO: 'nb_no',
    NZ: 'en_nz',
    PE: 'es-419_pe',
    PH: 'en_ph',
    PK: 'en_pk',
    PL: 'pl_pl',
    PT: 'pt_pt',
    RO: 'ro_ro',
    SA: 'ar_sa',
    SE: 'sv_se',
    SG: 'en_sg',
    TH: 'th_th',
    TR: 'tr_tr',
    TW: 'zh_tw',
    UA: 'uk_ua',
    US: 'en_us',
    VN: 'vi_vn',
    ZA: 'en_za'
  };
  return localeByRegion[region] ?? 'en_us';
}
