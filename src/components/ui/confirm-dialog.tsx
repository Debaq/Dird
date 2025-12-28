import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: () => void;
  onCancel?: () => void;
}

const variantConfig = {
  default: {
    icon: Info,
    iconColor: 'text-primary-500',
    confirmVariant: 'default' as const,
  },
  destructive: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    confirmVariant: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    confirmVariant: 'default' as const,
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const config = variantConfig[variant];
  const Icon = config.icon;

  // Use translation keys if no custom text is provided
  const defaultConfirmText = confirmText || t('common.confirm');
  const defaultCancelText = cancelText || t('common.cancel');

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-coal-100`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-3 text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            {defaultCancelText}
          </Button>
          <Button
            type="button"
            variant={config.confirmVariant}
            onClick={handleConfirm}
            className="flex-1"
          >
            {defaultConfirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
