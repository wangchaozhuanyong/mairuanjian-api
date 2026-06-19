import type {
  MessageTemplateChannel,
  MessageTemplateStatus,
  MessageTemplateType
} from '@prisma/client';

export interface UpdateMessageTemplateDto {
  name?: string;
  type?: MessageTemplateType;
  channel?: MessageTemplateChannel;
  content?: string;
  variables?: string[];
  status?: MessageTemplateStatus;
  remark?: string | null;
}
