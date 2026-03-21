export type ContextMenuValueResolver<T, R> = R | ((context: T) => R);

export type ContextMenuOpenHandler<T = unknown> = (event: MouseEvent, context?: T | null) => void;

export type ContextMenuActionControls<T = unknown> = {
  close: () => void;
  open: ContextMenuOpenHandler<T>;
};

export type ContextMenuDividerItem<T = unknown> = {
  key: string;
  type: 'divider';
  hidden?: ContextMenuValueResolver<T, boolean>;
};

export type ContextMenuActionItem<T = unknown> = {
  key: string;
  type?: 'action';
  label: ContextMenuValueResolver<T, string>;
  description?: ContextMenuValueResolver<T, string | undefined>;
  shortcut?: ContextMenuValueResolver<T, string | undefined>;
  disabled?: ContextMenuValueResolver<T, boolean>;
  hidden?: ContextMenuValueResolver<T, boolean>;
  danger?: ContextMenuValueResolver<T, boolean>;
  divided?: ContextMenuValueResolver<T, boolean>;
  onSelect?: (context: T, controls: ContextMenuActionControls<T>) => void | Promise<void>;
};

export type ContextMenuItem<T = unknown> = ContextMenuDividerItem<T> | ContextMenuActionItem<T>;

export type ContextMenuResolvedItem<T = unknown> =
  | {
      key: string;
      type: 'divider';
    }
  | {
      key: string;
      type: 'action';
      label: string;
      description?: string;
      shortcut?: string;
      disabled: boolean;
      danger: boolean;
      onSelect?: (context: T, controls: ContextMenuActionControls<T>) => void | Promise<void>;
    };
