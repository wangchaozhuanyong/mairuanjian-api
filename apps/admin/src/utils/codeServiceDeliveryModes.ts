import { CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP } from '@/config/quickSettings';
import type { CodeService, DataDictionary } from '@/types/system';

export type CodeServiceDeliveryModeOption = {
  value: CodeService['deliveryMode'];
  label: string;
};

export const defaultCodeServiceDeliveryModes: CodeServiceDeliveryModeOption[] = [
  { value: 'auto', label: '自动' },
  { value: 'semi_auto', label: '半自动' },
  { value: 'manual', label: '手工' }
];

const supportedCodeServiceDeliveryModes = new Set<CodeService['deliveryMode']>(
  defaultCodeServiceDeliveryModes.map((mode) => mode.value)
);

export function isCodeServiceDeliveryMode(value: string): value is CodeService['deliveryMode'] {
  return supportedCodeServiceDeliveryModes.has(value as CodeService['deliveryMode']);
}

export function getDefaultCodeServiceDeliveryModeDictionaries() {
  return defaultCodeServiceDeliveryModes.map((mode, index) => ({
    group: CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP,
    code: mode.value,
    label: mode.label,
    value: mode.value,
    sortOrder: index,
    status: 'active' as const,
    remark: '系统支持的兑换码业务发货模式，可在快捷设置里改名称、排序和启停'
  }));
}

export function buildCodeServiceDeliveryModeOptions(
  dictionaries: DataDictionary[]
): CodeServiceDeliveryModeOption[] {
  const configuredModes = dictionaries.filter(
    (item): item is DataDictionary & { code: CodeService['deliveryMode'] } =>
      isCodeServiceDeliveryMode(item.code)
  );

  if (!configuredModes.length) {
    return defaultCodeServiceDeliveryModes;
  }

  return configuredModes
    .filter((item) => item.status === 'active')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      value: item.code,
      label: item.label
    }));
}

export function getCodeServiceDeliveryModeLabel(
  mode: CodeService['deliveryMode'],
  dictionaries: DataDictionary[]
) {
  const dictionary = dictionaries.find((item) => item.code === mode);
  return dictionary?.label || defaultCodeServiceDeliveryModes.find((item) => item.value === mode)?.label || mode;
}
