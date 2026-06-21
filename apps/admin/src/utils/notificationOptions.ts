import {
  NOTIFICATION_CHANNEL_DICTIONARY_GROUP,
  NOTIFICATION_LEVEL_DICTIONARY_GROUP,
  NOTIFICATION_MODULE_DICTIONARY_GROUP
} from '@/config/quickSettings';
import type { DataDictionary, NotificationLevel, NotificationLog } from '@/types/system';

export type NotificationChannel = NotificationLog['channel'];

export type NotificationModuleOption = {
  value: string;
  label: string;
};

export type NotificationLevelOption = {
  value: NotificationLevel;
  label: string;
};

export type NotificationChannelOption = {
  value: NotificationChannel;
  label: string;
};

export type NotificationQuickOptionGroupKey = 'module' | 'level' | 'channel';

export type NotificationQuickOptionGroupConfig = {
  key: NotificationQuickOptionGroupKey;
  title: string;
  group: string;
  help: string[];
};

export const notificationQuickOptionGroups: NotificationQuickOptionGroupConfig[] = [
  {
    key: 'module',
    title: '通知模块',
    group: NOTIFICATION_MODULE_DICTIONARY_GROUP,
    help: [
      '这里管通知规则里“属于哪个模块”的下拉，比如 Apple ID、兑换码、平台接口。',
      '它主要方便员工筛选和判断消息来源，只支持改名称、排序和启停。'
    ]
  },
  {
    key: 'level',
    title: '通知级别',
    group: NOTIFICATION_LEVEL_DICTIONARY_GROUP,
    help: [
      '这里管通知严重程度，比如普通、警告、错误、严重。',
      '级别会影响员工处理优先级和 Telegram 过滤，所以只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'channel',
    title: '通知渠道',
    group: NOTIFICATION_CHANNEL_DICTIONARY_GROUP,
    help: [
      '这里管通知可以发到哪里，比如站内通知和 Telegram。',
      '渠道和后端发送能力绑定，所以只支持改显示名称、排序和启停。'
    ]
  }
];

export const defaultNotificationModules: NotificationModuleOption[] = [
  { value: 'apple', label: 'Apple ID' },
  { value: 'code', label: '兑换码' },
  { value: 'platform', label: '平台接口' },
  { value: 'security', label: '系统安全' },
  { value: 'ops', label: '运维' },
  { value: 'notification', label: '通知设置' }
];

export const defaultNotificationLevels: NotificationLevelOption[] = [
  { value: 'info', label: '普通' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'critical', label: '严重' }
];

export const defaultNotificationChannels: NotificationChannelOption[] = [
  { value: 'system', label: '站内通知' },
  { value: 'telegram', label: 'Telegram' }
];

const supportedNotificationModules = new Set(defaultNotificationModules.map((item) => item.value));
const supportedNotificationLevels = new Set<NotificationLevel>(
  defaultNotificationLevels.map((item) => item.value)
);
const supportedNotificationChannels = new Set<NotificationChannel>(
  defaultNotificationChannels.map((item) => item.value)
);

function buildDefaultDictionaries<T extends string>(
  group: string,
  options: Array<{ value: T; label: string }>,
  remark: string
) {
  return options.map((option, index) => ({
    group,
    code: option.value,
    label: option.label,
    value: option.value,
    sortOrder: index,
    status: 'active' as const,
    remark
  }));
}

function buildFixedOptions<T extends string>(
  dictionaries: DataDictionary[],
  isSupported: (value: string) => value is T,
  defaults: Array<{ value: T; label: string }>
) {
  const configured = dictionaries.filter((item): item is DataDictionary & { code: T } =>
    isSupported(item.code)
  );

  if (!configured.length) {
    return defaults;
  }

  return configured
    .filter((item) => item.status === 'active')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      value: item.code,
      label: item.label
    }));
}

function getFixedLabel<T extends string>(
  value: T,
  dictionaries: DataDictionary[],
  defaults: Array<{ value: T; label: string }>
) {
  const dictionary = dictionaries.find((item) => item.code === value);
  return dictionary?.label || defaults.find((item) => item.value === value)?.label || value;
}

export function isNotificationModule(value: string) {
  return supportedNotificationModules.has(value);
}

export function isNotificationLevel(value: string): value is NotificationLevel {
  return supportedNotificationLevels.has(value as NotificationLevel);
}

export function isNotificationChannel(value: string): value is NotificationChannel {
  return supportedNotificationChannels.has(value as NotificationChannel);
}

export function getDefaultNotificationModuleDictionaries() {
  return buildDefaultDictionaries(
    NOTIFICATION_MODULE_DICTIONARY_GROUP,
    defaultNotificationModules,
    '系统支持的通知模块，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultNotificationLevelDictionaries() {
  return buildDefaultDictionaries(
    NOTIFICATION_LEVEL_DICTIONARY_GROUP,
    defaultNotificationLevels,
    '系统支持的通知级别，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultNotificationChannelDictionaries() {
  return buildDefaultDictionaries(
    NOTIFICATION_CHANNEL_DICTIONARY_GROUP,
    defaultNotificationChannels,
    '系统支持的通知渠道，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultNotificationQuickOptionDictionaries(
  key: NotificationQuickOptionGroupKey
) {
  if (key === 'module') return getDefaultNotificationModuleDictionaries();
  if (key === 'level') return getDefaultNotificationLevelDictionaries();
  return getDefaultNotificationChannelDictionaries();
}

export function isNotificationQuickOptionCode(key: NotificationQuickOptionGroupKey, value: string) {
  if (key === 'module') return isNotificationModule(value);
  if (key === 'level') return isNotificationLevel(value);
  return isNotificationChannel(value);
}

export function buildNotificationModuleOptions(
  dictionaries: DataDictionary[]
): NotificationModuleOption[] {
  return buildFixedOptions(
    dictionaries,
    (value): value is string => isNotificationModule(value),
    defaultNotificationModules
  );
}

export function buildNotificationLevelOptions(
  dictionaries: DataDictionary[]
): NotificationLevelOption[] {
  return buildFixedOptions(dictionaries, isNotificationLevel, defaultNotificationLevels);
}

export function buildNotificationChannelOptions(
  dictionaries: DataDictionary[]
): NotificationChannelOption[] {
  return buildFixedOptions(dictionaries, isNotificationChannel, defaultNotificationChannels);
}

export function getNotificationModuleLabel(value: string, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultNotificationModules);
}

export function getNotificationLevelLabel(
  value: NotificationLevel,
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultNotificationLevels);
}

export function getNotificationChannelLabel(value: string, dictionaries: DataDictionary[]) {
  if (!isNotificationChannel(value)) {
    return value;
  }
  return getFixedLabel(value, dictionaries, defaultNotificationChannels);
}
