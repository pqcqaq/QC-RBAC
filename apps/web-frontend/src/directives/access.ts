import type { App, Directive, DirectiveBinding, EffectScope } from 'vue';
import { effectScope, watchEffect } from 'vue';
import { pinia } from '@/stores';
import { useAuthStore } from '@/stores/auth';
import type { AccessDirectiveValue } from '@/utils/access-control';

type AccessDirectiveKind = 'permission' | 'role';

type AccessDirectiveState = {
  kind: AccessDirectiveKind;
  value: AccessDirectiveValue;
  arg?: string;
  scope: EffectScope | null;
  originalDisplay: string | null;
};

type AccessDirectiveElement = HTMLElement & {
  __rbacAccessDirective__?: AccessDirectiveState;
};

const setElementVisible = (el: AccessDirectiveElement, visible: boolean) => {
  const state = el.__rbacAccessDirective__;
  if (!state) {
    return;
  }

  if (visible) {
    if (state.originalDisplay === null) {
      el.style.removeProperty('display');
      return;
    }

    el.style.display = state.originalDisplay;
    return;
  }

  if (state.originalDisplay === null) {
    state.originalDisplay = el.style.display || null;
  }
  el.style.display = 'none';
};

const evaluateAccess = (kind: AccessDirectiveKind, value: AccessDirectiveValue, arg?: string) => {
  const auth = useAuthStore(pinia);

  if (kind === 'role') {
    return auth.matchRoles(value, arg);
  }

  return auth.matchPermissions(value, arg);
};

const syncDirectiveState = (
  el: AccessDirectiveElement,
  binding: DirectiveBinding<AccessDirectiveValue>,
  kind: AccessDirectiveKind,
) => {
  const state = el.__rbacAccessDirective__;
  if (!state) {
    el.__rbacAccessDirective__ = {
      kind,
      value: binding.value,
      arg: binding.arg,
      scope: null,
      originalDisplay: el.style.display || null,
    };
    return;
  }

  state.kind = kind;
  state.value = binding.value;
  state.arg = binding.arg;
};

const mountAccessWatcher = (
  el: AccessDirectiveElement,
  binding: DirectiveBinding<AccessDirectiveValue>,
  kind: AccessDirectiveKind,
) => {
  syncDirectiveState(el, binding, kind);

  const state = el.__rbacAccessDirective__;
  if (!state || state.scope) {
    return;
  }

  state.scope = effectScope();
  state.scope.run(() => {
    watchEffect(() => {
      const currentState = el.__rbacAccessDirective__;
      if (!currentState) {
        return;
      }

      const visible = evaluateAccess(currentState.kind, currentState.value, currentState.arg);
      setElementVisible(el, visible);
    });
  });
};

const updateAccessDirective = (
  el: AccessDirectiveElement,
  binding: DirectiveBinding<AccessDirectiveValue>,
  kind: AccessDirectiveKind,
) => {
  syncDirectiveState(el, binding, kind);
  const state = el.__rbacAccessDirective__;
  if (!state) {
    return;
  }

  setElementVisible(el, evaluateAccess(state.kind, state.value, state.arg));
};

const unmountAccessDirective = (el: AccessDirectiveElement) => {
  const state = el.__rbacAccessDirective__;
  state?.scope?.stop();
  delete el.__rbacAccessDirective__;
};

const createAccessDirective = (kind: AccessDirectiveKind): Directive<HTMLElement, AccessDirectiveValue> => ({
  mounted(el, binding) {
    mountAccessWatcher(el as AccessDirectiveElement, binding, kind);
  },
  updated(el, binding) {
    updateAccessDirective(el as AccessDirectiveElement, binding, kind);
  },
  unmounted(el) {
    unmountAccessDirective(el as AccessDirectiveElement);
  },
});

export const permissionDirective = createAccessDirective('permission');
export const roleDirective = createAccessDirective('role');

export const registerAccessDirectives = (app: App) => {
  app.directive('permission', permissionDirective);
  app.directive('role', roleDirective);
};
