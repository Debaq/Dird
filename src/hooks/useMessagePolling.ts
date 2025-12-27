/**
 * Message Polling Hook
 * Periodically checks for broadcast messages from admin
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchPendingMessages, markMessageAsRead } from '@/lib/api/admin-service';
import { getInstallationToken } from '@/lib/utils/installation';
import { useConfirm } from '@/hooks/useConfirm';
import type { BroadcastMessage } from '@/types/admin';

export interface UseMessagePollingOptions {
  /**
   * Polling interval in milliseconds
   * @default 120000 (2 minutes)
   */
  intervalMs?: number;

  /**
   * Whether to start polling immediately
   * @default true
   */
  enabled?: boolean;
}

export function useMessagePolling(options: UseMessagePollingOptions = {}) {
  const { intervalMs = 120000, enabled = true } = options;

  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  const showMessage = async (message: BroadcastMessage) => {
    const installationToken = getInstallationToken();

    if (message.type === 'toast') {
      // Show toast notification
      const variantMap = {
        info: toast.info,
        success: toast.success,
        warning: toast.warning,
        error: toast.error,
      };

      const toastFn = variantMap[message.variant] || toast.info;
      toastFn(message.text, {
        duration: 5000,
      });
    } else {
      // Show modal dialog
      const variantConfig = {
        info: { title: 'Información', variant: 'default' as const },
        success: { title: 'Mensaje', variant: 'default' as const },
        warning: { title: 'Advertencia', variant: 'warning' as const },
        error: { title: 'Atención', variant: 'destructive' as const },
      };

      const config = variantConfig[message.variant] || variantConfig.info;

      await confirm({
        title: config.title,
        description: message.text,
        confirmText: 'Aceptar',
        variant: config.variant,
      });
    }

    // Mark as read
    try {
      await markMessageAsRead(message.id, installationToken);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const checkMessages = async () => {
    if (isChecking) return;

    setIsChecking(true);

    try {
      const installationToken = getInstallationToken();
      const messages = await fetchPendingMessages(installationToken);

      // Process messages sequentially
      for (const message of messages) {
        await showMessage(message);
      }
    } catch (error) {
      console.error('Message polling error:', error);
      // Fail silently - don't interrupt user experience
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkMessages();

    // Set up interval
    intervalRef.current = setInterval(checkMessages, intervalMs);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs]);

  return {
    isChecking,
    checkNow: checkMessages,
    ConfirmDialogComponent,
  };
}
