import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { PrismaService } from '../common/prisma/prisma.service';
import type { OrderEntryExchangeRateQueryDto } from './dto/order-entry-exchange-rate-query.dto';

type PaidCurrency = 'CNY' | 'MYR' | 'USD' | 'USDT';
type QuoteSource = 'fixed' | 'free_daily' | 'p2p_otc';
type P2pAdSide = 'merchant_buy' | 'merchant_sell';

interface ExchangeRateSettings {
  buffers?: Record<string, string | number | null | undefined>;
  bufferPercentByCurrency?: Record<string, string | number | null | undefined>;
}

interface FreeDailyExchangeRateResponse {
  provider?: string;
  date?: string;
  time_last_updated?: number;
  rates?: Record<string, string | number>;
}

interface BinanceP2pResponse {
  data?: Array<{
    adv?: {
      tradeType?: string;
      price?: string;
      minSingleTransAmount?: string;
      maxSingleTransAmount?: string;
      tradeMethods?: Array<{
        identifier?: string;
        tradeMethodName?: string;
        tradeMethodShortName?: string;
      }>;
    };
  }>;
}

interface OkxP2pResponse {
  data?: {
    buy?: OkxP2pAd[];
    sell?: OkxP2pAd[];
  };
}

interface OkxP2pAd {
  price?: string;
  quoteMinAmountPerOrder?: string;
  quoteMaxAmountPerOrder?: string;
  paymentMethods?: Array<{
    paymentMethod?: string;
    name?: string;
  }>;
}

interface P2pAdQuote {
  provider: string;
  side: P2pAdSide;
  price: PrismaNamespace.Decimal;
  minAmountRmb: PrismaNamespace.Decimal | null;
  maxAmountRmb: PrismaNamespace.Decimal | null;
  paymentMethods: string[];
}

interface P2pProviderQuote {
  provider: string;
  available: boolean;
  merchantBuyRateToRmb?: PrismaNamespace.Decimal;
  merchantSellRateToRmb?: PrismaNamespace.Decimal;
  midRateToRmb?: PrismaNamespace.Decimal;
  adCount: number;
  usedAdCount: number;
  errorMessage?: string;
}

export interface OrderEntryP2pProviderQuoteResponse {
  provider: string;
  available: boolean;
  merchantBuyRateToRmb?: string;
  merchantSellRateToRmb?: string;
  midRateToRmb?: string;
  adCount: number;
  usedAdCount: number;
  errorMessage?: string;
}

export interface OrderEntryExchangeRateQuoteResponse {
  paidCurrency: PaidCurrency;
  available: boolean;
  rateToRmb: string;
  rawRateToRmb: string;
  bufferPercent: string;
  source: QuoteSource;
  provider: string;
  collectedAt: string;
  expiresAt: string;
  errorMessage?: string;
  merchantBuyRateToRmb?: string;
  merchantSellRateToRmb?: string;
  midRateToRmb?: string;
  p2pQuotes?: OrderEntryP2pProviderQuoteResponse[];
}

const SUPPORTED_PAID_CURRENCIES: PaidCurrency[] = ['CNY', 'MYR', 'USD', 'USDT'];
const FREE_DAILY_EXCHANGE_RATE_URL = 'https://api.exchangerate-api.com/v4/latest/CNY';
const FIAT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const P2P_CACHE_TTL_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const EXCHANGE_RATE_SETTINGS_KEY = 'exchange_rate_settings';

@Injectable()
export class ExchangeRatesService {
  private readonly cache = new TimedMemoryCache();
  private fetcher: typeof fetch = fetch;

  constructor(private readonly prisma: PrismaService) {}

  setFetchImplementationForTest(fetcher: typeof fetch) {
    this.fetcher = fetcher;
  }

  async getOrderEntryQuote(
    query: OrderEntryExchangeRateQueryDto
  ): Promise<OrderEntryExchangeRateQuoteResponse> {
    const paidCurrency = this.normalizePaidCurrency(query.paidCurrency);
    const targetAmountRmb = this.normalizeOptionalDecimal(query.targetAmountRmb);

    if (paidCurrency === 'CNY') {
      return this.buildAvailableQuote({
        paidCurrency,
        rawRateToRmb: new PrismaNamespace.Decimal(1),
        bufferPercent: new PrismaNamespace.Decimal(0),
        source: 'fixed',
        provider: 'system',
        collectedAt: new Date().toISOString(),
        ttlMs: FIAT_CACHE_TTL_MS
      });
    }

    try {
      if (paidCurrency === 'USDT') {
        return await this.getUsdtP2pQuote(targetAmountRmb);
      }

      return await this.getFiatQuote(paidCurrency);
    } catch (error) {
      const bufferPercent = await this.getBufferPercent(paidCurrency);
      return this.buildUnavailableQuote(
        paidCurrency,
        paidCurrency === 'USDT' ? 'p2p_otc' : 'free_daily',
        paidCurrency === 'USDT' ? 'okx+binance' : 'ExchangeRate-API free',
        bufferPercent,
        error
      );
    }
  }

  private async getFiatQuote(
    paidCurrency: Exclude<PaidCurrency, 'CNY' | 'USDT'>
  ): Promise<OrderEntryExchangeRateQuoteResponse> {
    const data = await this.cache.getOrSet('free-daily:CNY', FIAT_CACHE_TTL_MS, () =>
      this.fetchJson<FreeDailyExchangeRateResponse>(FREE_DAILY_EXCHANGE_RATE_URL)
    );
    const rateValue = data.rates?.[paidCurrency];

    if (rateValue === undefined || rateValue === null) {
      throw new BadRequestException(`Exchange rate for ${paidCurrency} is unavailable`);
    }

    const foreignPerCny = this.toPositiveDecimal(rateValue, `${paidCurrency} rate`);
    const rawRateToRmb = new PrismaNamespace.Decimal(1).div(foreignPerCny).toDecimalPlaces(8);
    const bufferPercent = await this.getBufferPercent(paidCurrency);
    const collectedAt = data.time_last_updated
      ? new Date(data.time_last_updated * 1000).toISOString()
      : new Date().toISOString();

    return this.buildAvailableQuote({
      paidCurrency,
      rawRateToRmb,
      bufferPercent,
      source: 'free_daily',
      provider: data.provider || 'ExchangeRate-API free',
      collectedAt,
      ttlMs: FIAT_CACHE_TTL_MS
    });
  }

  private async getUsdtP2pQuote(
    targetAmountRmb: PrismaNamespace.Decimal | null
  ): Promise<OrderEntryExchangeRateQuoteResponse> {
    const [binanceQuote, okxQuote] = await Promise.all([
      this.getBinanceP2pQuote(targetAmountRmb),
      this.getOkxP2pQuote(targetAmountRmb)
    ]);
    const availableQuotes = [binanceQuote, okxQuote].filter(
      (quote) => quote.available && quote.merchantBuyRateToRmb
    );

    if (!availableQuotes.length) {
      throw new BadRequestException('USDT OTC quote is unavailable');
    }

    const merchantBuyRateToRmb = this.minDecimal(
      availableQuotes.map((quote) => quote.merchantBuyRateToRmb!)
    );
    const sellRates = [binanceQuote, okxQuote]
      .map((quote) => quote.merchantSellRateToRmb)
      .filter((rate): rate is PrismaNamespace.Decimal => Boolean(rate));
    const merchantSellRateToRmb = sellRates.length ? this.maxDecimal(sellRates) : undefined;
    const midRateToRmb = merchantSellRateToRmb
      ? merchantBuyRateToRmb.plus(merchantSellRateToRmb).div(2).toDecimalPlaces(8)
      : undefined;
    const bufferPercent = await this.getBufferPercent('USDT');

    return this.buildAvailableQuote({
      paidCurrency: 'USDT',
      rawRateToRmb: merchantBuyRateToRmb,
      bufferPercent,
      source: 'p2p_otc',
      provider: availableQuotes.map((quote) => quote.provider).join('+'),
      collectedAt: new Date().toISOString(),
      ttlMs: P2P_CACHE_TTL_MS,
      merchantBuyRateToRmb,
      merchantSellRateToRmb,
      midRateToRmb,
      p2pQuotes: [binanceQuote, okxQuote].map((quote) => this.toP2pQuoteResponse(quote))
    });
  }

  private async getBinanceP2pQuote(targetAmountRmb: PrismaNamespace.Decimal | null) {
    try {
      const [merchantBuyAds, merchantSellAds] = await Promise.all([
        this.cache.getOrSet('p2p:binance:merchant-buy', P2P_CACHE_TTL_MS, () =>
          this.fetchBinanceAds('SELL', 'merchant_buy')
        ),
        this.cache.getOrSet('p2p:binance:merchant-sell', P2P_CACHE_TTL_MS, () =>
          this.fetchBinanceAds('BUY', 'merchant_sell')
        )
      ]);

      return this.buildP2pProviderQuote('Binance', merchantBuyAds, merchantSellAds, targetAmountRmb);
    } catch (error) {
      return this.buildP2pErrorQuote('Binance', error);
    }
  }

  private async getOkxP2pQuote(targetAmountRmb: PrismaNamespace.Decimal | null) {
    try {
      const [merchantBuyAds, merchantSellAds] = await Promise.all([
        this.cache.getOrSet('p2p:okx:merchant-buy', P2P_CACHE_TTL_MS, () =>
          this.fetchOkxAds('buy', 'merchant_buy')
        ),
        this.cache.getOrSet('p2p:okx:merchant-sell', P2P_CACHE_TTL_MS, () =>
          this.fetchOkxAds('sell', 'merchant_sell')
        )
      ]);

      return this.buildP2pProviderQuote('OKX', merchantBuyAds, merchantSellAds, targetAmountRmb);
    } catch (error) {
      return this.buildP2pErrorQuote('OKX', error);
    }
  }

  private async fetchBinanceAds(tradeType: 'BUY' | 'SELL', side: P2pAdSide) {
    const response = await this.fetchJson<BinanceP2pResponse>(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': this.getUserAgent()
        },
        body: JSON.stringify({
          page: 1,
          rows: 20,
          payTypes: [],
          asset: 'USDT',
          tradeType,
          fiat: 'CNY',
          publisherType: null
        })
      }
    );

    return (response.data ?? [])
      .map((item) => item.adv)
      .filter((adv): adv is NonNullable<typeof adv> => Boolean(adv))
      .map((adv) => ({
        provider: 'Binance',
        side,
        price: this.toPositiveDecimal(adv.price, 'Binance P2P price'),
        minAmountRmb: this.toNullableDecimal(adv.minSingleTransAmount),
        maxAmountRmb: this.toNullableDecimal(adv.maxSingleTransAmount),
        paymentMethods: (adv.tradeMethods ?? [])
          .map(
            (method) =>
              method.identifier || method.tradeMethodShortName || method.tradeMethodName || ''
          )
          .filter(Boolean)
      }))
      .filter((ad) => ad.price.greaterThan(0));
  }

  private async fetchOkxAds(sideParam: 'buy' | 'sell', side: P2pAdSide) {
    const response = await this.fetchJson<OkxP2pResponse>(
      `https://www.okx.com/v3/c2c/tradingOrders/books?quoteCurrency=cny&baseCurrency=usdt&side=${sideParam}&paymentMethod=all&userType=all&showTrade=false&showFollow=false&showAlreadyTraded=false&isAbleFilter=false&receivingAds=false&page=1&limit=20`,
      {
        headers: {
          accept: 'application/json',
          'user-agent': this.getUserAgent()
        }
      }
    );
    const rows = sideParam === 'buy' ? response.data?.buy : response.data?.sell;

    return (rows ?? [])
      .map((ad) => ({
        provider: 'OKX',
        side,
        price: this.toPositiveDecimal(ad.price, 'OKX P2P price'),
        minAmountRmb: this.toNullableDecimal(ad.quoteMinAmountPerOrder),
        maxAmountRmb: this.toNullableDecimal(ad.quoteMaxAmountPerOrder),
        paymentMethods: (ad.paymentMethods ?? [])
          .map((method) => method.paymentMethod || method.name || '')
          .filter(Boolean)
      }))
      .filter((ad) => ad.price.greaterThan(0));
  }

  private buildP2pProviderQuote(
    provider: string,
    merchantBuyAds: P2pAdQuote[],
    merchantSellAds: P2pAdQuote[],
    targetAmountRmb: PrismaNamespace.Decimal | null
  ): P2pProviderQuote {
    const usableBuyAds = this.filterAdsByAmount(merchantBuyAds, targetAmountRmb);
    const usableSellAds = this.filterAdsByAmount(merchantSellAds, targetAmountRmb);
    const merchantBuyRateToRmb = usableBuyAds.length
      ? this.minDecimal(usableBuyAds.map((ad) => ad.price))
      : undefined;
    const merchantSellRateToRmb = usableSellAds.length
      ? this.maxDecimal(usableSellAds.map((ad) => ad.price))
      : undefined;
    const midRateToRmb =
      merchantBuyRateToRmb && merchantSellRateToRmb
        ? merchantBuyRateToRmb.plus(merchantSellRateToRmb).div(2).toDecimalPlaces(8)
        : undefined;

    return {
      provider,
      available: Boolean(merchantBuyRateToRmb),
      merchantBuyRateToRmb,
      merchantSellRateToRmb,
      midRateToRmb,
      adCount: merchantBuyAds.length + merchantSellAds.length,
      usedAdCount: usableBuyAds.length + usableSellAds.length,
      errorMessage: merchantBuyRateToRmb ? undefined : `${provider} P2P buy quote unavailable`
    };
  }

  private buildP2pErrorQuote(provider: string, error: unknown): P2pProviderQuote {
    return {
      provider,
      available: false,
      adCount: 0,
      usedAdCount: 0,
      errorMessage: this.toErrorMessage(error)
    };
  }

  private filterAdsByAmount(
    ads: P2pAdQuote[],
    targetAmountRmb: PrismaNamespace.Decimal | null
  ) {
    const pricedAds = ads.filter((ad) => ad.price.greaterThan(0));

    if (!targetAmountRmb || targetAmountRmb.lessThanOrEqualTo(0)) {
      return pricedAds.slice(0, 5);
    }

    const matched = pricedAds.filter((ad) => {
      if (ad.minAmountRmb && targetAmountRmb.lessThan(ad.minAmountRmb)) {
        return false;
      }

      if (ad.maxAmountRmb && targetAmountRmb.greaterThan(ad.maxAmountRmb)) {
        return false;
      }

      return true;
    });

    return (matched.length ? matched : pricedAds).slice(0, 5);
  }

  private buildAvailableQuote(input: {
    paidCurrency: PaidCurrency;
    rawRateToRmb: PrismaNamespace.Decimal;
    bufferPercent: PrismaNamespace.Decimal;
    source: QuoteSource;
    provider: string;
    collectedAt: string;
    ttlMs: number;
    merchantBuyRateToRmb?: PrismaNamespace.Decimal;
    merchantSellRateToRmb?: PrismaNamespace.Decimal;
    midRateToRmb?: PrismaNamespace.Decimal;
    p2pQuotes?: OrderEntryP2pProviderQuoteResponse[];
  }): OrderEntryExchangeRateQuoteResponse {
    const rateToRmb = this.applyBuffer(input.rawRateToRmb, input.bufferPercent);

    return {
      paidCurrency: input.paidCurrency,
      available: true,
      rateToRmb: this.toRateString(rateToRmb),
      rawRateToRmb: this.toRateString(input.rawRateToRmb),
      bufferPercent: this.toPercentString(input.bufferPercent),
      source: input.source,
      provider: input.provider,
      collectedAt: input.collectedAt,
      expiresAt: new Date(Date.now() + input.ttlMs).toISOString(),
      merchantBuyRateToRmb: input.merchantBuyRateToRmb
        ? this.toRateString(input.merchantBuyRateToRmb)
        : undefined,
      merchantSellRateToRmb: input.merchantSellRateToRmb
        ? this.toRateString(input.merchantSellRateToRmb)
        : undefined,
      midRateToRmb: input.midRateToRmb ? this.toRateString(input.midRateToRmb) : undefined,
      p2pQuotes: input.p2pQuotes
    };
  }

  private buildUnavailableQuote(
    paidCurrency: PaidCurrency,
    source: QuoteSource,
    provider: string,
    bufferPercent: PrismaNamespace.Decimal,
    error: unknown
  ): OrderEntryExchangeRateQuoteResponse {
    const now = new Date().toISOString();

    return {
      paidCurrency,
      available: false,
      rateToRmb: '0',
      rawRateToRmb: '0',
      bufferPercent: this.toPercentString(bufferPercent),
      source,
      provider,
      collectedAt: now,
      expiresAt: now,
      errorMessage: this.toErrorMessage(error)
    };
  }

  private toP2pQuoteResponse(quote: P2pProviderQuote): OrderEntryP2pProviderQuoteResponse {
    return {
      provider: quote.provider,
      available: quote.available,
      merchantBuyRateToRmb: quote.merchantBuyRateToRmb
        ? this.toRateString(quote.merchantBuyRateToRmb)
        : undefined,
      merchantSellRateToRmb: quote.merchantSellRateToRmb
        ? this.toRateString(quote.merchantSellRateToRmb)
        : undefined,
      midRateToRmb: quote.midRateToRmb ? this.toRateString(quote.midRateToRmb) : undefined,
      adCount: quote.adCount,
      usedAdCount: quote.usedAdCount,
      errorMessage: quote.errorMessage
    };
  }

  private async getBufferPercent(paidCurrency: PaidCurrency) {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: EXCHANGE_RATE_SETTINGS_KEY }
    });
    const value = parameter?.value as ExchangeRateSettings | null | undefined;
    const bufferValue =
      value?.buffers?.[paidCurrency] ?? value?.bufferPercentByCurrency?.[paidCurrency] ?? 0;
    const bufferPercent = this.toDecimal(bufferValue, 'bufferPercent');

    if (bufferPercent.lessThan(0)) {
      return new PrismaNamespace.Decimal(0);
    }

    if (bufferPercent.greaterThan(50)) {
      return new PrismaNamespace.Decimal(50);
    }

    return bufferPercent.toDecimalPlaces(4);
  }

  private applyBuffer(rateToRmb: PrismaNamespace.Decimal, bufferPercent: PrismaNamespace.Decimal) {
    if (bufferPercent.lessThanOrEqualTo(0)) {
      return rateToRmb.toDecimalPlaces(8);
    }

    const multiplier = new PrismaNamespace.Decimal(1).minus(bufferPercent.div(100));
    const buffered = rateToRmb.mul(multiplier).toDecimalPlaces(8);

    return buffered.greaterThan(0) ? buffered : rateToRmb.toDecimalPlaces(8);
  }

  private normalizePaidCurrency(value: string | undefined): PaidCurrency {
    const normalized = (value || 'CNY').trim().toUpperCase();

    if (SUPPORTED_PAID_CURRENCIES.includes(normalized as PaidCurrency)) {
      return normalized as PaidCurrency;
    }

    throw new BadRequestException('paidCurrency must be one of CNY, MYR, USD, USDT');
  }

  private normalizeOptionalDecimal(value: string | number | undefined) {
    if (value === undefined || value === '') {
      return null;
    }

    const decimal = this.toDecimal(value, 'targetAmountRmb');

    return decimal.greaterThan(0) ? decimal : null;
  }

  private toPositiveDecimal(value: string | number | undefined, fieldName: string) {
    const decimal = this.toDecimal(value, fieldName);

    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(`${fieldName} must be greater than 0`);
    }

    return decimal;
  }

  private toNullableDecimal(value: string | number | null | undefined) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const decimal = this.toDecimal(value, 'amount');

    return decimal.greaterThanOrEqualTo(0) ? decimal : null;
  }

  private toDecimal(value: string | number | null | undefined, fieldName: string) {
    try {
      return new PrismaNamespace.Decimal(value ?? 0);
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid decimal`);
    }
  }

  private minDecimal(values: PrismaNamespace.Decimal[]) {
    return values.reduce((min, value) => (value.lessThan(min) ? value : min));
  }

  private maxDecimal(values: PrismaNamespace.Decimal[]) {
    return values.reduce((max, value) => (value.greaterThan(max) ? value : max));
  }

  private toRateString(value: PrismaNamespace.Decimal) {
    return value.toDecimalPlaces(8).toString();
  }

  private toPercentString(value: PrismaNamespace.Decimal) {
    return value.toDecimalPlaces(4).toString();
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await this.fetcher(url, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': this.getUserAgent(),
          ...(init?.headers ?? {})
        }
      });

      if (!response.ok) {
        throw new BadRequestException(`Exchange rate provider returned ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getUserAgent() {
    return 'apple-id-business-system/0.1 exchange-rate-quote';
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Exchange rate quote failed';
  }
}
