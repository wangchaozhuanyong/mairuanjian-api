export type AutomationTaskManualInputType =
  | 'verification_code'
  | 'captcha'
  | 'device_confirmation'
  | 'note';

export interface SubmitManualInputDto {
  inputType?: AutomationTaskManualInputType;
  value: string;
  note?: string | null;
}
