import React, {
  createContext, useContext, useRef, useState, useCallback,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastStack, type ToastItem, type ToastType } from './Toast';
import { ConfirmationModal, type ConfirmOptions } from './ConfirmationModal';
import { ActionSheet, type ActionSheetOptions } from './ActionSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackAPI {
  /** Show a toast notification */
  toast: (opts: { type?: ToastType; title: string; message?: string; duration?: number; action?: { label: string; onPress: () => void } }) => void;
  /** Shorthand: success toast */
  success: (title: string, message?: string) => void;
  /** Shorthand: error toast */
  error: (title: string, message?: string) => void;
  /** Shorthand: warning toast */
  warn: (title: string, message?: string) => void;
  /** Shorthand: info toast */
  info: (title: string, message?: string) => void;
  /** Show a confirmation dialog */
  confirm: (opts: ConfirmOptions) => void;
  /** Show an action sheet */
  actionSheet: (opts: ActionSheetOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FeedbackContext = createContext<FeedbackAPI | null>(null);

let _nextId = 0;
const uid = () => String(++_nextId);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  const [toasts,    setToasts]    = useState<ToastItem[]>([]);
  const [confirm,   setConfirm]   = useState<{ opts: ConfirmOptions | null; visible: boolean }>({ opts: null, visible: false });
  const [sheet,     setSheet]     = useState<{ opts: ActionSheetOptions | null; visible: boolean }>({ opts: null, visible: false });

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const toast = useCallback<FeedbackAPI['toast']>((opts) => {
    const item: ToastItem = {
      id: uid(),
      type: opts.type ?? 'info',
      title: opts.title,
      message: opts.message,
      duration: opts.duration ?? (opts.type === 'error' ? 4000 : 3000),
      action: opts.action,
    };
    setToasts(prev => {
      const next = [item, ...prev];
      return next.slice(0, 3);
    });
  }, []);

  const success = useCallback((title: string, message?: string) =>
    toast({ type: 'success', title, message }), [toast]);

  const error = useCallback((title: string, message?: string) =>
    toast({ type: 'error', title, message }), [toast]);

  const warn = useCallback((title: string, message?: string) =>
    toast({ type: 'warning', title, message }), [toast]);

  const info = useCallback((title: string, message?: string) =>
    toast({ type: 'info', title, message }), [toast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Confirm helpers ────────────────────────────────────────────────────────

  const openConfirm = useCallback((opts: ConfirmOptions) => {
    setConfirm({ opts, visible: true });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirm(prev => ({ ...prev, visible: false }));
  }, []);

  // ── ActionSheet helpers ────────────────────────────────────────────────────

  const openActionSheet = useCallback((opts: ActionSheetOptions) => {
    setSheet({ opts, visible: true });
  }, []);

  const closeActionSheet = useCallback(() => {
    setSheet(prev => ({ ...prev, visible: false }));
  }, []);

  // ── API object ─────────────────────────────────────────────────────────────

  const api: FeedbackAPI = {
    toast,
    success,
    error,
    warn,
    info,
    confirm: openConfirm,
    actionSheet: openActionSheet,
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {/* Toast overlay — rendered above all screen content */}
      <View style={styles.overlay} pointerEvents="box-none">
        <ToastStack
          toasts={toasts}
          topOffset={insets.top + 10}
          onDismiss={dismissToast}
        />
      </View>

      {/* Modals */}
      <ConfirmationModal
        visible={confirm.visible}
        opts={confirm.opts}
        onClose={closeConfirm}
      />
      <ActionSheet
        visible={sheet.visible}
        opts={sheet.opts}
        onClose={closeActionSheet}
      />
    </FeedbackContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFeedback(): FeedbackAPI {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 99,
  },
});
