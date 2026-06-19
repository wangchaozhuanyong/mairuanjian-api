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
        <el-form-item label="账号" prop="username">
          <el-input v-model.trim="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>
        <el-form-item label="动态验证码 / 恢复码" prop="mfaCode">
          <el-input
            v-model.trim="form.mfaCode"
            autocomplete="one-time-code"
            placeholder="未绑定 MFA 可留空"
          />
        </el-form-item>
        <el-button type="primary" class="full-button" :loading="loading" @click="submit">
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

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
  try {
    await authStore.login(form.username, form.password, form.mfaCode || undefined);
    await router.push('/dashboard');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>
