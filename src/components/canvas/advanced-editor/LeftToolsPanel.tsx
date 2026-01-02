import { motion } from 'framer-motion';
import {
  MousePointer2,
  Square,
  Target,
  Eye,
  Ruler,
  Wand2,
  Eraser,
  Move,
  ZoomIn,
  Pipette,
  Focus,
  Map
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CanvasTool } from '../ToolPanel';

interface LeftToolsPanelProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onToggleMiniMap?: () => void;
  showMiniMap?: boolean;
  canvasPreview?: string;
}

const TOOLS: Array<{
  id: CanvasTool;
  icon: any;
  label: string;
  shortcut?: string;
}> = [
  { id: 'select', icon: MousePointer2, label: 'Seleccionar', shortcut: 'V' },
  { id: 'bbox', icon: Square, label: 'Bounding Box', shortcut: 'B' },
  { id: 'landmark', icon: Target, label: 'Punto de Referencia', shortcut: 'L' },
  { id: 'cup', icon: Eye, label: 'Copa Óptica', shortcut: 'C' },
  { id: 'ruler', icon: Ruler, label: 'Regla', shortcut: 'M' },
  { id: 'image-processing', icon: Wand2, label: 'Procesamiento', shortcut: 'P' },
  { id: 'eraser', icon: Eraser, label: 'Borrador', shortcut: 'E' },
  { id: 'pan', icon: Move, label: 'Mover', shortcut: 'H' },
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
];

export function LeftToolsPanel({
  activeTool,
  onToolChange,
  onToggleMiniMap,
  showMiniMap = true,
  canvasPreview,
}: LeftToolsPanelProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed left-0 top-12 bottom-0 w-16 bg-gradient-to-r from-gray-900 via-gray-900/95 to-gray-900/80 backdrop-blur-xl border-r border-gray-800/50 shadow-2xl z-40 flex flex-col"
    >
      {/* Tools */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <motion.button
              key={tool.id}
              whileHover={{ scale: 1.05, x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToolChange(tool.id)}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-lg transition-all relative group ${
                isActive
                  ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50 shadow-lg shadow-blue-500/20'
                  : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white'
              }`}
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            >
              <Icon className="w-5 h-5" />

              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
                {tool.label}
                {tool.shortcut && (
                  <span className="ml-2 text-gray-400">{tool.shortcut}</span>
                )}
              </div>

              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeToolIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full"
                />
              )}
            </motion.button>
          );
        })}

        <div className="h-px bg-gray-700/50 my-2" />

        {/* Extra Tools */}
        <motion.button
          whileHover={{ scale: 1.05, x: 2 }}
          whileTap={{ scale: 0.95 }}
          className="w-full aspect-square flex items-center justify-center rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all relative group"
          title={t('advancedEditor.colorPicker') || 'Selector de Color (I)'}
        >
          <Pipette className="w-5 h-5" />

          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
            {t('advancedEditor.colorPicker') || 'Selector de Color'}
            <span className="ml-2 text-gray-400">I</span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05, x: 2 }}
          whileTap={{ scale: 0.95 }}
          className="w-full aspect-square flex items-center justify-center rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all relative group"
          title={t('advancedEditor.focusMode') || 'Modo Foco (F)'}
        >
          <Focus className="w-5 h-5" />

          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
            {t('advancedEditor.focusMode') || 'Modo Foco'}
            <span className="ml-2 text-gray-400">F</span>
          </div>
        </motion.button>
      </div>

      {/* Mini Map Toggle */}
      <div className="p-2 border-t border-gray-800/50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleMiniMap}
          className={`w-full aspect-square flex items-center justify-center rounded-lg transition-all relative group ${
            showMiniMap
              ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
              : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
          }`}
          title={t('advancedEditor.miniMap') || 'Mini Mapa (N)'}
        >
          <Map className="w-5 h-5" />

          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
            {t('advancedEditor.miniMap') || 'Mini Mapa'}
            <span className="ml-2 text-gray-400">N</span>
          </div>
        </motion.button>
      </div>

      {/* Mini Preview */}
      {showMiniMap && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-gray-800/50 p-2"
        >
          <div className="relative aspect-square bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700/50">
            {canvasPreview ? (
              <img
                src={canvasPreview}
                alt="Canvas Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                Preview
              </div>
            )}

            {/* Viewport indicator */}
            <div className="absolute inset-0 border-2 border-blue-500/50 pointer-events-none" />
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-1">Mini Mapa</p>
        </motion.div>
      )}
    </motion.div>
  );
}
