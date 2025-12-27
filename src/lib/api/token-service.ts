/**
 * Token Service - Handles token-related API calls
 */

import { getInstallationToken } from '@/lib/utils/installation';
import { API_ENDPOINTS } from '@/config/api';

interface TokenResponse {
  success: boolean;
  tokens: number;
  is_new_installation?: boolean;
  timestamp: number;
}

interface ProcessConclusionResponse {
  success: boolean;
  message: string;
  processed_data: any;
  timestamp: number;
}

interface ConfirmProcessingResponse {
  success: boolean;
  message: string;
  remaining_tokens: number;
  timestamp: number;
}

/**
 * Fetch available tokens from the server
 * Automatically registers new installations
 */
export async function fetchTokens(): Promise<number> {
  try {
    const installationToken = getInstallationToken();

    const response = await fetch(API_ENDPOINTS.GET_TOKENS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installation_token: installationToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: TokenResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch tokens');
    }

    if (data.is_new_installation) {
      console.log('🎉 New installation registered with', data.tokens, 'tokens');
    }

    return data.tokens;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    // Return 0 if there's an error
    return 0;
  }
}

/**
 * Process conclusion data with the backend
 * Sends report data and receives processed result
 */
export async function processConclusion(reportData: any): Promise<any> {
  try {
    const installationToken = getInstallationToken();

    const response = await fetch(API_ENDPOINTS.PROCESS_CONCLUSION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installation_token: installationToken,
        report_data: reportData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ProcessConclusionResponse = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to process conclusion');
    }

    return data.processed_data;
  } catch (error) {
    console.error('Error processing conclusion:', error);
    throw error;
  }
}

/**
 * Confirm successful processing and consume token
 * Called after validating the processed data
 */
export async function confirmProcessing(): Promise<number> {
  try {
    const installationToken = getInstallationToken();

    const response = await fetch(API_ENDPOINTS.CONFIRM_PROCESSING, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installation_token: installationToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ConfirmProcessingResponse = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to confirm processing');
    }

    console.log('✅ Token consumed. Remaining:', data.remaining_tokens);
    return data.remaining_tokens;
  } catch (error) {
    console.error('Error confirming processing:', error);
    throw error;
  }
}
