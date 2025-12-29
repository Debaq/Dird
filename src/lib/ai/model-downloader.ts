import type { ModelMetadata } from './model-metadata';

export type DownloadProgressCallback = (progress: number) => void;

export interface ModelSource {
  type: 'github' | 'local';
  branch?: string; // For GitHub (version branch)
  path: string; // Relative path in repo or local path
}

export interface ModelConfig {
  detection: ModelSource;
  segmentation?: ModelSource;
}

export interface AvailableModel {
  name: string;
  version: string;
  type: 'detection' | 'segmentation';
  onnxUrl: string;
  jsonUrl: string;
}

// Default configuration
const DEFAULT_CONFIG: ModelConfig = {
  detection: {
    type: 'github',
    branch: 'main',
    path: 'detection-v1.0.0.onnx',
  },
  segmentation: {
    type: 'github',
    branch: 'main',
    path: 'segmentation-v1.0.0.onnx',
  },
};

const GITHUB_REPO = 'Debaq/dird_models';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents`;
const CACHE_NAME = 'dird-onnx-models';

export class ModelDownloader {
  private config: ModelConfig;

  constructor(config?: ModelConfig) {
    this.config = config || DEFAULT_CONFIG;
  }

  /**
   * List available models in the GitHub repository
   */
  async listAvailableModels(branch: string = 'main'): Promise<AvailableModel[]> {
    try {
      console.log(`Fetching available models from GitHub (branch: ${branch})...`);

      const response = await fetch(`${GITHUB_API_URL}?ref=${branch}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch repository contents: ${response.statusText}`);
      }

      const files = await response.json();
      const models: AvailableModel[] = [];

      // Find all .onnx files
      const onnxFiles = files.filter((file: any) =>
        file.name.endsWith('.onnx') && file.type === 'file'
      );

      for (const onnxFile of onnxFiles) {
        // Check if corresponding .json exists
        const jsonName = onnxFile.name.replace('.onnx', '.json');
        const jsonFile = files.find((f: any) => f.name === jsonName);

        if (jsonFile) {
          // Extract model type and version from filename
          // Format: detection-v1.0.1.onnx or segmentation-v1.0.0.onnx
          const match = onnxFile.name.match(/^(detection|segmentation)-v?([\d.]+)\.onnx$/);

          if (match) {
            const [, type, version] = match;
            models.push({
              name: onnxFile.name,
              version,
              type: type as 'detection' | 'segmentation',
              onnxUrl: `https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/${onnxFile.name}`,
              jsonUrl: `https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/${jsonName}`,
            });
          }
        }
      }

      console.log(`Found ${models.length} available models:`, models);
      return models;

    } catch (error) {
      console.error('Error listing models:', error);
      throw error;
    }
  }

  /**
   * Find the latest version of a model type
   */
  async findLatestModel(
    modelType: 'detection' | 'segmentation',
    branch: string = 'main'
  ): Promise<AvailableModel | null> {
    const models = await this.listAvailableModels(branch);
    const filtered = models.filter(m => m.type === modelType);

    if (filtered.length === 0) {
      return null;
    }

    // Sort by version (semantic versioning)
    filtered.sort((a, b) => {
      const aParts = a.version.split('.').map(Number);
      const bParts = b.version.split('.').map(Number);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) {
          return bVal - aVal; // Descending order
        }
      }
      return 0;
    });

    return filtered[0];
  }

  /**
   * Download model from GitHub or load from local
   */
  async downloadModel(
    modelType: 'detection' | 'segmentation',
    onProgress?: DownloadProgressCallback
  ): Promise<{ modelUrl: string; metadata: ModelMetadata }> {
    // First, try to find the latest model in the repository
    try {
      console.log(`Looking for latest ${modelType} model...`);
      const latestModel = await this.findLatestModel(modelType);

      if (latestModel) {
        console.log(`Found latest ${modelType} model: ${latestModel.name} (v${latestModel.version})`);
        return await this.downloadFromUrls(latestModel.onnxUrl, latestModel.jsonUrl, onProgress);
      }

      console.warn(`No ${modelType} model found in repository, trying fallback...`);
    } catch (error) {
      console.warn('Error searching for models, using fallback:', error);
    }

    // Fallback to configured source
    const source = this.config[modelType];
    if (!source) {
      throw new Error(`No ${modelType} model found in repository or configuration`);
    }

    if (source.type === 'github') {
      return await this.downloadFromGitHub(source, onProgress);
    } else {
      onProgress?.(100); // Local load is instant relative to download
      return await this.loadFromLocal(source);
    }
  }

  /**
   * Download from direct URLs with caching
   */
  private async downloadFromUrls(
    modelUrl: string,
    metadataUrl: string,
    onProgress?: DownloadProgressCallback
  ): Promise<{ modelUrl: string; metadata: ModelMetadata }> {
    console.log(`Downloading model from: ${modelUrl}`);

    try {
      // Check cache first
      const cache = await caches.open(CACHE_NAME);

      // Try to get from cache
      let modelResponse = await cache.match(modelUrl);

      // Download metadata (always fetch to check for updates)
      const metadataFetchResponse = await fetch(metadataUrl);
      if (!metadataFetchResponse.ok) {
        throw new Error(`Failed to fetch metadata: ${metadataFetchResponse.statusText}`);
      }

      // Clone before consuming the body
      const metadataClone = metadataFetchResponse.clone();
      const metadata: ModelMetadata = await metadataFetchResponse.json();

      // Cache metadata
      await cache.put(metadataUrl, metadataClone);

      // Download model if not cached
      if (!modelResponse) {
        console.log('Model not in cache, downloading...');
        
        // Use fetch with ReadableStream for progress
        const response = await fetch(modelUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch model: ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const stream = new ReadableStream({
          start(controller) {
            const reader = response.body!.getReader();

            function push() {
              reader.read().then(({ done, value }) => {
                if (done) {
                  controller.close();
                  return;
                }
                loaded += value.byteLength;
                if (total && onProgress) {
                  onProgress(Math.round((loaded / total) * 100));
                }
                controller.enqueue(value);
                push();
              });
            }

            push();
          }
        });

        // Create a new response from the stream
        const newResponse = new Response(stream, { headers: response.headers });
        
        // We need to clone it because we consume one for cache and one for return (if needed, though here we just cache)
        // Actually, Response.clone() might not work well with streams that are being read.
        // Better approach: Read the stream into a Blob/ArrayBuffer, then cache that.
        const blob = await newResponse.blob();
        
        // Cache the blob
        await cache.put(modelUrl, new Response(blob));
        
        // Return a response pointing to the blob (mocking a fetch response)
        // But since our loadFromLocal/download functions return URLs or objects,
        // and ONNX manager usually takes a URL or ArrayBuffer...
        // The current implementation returns { modelUrl, metadata }.
        // ONNX manager will fetch this URL again.
        // If it's in cache, the subsequent fetch in ONNX manager will hit the cache.
        
      } else {
        console.log('Model loaded from cache');
        onProgress?.(100);
      }

      return {
        modelUrl,
        metadata,
      };
    } catch (error) {
      console.error('Error downloading from URLs:', error);
      throw error;
    }
  }

  /**
   * Download from GitHub with caching
   */
  private async downloadFromGitHub(
    source: ModelSource,
    onProgress?: DownloadProgressCallback
  ): Promise<{ modelUrl: string; metadata: ModelMetadata }> {
    const { branch, path } = source;

    // GitHub raw content URLs
    const modelUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/${path}`;
    const metadataUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/${path.replace('.onnx', '.json')}`;

    return await this.downloadFromUrls(modelUrl, metadataUrl, onProgress);
  }

  /**
   * Load from local public folder
   */
  private async loadFromLocal(
    source: ModelSource
  ): Promise<{ modelUrl: string; metadata: ModelMetadata }> {
    const modelPath = `${import.meta.env.BASE_URL}${source.path.startsWith('/') ? source.path.slice(1) : source.path}`;
    const metadataPath = modelPath.replace('.onnx', '.json');

    console.log(`Loading model from local: ${modelPath}`);

    try {
      const metadataResponse = await fetch(metadataPath);
      if (!metadataResponse.ok) {
        throw new Error(
          `No se encontró el modelo local en ${metadataPath}. ` +
          `Por favor, coloca los archivos del modelo en la carpeta public/models/ ` +
          `o asegúrate de que la descarga desde GitHub funcione correctamente.`
        );
      }

      const metadata: ModelMetadata = await metadataResponse.json();

      return {
        modelUrl: modelPath,
        metadata,
      };
    } catch (error) {
      console.error('Error loading local model:', error);
      throw error;
    }
  }

  /**
   * Clear model cache
   */
  async clearCache(): Promise<void> {
    try {
      await caches.delete(CACHE_NAME);
      console.log('Model cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Check if model is cached
   */
  async isCached(modelType: 'detection' | 'segmentation'): Promise<boolean> {
    const source = this.config[modelType];
    if (!source || source.type !== 'github') return false;

    const modelUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${source.branch}/${source.path}`;

    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(modelUrl);
      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Get currently loaded model version from cache
   */
  async getLoadedModelVersion(modelType: 'detection' | 'segmentation'): Promise<string | null> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();

      // Find all cached models of this type
      for (const request of keys) {
        const url = request.url;
        if (url.includes('.json')) continue; // Skip metadata files

        // Extract model type and version from URL
        const match = url.match(new RegExp(`${modelType}-v?([\\d.]+)\\.onnx`));
        if (match) {
          return match[1]; // Return version
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get cache size (approximate)
   */
  async getCacheSize(): Promise<number> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      let totalSize = 0;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const modelDownloader = new ModelDownloader();

// Helper function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
