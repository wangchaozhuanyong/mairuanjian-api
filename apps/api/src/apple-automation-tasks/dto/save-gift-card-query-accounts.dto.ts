export type GiftCardQueryAccountStatus = 'ready' | 'disabled';

export interface SaveGiftCardQueryAccountDto {
  appleId: string;
  password: string;
  status?: GiftCardQueryAccountStatus;
  remark?: string | null;
}

export interface SaveGiftCardQueryAccountsDto {
  accounts: SaveGiftCardQueryAccountDto[];
}
