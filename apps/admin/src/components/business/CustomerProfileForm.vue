<template>
  <el-form ref="formRef" :model="modelValue" :rules="rules" label-position="top">
    <el-form-item prop="name">
      <template #label>
        <FieldHelpLabel
          label="客户名称"
          purpose="用来识别这个客户，后续查订单、续费和售后都会显示这个名字。"
          example="可以填微信昵称、客户真实称呼或你内部习惯的备注名。"
        />
      </template>
      <el-input
        :model-value="modelValue.name"
        @update:model-value="updateTextField('name', $event)"
      />
    </el-form-item>
    <el-form-item>
      <template #label>
        <FieldHelpLabel
          :label="editing ? '手机号（留空不修改）' : '手机号'"
          purpose="保存客户联系方式，默认会脱敏展示，查看完整手机号需要权限和原因。"
          example="新客户可以填完整手机号；编辑客户时不想改手机号就留空。"
        />
      </template>
      <el-input
        :model-value="modelValue.phone"
        placeholder="保存后列表脱敏展示"
        @update:model-value="updateTextField('phone', $event)"
      />
    </el-form-item>
    <el-form-item>
      <template #label>
        <FieldHelpLabel
          label="微信"
          purpose="记录客户微信号或微信备注，方便客服联系和订单回访。"
          example="可以填微信号 wx123，也可以填你微信里的备注名。"
        />
      </template>
      <el-input
        :model-value="modelValue.wechat"
        @update:model-value="updateTextField('wechat', $event)"
      />
    </el-form-item>
    <el-form-item>
      <template #label>
        <FieldHelpLabel
          label="来源平台"
          purpose="标记客户最早从哪里来，方便统计客户来源和后续平台对账。"
          example="从闲鱼加来的选闲鱼，从淘宝来的选淘宝，老客户转介绍可选对应自定义平台。"
        />
      </template>
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
    <el-form-item>
      <template #label>
        <FieldHelpLabel
          label="标签"
          purpose="给客户打分类标签，方便搜索、分组和后续运营。"
          example="可以填老客户、高频续费、企业客户、重点跟进。"
        />
      </template>
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
    <el-form-item>
      <template #label>
        <FieldHelpLabel
          label="状态"
          purpose="标记客户是否还能正常服务，停用后可提醒员工谨慎处理。"
          example="正常客户选启用；拉黑、纠纷或不再服务的客户选停用。"
        />
      </template>
      <el-radio-group :model-value="modelValue.status" @update:model-value="updateStatus">
        <el-radio-button value="active">启用</el-radio-button>
        <el-radio-button value="disabled">停用</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item>
      <template #label>
        <FieldHelpLabel
          label="备注"
          purpose="记录这个客户的长期补充信息，方便不同员工接手。"
          example="可以写偏好、沟通注意点、历史问题或特殊折扣。"
        />
      </template>
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
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
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
