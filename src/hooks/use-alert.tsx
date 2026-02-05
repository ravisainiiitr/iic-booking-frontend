import { useState, useCallback } from 'react';
import CustomAlert from '@/components/CustomAlert';
import CustomConfirm from '@/components/CustomConfirm';

interface AlertOptions {
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
}

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export const useAlert = () => {
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    confirmText: string;
  }>({
    open: false,
    title: 'Alert',
    message: '',
    type: 'info',
    confirmText: 'OK',
  });

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    open: false,
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: () => {},
  });

  const alert = useCallback((message: string, options?: AlertOptions) => {
    setAlertState({
      open: true,
      title: options?.title || 'Alert',
      message,
      type: options?.type || 'info',
      confirmText: options?.confirmText || 'OK',
    });
  }, []);

  const confirm = useCallback(
    (
      message: string,
      onConfirm: () => void,
      options?: ConfirmOptions
    ): void => {
      setConfirmState({
        open: true,
        title: options?.title || 'Confirm',
        message,
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        variant: options?.variant || 'default',
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, open: false }));
          onConfirm();
        },
      });
    },
    []
  );

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, open: false }));
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, open: false }));
  }, []);

  const AlertComponent = (
    <CustomAlert
      open={alertState.open}
      onClose={closeAlert}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      confirmText={alertState.confirmText}
    />
  );

  const ConfirmComponent = (
    <CustomConfirm
      open={confirmState.open}
      onConfirm={confirmState.onConfirm}
      onCancel={closeConfirm}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      variant={confirmState.variant}
    />
  );

  return {
    alert,
    confirm,
    AlertComponent,
    ConfirmComponent,
  };
};
