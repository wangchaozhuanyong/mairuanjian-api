import { CODE_DELIVERY_METHOD_DICTIONARY_GROUP } from '@/config/quickSettings';
import type { CodeDeliveryLog, DataDictionary } from '@/types/system';

export type CodeDeliveryMethodOption = {
  value: CodeDeliveryLog['deliveryMethod'];
  label: string;
};

export const defaultCodeDeliveryMethods: CodeDeliveryMethodOption[] = [
  { value: 'manual', label: '手工发货' },
  { value: 'eticket', label: '电子凭证' },
  { value: 'dummy_send', label: '虚拟无需物流' },
  { value: 'message_card', label: '消息卡片' }
];

const supportedDeliveryMethodValues = new Set<CodeDeliveryLog['deliveryMethod']>(
  defaultCodeDeliveryMethods.map((method) => method.value)
);

export function isCodeDeliveryMethod(value: string): value is CodeDeliveryLog['deliveryMethod'] {
  return supportedDeliveryMethodValues.has(value as CodeDeliveryLog['deliveryMethod']);
}

export function getDefaultCodeDeliveryMethodDictionaries() {
  return defaultCodeDeliveryMethods.map((method, index) => ({
    group: CODE_DELIVERY_METHOD_DICTIONARY_GROUP,
    code: method.value,
    label: method.label,
    value: method.value,
    sortOrder: index,
    status: 'active' as const,
    remark: '系统支持的兑换码发货方式，可在快捷设置里改名称、排序和启停'
  }));
}

export function buildCodeDeliveryMethodOptions(
  dictionaries: DataDictionary[]
): CodeDeliveryMethodOption[] {
  const configuredMethods = dictionaries.filter(
    (item): item is DataDictionary & { code: CodeDeliveryLog['deliveryMethod'] } =>
      isCodeDeliveryMethod(item.code)
  );

  if (!configuredMethods.length) {
    return defaultCodeDeliveryMethods;
  }

  return configuredMethods
    .filter((item) => item.status === 'active')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      value: item.code,
      label: item.label
    }));
}

export function getCodeDeliveryMethodLabel(
  method: CodeDeliveryLog['deliveryMethod'],
  dictionaries: DataDictionary[]
) {
  const dictionary = dictionaries.find((item) => item.code === method);
  return (
    dictionary?.label ||
    defaultCodeDeliveryMethods.find((item) => item.value === method)?.label ||
    method
  );
}
