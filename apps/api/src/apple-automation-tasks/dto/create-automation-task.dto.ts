import type { AutomationTaskPriority, AutomationTaskType } from '@prisma/client';

export interface CreateAutomationTaskDto {
  taskType: AutomationTaskType;
  appleAccountId?: string | null;
  customerId?: string | null;
  serviceId?: string | null;
  activationId?: string | null;
  priority?: AutomationTaskPriority;
  inputPayload?: Record<string, unknown> | null;
}
