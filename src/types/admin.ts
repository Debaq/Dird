/**
 * Admin System TypeScript Definitions
 */

export interface Installation {
  installation_token: string;
  tokens: number;
  created_at: string;
  last_access: string;
  last_usage?: string;
  has_active_beacon: boolean;
}

export interface Contribution {
  id: string;
  type?: 'image' | 'guideline' | 'conclusion';
  filename: string;
  original_filename: string;
  size: number;
  size_formatted: string;
  installation_token: string;
  uploaded_at: string;
  folder_path?: string;
  image_exists?: boolean;
  json_exists?: boolean;
  download_url_image?: string;
  download_url_json?: string;
  // New fields
  exists?: boolean;
  download_url?: string;
  guideline_name?: string;
  guideline_version?: string;
}

export interface BroadcastMessage {
  id: string;
  text: string;
  type: 'toast' | 'modal';
  variant: 'info' | 'success' | 'warning' | 'error';
  created_at: string;
  expires_at?: string;
}

export interface Beacon {
  installation_token: string;
  activated_at: string;
  expires_at: string;
  seconds_remaining: number;
}

export interface AdminSession {
  token: string;
  expires_at: string;
  username: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  expires_at?: string;
  username?: string;
  error?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface UpdateTokensRequest {
  installation_token: string;
  new_total: number;
}

export interface SendMessageRequest {
  text: string;
  type: 'toast' | 'modal';
  variant: 'info' | 'success' | 'warning' | 'error';
  expires_in_hours?: number;
}

export interface ActivateBeaconRequest {
  installation_token: string;
}

export interface ActivateBeaconResponse {
  success: boolean;
  message: string;
  already_active: boolean;
  expires_at: string;
  seconds_remaining: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}
