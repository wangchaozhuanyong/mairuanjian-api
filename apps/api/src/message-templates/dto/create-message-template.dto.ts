import type { MessageTemplateStatus } from '@prisma/client';

export interface CreateMessageTemplateDto {
  name: string;
  type?: 'delivery';
  channel?: 'customer_service';
  content: string;
  variables?: string[];
  status?: MessageTemplateStatus;
  remark?: string | null;
}
