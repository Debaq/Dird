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
  // Existing endpoints
  GET_TOKENS: `${API_BASE_URL}/get_tokens.php`,
  PROCESS_CONCLUSION: `${API_BASE_URL}/consume_token.php`,
  CONFIRM_PROCESSING: `${API_BASE_URL}/confirm_processing.php`,
  CONTRIBUTE: `${API_BASE_URL}/receive_contribution.php`,

  // Admin endpoints
  ADMIN_LOGIN: `${API_BASE_URL}/admin/login_admin.php`,
  ADMIN_CHANGE_PASSWORD: `${API_BASE_URL}/admin/change_password.php`,
  ADMIN_GET_CONTRIBUTIONS: `${API_BASE_URL}/admin/get_contributions.php`,
  ADMIN_DOWNLOAD_TIX: `${API_BASE_URL}/admin/download_tix.php`,
  ADMIN_GET_INSTALLATIONS: `${API_BASE_URL}/admin/get_installations.php`,
  ADMIN_UPDATE_TOKENS: `${API_BASE_URL}/admin/update_tokens.php`,
  ADMIN_SEND_MESSAGE: `${API_BASE_URL}/admin/send_message.php`,
  ADMIN_GET_BEACONS: `${API_BASE_URL}/admin/get_beacons.php`,

  // Client endpoints for messages and beacons
  GET_MESSAGES: `${API_BASE_URL}/admin/get_messages.php`,
  MARK_MESSAGE_READ: `${API_BASE_URL}/admin/mark_message_read.php`,
  ACTIVATE_BEACON: `${API_BASE_URL}/admin/activate_beacon.php`,
} as const;

/**
 * Log configuration on startup (only in development)
 */
import { logger } from '@/utils/logger';

if (import.meta.env.DEV) {
  logger.api.log('API Configuration', {
    baseURL: API_BASE_URL,
    environment: import.meta.env.MODE
  });
}
