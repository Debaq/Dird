import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';

interface AdvancedEditorDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AdvancedEditorDialog({
  isOpen,
  onConfirm,
  onCancel,
}: AdvancedEditorDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed top-[20vh] left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-md"
              >
                <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 rounded-xl shadow-2xl">
                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <Dialog.Title className="text-xl font-bold text-white mb-2">
                          {t('advancedEditor.dialogTitle') || 'Modo Editor Avanzado'}
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-gray-300 leading-relaxed">
                          {t('advancedEditor.dialogDescription') ||
                            'Activa el modo editor profesional con paneles laterales, herramientas avanzadas y canvas maximizado.'}
                        </Dialog.Description>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-4">
                      💡 Presiona <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-200">ESC</kbd> para salir en cualquier momento
                    </p>

                    <div className="flex items-center justify-end gap-2">
                      <Dialog.Close asChild>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={onCancel}
                          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                        >
                          {t('advancedEditor.cancel') || 'Cancelar'}
                        </motion.button>
                      </Dialog.Close>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onConfirm}
                        className="px-5 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-500/20"
                      >
                        {t('advancedEditor.activate') || 'Activar'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
