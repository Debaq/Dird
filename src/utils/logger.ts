/**
 * Professional logging system with category-based control
 * Replaces scattered console.logs with a centralized, configurable solution
 */

import { useConfigStore } from '@/stores/config-store';

type LogLevel = 'log' | 'warn' | 'error' | 'info';
type LogCategory = 'api' | 'ai' | 'imageProcessing' | 'clinicalGuidelines' | 'database' | 'drClassification' | 'canvas' | 'general';

interface LogOptions {
  category: LogCategory;
  level?: LogLevel;
  data?: any;
}

class Logger {
  private getCategoryPrefix(category: LogCategory): string {
    const prefixes: Record<LogCategory, string> = {
      api: '[API]',
      ai: '[AI]',
      imageProcessing: '[Image Processing]',
      clinicalGuidelines: '[Clinical Guidelines]',
      database: '[Database]',
      drClassification: '[DR Classification]',
      canvas: '[Canvas]',
      general: '[App]'
    };
    return prefixes[category];
  }

  private shouldLog(category: LogCategory): boolean {
    const state = useConfigStore.getState();
    const config = state?.config;

    // Safety check: if config or debug is not initialized yet
    if (!config || !config.debug) {
      // In development, show logs by default when config is not ready
      // In production, don't show anything
      return import.meta.env.DEV;
    }

    // In production mode, only log if debug is explicitly enabled
    if (import.meta.env.PROD && !config.debug.enabled) {
      return false;
    }

    // Check if debug is enabled globally
    if (!config.debug.enabled) {
      return false;
    }

    // Check if the specific category is enabled
    return config.debug.categories[category];
  }

  private isDebugEnabled(): boolean {
    const state = useConfigStore.getState();
    const config = state?.config;

    // Safety check: if config or debug is not initialized yet, return false
    if (!config || !config.debug) {
      return false;
    }

    return config.debug.enabled;
  }

  private formatMessage(category: LogCategory, message: string): string {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = this.getCategoryPrefix(category);
    return `${timestamp} ${prefix} ${message}`;
  }

  /**
   * Generic log method
   */
  private logMessage(options: LogOptions, message: string): void {
    if (!this.shouldLog(options.category)) {
      return;
    }

    const formattedMessage = this.formatMessage(options.category, message);
    const level = options.level || 'log';

    if (options.data !== undefined) {
      console[level](formattedMessage, options.data);
    } else {
      console[level](formattedMessage);
    }
  }

  /**
   * Log an informational message
   */
  log(category: LogCategory, message: string, data?: any): void {
    this.logMessage({ category, level: 'log', data }, message);
  }

  /**
   * Log a warning message
   */
  warn(category: LogCategory, message: string, data?: any): void {
    this.logMessage({ category, level: 'warn', data }, message);
  }

  /**
   * Log an error message
   * Errors are always logged regardless of debug settings in development
   */
  error(category: LogCategory, message: string, data?: any): void {
    if (import.meta.env.DEV) {
      // Always log errors in development
      const formattedMessage = this.formatMessage(category, message);
      if (data !== undefined) {
        console.error(formattedMessage, data);
      } else {
        console.error(formattedMessage);
      }
    } else {
      // In production, respect debug settings
      this.logMessage({ category, level: 'error', data }, message);
    }
  }

  /**
   * Log an info message
   */
  info(category: LogCategory, message: string, data?: any): void {
    this.logMessage({ category, level: 'info', data }, message);
  }

  /**
   * Category-specific convenience methods
   */
  api = {
    log: (message: string, data?: any) => this.log('api', message, data),
    warn: (message: string, data?: any) => this.warn('api', message, data),
    error: (message: string, data?: any) => this.error('api', message, data),
    info: (message: string, data?: any) => this.info('api', message, data),
  };

  ai = {
    log: (message: string, data?: any) => this.log('ai', message, data),
    warn: (message: string, data?: any) => this.warn('ai', message, data),
    error: (message: string, data?: any) => this.error('ai', message, data),
    info: (message: string, data?: any) => this.info('ai', message, data),
  };

  imageProcessing = {
    log: (message: string, data?: any) => this.log('imageProcessing', message, data),
    warn: (message: string, data?: any) => this.warn('imageProcessing', message, data),
    error: (message: string, data?: any) => this.error('imageProcessing', message, data),
    info: (message: string, data?: any) => this.info('imageProcessing', message, data),
  };

  clinicalGuidelines = {
    log: (message: string, data?: any) => this.log('clinicalGuidelines', message, data),
    warn: (message: string, data?: any) => this.warn('clinicalGuidelines', message, data),
    error: (message: string, data?: any) => this.error('clinicalGuidelines', message, data),
    info: (message: string, data?: any) => this.info('clinicalGuidelines', message, data),
  };

  database = {
    log: (message: string, data?: any) => this.log('database', message, data),
    warn: (message: string, data?: any) => this.warn('database', message, data),
    error: (message: string, data?: any) => this.error('database', message, data),
    info: (message: string, data?: any) => this.info('database', message, data),
  };

  drClassification = {
    log: (message: string, data?: any) => this.log('drClassification', message, data),
    warn: (message: string, data?: any) => this.warn('drClassification', message, data),
    error: (message: string, data?: any) => this.error('drClassification', message, data),
    info: (message: string, data?: any) => this.info('drClassification', message, data),
  };

  canvas = {
    log: (message: string, data?: any) => this.log('canvas', message, data),
    warn: (message: string, data?: any) => this.warn('canvas', message, data),
    error: (message: string, data?: any) => this.error('canvas', message, data),
    info: (message: string, data?: any) => this.info('canvas', message, data),
  };

  general = {
    log: (message: string, data?: any) => this.log('general', message, data),
    warn: (message: string, data?: any) => this.warn('general', message, data),
    error: (message: string, data?: any) => this.error('general', message, data),
    info: (message: string, data?: any) => this.info('general', message, data),
  };
}

// Export a singleton instance
export const logger = new Logger();

/**
 * Development utilities exposed to browser console
 * Available as window.dirdDevUtils in development mode
 */
if (import.meta.env.DEV) {
  import('@/lib/db/actions').then(({ cleanupInvalidAnnotations }) => {
    (window as any).dirdDevUtils = {
      cleanupInvalidAnnotations,
      help: () => {
        console.log(`
=== DIRD Development Utilities ===

Available commands:
  window.dirdDevUtils.cleanupInvalidAnnotations()
    - Removes all invalid annotations from the database
    - Returns a promise with the number of removed annotations
    - Example: await window.dirdDevUtils.cleanupInvalidAnnotations()

  window.dirdDevUtils.help()
    - Shows this help message
        `);
      }
    };

    console.log('%c[DIRD Dev Utils]%c Development utilities loaded. Type %cwindow.dirdDevUtils.help()%c for available commands.',
      'font-weight: bold; color: #2563eb',
      'color: inherit',
      'font-family: monospace; background: #f1f5f9; padding: 2px 4px; border-radius: 3px',
      'color: inherit'
    );
  });
}
