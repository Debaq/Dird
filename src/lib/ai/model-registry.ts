import { invoke } from '@tauri-apps/api/core';
import * as ort from 'onnxruntime-web';
import { validateModelCardJson, type ValidatedModelCard } from './model-card-validator';

export interface InstalledModel {
  id: string;
  name: string;
  version: string;
  installed_at: string;
  size_bytes: number;
  active: boolean;
}

export interface ModelFiles {
  onnx_path: string;
  card_json: string;
}

export async function installModel(args: {
  name: string;
  version: string;
  onnxBytes: Uint8Array;
  cardJson: string;
}): Promise<InstalledModel> {
  return invoke<InstalledModel>('models_install', {
    name: args.name,
    version: args.version,
    onnxBytes: Array.from(args.onnxBytes),
    cardJson: args.cardJson,
  });
}

export async function listModels(): Promise<InstalledModel[]> {
  return invoke<InstalledModel[]>('models_list');
}

export async function uninstallModel(id: string): Promise<void> {
  await invoke('models_uninstall', { id });
}

export async function setActiveModel(id: string): Promise<void> {
  await invoke('models_set_active', { id });
}

export async function getActiveModel(): Promise<string | null> {
  return invoke<string | null>('models_get_active');
}

export async function getModelFiles(id: string): Promise<ModelFiles> {
  return invoke<ModelFiles>('models_get_files', { id });
}

export async function readModelBytes(id: string): Promise<Uint8Array> {
  const arr = await invoke<number[]>('models_read_onnx_bytes', { id });
  return new Uint8Array(arr);
}

export interface SanityCheckResult {
  ok: boolean;
  errors: string[];
  /** Tiempo total de inferencia en ms. */
  inferenceMs?: number;
  /** Shape efectivo del output. */
  outputShape?: readonly number[];
  /** Cuántas detecciones produjo en la imagen de prueba (puede ser 0). */
  detectionsCount?: number;
}

/**
 * Carga el ONNX en memoria, verifica que el shape de entrada coincida con el card,
 * ejecuta una inferencia sobre un tensor RGB ceros (640×640 por defecto) y valida
 * que el output tenga el formato declarado. Sin asunciones sobre el valor de
 * detección — solo verifica que el modelo no explote y que el shape sea válido.
 */
export async function sanityCheckModel(
  onnxBytes: Uint8Array,
  card: ValidatedModelCard,
): Promise<SanityCheckResult> {
  const errors: string[] = [];
  try {
    const session = await ort.InferenceSession.create(onnxBytes, {
      executionProviders: ['wasm'],
    });

    // Validar que los nombres de tensores existen en el modelo.
    if (!session.inputNames.includes(card.input.tensor_name)) {
      errors.push(
        `Input tensor "${card.input.tensor_name}" no existe en el modelo. ` +
        `Disponibles: ${session.inputNames.join(', ')}`,
      );
    }
    if (!session.outputNames.includes(card.output.tensor_name)) {
      errors.push(
        `Output tensor "${card.output.tensor_name}" no existe en el modelo. ` +
        `Disponibles: ${session.outputNames.join(', ')}`,
      );
    }

    if (errors.length > 0) {
      await session.release?.();
      return { ok: false, errors };
    }

    // Tensor de entrada RGB ceros con el shape declarado.
    const [_n, c, h, w] = card.input.shape;
    const len = 1 * c * h * w;
    const data = new Float32Array(len); // zeros
    const inputTensor = new ort.Tensor('float32', data, [1, c, h, w]);

    const feeds: Record<string, ort.Tensor> = { [card.input.tensor_name]: inputTensor };
    const t0 = performance.now();
    const out = await session.run(feeds);
    const t1 = performance.now();
    const outTensor = out[card.output.tensor_name];

    if (!outTensor) {
      errors.push('El modelo no devolvió el tensor de salida declarado.');
      return { ok: false, errors };
    }

    const outShape = outTensor.dims;
    if (card.output.format === 'yolo_end2end_v2') {
      if (outShape.length !== 3 || outShape[0] !== 1 || outShape[2] !== 6) {
        errors.push(
          `Output shape esperado [1, N, 6] para "yolo_end2end_v2", recibido ${JSON.stringify(outShape)}`,
        );
      }
    }

    const detections = outShape.length >= 2 ? (outShape[1] as number) : 0;

    try { await session.release?.(); } catch { /* noop */ }

    if (errors.length > 0) return { ok: false, errors, outputShape: outShape };

    return {
      ok: true,
      errors: [],
      inferenceMs: t1 - t0,
      outputShape: outShape,
      detectionsCount: detections,
    };
  } catch (e) {
    return {
      ok: false,
      errors: [`Excepción durante carga/ejecución del modelo: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

export interface InstallResult {
  ok: boolean;
  model?: InstalledModel;
  errors: string[];
  warnings?: string[];
  sanity?: SanityCheckResult;
}

/**
 * Pipeline completo: valida card → sanity check → instala. Si algo falla
 * NO toca el filesystem (el `models_install` solo se llama si todo pasó).
 */
export async function validateAndInstallModel(args: {
  onnxBytes: Uint8Array;
  cardJson: string;
}): Promise<InstallResult> {
  const validation = validateModelCardJson(args.cardJson);
  if (!validation.ok || !validation.card) {
    return {
      ok: false,
      errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }
  const card = validation.card;

  const sanity = await sanityCheckModel(args.onnxBytes, card);
  if (!sanity.ok) {
    return { ok: false, errors: sanity.errors, sanity };
  }

  try {
    const model = await installModel({
      name: card.name,
      version: card.version,
      onnxBytes: args.onnxBytes,
      cardJson: args.cardJson,
    });
    return { ok: true, model, errors: [], sanity };
  } catch (e) {
    return { ok: false, errors: [`Error escribiendo a disco: ${e instanceof Error ? e.message : String(e)}`] };
  }
}
