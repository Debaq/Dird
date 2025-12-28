import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { sendBroadcastMessage } from '@/lib/api/admin-service';

export function MessageBroadcast() {
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'toast' | 'modal'>('toast');
  const [messageVariant, setMessageVariant] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [isSending, setIsSending] = useState(false);
  const { t } = useTranslation();

  const MESSAGE_TYPES = [
    { value: 'toast', label: t('admin.messageBroadcast.types.toast') },
    { value: 'modal', label: t('admin.messageBroadcast.types.modal') },
  ];

  const MESSAGE_VARIANTS = [
    { value: 'info', label: t('admin.messageBroadcast.variants.info'), icon: Info, color: 'text-blue-500' },
    { value: 'success', label: t('admin.messageBroadcast.variants.success'), icon: CheckCircle, color: 'text-green-500' },
    { value: 'warning', label: t('admin.messageBroadcast.variants.warning'), icon: AlertTriangle, color: 'text-amber-500' },
    { value: 'error', label: t('admin.messageBroadcast.variants.error'), icon: AlertCircle, color: 'text-red-500' },
  ];

  const DURATION_OPTIONS = [
    { value: '1', label: t('admin.messageBroadcast.duration.1') },
    { value: '6', label: t('admin.messageBroadcast.duration.6') },
    { value: '12', label: t('admin.messageBroadcast.duration.12') },
    { value: '24', label: t('admin.messageBroadcast.duration.24') },
    { value: '48', label: t('admin.messageBroadcast.duration.48') },
    { value: '168', label: t('admin.messageBroadcast.duration.168') },
  ];

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error(t('admin.messageBroadcast.errors.emptyMessage'));
      return;
    }

    const hours = parseInt(expiresInHours);
    if (isNaN(hours) || hours <= 0) {
      toast.error(t('admin.messageBroadcast.errors.invalidDuration'));
      return;
    }

    setIsSending(true);

    try {
      await sendBroadcastMessage({
        text: messageText,
        type: messageType,
        variant: messageVariant,
        expires_in_hours: hours,
      });

      toast.success(t('admin.messageBroadcast.success'));
      setMessageText('');
      setMessageType('toast');
      setMessageVariant('info');
      setExpiresInHours('24');
    } catch (error) {
      toast.error(t('admin.messageBroadcast.errors.sendError'));
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const VariantIcon = MESSAGE_VARIANTS.find((v) => v.value === messageVariant)?.icon || Info;
  const variantColor = MESSAGE_VARIANTS.find((v) => v.value === messageVariant)?.color || 'text-blue-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Card */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text mb-4">
          {t('admin.messageBroadcast.title')}
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message-text">{t('admin.messageBroadcast.messageLabel')}</Label>
            <Textarea
              id="message-text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t('admin.messageBroadcast.messagePlaceholder')}
              className="min-h-[120px] resize-none"
              disabled={isSending}
            />
            <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
              {t('admin.messageBroadcast.characterCount', { count: messageText.length })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="message-type">{t('admin.messageBroadcast.typeLabel')}</Label>
              <Select
                value={messageType}
                onValueChange={(value) => setMessageType(value as 'toast' | 'modal')}
                options={MESSAGE_TYPES}
                disabled={isSending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-variant">{t('admin.messageBroadcast.styleLabel')}</Label>
              <Select
                value={messageVariant}
                onValueChange={(value) => setMessageVariant(value as 'info' | 'success' | 'warning' | 'error')}
                options={MESSAGE_VARIANTS}
                disabled={isSending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires-hours">{t('admin.messageBroadcast.durationLabel')}</Label>
            <Select
              value={expiresInHours}
              onValueChange={setExpiresInHours}
              options={DURATION_OPTIONS}
              disabled={isSending}
            />
            <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
              {t('admin.messageBroadcast.durationDescription')}
            </p>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={isSending || !messageText.trim()}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {isSending ? t('admin.messageBroadcast.sending') : t('admin.messageBroadcast.sendButton')}
          </Button>
        </div>
      </Card>

      {/* Preview Card */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text mb-4">
          {t('admin.messageBroadcast.previewTitle')}
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
            {t('admin.messageBroadcast.previewDescription')}
          </p>

          {messageType === 'toast' ? (
            <div className="border border-smoke-200 dark:border-coal-700 rounded-lg p-4 bg-white dark:bg-coal-900 shadow-lg">
              <div className="flex items-start gap-3">
                <VariantIcon className={`w-5 h-5 flex-shrink-0 ${variantColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-coal-800 dark:text-dark-text break-words">
                    {messageText || t('admin.messageBroadcast.previewMessage')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-smoke-200 dark:border-coal-700 rounded-lg p-6 bg-white dark:bg-coal-900 shadow-xl">
              <div className="flex flex-col items-center text-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  messageVariant === 'info' ? 'bg-blue-100 dark:bg-blue-900' :
                  messageVariant === 'success' ? 'bg-green-100 dark:bg-green-900' :
                  messageVariant === 'warning' ? 'bg-amber-100 dark:bg-amber-900' :
                  'bg-red-100 dark:bg-red-900'
                }`}>
                  <VariantIcon className={`w-6 h-6 ${variantColor}`} />
                </div>
                <p className="text-sm text-coal-800 dark:text-dark-text break-words">
                  {messageText || t('admin.messageBroadcast.previewMessage')}
                </p>
                <Button size="sm" variant="outline">
                  {t('admin.messageBroadcast.acceptButton')}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 text-xs text-smoke-600 dark:text-dark-textSecondary">
            <p>
              <strong>{t('admin.messageBroadcast.type')}:</strong> {MESSAGE_TYPES.find((t) => t.value === messageType)?.label}
            </p>
            <p>
              <strong>{t('admin.messageBroadcast.style')}:</strong> {MESSAGE_VARIANTS.find((v) => v.value === messageVariant)?.label}
            </p>
            <p>
              <strong>{t('admin.messageBroadcast.expiresIn')}:</strong> {t('admin.messageBroadcast.hours', { count: parseInt(expiresInHours) })}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
