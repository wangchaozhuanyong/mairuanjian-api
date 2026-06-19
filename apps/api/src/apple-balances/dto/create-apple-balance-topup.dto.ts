export interface CreateAppleBalanceTopupDto {
  faceValue: string | number;
  costAmount: string | number;
  giftCardCode?: string | null;
  remark?: string | null;
}
