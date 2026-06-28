import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import type { OrderEntryExchangeRateQueryDto } from './dto/order-entry-exchange-rate-query.dto';
import { ExchangeRatesService } from './exchange-rates.service';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get('order-entry-quote')
  @RequirePermissions('apple.order.create')
  getOrderEntryQuote(@Query() query: OrderEntryExchangeRateQueryDto) {
    return this.exchangeRatesService.getOrderEntryQuote(query);
  }
}
