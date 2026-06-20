import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { RevealCustomerPhoneDto } from './dto/reveal-customer-phone.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

interface RequestWithAuditMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('customer.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('sourcePlatformId') sourcePlatformId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.customersService.list({
      page,
      pageSize,
      keyword,
      status,
      sourcePlatformId,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('customer.view')
  get(@Param('id') id: string) {
    return this.customersService.get(id);
  }

  @Post()
  @RequirePermissions('customer.create')
  async create(@Body() dto: CreateCustomerDto, @CurrentUser() operator?: AuthenticatedUser) {
    const customer = await this.customersService.create(dto, operator);
    this.publishCustomerEvent('common.customer.created', 'created', customer.id);
    return customer;
  }

  @Patch(':id')
  @RequirePermissions('customer.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const customer = await this.customersService.update(id, dto, operator);
    this.publishCustomerEvent('common.customer.updated', 'updated', customer.id);
    return customer;
  }

  @Post(':id/reveal-phone')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('customer.view')
  revealPhone(
    @Param('id') id: string,
    @Body() dto: RevealCustomerPhoneDto,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Req() request: RequestWithAuditMeta
  ) {
    return this.customersService.revealPhone(id, dto, operator, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
  }

  @Delete(':id')
  @RequirePermissions('customer.delete')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.customersService.remove(id, operator);
    this.publishCustomerEvent('common.customer.deleted', 'deleted', id);
    return result;
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.join(', ') : value;
  }

  private publishCustomerEvent(type: string, action: string, customerId: string) {
    this.realtimeService.publish({
      type,
      module: 'common',
      entity: 'customer',
      action,
      resourceId: customerId,
      scope: {
        customerId
      }
    });
  }
}
