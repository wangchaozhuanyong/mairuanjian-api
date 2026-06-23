import {
  appleAccountSourceChannelsApi,
  appleAccountsApi,
  appleServicesApi,
  codeServicesApi,
  customersApi,
  messageTemplatesApi,
  rolesApi,
  sourcePlatformsApi,
  userTableViewsApi
} from '@/api/system';
import type {
  AppleAccountQuery,
  AppleAccountSourceChannelQuery,
  AppleServiceQuery,
  CodeServiceQuery,
  CustomerQuery,
  MessageTemplateQuery,
  SourcePlatformQuery,
  UserTableViewQuery
} from '@/api/system';
import type {
  AppleAccount,
  AppleAccountSourceChannel,
  AppleService,
  CodeService,
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
  signal?: AbortSignal;
  staleMs?: number;
  trackActivity?: boolean;
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
    (signal) => sourcePlatformsApi.list(params, { signal }),
    options
  );
}

export function loadSmartAppleAccountSourceChannels(
  params: AppleAccountSourceChannelQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<AppleAccountSourceChannel>>(
    'apple-account-source-channels',
    params,
    (signal) => appleAccountSourceChannelsApi.list(params, { signal }),
    options
  );
}

export function loadSmartCustomers(params: CustomerQuery, options: SmartSystemQueryOptions = {}) {
  return loadSmartSystemQuery<PageResult<Customer>>(
    'customers',
    params,
    (signal) => customersApi.list(params, { signal }),
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
    (signal) => messageTemplatesApi.list(params, { signal }),
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
    (signal) => appleAccountsApi.list(params, { signal }),
    options
  );
}

export function loadSmartAppleServices(
  params: AppleServiceQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<AppleService>>(
    'apple-services',
    params,
    (signal) => appleServicesApi.list(params, { signal }),
    options
  );
}

export function loadSmartCodeServices(
  params: CodeServiceQuery,
  options: SmartSystemQueryOptions = {}
) {
  return loadSmartSystemQuery<PageResult<CodeService>>(
    'code-services',
    params,
    (signal) => codeServicesApi.list(params, { signal }),
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
  fetcher: (signal?: AbortSignal) => Promise<TData>,
  options: SmartSystemQueryOptions
) {
  const result = await refreshSmartQuery<TData>({
    key: createSmartQueryKey(scope, params),
    fetcher: ({ signal }) => fetcher(options.signal ?? signal),
    force: options.force ?? false,
    dedupeMs: options.dedupeMs,
    staleMs: options.staleMs,
    trackActivity: options.trackActivity
  });

  return result.data;
}
