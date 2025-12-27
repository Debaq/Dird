import { getApiBaseUrl } from '@/config/api';

const API_BASE_URL = getApiBaseUrl();

export interface AIModel {
  id: string;
  name: string;
  description: string;
}

export interface AIConfig {
  active_model: string;
  models: AIModel[];
  system_prompt: string;
}

export interface AIConfigResponse {
  success: boolean;
  config: AIConfig;
  has_key: boolean;
  masked_key: string;
  error?: string;
}

export interface SaveAIConfigPayload {
  api_key?: string;
  active_model?: string;
  models?: AIModel[];
  system_prompt?: string;
}

export interface TestAIConfigPayload {
  model: string;
  system_prompt: string;
  test_data?: any;
  language?: string;
}

export interface TestAIConfigResponse {
  success: boolean;
  http_code: number;
  response: any;
  sent_prompt: string;
  error?: string;
}

const ENDPOINTS = {
  GET_CONFIG: `${API_BASE_URL}/admin/get_ai_config.php`,
  SAVE_CONFIG: `${API_BASE_URL}/admin/save_ai_config.php`,
  TEST_CONFIG: `${API_BASE_URL}/admin/test_ai_config.php`,
};

export async function getAIConfig(): Promise<AIConfigResponse> {
  const response = await fetch(ENDPOINTS.GET_CONFIG);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function saveAIConfig(data: SaveAIConfigPayload): Promise<void> {
  const response = await fetch(ENDPOINTS.SAVE_CONFIG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to save configuration');
  }
}

export async function testAIConfig(data: TestAIConfigPayload): Promise<TestAIConfigResponse> {
  const response = await fetch(ENDPOINTS.TEST_CONFIG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
