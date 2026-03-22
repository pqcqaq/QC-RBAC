import { computed, reactive, watch } from 'vue';
import { useWorkbenchStore } from '@/stores/workbench';

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeState = <T>(defaults: T, initial?: unknown): T => {
  if (initial === undefined) {
    return cloneValue(defaults);
  }

  if (!isPlainObject(defaults) || !isPlainObject(initial)) {
    return cloneValue(initial as T);
  }

  const merged = Object.entries(initial).reduce<Record<string, unknown>>((result, [key, value]) => {
    const defaultValue = Reflect.get(defaults, key);
    result[key] = key in defaults ? mergeState(defaultValue, value) : cloneValue(value);
    return result;
  }, cloneValue(defaults) as Record<string, unknown>);

  return merged as T;
};

export const usePageState = <T extends Record<string, unknown>>(key: string, defaults: T) => {
  const workbench = useWorkbenchStore();
  const initial = workbench.getPageState<T>(key);
  const state = reactive<T>(mergeState(defaults, initial));

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
