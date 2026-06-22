import { ElMessageBox } from 'element-plus';

export type ConfirmActionRisk = 'normal' | 'strong';

export interface ConfirmActionOptions {
  title: string;
  description: string;
  actionName?: string;
  impact?: string | string[];
  expectedCount?: string | number;
  riskNotes?: string | string[];
  irreversible?: boolean;
  requireText?: string;
  risk?: ConfirmActionRisk;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export async function confirmAction(options: ConfirmActionOptions) {
  const risk = options.risk ?? 'normal';
  const message = buildConfirmActionMessage(options);
  const confirmButtonText = options.confirmButtonText ?? (risk === 'strong' ? '确认执行' : '确认');
  const cancelButtonText = options.cancelButtonText ?? '取消';

  try {
    if (options.requireText) {
      const result = await ElMessageBox.prompt(message, options.title, {
        type: risk === 'strong' ? 'warning' : 'info',
        confirmButtonText,
        cancelButtonText,
        inputPlaceholder: `请输入「${options.requireText}」`,
        inputValidator: (value) =>
          value === options.requireText || `请输入「${options.requireText}」后继续`
      });
      return result.value === options.requireText;
    }

    await ElMessageBox.confirm(message, options.title, {
      type: risk === 'strong' ? 'warning' : 'info',
      confirmButtonText,
      cancelButtonText,
      distinguishCancelAndClose: true
    });
    return true;
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return false;
    }
    throw error;
  }
}

function buildConfirmActionMessage(options: ConfirmActionOptions) {
  const lines = [options.description.trim()];

  if (options.actionName) {
    lines.push(`操作名称：${options.actionName}`);
  }
  if (options.expectedCount !== undefined && options.expectedCount !== '') {
    lines.push(`预计数量：${options.expectedCount}`);
  }
  lines.push(...buildSectionLines('影响范围', options.impact));
  lines.push(...buildSectionLines('失败风险', options.riskNotes));
  lines.push(`是否可撤销：${options.irreversible ? '通常不可撤销' : '可返回或按业务规则恢复'}`);
  if (options.requireText) {
    lines.push(`继续前需要输入：${options.requireText}`);
  }

  return lines.filter(Boolean).join('\n');
}

function buildSectionLines(title: string, value?: string | string[]) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  if (!items.length) return [];
  if (items.length === 1) return [`${title}：${items[0]}`];
  return [`${title}：`, ...items.map((item) => `- ${item}`)];
}
