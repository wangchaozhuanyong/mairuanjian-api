import {
  APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP,
  APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP,
  APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP,
  APPLE_SERVICE_PLATFORM_FEE_TYPE_DICTIONARY_GROUP
} from '@/config/quickSettings';
import type { AppleService, AppleServicePlatformMapping, DataDictionary } from '@/types/system';

export type AppleServicePeriodTypeOption = {
  value: AppleService['defaultPeriodType'];
  label: string;
};

export type AppleServiceExpireCalcTypeOption = {
  value: AppleService['expireCalcType'];
  label: string;
};

export type AppleServiceLockRuleOption = {
  value: AppleService['lockRule'];
  label: string;
};

export type AppleServicePlatformFeeTypeOption = {
  value: AppleServicePlatformMapping['platformFeeType'];
  label: string;
};

export type AppleServiceQuickOptionGroupKey =
  | 'periodType'
  | 'expireCalcType'
  | 'lockRule'
  | 'platformFeeType';

export type AppleServiceQuickOptionGroupConfig = {
  key: AppleServiceQuickOptionGroupKey;
  title: string;
  group: string;
  help: string[];
};

export const appleServiceQuickOptionGroups: AppleServiceQuickOptionGroupConfig[] = [
  {
    key: 'periodType',
    title: '业务周期',
    group: APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP,
    help: [
      '这里管 Apple ID 业务设置里的业务周期，比如按月、按天、手工。',
      '这些值会影响订单到期时间，所以只能改显示名称、排序和启停。'
    ]
  },
  {
    key: 'expireCalcType',
    title: '到期计算',
    group: APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP,
    help: [
      '这里管订单提交后怎么计算到期时间，比如按月算、按天算、手工填。',
      '它和系统到期逻辑绑定，只支持改名称、排序和启停。'
    ]
  },
  {
    key: 'lockRule',
    title: '锁定规则',
    group: APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP,
    help: [
      '这里管订单选中 Apple ID 后怎么占住账号，避免重复使用。',
      '规则本身是系统流程，不允许新增系统不认识的规则。'
    ]
  },
  {
    key: 'platformFeeType',
    title: '平台手续费类型',
    group: APPLE_SERVICE_PLATFORM_FEE_TYPE_DICTIONARY_GROUP,
    help: [
      '这里管 Apple ID 平台映射里的手续费算法，比如无、比例、固定、混合。',
      '它会参与利润估算，所以只能改显示名称、排序和启停。'
    ]
  }
];

export const defaultAppleServicePeriodTypes: AppleServicePeriodTypeOption[] = [
  { value: 'month', label: '按月' },
  { value: 'day', label: '按天' },
  { value: 'manual', label: '手工' }
];

export const defaultAppleServiceExpireCalcTypes: AppleServiceExpireCalcTypeOption[] = [
  { value: 'by_month', label: '按月' },
  { value: 'by_day', label: '按天' },
  { value: 'manual', label: '手工' }
];

export const defaultAppleServiceLockRules: AppleServiceLockRuleOption[] = [
  { value: 'by_service', label: '按业务锁定' },
  { value: 'global', label: '全局锁定' }
];

export const defaultAppleServicePlatformFeeTypes: AppleServicePlatformFeeTypeOption[] = [
  { value: 'none', label: '无手续费' },
  { value: 'rate', label: '比例' },
  { value: 'fixed', label: '固定' },
  { value: 'mixed', label: '比例 + 固定' }
];

const supportedPeriodTypes = new Set<AppleService['defaultPeriodType']>(
  defaultAppleServicePeriodTypes.map((item) => item.value)
);
const supportedExpireCalcTypes = new Set<AppleService['expireCalcType']>(
  defaultAppleServiceExpireCalcTypes.map((item) => item.value)
);
const supportedLockRules = new Set<AppleService['lockRule']>(
  defaultAppleServiceLockRules.map((item) => item.value)
);
const supportedPlatformFeeTypes = new Set<AppleServicePlatformMapping['platformFeeType']>(
  defaultAppleServicePlatformFeeTypes.map((item) => item.value)
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
  const configured = dictionaries.filter(
    (item): item is DataDictionary & { code: T } => isSupported(item.code)
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

export function isAppleServicePeriodType(
  value: string
): value is AppleService['defaultPeriodType'] {
  return supportedPeriodTypes.has(value as AppleService['defaultPeriodType']);
}

export function isAppleServiceExpireCalcType(
  value: string
): value is AppleService['expireCalcType'] {
  return supportedExpireCalcTypes.has(value as AppleService['expireCalcType']);
}

export function isAppleServiceLockRule(value: string): value is AppleService['lockRule'] {
  return supportedLockRules.has(value as AppleService['lockRule']);
}

export function isAppleServicePlatformFeeType(
  value: string
): value is AppleServicePlatformMapping['platformFeeType'] {
  return supportedPlatformFeeTypes.has(value as AppleServicePlatformMapping['platformFeeType']);
}

export function getDefaultAppleServicePeriodTypeDictionaries() {
  return buildDefaultDictionaries(
    APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP,
    defaultAppleServicePeriodTypes,
    '系统支持的 Apple ID 业务周期，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultAppleServiceExpireCalcTypeDictionaries() {
  return buildDefaultDictionaries(
    APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP,
    defaultAppleServiceExpireCalcTypes,
    '系统支持的 Apple ID 到期计算方式，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultAppleServiceLockRuleDictionaries() {
  return buildDefaultDictionaries(
    APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP,
    defaultAppleServiceLockRules,
    '系统支持的 Apple ID 锁定规则，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultAppleServicePlatformFeeTypeDictionaries() {
  return buildDefaultDictionaries(
    APPLE_SERVICE_PLATFORM_FEE_TYPE_DICTIONARY_GROUP,
    defaultAppleServicePlatformFeeTypes,
    '系统支持的 Apple ID 平台手续费类型，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultAppleServiceQuickOptionDictionaries(
  key: AppleServiceQuickOptionGroupKey
) {
  if (key === 'periodType') return getDefaultAppleServicePeriodTypeDictionaries();
  if (key === 'expireCalcType') return getDefaultAppleServiceExpireCalcTypeDictionaries();
  if (key === 'lockRule') return getDefaultAppleServiceLockRuleDictionaries();
  return getDefaultAppleServicePlatformFeeTypeDictionaries();
}

export function isAppleServiceQuickOptionCode(
  key: AppleServiceQuickOptionGroupKey,
  value: string
) {
  if (key === 'periodType') return isAppleServicePeriodType(value);
  if (key === 'expireCalcType') return isAppleServiceExpireCalcType(value);
  if (key === 'lockRule') return isAppleServiceLockRule(value);
  return isAppleServicePlatformFeeType(value);
}

export function buildAppleServicePeriodTypeOptions(
  dictionaries: DataDictionary[]
): AppleServicePeriodTypeOption[] {
  return buildFixedOptions(dictionaries, isAppleServicePeriodType, defaultAppleServicePeriodTypes);
}

export function buildAppleServiceExpireCalcTypeOptions(
  dictionaries: DataDictionary[]
): AppleServiceExpireCalcTypeOption[] {
  return buildFixedOptions(
    dictionaries,
    isAppleServiceExpireCalcType,
    defaultAppleServiceExpireCalcTypes
  );
}

export function buildAppleServiceLockRuleOptions(
  dictionaries: DataDictionary[]
): AppleServiceLockRuleOption[] {
  return buildFixedOptions(dictionaries, isAppleServiceLockRule, defaultAppleServiceLockRules);
}

export function buildAppleServicePlatformFeeTypeOptions(
  dictionaries: DataDictionary[]
): AppleServicePlatformFeeTypeOption[] {
  return buildFixedOptions(
    dictionaries,
    isAppleServicePlatformFeeType,
    defaultAppleServicePlatformFeeTypes
  );
}

export function getAppleServicePeriodTypeLabel(
  value: AppleService['defaultPeriodType'],
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultAppleServicePeriodTypes);
}

export function getAppleServiceExpireCalcTypeLabel(
  value: AppleService['expireCalcType'],
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultAppleServiceExpireCalcTypes);
}

export function getAppleServiceLockRuleLabel(
  value: AppleService['lockRule'],
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultAppleServiceLockRules);
}

export function getAppleServicePlatformFeeTypeLabel(
  value: AppleServicePlatformMapping['platformFeeType'],
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultAppleServicePlatformFeeTypes);
}
