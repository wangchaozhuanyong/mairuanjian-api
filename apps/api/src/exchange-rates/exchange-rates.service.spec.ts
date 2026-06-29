import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ExchangeRatesService } from './exchange-rates.service';

function createResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data
  } as Response;
}

describe('ExchangeRatesService', () => {
  function createService(options?: { settings?: Record<string, unknown> | null }) {
    const prisma = {
      systemParameter: {
        findUnique: vi.fn().mockResolvedValue(
          options?.settings === undefined
            ? null
            : {
                value: options.settings
              }
        )
      }
    } as unknown as PrismaService;
    const service = new ExchangeRatesService(prisma);

    return { service, prisma };
  }

  it('converts free daily MYR rate to RMB and applies currency buffer', async () => {
    const { service } = createService({ settings: { buffers: { MYR: 1 } } });
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        provider: 'https://www.exchangerate-api.com',
        time_last_updated: 1782604801,
        rates: {
          CNY: 1,
          MYR: 0.604,
          USD: 0.147
        }
      })
    );
    service.setFetchImplementationForTest(fetcher as unknown as typeof fetch);

    const first = await service.getOrderEntryQuote({
      paidCurrency: 'MYR',
      targetAmountRmb: '100'
    });
    const second = await service.getOrderEntryQuote({
      paidCurrency: 'MYR',
      targetAmountRmb: '100'
    });

    expect(first.available).toBe(true);
    expect(first.source).toBe('free_daily');
    expect(first.rawRateToRmb).toBe(
      new Prisma.Decimal(1).div('0.604').toDecimalPlaces(8).toString()
    );
    expect(first.rateToRmb).toBe(
      new Prisma.Decimal(first.rawRateToRmb).mul('0.99').toDecimalPlaces(8).toString()
    );
    expect(first.bufferPercent).toBe('1');
    expect(second.rateToRmb).toBe(first.rateToRmb);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('parses OKX and Binance USDT P2P buy, sell and mid rates', async () => {
    const { service } = createService();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('binance')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { tradeType?: string };
        return createResponse({
          data: [
            {
              adv: {
                tradeType: body.tradeType === 'SELL' ? 'BUY' : 'SELL',
                price: body.tradeType === 'SELL' ? '6.80' : '6.90',
                minSingleTransAmount: '10',
                maxSingleTransAmount: '1000',
                tradeMethods: [{ identifier: 'BANK' }]
              }
            }
          ]
        });
      }

      if (url.includes('side=buy')) {
        return createResponse({
          data: {
            buy: [
              {
                price: '6.79',
                quoteMinAmountPerOrder: '10',
                quoteMaxAmountPerOrder: '1000',
                paymentMethods: []
              }
            ]
          }
        });
      }

      return createResponse({
        data: {
          sell: [
            {
              price: '6.91',
              quoteMinAmountPerOrder: '10',
              quoteMaxAmountPerOrder: '1000',
              paymentMethods: []
            }
          ]
        }
      });
    });
    service.setFetchImplementationForTest(fetcher as unknown as typeof fetch);

    const quote = await service.getOrderEntryQuote({
      paidCurrency: 'USDT',
      targetAmountRmb: '100'
    });

    expect(quote.available).toBe(true);
    expect(quote.source).toBe('p2p_otc');
    expect(quote.merchantBuyRateToRmb).toBe('6.79');
    expect(quote.merchantSellRateToRmb).toBe('6.91');
    expect(quote.midRateToRmb).toBe('6.85');
    expect(quote.rateToRmb).toBe('6.79');
    expect(quote.p2pQuotes).toHaveLength(2);
    expect(quote.p2pQuotes?.every((item) => item.available)).toBe(true);
  });

  it('returns unavailable quote when all USDT P2P providers fail', async () => {
    const { service } = createService();
    const fetcher = vi.fn().mockRejectedValue(new Error('network failed'));
    service.setFetchImplementationForTest(fetcher as unknown as typeof fetch);

    const quote = await service.getOrderEntryQuote({
      paidCurrency: 'USDT',
      targetAmountRmb: '100'
    });

    expect(quote.available).toBe(false);
    expect(quote.source).toBe('p2p_otc');
    expect(quote.rateToRmb).toBe('0');
    expect(quote.errorMessage).toContain('USDT OTC quote is unavailable');
  });

  it('uses fixed rate for CNY without calling external providers', async () => {
    const { service } = createService({ settings: { buffers: { CNY: 5 } } });
    const fetcher = vi.fn();
    service.setFetchImplementationForTest(fetcher as unknown as typeof fetch);

    const quote = await service.getOrderEntryQuote({ paidCurrency: 'CNY' });

    expect(quote.available).toBe(true);
    expect(quote.rateToRmb).toBe('1');
    expect(quote.source).toBe('fixed');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
