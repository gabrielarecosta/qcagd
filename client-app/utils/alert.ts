import { useNotificationStore } from '../store/useNotificationStore';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export function customAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const store = useNotificationStore.getState();

  const isError = title.toLowerCase().includes('error') || 
                  (message && message.toLowerCase().includes('error')) ||
                  title.toLowerCase().includes('inválid') ||
                  title.toLowerCase().includes('requerid');

  const isSuccess = title.toLowerCase().includes('éxito') || 
                    title.toLowerCase().includes('exitos') ||
                    title.toLowerCase().includes('confirmado') ||
                    title.toLowerCase().includes('cargado');

  const type = isError ? 'error' : (isSuccess ? 'success' : 'info');

  if (!buttons || buttons.length === 0) {
    // Show toast
    store.showToast({
      message: message ? `${title}: ${message}` : title,
      type,
    });
  } else {
    // Show confirm modal
    // Find default or destructive buttons
    const confirmButton = buttons.find((b) => b.style === 'destructive' || b.style === 'default') || buttons[buttons.length - 1];
    const cancelButton = buttons.find((b) => b.style === 'cancel') || buttons.find((b) => b !== confirmButton);

    store.showConfirm({
      title,
      message: message || '',
      confirmLabel: confirmButton?.text,
      cancelLabel: cancelButton?.text,
      onConfirm: () => {
        confirmButton?.onPress?.();
      },
      onCancel: () => {
        cancelButton?.onPress?.();
      },
    });
  }
}

