<template>
  <ElConfigProvider :locale="zhCn" :message="messageConfig">
    <RouterView />
    <Transition name="app-boot">
      <div
        v-if="showBootFallback"
        class="app-boot"
        :class="{ 'app-boot--pending': isRoutePending }"
        role="status"
        aria-live="polite"
      >
        <section class="app-boot__panel">
          <span class="app-boot__mark">ID</span>
          <div class="app-boot__copy">
            <strong>正在进入代充业务控制台</strong>
            <p>{{ bootMessage }}</p>
          </div>
          <div class="app-boot__bar" aria-hidden="true">
            <span />
          </div>
        </section>
      </div>
    </Transition>
  </ElConfigProvider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { ElConfigProvider } from 'element-plus/es/components/config-provider/index.mjs';
import { ElMessage } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs';
import { AUTH_SESSION_EXPIRED_EVENT } from '@/auth/session';
import { isRoutePending, router } from '@/router';
import { useRealtimeConnection } from '@/realtime/useRealtime';
import { useAuthStore } from '@/stores/auth';

const isRouterReady = ref(false);
const isBootVisible = ref(false);
const isSlowBoot = ref(false);
const authStore = useAuthStore();
const messageConfig = {
  duration: 2600,
  grouping: true,
  max: 2,
  offset: 16,
  placement: 'top-right',
  showClose: true
};

const bootDelayTimer = window.setTimeout(() => {
  isBootVisible.value = true;
}, 360);

const slowBootTimer = window.setTimeout(() => {
  isBootVisible.value = true;
  isSlowBoot.value = true;
}, 1200);

useRealtimeConnection();

function handleAuthSessionExpired(rawEvent: Event) {
  const event = rawEvent as CustomEvent<{ message?: string }>;
  const currentRoute = router.currentRoute.value;

  authStore.clearLocalSession();
  ElMessage.warning(event.detail?.message || '登录状态已过期，请重新登录。');

  if (currentRoute.path === '/login') {
    return;
  }

  void router
    .replace({
      path: '/login',
      query: currentRoute.fullPath === '/login' ? undefined : { redirect: currentRoute.fullPath }
    })
    .catch(() => undefined);
}

window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);

router
  .isReady()
  .catch(() => undefined)
  .finally(() => {
    isRouterReady.value = true;
    window.clearTimeout(bootDelayTimer);
    window.clearTimeout(slowBootTimer);
  });

const showBootFallback = computed(() => !isRouterReady.value && isBootVisible.value);
const bootMessage = computed(() =>
  isSlowBoot.value ? '正在连接登录状态和页面资源，请稍候。' : '加载页面结构和权限状态'
);

onBeforeUnmount(() => {
  window.clearTimeout(bootDelayTimer);
  window.clearTimeout(slowBootTimer);
  window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);
});
</script>
