import {
  appleAccountsApi,
  customersApi,
  messageTemplatesApi,
  rolesApi,
  sourcePlatformsApi,
  userTableViewsApi
} from '@/api/system';
import type {
  AppleAccountQuery,
  CustomerQuery,
  MessageTemplateQuery,
  SourcePlatformQuery,
  UserTableViewQuery
} from '@/api/system';
import type {
  AppleAccount,
  Customer,
  MessageTemplate,
  PageResult,
  Permission,
  Role,
  SourcePlatform,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, refreshSmartQuery } from '@/utils/smartQuery';

export interface SmartSystemQueryOptions {
  force?: boolean;
  dedupeMs?: number;
  staleMs?: number;
}

export function loadSmartUserTableViews(
  params: UserTableViewQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<UserTableView>>(
    'user-table-views',
    params,
    () => userTableViewsApi.list(params),
    options
  );
}

export function loadSmartSourcePlatforms(
  params: SourcePlatformQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<SourcePlatform>>(
    'source-platforms',
    params,
    () => sourcePlatformsApi.list(params),
    options
  );
}

export function loadSmartCustomers(params: CustomerQuery, options: SmartSystemQueryOptions = {}) {
  return loadSmartSystemQuery<PageResult<Customer>>(
    'customers',
    params,
    () => customersApi.list(params),
    options
  );
}

export function loadSmartMessageTemplates(
  params: MessageTemplateQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<MessageTemplate>>(
    'message-templates',
    params,
    () => messageTemplatesApi.list(params),
    options
  );
}

export function loadSmartAppleAccounts(
  params: AppleAccountQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<AppleAccount>>(
    'apple-accounts',
    params,
    () => appleAccountsApi.list(params),
    options
  );
}

export function loadSmartRoles(options: SmartSystemQueryOptions = {}) {
  return loadSmartSystemQuery<Role[]>('system-user-roles', {}, () => rolesApi.listRoles(), options);
}

export function loadSmartRolesAndPermissions(options: SmartSystemQueryOptions = {}) {
  return loadSmartSystemQuery<{ roles: Role[]; permissions: Permission[] }>(
    'system-roles',
    {},
    async () => {
      const [roles, permissions] = await Promise.all([
        rolesApi.listRoles(),
        rolesApi.listPermissions()
      ]);

      return {
        roles,
        permissions
      };
    },
    options
  );
}

async function loadSmartSystemQuery<TData>(
  scope: string,
  params: unknown,
  fetcher: () => Promise<TData>,
  options: SmartSystemQueryOptions
) {
  const result = await refreshSmartQuery({
    key: createSmartQueryKey(scope, params),
    fetcher,
    force: options.force ?? false,
    dedupeMs: options.dedupeMs,
    staleMs: options.staleMs
  });

  return result.data;
}
