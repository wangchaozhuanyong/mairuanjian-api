import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@RequirePermissions('system.user_manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.usersService.listUsers({
      page,
      pageSize,
      keyword,
      status,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.usersService.getUserDetail(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.usersService.createUser(dto, operator);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.usersService.updateUser(id, dto, operator);
  }
}
