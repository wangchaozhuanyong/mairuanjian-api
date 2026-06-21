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
  reason?: 'manual' | 'realtime' | 'fallback-poll' | 'route-enter';
}

export type PageRefreshHandler = (options: PageRefreshOptions) => Promise<void> | void;

interface PageRefreshRegistration {
  id: symbol;
  label?: string;
  refresh: PageRefreshHandler;
}

interface PageRefreshContext {
  active: ShallowRef<PageRefreshRegistration | null>;
  activeVersion: Ref<number>;
  refreshing: Ref<boolean>;
  backgroundRefreshing: Ref<boolean>;
  register: (registration: PageRefreshRegistration) => () => void;
  run: (options?: PageRefreshOptions) => Promise<boolean>;
}

const pageRefreshKey: InjectionKey<PageRefreshContext> = Symbol('page-refresh');

export function providePageRefreshHost() {
  const active = shallowRef<PageRefreshRegistration | null>(null);
  const activeVersion = ref(0);
  const refreshing = ref(false);
  const backgroundRefreshing = ref(false);

  const context: PageRefreshContext = {
    active,
    activeVersion,
    refreshing,
    backgroundRefreshing,
    register(registration) {
      active.value = registration;
      activeVersion.value += 1;

      return () => {
        if (active.value?.id === registration.id) {
          active.value = null;
          activeVersion.value += 1;
        }
      };
    },
    async run(options = {}) {
      const current = active.value;
      const isBackground = Boolean(options.background);

      if (!current || refreshing.value || backgroundRefreshing.value) {
        return false;
      }

      if (isBackground) {
        backgroundRefreshing.value = true;
      } else {
        refreshing.value = true;
      }

      try {
        await current.refresh(options);
        return true;
      } finally {
        if (isBackground) {
          backgroundRefreshing.value = false;
        } else {
          refreshing.value = false;
        }
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
