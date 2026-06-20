import { inject, provide, shallowRef, type InjectionKey, type ShallowRef, type Slot } from 'vue';

interface PageActionsContext {
  slot: ShallowRef<Slot | null>;
  setActions: (slot: Slot) => void;
  clearActions: (slot?: Slot) => void;
}

const pageActionsKey: InjectionKey<PageActionsContext> = Symbol('page-actions');

export function providePageActionsHost() {
  const slot = shallowRef<Slot | null>(null);

  const context: PageActionsContext = {
    slot,
    setActions(nextSlot) {
      slot.value = nextSlot;
    },
    clearActions(currentSlot) {
      if (!currentSlot || slot.value === currentSlot) {
        slot.value = null;
      }
    }
  };

  provide(pageActionsKey, context);

  return context;
}

export function usePageActions() {
  return inject(pageActionsKey, null);
}
