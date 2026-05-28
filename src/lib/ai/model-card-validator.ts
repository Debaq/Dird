// Validador del schema model card v2.0 según docs/model-interface.md.
//
// Validación manual sin dependencias externas. Devuelve estructura tipada o
// lista de errores enumerados.

export type ModelCardSeverity =
  | 'landmark' | 'mild' | 'mild-moderate' | 'moderate' | 'moderate-severe' | 'severe';

export interface ModelCardClass {
  id: number;
  name: string;
  severity?: ModelCardSeverity;
  description?: string;
}

export interface ModelCardInput {
  tensor_name: string;
  shape: [number, number, number, number]; // [N,C,H,W]
  layout: 'NCHW';
  dtype: 'float32';
  preprocessing: {
    resize_to: [number, number];
    letterbox: boolean;
    letterbox_color: [number, number, number];
    normalize: 'divide_by_255' | 'imagenet';
    color_order: 'RGB' | 'BGR';
  };
}

export interface ModelCardOutput {
  tensor_name: string;
  format: 'yolo_end2end_v2' | 'yolo_v8_native';
  max_detections?: number;
}

export interface ValidatedModelCard {
  schema_version: '2.0';
  name: string;
  version: string;
  license: string;
  description?: string;
  doi?: string;
  authors?: string[];
  trained_on?: string;
  validated_on?: unknown[];
  input: ModelCardInput;
  output: ModelCardOutput;
  classes: ModelCardClass[];
  per_class_thresholds?: Record<string, number>;
  default_confidence_threshold?: number;
  minimum_dird_version?: string;
  tags?: string[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  card?: ValidatedModelCard;
  errors: ValidationError[];
}

function err(errors: ValidationError[], path: string, message: string): void {
  errors.push({ path, message });
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function requireString(
  obj: Record<string, unknown>, key: string, errors: ValidationError[], parent: string,
): string | undefined {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    err(errors, `${parent}.${key}`, 'string requerido');
    return undefined;
  }
  return v;
}

function requireOneOf<T extends string>(
  obj: Record<string, unknown>, key: string, allowed: readonly T[],
  errors: ValidationError[], parent: string,
): T | undefined {
  const v = obj[key];
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    err(errors, `${parent}.${key}`, `debe ser uno de: ${allowed.join(', ')}`);
    return undefined;
  }
  return v as T;
}

function requireIntArrayOfLen(
  obj: Record<string, unknown>, key: string, len: number,
  errors: ValidationError[], parent: string,
): number[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v) || v.length !== len || !v.every((x) => Number.isInteger(x))) {
    err(errors, `${parent}.${key}`, `array de ${len} enteros requerido`);
    return undefined;
  }
  return v as number[];
}

function validateInput(raw: unknown, errors: ValidationError[]): ModelCardInput | undefined {
  if (!isRecord(raw)) { err(errors, 'input', 'objeto requerido'); return undefined; }
  const parent = 'input';
  const tensor_name = requireString(raw, 'tensor_name', errors, parent);
  const shape = requireIntArrayOfLen(raw, 'shape', 4, errors, parent);
  const layout = requireOneOf(raw, 'layout', ['NCHW'] as const, errors, parent);
  const dtype = requireOneOf(raw, 'dtype', ['float32'] as const, errors, parent);
  const prep = raw['preprocessing'];
  if (!isRecord(prep)) { err(errors, 'input.preprocessing', 'objeto requerido'); return undefined; }
  const resize_to = requireIntArrayOfLen(prep, 'resize_to', 2, errors, 'input.preprocessing');
  const letterbox = prep['letterbox'];
  if (typeof letterbox !== 'boolean') {
    err(errors, 'input.preprocessing.letterbox', 'bool requerido');
    return undefined;
  }
  const letterbox_color = requireIntArrayOfLen(prep, 'letterbox_color', 3, errors, 'input.preprocessing');
  const normalize = requireOneOf(prep, 'normalize', ['divide_by_255', 'imagenet'] as const, errors, 'input.preprocessing');
  const color_order = requireOneOf(prep, 'color_order', ['RGB', 'BGR'] as const, errors, 'input.preprocessing');

  if (!tensor_name || !shape || !layout || !dtype || !resize_to || !letterbox_color || !normalize || !color_order) {
    return undefined;
  }
  if (shape[0] !== 1) err(errors, 'input.shape[0]', 'batch debe ser 1');
  if (shape[1] !== 3) err(errors, 'input.shape[1]', 'channels debe ser 3 (RGB)');
  if (shape[2] !== resize_to[0] || shape[3] !== resize_to[1]) {
    err(errors, 'input.shape', `shape[H,W] debe coincidir con preprocessing.resize_to`);
  }

  return {
    tensor_name,
    shape: shape as [number, number, number, number],
    layout,
    dtype,
    preprocessing: {
      resize_to: resize_to as [number, number],
      letterbox,
      letterbox_color: letterbox_color as [number, number, number],
      normalize,
      color_order,
    },
  };
}

function validateOutput(raw: unknown, errors: ValidationError[]): ModelCardOutput | undefined {
  if (!isRecord(raw)) { err(errors, 'output', 'objeto requerido'); return undefined; }
  const tensor_name = requireString(raw, 'tensor_name', errors, 'output');
  const format = requireOneOf(raw, 'format', ['yolo_end2end_v2', 'yolo_v8_native'] as const, errors, 'output');
  const max_detections = raw['max_detections'];
  if (max_detections !== undefined && !Number.isInteger(max_detections)) {
    err(errors, 'output.max_detections', 'entero opcional');
  }
  if (!tensor_name || !format) return undefined;
  return {
    tensor_name,
    format,
    max_detections: typeof max_detections === 'number' ? max_detections : undefined,
  };
}

function validateClasses(raw: unknown, errors: ValidationError[]): ModelCardClass[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    err(errors, 'classes', 'array no vacío requerido');
    return undefined;
  }
  const result: ModelCardClass[] = [];
  const seenIds = new Set<number>();
  raw.forEach((c, i) => {
    if (!isRecord(c)) { err(errors, `classes[${i}]`, 'objeto requerido'); return; }
    const id = c['id'];
    if (!Number.isInteger(id)) { err(errors, `classes[${i}].id`, 'entero requerido'); return; }
    if (seenIds.has(id as number)) { err(errors, `classes[${i}].id`, `id duplicado: ${id}`); return; }
    seenIds.add(id as number);
    const name = requireString(c, 'name', errors, `classes[${i}]`);
    if (!name) return;
    const sev = c['severity'];
    const allowed: ModelCardSeverity[] = ['landmark', 'mild', 'mild-moderate', 'moderate', 'moderate-severe', 'severe'];
    if (sev !== undefined && (typeof sev !== 'string' || !allowed.includes(sev as ModelCardSeverity))) {
      err(errors, `classes[${i}].severity`, `valor inválido: ${sev}`);
    }
    result.push({
      id: id as number,
      name,
      severity: sev as ModelCardSeverity | undefined,
      description: typeof c['description'] === 'string' ? (c['description'] as string) : undefined,
    });
  });
  return result;
}

export function validateModelCard(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ path: '$', message: 'el model card debe ser un objeto JSON' }] };
  }

  const schema_version = raw['schema_version'];
  if (schema_version !== '2.0') {
    err(errors, 'schema_version', 'debe ser "2.0"');
  }
  const name = requireString(raw, 'name', errors, '$');
  const version = requireString(raw, 'version', errors, '$');
  const license = requireString(raw, 'license', errors, '$');

  const input = validateInput(raw['input'], errors);
  const output = validateOutput(raw['output'], errors);
  const classes = validateClasses(raw['classes'], errors);

  // Validaciones cruzadas: per_class_thresholds debe referenciar clases existentes.
  const pct = raw['per_class_thresholds'];
  if (pct !== undefined) {
    if (!isRecord(pct)) {
      err(errors, 'per_class_thresholds', 'objeto opcional');
    } else if (classes) {
      const names = new Set(classes.map((c) => c.name));
      for (const [k, v] of Object.entries(pct)) {
        if (!names.has(k)) err(errors, `per_class_thresholds.${k}`, `clase "${k}" no declarada en classes[]`);
        if (typeof v !== 'number' || v < 0 || v > 1) {
          err(errors, `per_class_thresholds.${k}`, 'umbral debe ser número en [0,1]');
        }
      }
    }
  }

  const dct = raw['default_confidence_threshold'];
  if (dct !== undefined && (typeof dct !== 'number' || dct < 0 || dct > 1)) {
    err(errors, 'default_confidence_threshold', 'número en [0,1]');
  }

  if (errors.length > 0 || !name || !version || !license || !input || !output || !classes) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    card: {
      schema_version: '2.0',
      name, version, license,
      description: typeof raw['description'] === 'string' ? (raw['description'] as string) : undefined,
      doi: typeof raw['doi'] === 'string' ? (raw['doi'] as string) : undefined,
      authors: Array.isArray(raw['authors']) ? (raw['authors'] as string[]) : undefined,
      trained_on: typeof raw['trained_on'] === 'string' ? (raw['trained_on'] as string) : undefined,
      validated_on: Array.isArray(raw['validated_on']) ? (raw['validated_on'] as unknown[]) : undefined,
      input, output, classes,
      per_class_thresholds: isRecord(pct) ? (pct as Record<string, number>) : undefined,
      default_confidence_threshold: typeof dct === 'number' ? dct : undefined,
      minimum_dird_version: typeof raw['minimum_dird_version'] === 'string' ? (raw['minimum_dird_version'] as string) : undefined,
      tags: Array.isArray(raw['tags']) ? (raw['tags'] as string[]) : undefined,
    },
  };
}

/** Helper: parsea texto JSON y valida. */
export function validateModelCardJson(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [{ path: '$', message: `JSON inválido: ${(e as Error).message}` }] };
  }
  return validateModelCard(parsed);
}
