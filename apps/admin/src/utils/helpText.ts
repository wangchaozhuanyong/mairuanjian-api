export type HelpTextValue = string | string[] | undefined | null;

export interface HelpTextInput {
  description: string;
  suggestion?: string;
  example?: string;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function ensurePrefix(prefix: string, value: string) {
  const text = cleanText(value);
  if (!text) return '';
  return text.startsWith(prefix) ? text : `${prefix}${text}`;
}

export function buildHelpText(input: HelpTextInput): string[] {
  const description = ensurePrefix('说明：', input.description);
  const suggestion = ensurePrefix(
    '建议：',
    input.suggestion ?? '先确认筛选范围和状态，再处理需要操作的记录。'
  );
  const example = ensurePrefix(
    '举例：',
    input.example ?? '例如先筛出待处理记录，核对信息无误后再执行保存、导出或发货。'
  );

  return [description, suggestion, example].filter(Boolean);
}

export function normalizeHelpText(value: HelpTextValue): string[] {
  const rawItems = Array.isArray(value) ? value : [value ?? ''];
  const items = rawItems.map((item) => cleanText(String(item))).filter(Boolean);

  if (items.length === 0) return [];
  if (items.some((item) => item.startsWith('说明：'))) return items;

  return buildHelpText({
    description: items[0] ?? '',
    suggestion: items[1],
    example: items[2]
  });
}

export function buildFieldHelpText(label: string, purpose?: string, example?: string): string[] {
  return buildHelpText({
    description: purpose ? `${label}：${purpose}` : `${label}用于当前表单的业务判断和后续追踪。`,
    suggestion: '按真实业务情况填写；不确定时先留空或询问负责人，不要随便编一个值。',
    example: example
      ? `${label}可以填：${example}`
      : `填写${label}后，列表和详情页会按这个值展示或筛选。`
  });
}

export function buildRouteHelpText(title: string, description: string, group: string): string[] {
  return buildHelpText({
    description: `${title}：${description}`,
    suggestion: `这是${group}里的功能页，先看状态、筛选条件和右上角操作，再处理真实业务。`,
    example: `例如进入${title}后，先筛选待处理或异常记录，再逐条核对后操作。`
  });
}
