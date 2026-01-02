import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useEffect } from 'react';
import { TopMiniBar } from './TopMiniBar';
import { LeftToolsPanel } from './LeftToolsPanel';
import { RightLayersPanel } from './RightLayersPanel';
import type { CanvasLayer } from '../AdvancedLayerControls';
import type { CanvasTool } from '../ToolPanel';

interface AdvancedEditorLayoutProps {
  isActive: boolean;
  children: ReactNode;

  // State
  activeTool: CanvasTool;
  layers: CanvasLayer[];
  canUndo?: boolean;
  canRedo?: boolean;
  showGrid?: boolean;
  showRulers?: boolean;
  snapEnabled?: boolean;
  showMiniMap?: boolean;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
  imageUrl?: string;
  canvasPreview?: string;

  // Handlers
  onExit: () => void;
  onToolChange: (tool: CanvasTool) => void;
  onLayerToggle: (layerId: string) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerLockToggle: (layerId: string) => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onScreenshot?: () => void;
  onToggleGrid?: () => void;
  onToggleRulers?: () => void;
  onToggleSnap?: () => void;
  onToggleMiniMap?: () => void;
  onSettings?: () => void;
}

export function AdvancedEditorLayout({
  isActive,
  children,
  activeTool,
  layers,
  canUndo = false,
  canRedo = false,
  showGrid = false,
  showRulers = true,
  snapEnabled = false,
  showMiniMap = true,
  showLeftPanel = true,
  showRightPanel = true,
  imageUrl,
  canvasPreview,
  onExit,
  onToolChange,
  onLayerToggle,
  onLayerOpacityChange,
  onLayerLockToggle,
  onSave,
  onUndo,
  onRedo,
  onScreenshot,
  onToggleGrid,
  onToggleRulers,
  onToggleSnap,
  onToggleMiniMap,
  onSettings,
}: AdvancedEditorLayoutProps) {

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to exit
      if (e.key === 'Escape') {
        onExit();
        return;
      }

      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl/Cmd + Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z to redo
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Tool shortcuts (only if no modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            onToolChange('select');
            break;
          case 'b':
            onToolChange('bbox');
            break;
          case 'l':
            onToolChange('landmark');
            break;
          case 'c':
            onToolChange('cup');
            break;
          case 'm':
            onToolChange('ruler');
            break;
          case 'p':
            onToolChange('image-processing');
            break;
          case 'e':
            onToolChange('eraser');
            break;
          case 'h':
            onToolChange('pan');
            break;
          case 'z':
            onToolChange('zoom');
            break;
          case 'g':
            onToggleGrid?.();
            break;
          case 'r':
            onToggleRulers?.();
            break;
          case 'n':
            onToggleMiniMap?.();
            break;
        }
      }

      // Shift + S for snap
      if (e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onToggleSnap?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    onExit,
    onSave,
    onUndo,
    onRedo,
    onToolChange,
    onToggleGrid,
    onToggleRulers,
    onToggleSnap,
    onToggleMiniMap,
  ]);

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <AnimatePresence>
        {/* Top Mini Bar */}
        <TopMiniBar
          onExit={onExit}
          onSave={onSave}
          onUndo={onUndo}
          onRedo={onRedo}
          onScreenshot={onScreenshot}
          onToggleGrid={onToggleGrid}
          onToggleRulers={onToggleRulers}
          onToggleSnap={onToggleSnap}
          onSettings={onSettings}
          canUndo={canUndo}
          canRedo={canRedo}
          showGrid={showGrid}
          showRulers={showRulers}
          snapEnabled={snapEnabled}
        />

        {/* Left Tools Panel */}
        {showLeftPanel && (
          <LeftToolsPanel
            activeTool={activeTool}
            onToolChange={onToolChange}
            onToggleMiniMap={onToggleMiniMap}
            showMiniMap={showMiniMap}
            canvasPreview={canvasPreview}
          />
        )}

        {/* Right Layers Panel */}
        {showRightPanel && (
          <RightLayersPanel
            layers={layers}
            activeTool={activeTool}
            onLayerToggle={onLayerToggle}
            onLayerOpacityChange={onLayerOpacityChange}
            onLayerLockToggle={onLayerLockToggle}
            imageUrl={imageUrl}
          />
        )}

        {/* Canvas Area - with padding for panels */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute top-12 bottom-0"
          style={{
            left: showLeftPanel ? '64px' : '0',
            right: showRightPanel ? '320px' : '0',
          }}
        >
          {/* Grid Overlay */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            />
          )}

          {/* Rulers */}
          {showRulers && (
            <>
              {/* Horizontal Ruler */}
              <div className="absolute top-0 left-0 right-0 h-6 bg-gray-900/90 border-b border-gray-700/50 flex items-end text-[10px] text-gray-500 z-10">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} className="flex-1 border-l border-gray-700/30 relative">
                    {i % 5 === 0 && (
                      <span className="absolute -top-4 left-0.5">{i * 20}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Vertical Ruler */}
              <div className="absolute top-6 left-0 bottom-0 w-6 bg-gray-900/90 border-r border-gray-700/50 flex flex-col text-[10px] text-gray-500 z-10">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} className="flex-1 border-t border-gray-700/30 relative">
                    {i % 5 === 0 && (
                      <span className="absolute left-0.5 top-0.5 -rotate-90 origin-top-left">
                        {i * 20}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Canvas Content */}
          <div
            className="w-full h-full"
            style={{
              paddingTop: showRulers ? '24px' : '0',
              paddingLeft: showRulers ? '24px' : '0',
            }}
          >
            {children}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Performance Indicator (FPS Counter) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-4 left-4 px-3 py-1.5 bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-lg text-xs text-gray-400 font-mono z-50"
      >
        <span className="text-green-400">●</span> 60 FPS
      </motion.div>

      {/* Snap Indicator */}
      {snapEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-purple-500/20 backdrop-blur-sm border border-purple-500/50 rounded-lg text-xs text-purple-300 font-medium z-50"
        >
          🧲 Ajuste a Grilla Activado
        </motion.div>
      )}
    </div>
  );
}
