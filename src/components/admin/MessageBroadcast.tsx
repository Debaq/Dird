import { useState } from 'react';
import { Send, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { sendBroadcastMessage } from '@/lib/api/admin-service';

const MESSAGE_TYPES = [
  { value: 'toast', label: 'Toast (Notificación)' },
  { value: 'modal', label: 'Modal (Ventana)' },
];

const MESSAGE_VARIANTS = [
  { value: 'info', label: 'Información', icon: Info, color: 'text-blue-500' },
  { value: 'success', label: 'Éxito', icon: CheckCircle, color: 'text-green-500' },
  { value: 'warning', label: 'Advertencia', icon: AlertTriangle, color: 'text-amber-500' },
  { value: 'error', label: 'Error', icon: AlertCircle, color: 'text-red-500' },
];

const DURATION_OPTIONS = [
  { value: '1', label: '1 hora' },
  { value: '6', label: '6 horas' },
  { value: '12', label: '12 horas' },
  { value: '24', label: '24 horas (1 día)' },
  { value: '48', label: '48 horas (2 días)' },
  { value: '168', label: '168 horas (1 semana)' },
];

export function MessageBroadcast() {
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'toast' | 'modal'>('toast');
  const [messageVariant, setMessageVariant] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error('Escribe un mensaje');
      return;
    }

    const hours = parseInt(expiresInHours);
    if (isNaN(hours) || hours <= 0) {
      toast.error('Duración inválida');
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

      toast.success('Mensaje enviado a todos los usuarios');
      setMessageText('');
      setMessageType('toast');
      setMessageVariant('info');
      setExpiresInHours('24');
    } catch (error) {
      toast.error('Error al enviar mensaje');
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
          Enviar Mensaje a Todos los Usuarios
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message-text">Mensaje</Label>
            <Textarea
              id="message-text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escribe el mensaje que verán todos los usuarios..."
              className="min-h-[120px] resize-none"
              disabled={isSending}
            />
            <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
              {messageText.length} caracteres
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="message-type">Tipo de Notificación</Label>
              <Select
                value={messageType}
                onValueChange={(value) => setMessageType(value as 'toast' | 'modal')}
                options={MESSAGE_TYPES}
                disabled={isSending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-variant">Estilo</Label>
              <Select
                value={messageVariant}
                onValueChange={(value) => setMessageVariant(value as 'info' | 'success' | 'warning' | 'error')}
                options={MESSAGE_VARIANTS}
                disabled={isSending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires-hours">Duración (horas)</Label>
            <Select
              value={expiresInHours}
              onValueChange={setExpiresInHours}
              options={DURATION_OPTIONS}
              disabled={isSending}
            />
            <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
              El mensaje expirará automáticamente después de este tiempo
            </p>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={isSending || !messageText.trim()}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Enviando...' : 'Enviar Mensaje'}
          </Button>
        </div>
      </Card>

      {/* Preview Card */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text mb-4">
          Vista Previa
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
            Así verán el mensaje los usuarios:
          </p>

          {messageType === 'toast' ? (
            <div className="border border-smoke-200 dark:border-coal-700 rounded-lg p-4 bg-white dark:bg-coal-900 shadow-lg">
              <div className="flex items-start gap-3">
                <VariantIcon className={`w-5 h-5 flex-shrink-0 ${variantColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-coal-800 dark:text-dark-text break-words">
                    {messageText || 'El mensaje aparecerá aquí...'}
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
                  {messageText || 'El mensaje aparecerá aquí...'}
                </p>
                <Button size="sm" variant="outline">
                  Aceptar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 text-xs text-smoke-600 dark:text-dark-textSecondary">
            <p>
              <strong>Tipo:</strong> {MESSAGE_TYPES.find((t) => t.value === messageType)?.label}
            </p>
            <p>
              <strong>Estilo:</strong> {MESSAGE_VARIANTS.find((v) => v.value === messageVariant)?.label}
            </p>
            <p>
              <strong>Expira en:</strong> {expiresInHours} horas
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
