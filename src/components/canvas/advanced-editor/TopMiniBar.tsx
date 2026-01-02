import { motion } from 'framer-motion';
import {
  Save,
  Undo2,
  Redo2,
  X,
  Camera,
  Settings,
  Grid3x3,
  Ruler,
  Magnet
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TopMiniBarProps {
  onExit: () => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onScreenshot?: () => void;
  onToggleGrid?: () => void;
  onToggleRulers?: () => void;
  onToggleSnap?: () => void;
  onSettings?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  showGrid?: boolean;
  showRulers?: boolean;
  snapEnabled?: boolean;
}

export function TopMiniBar({
  onExit,
  onSave,
  onUndo,
  onRedo,
  onScreenshot,
  onToggleGrid,
  onToggleRulers,
  onToggleSnap,
  onSettings,
  canUndo = false,
  canRedo = false,
  showGrid = false,
  showRulers = true,
  snapEnabled = false,
}: TopMiniBarProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 h-12 bg-gradient-to-b from-gray-900 via-gray-900/95 to-gray-900/80 backdrop-blur-xl border-b border-gray-800/50 shadow-2xl"
    >
      <div className="h-full flex items-center justify-between px-4">
        {/* Left Section - Exit */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/30"
            title={t('advancedEditor.exitMode') || 'Salir del Modo Avanzado'}
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">
              {t('advancedEditor.exit') || 'Salir'}
            </span>
          </motion.button>
        </div>

        {/* Center Section - Main Actions */}
        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <motion.button
            whileHover={{ scale: canUndo ? 1.05 : 1 }}
            whileTap={{ scale: canUndo ? 0.95 : 1 }}
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-colors ${
              canUndo
                ? 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
                : 'bg-gray-800/20 text-gray-600 cursor-not-allowed'
            }`}
            title={t('advancedEditor.undo') || 'Deshacer (Ctrl+Z)'}
          >
            <Undo2 className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: canRedo ? 1.05 : 1 }}
            whileTap={{ scale: canRedo ? 0.95 : 1 }}
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-colors ${
              canRedo
                ? 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
                : 'bg-gray-800/20 text-gray-600 cursor-not-allowed'
            }`}
            title={t('advancedEditor.redo') || 'Rehacer (Ctrl+Y)'}
          >
            <Redo2 className="w-4 h-4" />
          </motion.button>

          <div className="w-px h-6 bg-gray-700/50 mx-1" />

          {/* Save */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSave}
            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
            title={t('advancedEditor.save') || 'Guardar (Ctrl+S)'}
          >
            <Save className="w-4 h-4" />
          </motion.button>

          {/* Screenshot */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onScreenshot}
            className="p-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-lg transition-colors"
            title={t('advancedEditor.screenshot') || 'Captura de Pantalla'}
          >
            <Camera className="w-4 h-4" />
          </motion.button>

          <div className="w-px h-6 bg-gray-700/50 mx-1" />

          {/* Grid Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleGrid}
            className={`p-2 rounded-lg transition-colors ${
              showGrid
                ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
            title={t('advancedEditor.toggleGrid') || 'Mostrar Grilla (G)'}
          >
            <Grid3x3 className="w-4 h-4" />
          </motion.button>

          {/* Rulers Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleRulers}
            className={`p-2 rounded-lg transition-colors ${
              showRulers
                ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
            title={t('advancedEditor.toggleRulers') || 'Mostrar Reglas (R)'}
          >
            <Ruler className="w-4 h-4" />
          </motion.button>

          {/* Snap Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSnap}
            className={`p-2 rounded-lg transition-colors ${
              snapEnabled
                ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
            title={t('advancedEditor.toggleSnap') || 'Ajustar a Grilla (Shift+S)'}
          >
            <Magnet className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Right Section - Settings */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSettings}
            className="p-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-lg transition-colors"
            title={t('advancedEditor.settings') || 'Configuración'}
          >
            <Settings className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
