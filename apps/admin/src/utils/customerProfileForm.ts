import type { SaveCustomerPayload } from '@/api/system';
import type { CustomerProfileFormModel } from '@/types/customerProfileForm';
import type { Customer } from '@/types/system';

type EmptyPhoneMode = 'null' | 'undefined';

export function createCustomerProfileFormModel(): CustomerProfileFormModel {
  return {
    name: '',
    phone: '',
    wechat: '',
    sourcePlatformId: '',
    tags: [],
    remark: '',
    status: 'active'
  };
}

export function resetCustomerProfileForm(form: CustomerProfileFormModel) {
  Object.assign(form, createCustomerProfileFormModel());
}

export function assignCustomerProfileForm(
  form: CustomerProfileFormModel,
  value: CustomerProfileFormModel
) {
  form.name = value.name;
  form.phone = value.phone;
  form.wechat = value.wechat;
  form.sourcePlatformId = value.sourcePlatformId;
  form.tags = [...value.tags];
  form.remark = value.remark;
  form.status = value.status;
}

export function fillCustomerProfileForm(form: CustomerProfileFormModel, customer: Customer) {
  form.name = customer.name;
  form.phone = '';
  form.wechat = customer.wechat ?? '';
  form.sourcePlatformId = customer.sourcePlatformId ?? '';
  form.tags = [...customer.tags];
  form.remark = customer.remark ?? '';
  form.status = customer.status;
}

export function buildCustomerProfilePayload(
  form: CustomerProfileFormModel,
  options: { emptyPhone?: EmptyPhoneMode } = {}
): SaveCustomerPayload {
  const phone = form.phone.trim();

  return {
    name: form.name.trim(),
    phone: phone || (options.emptyPhone === 'null' ? null : undefined),
    wechat: form.wechat.trim() || null,
    sourcePlatformId: form.sourcePlatformId || null,
    tags: [...new Set(form.tags.map((tag) => tag.trim()).filter(Boolean))],
    remark: form.remark.trim() || null,
    status: form.status
  };
}
