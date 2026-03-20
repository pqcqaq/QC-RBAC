import { computed, reactive, watch } from 'vue';
import { useWorkbenchStore } from '@/stores/workbench';

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const usePageState = <T extends Record<string, any>>(key: string, defaults: T) => {
  const workbench = useWorkbenchStore();
  const initial = workbench.getPageState<T>(key);
  const state = reactive<T>(cloneValue(initial ?? defaults));

  watch(
    state,
    (value) => {
      workbench.setPageState(key, cloneValue(value));
    },
    { deep: true },
  );

  const reset = () => {
    Object.assign(state, cloneValue(defaults));
  };

  return {
    state,
    reset,
    snapshot: computed(() => state),
  };
};
