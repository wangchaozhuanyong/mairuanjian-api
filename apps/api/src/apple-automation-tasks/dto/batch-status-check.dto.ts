import type { AutomationTaskPriority } from '@prisma/client';

export interface BatchStatusCheckDto {
  appleAccountIds: string[];
  priority?: AutomationTaskPriority;
  gatewayRegion?: string | null;
  note?: string | null;
}
