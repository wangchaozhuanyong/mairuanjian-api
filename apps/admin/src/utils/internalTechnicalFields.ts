const internalTechnicalFieldLabels: Record<string, string> = {
  id: '内部 ID',
  taskId: '任务 ID',
  jobId: 'Job ID',
  jobKey: 'Job Key',
  queueJobId: '队列 ID',
  requestId: '请求 ID',
  traceId: '追踪 ID',
  errorCode: '错误码',
  slug: '内部编码'
};

export type TechnicalFieldRow = {
  key: string;
  label: string;
  value: string;
};

export function isInternalTechnicalField(field: string) {
  return Object.prototype.hasOwnProperty.call(internalTechnicalFieldLabels, field);
}

export function getInternalTechnicalFieldLabel(field: string) {
  return internalTechnicalFieldLabels[field] ?? field;
}

export function buildTechnicalFieldRows(fields: Record<string, unknown>): TechnicalFieldRow[] {
  return Object.entries(fields)
    .filter(([key, value]) => isInternalTechnicalField(key) && hasTechnicalFieldValue(value))
    .map(([key, value]) => ({
      key,
      label: getInternalTechnicalFieldLabel(key),
      value: String(value)
    }));
}

function hasTechnicalFieldValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  return String(value).trim().length > 0;
}
