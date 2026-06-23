import type { AutomationTaskPriority } from '@prisma/client';

export interface BatchBalanceCheckDto {
  appleAccountIds: string[];
  priority?: AutomationTaskPriority;
  note?: string | null;
}
