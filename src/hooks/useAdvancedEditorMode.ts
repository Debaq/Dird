import { useState, useCallback } from 'react';

export interface AdvancedEditorModeState {
  isActive: boolean;
  showLeftPanel: boolean;
  showRightPanel: boolean;
  showMiniMap: boolean;
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  gridSize: number;
  theme: 'dark' | 'light';
  accentColor: string;
}

const DEFAULT_STATE: AdvancedEditorModeState = {
  isActive: false,
  showLeftPanel: true,
  showRightPanel: true,
  showMiniMap: true,
  showGrid: false,
  showRulers: true,
  snapToGrid: false,
  gridSize: 20,
  theme: 'dark',
  accentColor: '#3b82f6', // blue-500
};

export function useAdvancedEditorMode() {
  const [state, setState] = useState<AdvancedEditorModeState>(DEFAULT_STATE);

  const enterAdvancedMode = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true }));
  }, []);

  const exitAdvancedMode = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  const toggleAdvancedMode = useCallback(() => {
    setState(prev => ({ ...prev, isActive: !prev.isActive }));
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setState(prev => ({ ...prev, showLeftPanel: !prev.showLeftPanel }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState(prev => ({ ...prev, showRightPanel: !prev.showRightPanel }));
  }, []);

  const toggleMiniMap = useCallback(() => {
    setState(prev => ({ ...prev, showMiniMap: !prev.showMiniMap }));
  }, []);

  const toggleGrid = useCallback(() => {
    setState(prev => ({ ...prev, showGrid: !prev.showGrid }));
  }, []);

  const toggleRulers = useCallback(() => {
    setState(prev => ({ ...prev, showRulers: !prev.showRulers }));
  }, []);

  const toggleSnapToGrid = useCallback(() => {
    setState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const setGridSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, gridSize: size }));
  }, []);

  const setTheme = useCallback((theme: 'dark' | 'light') => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const setAccentColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, accentColor: color }));
  }, []);

  const updateState = useCallback((updates: Partial<AdvancedEditorModeState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    state,
    enterAdvancedMode,
    exitAdvancedMode,
    toggleAdvancedMode,
    toggleLeftPanel,
    toggleRightPanel,
    toggleMiniMap,
    toggleGrid,
    toggleRulers,
    toggleSnapToGrid,
    setGridSize,
    setTheme,
    setAccentColor,
    updateState,
  };
}
