<template>
  <div ref="hostRef" class="context-menu-host" v-bind="attrs" @contextmenu="handleHostContextMenu">
    <slot :open="open" :close="close" :visible="visible" />
  </div>

  <Teleport to="body">
    <Transition name="context-menu-fade">
      <section
        v-if="visible"
        ref="menuRef"
        class="context-menu"
        :style="menuStyle"
        role="menu"
        tabindex="-1"
        aria-label="右键菜单"
        @contextmenu.prevent
        @keydown="handleMenuKeydown"
      >
        <div class="context-menu__list">
          <template v-for="item in resolvedItems" :key="item.key">
            <div v-if="item.type === 'divider'" class="context-menu__divider" role="separator" />
            <button
              v-else
              ref="menuItemRefs"
              class="context-menu__item"
              :class="{ 'context-menu__item--danger': item.danger }"
              type="button"
              role="menuitem"
              :disabled="item.disabled"
              @click="selectItem(item)"
            >
              <div class="context-menu__item-head">
                <span class="context-menu__label">{{ item.label }}</span>
                <span v-if="item.shortcut" class="context-menu__shortcut">{{ item.shortcut }}</span>
              </div>
              <span v-if="item.description" class="context-menu__description">{{ item.description }}</span>
            </button>
          </template>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, useAttrs, watch } from 'vue';
import { useRoute } from 'vue-router';
import type {
  ContextMenuActionControls,
  ContextMenuActionItem,
  ContextMenuItem,
  ContextMenuOpenHandler,
  ContextMenuResolvedItem,
  ContextMenuValueResolver,
} from './context-menu';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  items: ContextMenuItem<any>[];
  context?: unknown;
  disabled?: boolean;
  manual?: boolean;
  placementPadding?: number;
}>(), {
  context: undefined,
  disabled: false,
  manual: false,
  placementPadding: 12,
});

const emit = defineEmits<{
  open: [context: unknown];
  close: [];
  select: [key: string, context: unknown];
}>();

const attrs = useAttrs();
const route = useRoute();

const hostRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuItemRefs = ref<HTMLButtonElement[]>([]);
const visible = ref(false);
const activeContext = ref<unknown>(undefined);
const resolvedItems = ref<ContextMenuResolvedItem<any>[]>([]);
const rawPoint = ref({ x: 0, y: 0 });
const position = ref({ left: props.placementPadding, top: props.placementPadding });
const transformOrigin = ref('left top');

const menuStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`,
  '--context-menu-origin': transformOrigin.value,
}));

const readValue = <T, R>(resolver: ContextMenuValueResolver<T, R> | undefined, context: T, fallback: R): R => {
  if (resolver === undefined) {
    return fallback;
  }

  return typeof resolver === 'function'
    ? (resolver as (value: T) => R)(context)
    : resolver;
};

const trimText = (value?: string) => {
  const nextValue = value?.trim();
  return nextValue ? nextValue : undefined;
};

const normalizeResolvedItems = (items: ContextMenuResolvedItem<any>[]) => items.filter((item, index, list) => {
  if (item.type !== 'divider') {
    return true;
  }

  const previous = list[index - 1];
  const next = list[index + 1];
  return Boolean(previous) && previous.type !== 'divider' && Boolean(next) && next.type !== 'divider';
});

const buildResolvedItems = (context: unknown) => {
  const entries: ContextMenuResolvedItem<any>[] = [];

  for (const item of props.items) {
    if (readValue(item.hidden as ContextMenuValueResolver<unknown, boolean> | undefined, context, false)) {
      continue;
    }

    if (item.type === 'divider') {
      entries.push({
        key: item.key,
        type: 'divider',
      });
      continue;
    }

    const label = trimText(readValue(item.label as ContextMenuValueResolver<unknown, string>, context, ''));
    if (!label) {
      continue;
    }

    if (readValue(item.divided as ContextMenuValueResolver<unknown, boolean> | undefined, context, false)) {
      entries.push({
        key: `${item.key}__divider`,
        type: 'divider',
      });
    }

    entries.push({
      key: item.key,
      type: 'action',
      label,
      description: trimText(readValue(item.description as ContextMenuValueResolver<unknown, string | undefined> | undefined, context, undefined)),
      shortcut: trimText(readValue(item.shortcut as ContextMenuValueResolver<unknown, string | undefined> | undefined, context, undefined)),
      disabled: readValue(item.disabled as ContextMenuValueResolver<unknown, boolean> | undefined, context, false),
      danger: readValue(item.danger as ContextMenuValueResolver<unknown, boolean> | undefined, context, false),
      onSelect: (item as ContextMenuActionItem<any>).onSelect,
    });
  }

  return normalizeResolvedItems(entries);
};

const isWithin = (target: EventTarget | null, element: HTMLElement | null) => target instanceof Node && Boolean(element?.contains(target));

const focusItem = (index: number) => {
  const enabledItems = menuItemRefs.value.filter((item) => !item.disabled);
  enabledItems[index]?.focus();
};

const focusFirstItem = () => {
  focusItem(0);
};

const focusLastItem = () => {
  const enabledItems = menuItemRefs.value.filter((item) => !item.disabled);
  enabledItems.at(-1)?.focus();
};

const moveFocus = (offset: 1 | -1) => {
  const enabledItems = menuItemRefs.value.filter((item) => !item.disabled);
  if (!enabledItems.length) {
    return;
  }

  const currentIndex = enabledItems.findIndex((item) => item === document.activeElement);
  const nextIndex = currentIndex === -1
    ? offset > 0 ? 0 : enabledItems.length - 1
    : (currentIndex + offset + enabledItems.length) % enabledItems.length;

  enabledItems[nextIndex]?.focus();
};

const updatePosition = () => {
  const menu = menuRef.value;
  if (!menu) {
    return;
  }

  const padding = props.placementPadding;
  const maxLeft = Math.max(padding, window.innerWidth - menu.offsetWidth - padding);
  const maxTop = Math.max(padding, window.innerHeight - menu.offsetHeight - padding);
  const left = Math.min(Math.max(rawPoint.value.x, padding), maxLeft);
  const top = Math.min(Math.max(rawPoint.value.y, padding), maxTop);

  position.value = { left, top };
  transformOrigin.value = `${left < rawPoint.value.x ? 'right' : 'left'} ${top < rawPoint.value.y ? 'bottom' : 'top'}`;
};

const close = () => {
  if (!visible.value) {
    return;
  }

  visible.value = false;
  activeContext.value = undefined;
  resolvedItems.value = [];
  menuItemRefs.value = [];
  emit('close');
};

const open: ContextMenuOpenHandler = async (event, context = props.context) => {
  if (props.disabled || context === undefined || context === null) {
    return;
  }

  const nextItems = buildResolvedItems(context);
  if (!nextItems.length) {
    return;
  }

  event.preventDefault();
  activeContext.value = context;
  resolvedItems.value = nextItems;
  rawPoint.value = {
    x: event.clientX,
    y: event.clientY,
  };
  position.value = {
    left: event.clientX,
    top: event.clientY,
  };
  visible.value = true;

  await nextTick();
  updatePosition();
  focusFirstItem();
  emit('open', context);
};

const handleHostContextMenu = (event: MouseEvent) => {
  if (props.manual) {
    return;
  }

  void open(event);
};

const handleGlobalPointerDown = (event: PointerEvent) => {
  if (isWithin(event.target, menuRef.value)) {
    return;
  }

  close();
};

const handleGlobalContextMenu = (event: MouseEvent) => {
  if (isWithin(event.target, menuRef.value)) {
    event.preventDefault();
    return;
  }

  if (isWithin(event.target, hostRef.value)) {
    return;
  }

  close();
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }

  event.stopPropagation();
  close();
};

const handleMenuKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveFocus(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFocus(-1);
      break;
    case 'Home':
      event.preventDefault();
      focusFirstItem();
      break;
    case 'End':
      event.preventDefault();
      focusLastItem();
      break;
    case 'Escape':
      event.preventDefault();
      close();
      break;
    case 'Tab':
      close();
      break;
    default:
      break;
  }
};

const selectItem = async (item: Extract<ContextMenuResolvedItem<any>, { type: 'action' }>) => {
  if (item.disabled || activeContext.value === undefined || !item.onSelect) {
    return;
  }

  const context = activeContext.value;
  const controls: ContextMenuActionControls = {
    close,
    open: (event, nextContext = context) => {
      void open(event, nextContext);
    },
  };

  close();
  emit('select', item.key, context);
  await item.onSelect(context, controls);
};

const attachGlobalListeners = () => {
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
  window.addEventListener('contextmenu', handleGlobalContextMenu, true);
  window.addEventListener('keydown', handleGlobalKeydown, true);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
};

const detachGlobalListeners = () => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  window.removeEventListener('contextmenu', handleGlobalContextMenu, true);
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  window.removeEventListener('scroll', close, true);
  window.removeEventListener('resize', close);
  window.removeEventListener('blur', close);
};

watch(visible, (nextVisible) => {
  if (nextVisible) {
    attachGlobalListeners();
    return;
  }

  detachGlobalListeners();
});

watch(() => route.fullPath, () => {
  close();
});

onDeactivated(() => {
  close();
});

onBeforeUnmount(() => {
  detachGlobalListeners();
});

defineExpose({
  open,
  close,
});
</script>

<style scoped lang="scss">
.context-menu-host {
  display: contents;
}

.context-menu-fade-enter-active,
.context-menu-fade-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.context-menu-fade-enter-from,
.context-menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.context-menu {
  position: fixed;
  z-index: 3200;
  min-width: 208px;
  max-width: min(320px, calc(100vw - 24px));
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 8%, var(--line-strong));
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 22px 48px rgba(10, 21, 33, 0.18);
  backdrop-filter: blur(18px);
  transform-origin: var(--context-menu-origin, left top);
}

.context-menu__list {
  display: grid;
  gap: 4px;
}

.context-menu__divider {
  border-top: 1px solid var(--line-soft);
  margin: 4px 0;
}

.context-menu__item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ink-1);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.context-menu__item:hover:not(:disabled),
.context-menu__item:focus-visible {
  background: var(--accent-soft);
  outline: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent);
}

.context-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.context-menu__item--danger {
  color: var(--danger);
}

.context-menu__item--danger:hover:not(:disabled),
.context-menu__item--danger:focus-visible {
  background: color-mix(in srgb, var(--danger) 10%, white);
  color: color-mix(in srgb, var(--danger) 90%, #5d2328);
}

.context-menu__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.context-menu__label {
  font-size: 14px;
  font-weight: 600;
}

.context-menu__shortcut {
  color: var(--ink-3);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  white-space: nowrap;
}

.context-menu__description {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .context-menu {
    min-width: 184px;
    max-width: calc(100vw - 16px);
    padding: 6px;
  }
}
</style>
