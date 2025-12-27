/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

/**
 * Get the API base URL from environment variables
 * Falls back to default values if not configured
 */
export const getApiBaseUrl = (): string => {
  // Check if explicit URL is provided
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }

  // Check if should use relative path (production)
  const useRelative = import.meta.env.VITE_API_USE_RELATIVE === 'true';

  if (useRelative || import.meta.env.PROD) {
    // Use relative path based on BASE_URL
    const baseUrl = import.meta.env.BASE_URL || '/';
    // Ensure baseUrl ends with /
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}backend`;
  }

  // Development fallback
  return 'http://localhost:8000/backend';
};

/**
 * API Base URL - use this throughout the application
 */
export const API_BASE_URL = getApiBaseUrl();

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  GET_TOKENS: `${API_BASE_URL}/get_tokens.php`,
  PROCESS_CONCLUSION: `${API_BASE_URL}/consume_token.php`,
  CONFIRM_PROCESSING: `${API_BASE_URL}/confirm_processing.php`,
  CONTRIBUTE: `${API_BASE_URL}/receive_contribution.php`,
} as const;

/**
 * Log configuration on startup (only in development)
 */
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:');
  console.log('  Base URL:', API_BASE_URL);
  console.log('  Environment:', import.meta.env.MODE);
}
