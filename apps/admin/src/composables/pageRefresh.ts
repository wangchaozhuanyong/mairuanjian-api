import {
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  provide,
  ref,
  shallowRef,
  type InjectionKey,
  type Ref,
  type ShallowRef
} from 'vue';

export interface PageRefreshOptions {
  background?: boolean;
  force?: boolean;
  reason?: 'manual' | 'realtime' | 'fallback-poll';
}

export type PageRefreshHandler = (options: PageRefreshOptions) => Promise<void> | void;

interface PageRefreshRegistration {
  id: symbol;
  label?: string;
  refresh: PageRefreshHandler;
}

interface PageRefreshContext {
  active: ShallowRef<PageRefreshRegistration | null>;
  refreshing: Ref<boolean>;
  register: (registration: PageRefreshRegistration) => () => void;
  run: (options?: PageRefreshOptions) => Promise<boolean>;
}

const pageRefreshKey: InjectionKey<PageRefreshContext> = Symbol('page-refresh');

export function providePageRefreshHost() {
  const active = shallowRef<PageRefreshRegistration | null>(null);
  const refreshing = ref(false);

  const context: PageRefreshContext = {
    active,
    refreshing,
    register(registration) {
      active.value = registration;

      return () => {
        if (active.value?.id === registration.id) {
          active.value = null;
        }
      };
    },
    async run(options = {}) {
      const current = active.value;

      if (!current || refreshing.value) {
        return false;
      }

      refreshing.value = true;

      try {
        await current.refresh(options);
        return true;
      } finally {
        refreshing.value = false;
      }
    }
  };

  provide(pageRefreshKey, context);

  return context;
}

export function usePageRefresh(
  refresh: PageRefreshHandler,
  options: {
    label?: string;
  } = {}
) {
  const context = inject(pageRefreshKey, null);
  const id = Symbol(options.label ?? 'page-refresh');
  let cleanup: (() => void) | undefined;

  function register() {
    cleanup?.();
    cleanup = context?.register({
      id,
      label: options.label,
      refresh
    });
  }

  function clear() {
    cleanup?.();
    cleanup = undefined;
  }

  onMounted(register);
  onActivated(register);
  onDeactivated(clear);
  onBeforeUnmount(clear);
}
