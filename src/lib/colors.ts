/**
 * DIRD Color Palette
 *
 * This file documents the color system used throughout the application.
 * All colors are defined in tailwind.config.js and can be used via Tailwind classes.
 */

export const COLORS = {
  /**
   * Cian Médico #20B5AE
   * Primary brand color
   * Usage: Buttons, navbar, loading indicators, selection borders
   * Tailwind: bg-primary-500, text-primary-500, border-primary-500
   */
  PRIMARY: '#20B5AE',

  /**
   * Naranja Iris #B34B00
   * Accent color for critical elements
   * Usage: Retina lesion markers, critical alerts, chart accents
   * Tailwind: bg-accent-500, text-accent-500, border-accent-500
   */
  ACCENT: '#B34B00',

  /**
   * Gris Antracita #575756
   * Main text color
   * Usage: Titles, primary text, navigation icons
   * Tailwind: text-coal-500, fill-coal-500
   */
  COAL: '#575756',

  /**
   * Gris Humo #878787
   * Secondary text color
   * Usage: Secondary text, footers, data labels
   * Tailwind: text-smoke-500, fill-smoke-500
   */
  SMOKE: '#878787',

  /**
   * Blanco Nieve #FFFFFF
   * Container background
   * Usage: Card backgrounds, AI visualizer containers
   * Tailwind: bg-snow
   */
  SNOW: '#FFFFFF',

  /**
   * Gris Hielo #F8FAFC
   * App background
   * Usage: General app background (behind cards)
   * Tailwind: bg-ice
   */
  ICE: '#F8FAFC',
} as const;

/**
 * Semantic color mappings for specific use cases
 */
export const SEMANTIC_COLORS = {
  // Detection class colors (for bounding boxes and labels)
  DETECTION: {
    microaneurysm: '#B34B00',      // Accent
    hard_exudate: '#d87a1a',       // Accent-400
    soft_exudate: '#f8b05c',       // Accent-300
    hemorrhage: '#813700',         // Accent-700
    neovascularization: '#9a4100', // Accent-600
  },

  // UI States
  SUCCESS: '#10b981',  // green-500
  WARNING: '#f59e0b',  // amber-500
  ERROR: '#ef4444',    // red-500
  INFO: '#20B5AE',     // primary-500

  // Canvas layers
  CANVAS: {
    selection: '#20B5AE',      // Primary
    aiDetection: '#20B5AE',    // Primary
    aiSegmentation: '#80d9d5', // Primary-200 (more transparent)
    manual: '#B34B00',         // Accent
  },
} as const;
