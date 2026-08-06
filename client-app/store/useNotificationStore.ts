import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // duration in ms
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationStore {
  toasts: ToastItem[];
  modal: ConfirmModalOptions | null;
  
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  
  showConfirm: (options: ConfirmModalOptions) => void;
  dismissConfirm: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  toasts: [],
  modal: null,

  showToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: ToastItem = { ...toast, id };
    
    set((state) => ({
      toasts: [...state.toasts, newItem],
    }));

    // Auto dismiss
    const duration = toast.duration !== undefined ? toast.duration : 4000;
    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }

    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  showConfirm: (options) => {
    set({ modal: options });
  },

  dismissConfirm: () => {
    set({ modal: null });
  },
}));
