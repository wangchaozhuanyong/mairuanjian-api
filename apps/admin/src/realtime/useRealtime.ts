import { onBeforeUnmount, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { connectRealtime, disconnectRealtime } from './realtimeClient';

export function useRealtimeConnection() {
  const authStore = useAuthStore();

  const stop = watch(
    () => authStore.token,
    (token) => {
      if (token) {
        connectRealtime(token);
        return;
      }

      disconnectRealtime();
    },
    {
      immediate: true
    }
  );

  onBeforeUnmount(() => {
    stop();
    disconnectRealtime();
  });
}
