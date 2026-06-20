<template>
  <el-form ref="formRef" :model="modelValue" :rules="rules" label-position="top">
    <el-form-item label="客户名称" prop="name">
      <el-input
        :model-value="modelValue.name"
        @update:model-value="updateTextField('name', $event)"
      />
    </el-form-item>
    <el-form-item :label="editing ? '手机号（留空不修改）' : '手机号'">
      <el-input
        :model-value="modelValue.phone"
        placeholder="保存后列表脱敏展示"
        @update:model-value="updateTextField('phone', $event)"
      />
    </el-form-item>
    <el-form-item label="微信">
      <el-input
        :model-value="modelValue.wechat"
        @update:model-value="updateTextField('wechat', $event)"
      />
    </el-form-item>
    <el-form-item label="来源平台">
      <el-select
        :model-value="modelValue.sourcePlatformId"
        class="full-input"
        clearable
        filterable
        @update:model-value="updateTextField('sourcePlatformId', $event)"
      >
        <el-option
          v-for="platform in sourcePlatforms"
          :key="platform.id"
          :label="platform.name"
          :value="platform.id"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="标签">
      <el-select
        class="full-input"
        multiple
        filterable
        allow-create
        default-first-option
        :model-value="modelValue.tags"
        @update:model-value="updateTags"
      >
        <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
      </el-select>
    </el-form-item>
    <el-form-item label="状态">
      <el-radio-group :model-value="modelValue.status" @update:model-value="updateStatus">
        <el-radio-button value="active">启用</el-radio-button>
        <el-radio-button value="disabled">停用</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="备注">
      <el-input
        :model-value="modelValue.remark"
        type="textarea"
        :rows="3"
        @update:model-value="updateTextField('remark', $event)"
      />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ref } from 'vue';
import type { CustomerProfileFormModel } from '@/types/customerProfileForm';
import type { SourcePlatform } from '@/types/system';

type TextField = Exclude<keyof CustomerProfileFormModel, 'tags' | 'status'>;

const props = withDefaults(
  defineProps<{
    modelValue: CustomerProfileFormModel;
    rules: FormRules<CustomerProfileFormModel>;
    sourcePlatforms: SourcePlatform[];
    tagOptions?: string[];
    editing?: boolean;
  }>(),
  {
    tagOptions: () => [],
    editing: false
  }
);
const emit = defineEmits<{
  'update:modelValue': [value: CustomerProfileFormModel];
}>();

const formRef = ref<FormInstance>();

function updateModel(patch: Partial<CustomerProfileFormModel>) {
  emit('update:modelValue', {
    ...props.modelValue,
    tags: [...props.modelValue.tags],
    ...patch
  });
}

function updateTextField(field: TextField, value: unknown) {
  updateModel({ [field]: String(value ?? '') } as Partial<CustomerProfileFormModel>);
}

function updateTags(value: unknown) {
  updateModel({ tags: Array.isArray(value) ? value.map((tag) => String(tag)) : [] });
}

function updateStatus(value: unknown) {
  updateModel({ status: value === 'disabled' ? 'disabled' : 'active' });
}

async function validate() {
  return formRef.value?.validate() ?? false;
}

function clearValidate() {
  formRef.value?.clearValidate();
}

defineExpose({
  validate,
  clearValidate
});
</script>
