import * as ort from 'onnxruntime-web';

export interface ModelDiagnostics {
  isValid: boolean;
  size: number;
  format: string;
  error?: string;
  warnings: string[];
}

/**
 * Diagnose ONNX model compatibility issues
 */
export async function diagnoseModel(modelUrl: string): Promise<ModelDiagnostics> {
  const diagnostics: ModelDiagnostics = {
    isValid: false,
    size: 0,
    format: 'unknown',
    warnings: []
  };

  try {
    console.log('🔍 Starting model diagnostics...');

    // Fetch model
    const response = await fetch(modelUrl);
    if (!response.ok) {
      diagnostics.error = `Failed to fetch model: ${response.statusText}`;
      return diagnostics;
    }

    const arrayBuffer = await response.arrayBuffer();
    diagnostics.size = arrayBuffer.byteLength;

    console.log(`Model size: ${(diagnostics.size / 1024 / 1024).toFixed(2)} MB`);

    // Check if it's a valid ONNX file (starts with ONNX magic number)
    const bytes = new Uint8Array(arrayBuffer);
    const magicNumber = String.fromCharCode(...Array.from(bytes.slice(0, 4)));

    if (magicNumber === 'onnx' || bytes[0] === 0x08) {
      diagnostics.format = 'ONNX (Protobuf)';
    } else {
      diagnostics.warnings.push('File does not appear to be a valid ONNX model');
      diagnostics.format = 'Unknown';
    }

    // Try to load the model
    try {
      console.log('Attempting to load model for validation...');

      const session = await ort.InferenceSession.create(arrayBuffer, {
        executionProviders: ['wasm'],
        logSeverityLevel: 0, // Verbose logging
      });

      diagnostics.isValid = true;

      console.log('✅ Model is valid and loadable');
      console.log('Input names:', session.inputNames);
      console.log('Output names:', session.outputNames);

      // Check inputs
      for (const inputName of session.inputNames) {
        console.log(`Input: ${inputName}`);
      }

      await session.release();

    } catch (error) {
      diagnostics.error = `Failed to load model: ${error instanceof Error ? error.message : String(error)}`;

      // Specific error checks
      if (diagnostics.error.includes('getValue')) {
        diagnostics.warnings.push(
          'The model may have been exported with an incompatible ONNX opset version. ' +
          'Try re-exporting the model with opset version 13-17 for best browser compatibility.'
        );
      }

      if (diagnostics.error.includes('operator')) {
        diagnostics.warnings.push(
          'The model contains operators not supported by onnxruntime-web. ' +
          'Consider simplifying the model or using different operators.'
        );
      }

      diagnostics.isValid = false;
    }

    return diagnostics;

  } catch (error) {
    diagnostics.error = `Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`;
    return diagnostics;
  }
}

/**
 * Get ONNX Runtime environment info
 */
export function getOnnxRuntimeInfo() {
  return {
    version: ort.env.versions.web,
    wasmPaths: ort.env.wasm.wasmPaths,
    numThreads: ort.env.wasm.numThreads,
    simd: ort.env.wasm.simd,
  };
}

/**
 * Format diagnostics report
 */
export function formatDiagnosticsReport(diagnostics: ModelDiagnostics): string {
  const lines: string[] = [];

  lines.push('=== ONNX Model Diagnostics ===');
  lines.push(`Size: ${(diagnostics.size / 1024 / 1024).toFixed(2)} MB`);
  lines.push(`Format: ${diagnostics.format}`);
  lines.push(`Valid: ${diagnostics.isValid ? '✅ Yes' : '❌ No'}`);

  if (diagnostics.error) {
    lines.push(`\nError: ${diagnostics.error}`);
  }

  if (diagnostics.warnings.length > 0) {
    lines.push('\nWarnings:');
    diagnostics.warnings.forEach(warning => {
      lines.push(`  - ${warning}`);
    });
  }

  lines.push('\n=== ONNX Runtime Info ===');
  const runtimeInfo = getOnnxRuntimeInfo();
  lines.push(`Version: ${runtimeInfo.version}`);
  lines.push(`WASM Paths: ${runtimeInfo.wasmPaths}`);
  lines.push(`Threads: ${runtimeInfo.numThreads}`);
  lines.push(`SIMD: ${runtimeInfo.simd}`);

  return lines.join('\n');
}
