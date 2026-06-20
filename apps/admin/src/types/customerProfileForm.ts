export interface CustomerProfileFormModel {
  name: string;
  phone: string;
  wechat: string;
  sourcePlatformId: string;
  tags: string[];
  remark: string;
  status: 'active' | 'disabled';
}
