import { getApiBaseUrl } from '@/config/api';

const API_BASE_URL = getApiBaseUrl();

export interface LogsResponse {
  success: boolean;
  content: string;
  file: string;
  total_lines: number;
  lines_returned: number;
  lines_requested: number;
  message?: string;
  error?: string;
}

export async function getDebugLogs(lines: number = 100): Promise<LogsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/admin/view_logs.php?type=debug&lines=${lines}`
  );
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function getErrorLogs(lines: number = 100): Promise<LogsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/admin/view_logs.php?type=errors&lines=${lines}`
  );
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
