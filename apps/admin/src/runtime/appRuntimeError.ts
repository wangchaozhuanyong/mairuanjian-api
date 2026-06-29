import { ref } from 'vue';

type AppRuntimeErrorSource = 'vue' | 'window' | 'promise';

interface AppRuntimeErrorState {
  message: string;
  source: AppRuntimeErrorSource;
  occurredAt: number;
}

const runtimeErrorMessage = '页面运行时遇到问题，当前操作可能没有完成。';

export const appRuntimeError = ref<AppRuntimeErrorState | null>(null);

export function setAppRuntimeError(source: AppRuntimeErrorSource) {
  appRuntimeError.value = {
    message: runtimeErrorMessage,
    source,
    occurredAt: Date.now()
  };
}

export function clearAppRuntimeError() {
  appRuntimeError.value = null;
}
