import { useEffect } from 'react';
import { useConfigStore } from '@/stores/config-store';

export const useTheme = () => {
  const { config } = useConfigStore();

  useEffect(() => {
    const root = document.documentElement;
    const theme = config.appearance.theme;

    // Remover clases de tema anteriores
    root.classList.remove('light', 'dark');
    
    // Determinar el tema actual
    let currentTheme = theme;
    if (theme === 'auto') {
      currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Aplicar la clase de tema
    root.classList.add(currentTheme);
    
    // También aplicar al body para mayor especificidad
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(currentTheme);
  }, [config.appearance.theme]);

  // Escuchar cambios en la preferencia del sistema para 'auto'
  useEffect(() => {
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (config.appearance.theme === 'auto') {
        const root = document.documentElement;
        const newTheme = e.matches ? 'dark' : 'light';
        
        root.classList.remove('light', 'dark');
        root.classList.add(newTheme);
        
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(newTheme);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [config.appearance.theme]);
};