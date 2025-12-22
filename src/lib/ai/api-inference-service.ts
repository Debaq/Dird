import type {
  APIInferenceRequest,
  APIInferenceResponse,
  InferenceResult,
  ModelType
} from '@/types/models';
import { useConfigStore } from '@/stores/config-store';

export class APIInferenceService {
  private endpoint: string;
  private apiKey: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor() {
    const config = useConfigStore.getState().config;
    this.endpoint = config.apiModels.endpoint;
    this.apiKey = config.apiModels.apiKey;
    this.headers = config.apiModels.headers || {};
    this.timeout = config.apiModels.timeout || 30000;
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(): void {
    const config = useConfigStore.getState().config;
    this.endpoint = config.apiModels.endpoint;
    this.apiKey = config.apiModels.apiKey;
    this.headers = config.apiModels.headers || {};
    this.timeout = config.apiModels.timeout || 30000;
  }

  /**
   * Convert image to base64
   */
  private async imageToBase64(image: HTMLImageElement | Blob): Promise<string> {
    if (image instanceof Blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix if present
          const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(image);
      });
    } else {
      // HTMLImageElement - convert canvas to base64
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(image, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      return base64.split(',')[1];
    }
  }

  /**
   * Run inference via API
   */
  async runInference(
    image: HTMLImageElement | Blob,
    modelType: ModelType,
    options?: {
      modelName?: string;
      confidenceThreshold?: number;
      iouThreshold?: number;
    }
  ): Promise<InferenceResult> {
    this.updateConfig();

    if (!this.endpoint) {
      throw new Error('API endpoint not configured');
    }

    const startTime = performance.now();

    try {
      // Convert image to base64
      const base64Image = await this.imageToBase64(image);

      // Prepare request
      const requestBody: APIInferenceRequest = {
        image: base64Image,
        modelType,
        modelName: options?.modelName || useConfigStore.getState().config.apiModels.modelName,
        confidenceThreshold: options?.confidenceThreshold || 0.5,
        iouThreshold: options?.iouThreshold || 0.45
      };

      // Create headers
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.headers
      };

      if (this.apiKey) {
        requestHeaders['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Make API request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: APIInferenceResponse = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'API inference failed');
      }

      const processingTime = performance.now() - startTime;

      return {
        detections: data.data.detections,
        segmentations: data.data.segmentations,
        modelVersion: data.data.modelVersion,
        processingTime,
        source: 'api'
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`API request timeout after ${this.timeout}ms`);
        }
        throw error;
      }
      throw new Error('Unknown error during API inference');
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    this.updateConfig();

    if (!this.endpoint) {
      return {
        success: false,
        message: 'API endpoint not configured'
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.headers
      };

      if (this.apiKey) {
        requestHeaders['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Try to reach the endpoint (you may need to adjust this based on your API)
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        headers: requestHeaders,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful'
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: 'Connection timeout'
          };
        }
        return {
          success: false,
          message: error.message
        };
      }
      return {
        success: false,
        message: 'Unknown connection error'
      };
    }
  }
}

// Singleton instance
export const apiInferenceService = new APIInferenceService();
