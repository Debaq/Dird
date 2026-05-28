import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type ChatTemplate =
  | 'tinyllama' | 'chat_m_l' | 'llama3' | 'phi3' | 'gemma' | 'plain';

// El backend serializa `ChatML` como `chat_m_l` por rename_all = "snake_case".
// Aquí no nos importa: solo lo mostramos al usuario indirectamente.

export interface CatalogEntry {
  id: string;
  name: string;
  params: string;
  size_mb: number;
  quantization: string;
  url: string;
  sha256: string | null;
  license: string;
  family: string;
  languages: string[];
  description: string;
  chat_template: ChatTemplate;
}

export interface InstalledLlm {
  id: string;
  name: string;
  size_bytes: number;
  installed_at: string;
  active: boolean;
}

export interface DownloadProgress {
  id: string;
  received: number;
  total: number;
  done: boolean;
}

export interface GenerateParams {
  prompt: string;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  seed?: number;
}

export async function llmCatalog(): Promise<CatalogEntry[]> {
  return invoke<CatalogEntry[]>('llm_catalog');
}

export async function llmInstalled(): Promise<InstalledLlm[]> {
  return invoke<InstalledLlm[]>('llm_installed');
}

export async function llmDownload(id: string): Promise<InstalledLlm> {
  return invoke<InstalledLlm>('llm_download', { id });
}

export async function llmUninstall(id: string): Promise<void> {
  await invoke('llm_uninstall', { id });
}

export async function llmLoad(id: string): Promise<void> {
  await invoke('llm_load', { id });
}

export async function llmUnload(): Promise<void> {
  await invoke('llm_unload');
}

export async function llmActiveId(): Promise<string | null> {
  return invoke<string | null>('llm_active_id');
}

export async function llmGenerate(args: GenerateParams): Promise<string> {
  return invoke<string>('llm_generate', { args });
}

/**
 * Suscribe a eventos de progreso de descarga. Devuelve función para
 * cancelar la suscripción.
 */
export async function onLlmDownloadProgress(
  cb: (p: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>('llm:download_progress', (e) => cb(e.payload));
}
