import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ListUserTableViewsQuery, SaveUserTableViewInput } from './user-table-views.service';
import { UserTableViewsService } from './user-table-views.service';

@Controller('user-table-views')
export class UserTableViewsController {
  constructor(private readonly userTableViewsService: UserTableViewsService) {}

  @Get()
  listViews(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('tableKey') tableKey?: string,
    @Query('keyword') keyword?: string
  ) {
    const query: ListUserTableViewsQuery = {
      page,
      pageSize,
      tableKey,
      keyword
    };
    return this.userTableViewsService.listViews(user, query);
  }

  @Post()
  createView(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveUserTableViewInput) {
    return this.userTableViewsService.createView(user, dto);
  }

  @Patch(':id')
  updateView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: Partial<SaveUserTableViewInput>
  ) {
    return this.userTableViewsService.updateView(user, id, dto);
  }

  @Delete(':id')
  removeView(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userTableViewsService.removeView(user, id);
  }

  @Post(':id/set-default')
  setDefault(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userTableViewsService.setDefault(user, id);
  }
}
