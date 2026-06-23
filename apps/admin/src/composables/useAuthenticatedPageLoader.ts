import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import {
  AuthSessionExpiredError,
  isAuthSessionExpired,
  isAuthSessionExpiredError
} from '@/auth/session';
import { useAuthStore } from '@/stores/auth';

export interface AuthenticatedPageLoaderContext {
  signal: AbortSignal;
}

export type AuthenticatedPageLoader = (
  context: AuthenticatedPageLoaderContext
) => Promise<void> | void;

export interface AuthenticatedPageLoaderOptions {
  loadOnActivated?: boolean;
}

export function useAuthenticatedPageLoader(
  loader: AuthenticatedPageLoader,
  options: AuthenticatedPageLoaderOptions = {}
) {
  const authStore = useAuthStore();
  let controller: AbortController | null = null;

  function abort() {
    controller?.abort();
    controller = null;
  }

  async function load() {
    if (!authStore.isAuthenticated || isAuthSessionExpired()) {
      return false;
    }

    abort();
    controller = new AbortController();

    try {
      await loader({ signal: controller.signal });
      return true;
    } catch (error) {
      if (isExpectedLoaderAbort(error)) {
        return false;
      }

      throw error;
    } finally {
      if (controller?.signal.aborted) {
        controller = null;
      }
    }
  }

  onMounted(() => {
    void load();
  });

  if (options.loadOnActivated) {
    onActivated(() => {
      void load();
    });
  }

  onDeactivated(abort);
  onBeforeUnmount(abort);

  return {
    abort,
    load
  };
}

function isExpectedLoaderAbort(error: unknown) {
  if (isAuthSessionExpiredError(error)) {
    return true;
  }

  if (isAuthSessionExpired()) {
    return error instanceof AuthSessionExpiredError || isCanceledError(error);
  }

  return isCanceledError(error);
}

function isCanceledError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
  return (
    candidate.code === 'ERR_CANCELED' ||
    candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError' ||
    candidate.message === 'canceled'
  );
}
