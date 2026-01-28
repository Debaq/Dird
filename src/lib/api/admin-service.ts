/**
 * Admin API Service
 * Handles all admin-related API calls
 */

import { API_ENDPOINTS } from '@/config/api';
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  Installation,
  Contribution,
  UpdateTokensRequest,
  SendMessageRequest,
  BroadcastMessage,
  Beacon,
  ActivateBeaconRequest,
  ActivateBeaconResponse,
  ApiResponse,
} from '@/types/admin';

const ADMIN_TOKEN_KEY = 'dird-admin-token';

/**
 * Get stored admin token
 */
export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

/**
 * Save admin token to localStorage
 */
export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

/**
 * Remove admin token from localStorage
 */
export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Get authorization headers for admin requests
 */
function getAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: token }),
  };
}

/**
 * Login as admin
 */
export async function loginAdmin(
  credentials: AdminLoginRequest
): Promise<AdminLoginResponse> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_LOGIN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data: AdminLoginResponse = await response.json();

    if (data.success && data.token) {
      setAdminToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión',
    };
  }
}

/**
 * Logout admin (clear local token)
 */
export function logoutAdmin(): void {
  clearAdminToken();
}

/**
 * Check if user is authenticated as admin
 */
export function isAdminAuthenticated(): boolean {
  return !!getAdminToken();
}

/**
 * Change admin password
 */
export async function changeAdminPassword(
  request: ChangePasswordRequest
): Promise<ChangePasswordResponse> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_CHANGE_PASSWORD, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    const data: ChangePasswordResponse = await response.json();

    // If password was changed successfully, clear local token
    // User will need to login again
    if (data.success) {
      clearAdminToken();
    }

    return data;
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión',
    };
  }
}

/**
 * Get all installations with tokens info
 */
export async function getInstallations(): Promise<Installation[]> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_GET_INSTALLATIONS, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse<{ installations: Installation[]; total: number }> =
      await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al obtener instalaciones');
    }

    return data.data?.installations || [];
  } catch (error) {
    console.error('Get installations error:', error);
    throw error;
  }
}

/**
 * Update tokens for a specific installation
 */
export async function updateTokens(
  request: UpdateTokensRequest
): Promise<number> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_UPDATE_TOKENS, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse<{ new_total: number }> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al actualizar tokens');
    }

    return data.data?.new_total || 0;
  } catch (error) {
    console.error('Update tokens error:', error);
    throw error;
  }
}

/**
 * Get all contributions
 */
export async function getContributions(): Promise<Contribution[]> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_GET_CONTRIBUTIONS, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse<{ contributions: Contribution[]; total: number }> =
      await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al obtener contribuciones');
    }

    return data.data?.contributions || [];
  } catch (error) {
    console.error('Get contributions error:', error);
    throw error;
  }
}

/**
 * Send broadcast message to all users
 */
export async function sendBroadcastMessage(
  request: SendMessageRequest
): Promise<string> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_SEND_MESSAGE, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse<{ message_id: string }> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al enviar mensaje');
    }

    return data.data?.message_id || '';
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

/**
 * Get pending messages for current installation
 */
export async function fetchPendingMessages(
  installationToken: string
): Promise<BroadcastMessage[]> {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.GET_MESSAGES}?installation_token=${encodeURIComponent(installationToken)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse<{ messages: BroadcastMessage[]; count: number }> =
      await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al obtener mensajes');
    }

    return data.data?.messages || [];
  } catch (error) {
    console.error('Fetch messages error:', error);
    return [];
  }
}

/**
 * Mark message as read for current installation
 */
export async function markMessageAsRead(
  messageId: string,
  installationToken: string
): Promise<void> {
  try {
    const response = await fetch(API_ENDPOINTS.MARK_MESSAGE_READ, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_id: messageId,
        installation_token: installationToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al marcar mensaje como leído');
    }
  } catch (error) {
    console.error('Mark message read error:', error);
    // Don't throw - failing to mark as read shouldn't block user
  }
}

/**
 * Activate beacon for current installation
 */
export async function activateBeacon(
  installationToken: string
): Promise<ActivateBeaconResponse> {
  try {
    const request: ActivateBeaconRequest = {
      installation_token: installationToken,
    };

    const response = await fetch(API_ENDPOINTS.ACTIVATE_BEACON, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ActivateBeaconResponse = await response.json();

    if (!data.success) {
      throw new Error('Error al activar baliza');
    }

    return data;
  } catch (error) {
    console.error('Activate beacon error:', error);
    throw error;
  }
}

/**
 * Get active beacons (admin only)
 */
export async function getActiveBeacons(): Promise<Beacon[]> {
  try {
    const response = await fetch(API_ENDPOINTS.ADMIN_GET_BEACONS, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse<{ beacons: Beacon[]; count: number }> =
      await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al obtener balizas');
    }

    return data.data?.beacons || [];
  } catch (error) {
    console.error('Get beacons error:', error);
    throw error;
  }
}

/**
 * Download contributions as .tix file (Annotix format)
 */
export async function downloadTixPackage(
  installationToken?: string
): Promise<void> {
  try {
    const url = new URL(API_ENDPOINTS.ADMIN_DOWNLOAD_TIX);
    if (installationToken) {
      url.searchParams.append('installation_token', installationToken);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Get the blob
    const blob = await response.blob();

    // Create download link
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    link.download = `dird_contributions_${
    installationToken ? installationToken.substring(0, 8) : 'all'
    }_${new Date().toISOString().split('T')[0]}.tix`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Download TIX error:', error);
    throw error;
  }
}
