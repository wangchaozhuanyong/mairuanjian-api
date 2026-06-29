<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-heading">
        <p class="eyebrow">Admin</p>
        <h1>代充管理后台</h1>
      </div>

      <el-form
        id="admin-login-form"
        ref="formRef"
        :model="form"
        :rules="rules"
        :aria-busy="loading"
        :aria-describedby="loginError ? 'login-error-message' : undefined"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item prop="username">
          <template #label>
            <FieldHelpLabel
              label="账号"
              purpose="后台登录账号，由管理员在员工账号里创建。"
              example="输入你的后台用户名，例如 kefu01 或 admin。"
            />
          </template>
          <el-input
            v-model.trim="form.username"
            autocomplete="username"
            maxlength="80"
            name="username"
          />
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
            maxlength="160"
            name="password"
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
            inputmode="numeric"
            maxlength="64"
            name="one-time-code"
            placeholder="未绑定 MFA 可留空"
          />
        </el-form-item>
        <div
          v-if="loginError"
          id="login-error-message"
          class="login-error"
          role="alert"
          aria-live="assertive"
        >
          <strong>登录失败</strong>
          <span>{{ loginError }}</span>
        </div>
        <AppButton
          variant="primary"
          class="full-button"
          native-type="submit"
          :disabled="loading"
          :loading="loading"
        >
          登录
        </AppButton>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
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
  if (loading.value) {
    return;
  }

  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  loading.value = true;
  loginError.value = '';
  try {
    await authStore.login(form.username, form.password, form.mfaCode || undefined);
    await router.push(getLoginRedirectPath());
  } catch (error) {
    loginError.value = getLoginErrorMessage(error);
    ElMessage.error(loginError.value);
  } finally {
    loading.value = false;
  }
}

function getLoginRedirectPath() {
  const redirect = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect;

  if (
    typeof redirect === 'string' &&
    redirect.startsWith('/') &&
    !redirect.startsWith('//') &&
    redirect !== '/login'
  ) {
    return redirect;
  }

  return '/dashboard';
}

function getLoginErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error);

  if (message.includes('登录状态无效') || message.includes('登录状态已过期')) {
    return '账号、密码或动态验证码不正确，请检查后重试。';
  }

  return message;
}

watch(
  () => [form.username, form.password, form.mfaCode],
  () => {
    loginError.value = '';
  }
);
</script>
