export type AppleAccountSecretField =
  | 'appleId'
  | 'password'
  | 'securityInfo'
  | 'phone'
  | 'recoveryEmail';

export interface RevealAppleAccountSecretDto {
  field?: AppleAccountSecretField | string | null;
  reason?: string | null;
}
