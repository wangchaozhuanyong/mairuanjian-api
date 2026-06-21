<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-heading">
        <p class="eyebrow">Admin</p>
        <h1>代充管理后台</h1>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @keyup.enter="submit"
      >
        <el-form-item prop="username">
          <template #label>
            <FieldHelpLabel
              label="账号"
              purpose="后台登录账号，由管理员在员工账号里创建。"
              example="输入你的后台用户名，例如 kefu01 或 admin。"
            />
          </template>
          <el-input v-model.trim="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item prop="password">
          <template #label>
            <FieldHelpLabel
              label="密码"
              purpose="后台登录密码，用来验证账号身份。"
              example="输入管理员分配或你自己设置的后台密码。"
            />
          </template>
          <el-input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>
        <el-form-item prop="mfaCode">
          <template #label>
            <FieldHelpLabel
              label="动态验证码 / 恢复码"
              purpose="账号启用 MFA 后需要填写，用于第二步安全验证。"
              example="输入验证器 App 的 6 位动态码；没绑定 MFA 可以留空。"
            />
          </template>
          <el-input
            v-model.trim="form.mfaCode"
            autocomplete="one-time-code"
            placeholder="未绑定 MFA 可留空"
          />
        </el-form-item>
        <div v-if="loginError" class="login-error" role="alert">
          <strong>登录失败</strong>
          <span>{{ loginError }}</span>
        </div>
        <AppButton variant="primary" class="full-button" :loading="loading" @click="submit">
          登录
        </AppButton>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const loginError = ref('');

const form = reactive({
  username: '',
  password: '',
  mfaCode: ''
});

const rules: FormRules<typeof form> = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  loading.value = true;
  loginError.value = '';
  try {
    await authStore.login(form.username, form.password, form.mfaCode || undefined);
    await router.push('/dashboard');
  } catch (error) {
    loginError.value = getApiErrorMessage(error);
    ElMessage.error(loginError.value);
  } finally {
    loading.value = false;
  }
}
</script>
