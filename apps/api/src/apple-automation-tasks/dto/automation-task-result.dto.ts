import type { AutomationTaskStatus } from '@prisma/client';

export interface AutomationTaskResultDto {
  status?: Extract<AutomationTaskStatus, 'success' | 'failed' | 'need_review'>;
  resultPayload?: Record<string, unknown> | null;
  screenshotAttachmentId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}
