// Gestión de modelos ONNX externos.
//
// Almacena modelos instalados en `<app_data>/models/<id>/{model.onnx,card.json}`
// y mantiene un registro `<app_data>/models/registry.json` con la lista.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use thiserror::Error;

const MODELS_DIR: &str = "models";
const REGISTRY_FILE: &str = "registry.json";
const MODEL_FILENAME: &str = "model.onnx";
const CARD_FILENAME: &str = "card.json";

#[derive(Debug, Error)]
pub enum ModelsError {
    #[error("io: {0}")]
    Io(String),
    #[error("modelo no encontrado: {0}")]
    NotFound(String),
    #[error("id ya existe: {0}")]
    Duplicate(String),
    #[error("registry corrupto: {0}")]
    Corrupt(String),
}

impl serde::Serialize for ModelsError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for ModelsError {
    fn from(e: std::io::Error) -> Self { ModelsError::Io(e.to_string()) }
}
impl From<serde_json::Error> for ModelsError {
    fn from(e: serde_json::Error) -> Self { ModelsError::Corrupt(e.to_string()) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModel {
    /// Id estable (slug derivado del nombre).
    pub id: String,
    pub name: String,
    pub version: String,
    pub installed_at: String,
    /// Tamaño del .onnx en bytes (para mostrar en UI).
    pub size_bytes: u64,
    /// Indica si es el modelo activo.
    pub active: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Registry {
    models: Vec<InstalledModel>,
    /// Id del modelo activo (uno solo).
    active_id: Option<String>,
}

fn models_dir(handle: &tauri::AppHandle) -> Result<PathBuf, ModelsError> {
    let base = handle.path().app_data_dir().map_err(|e| ModelsError::Io(e.to_string()))?;
    let dir = base.join(MODELS_DIR);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn registry_path(handle: &tauri::AppHandle) -> Result<PathBuf, ModelsError> {
    Ok(models_dir(handle)?.join(REGISTRY_FILE))
}

fn load_registry(handle: &tauri::AppHandle) -> Result<Registry, ModelsError> {
    let path = registry_path(handle)?;
    if !path.exists() { return Ok(Registry::default()); }
    let txt = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&txt)?)
}

fn save_registry(handle: &tauri::AppHandle, reg: &Registry) -> Result<(), ModelsError> {
    let path = registry_path(handle)?;
    let txt = serde_json::to_string_pretty(reg)?;
    fs::write(&path, txt)?;
    Ok(())
}

fn slugify(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_dash = false;
    for c in name.chars() {
        let cl = c.to_ascii_lowercase();
        if cl.is_ascii_alphanumeric() {
            out.push(cl);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

// ---------------- Tauri commands ----------------

#[tauri::command]
pub fn models_install(
    handle: tauri::AppHandle,
    name: String,
    version: String,
    onnx_bytes: Vec<u8>,
    card_json: String,
) -> Result<InstalledModel, ModelsError> {
    let id_base = slugify(&format!("{}-{}", name, version));
    let mut reg = load_registry(&handle)?;
    let mut id = id_base.clone();
    let mut suffix = 1;
    while reg.models.iter().any(|m| m.id == id) {
        suffix += 1;
        id = format!("{}-{}", id_base, suffix);
        if suffix > 100 {
            return Err(ModelsError::Duplicate(id_base));
        }
    }

    let dir = models_dir(&handle)?.join(&id);
    fs::create_dir_all(&dir)?;
    fs::write(dir.join(MODEL_FILENAME), &onnx_bytes)?;
    fs::write(dir.join(CARD_FILENAME), card_json.as_bytes())?;

    let model = InstalledModel {
        id: id.clone(),
        name,
        version,
        installed_at: chrono_now(),
        size_bytes: onnx_bytes.len() as u64,
        active: false,
    };
    reg.models.push(model.clone());
    save_registry(&handle, &reg)?;
    Ok(model)
}

#[tauri::command]
pub fn models_list(handle: tauri::AppHandle) -> Result<Vec<InstalledModel>, ModelsError> {
    let reg = load_registry(&handle)?;
    let active = reg.active_id.clone();
    Ok(reg
        .models
        .into_iter()
        .map(|mut m| {
            m.active = Some(&m.id) == active.as_ref();
            m
        })
        .collect())
}

#[tauri::command]
pub fn models_uninstall(handle: tauri::AppHandle, id: String) -> Result<(), ModelsError> {
    let mut reg = load_registry(&handle)?;
    let idx = reg.models.iter().position(|m| m.id == id).ok_or_else(|| ModelsError::NotFound(id.clone()))?;
    reg.models.remove(idx);
    if reg.active_id.as_deref() == Some(&id) {
        reg.active_id = None;
    }
    let dir = models_dir(&handle)?.join(&id);
    if dir.exists() { fs::remove_dir_all(&dir)?; }
    save_registry(&handle, &reg)?;
    Ok(())
}

#[tauri::command]
pub fn models_set_active(handle: tauri::AppHandle, id: String) -> Result<(), ModelsError> {
    let mut reg = load_registry(&handle)?;
    if !reg.models.iter().any(|m| m.id == id) {
        return Err(ModelsError::NotFound(id));
    }
    reg.active_id = Some(id);
    save_registry(&handle, &reg)?;
    Ok(())
}

#[tauri::command]
pub fn models_get_active(handle: tauri::AppHandle) -> Result<Option<String>, ModelsError> {
    Ok(load_registry(&handle)?.active_id)
}

#[derive(Debug, Serialize)]
pub struct ModelFiles {
    pub onnx_path: String,
    pub card_json: String,
}

/// Devuelve el path absoluto al `.onnx` (para que ONNX Runtime lo cargue por path)
/// y el contenido del model card.
#[tauri::command]
pub fn models_get_files(handle: tauri::AppHandle, id: String) -> Result<ModelFiles, ModelsError> {
    let dir = models_dir(&handle)?.join(&id);
    let onnx = dir.join(MODEL_FILENAME);
    let card = dir.join(CARD_FILENAME);
    if !onnx.exists() || !card.exists() {
        return Err(ModelsError::NotFound(id));
    }
    Ok(ModelFiles {
        onnx_path: path_to_string(&onnx),
        card_json: fs::read_to_string(&card)?,
    })
}

/// Bytes del modelo (para entornos que cargan ONNX desde Uint8Array en JS).
#[tauri::command]
pub fn models_read_onnx_bytes(handle: tauri::AppHandle, id: String) -> Result<Vec<u8>, ModelsError> {
    let path = models_dir(&handle)?.join(&id).join(MODEL_FILENAME);
    if !path.exists() { return Err(ModelsError::NotFound(id)); }
    Ok(fs::read(&path)?)
}

fn path_to_string(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

fn chrono_now() -> String { epoch_iso_now() }

/// Devuelve la hora actual UTC como ISO-8601 (sin dependencia chrono).
pub fn epoch_iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, mo, d, h, mi, s) = epoch_to_ymdhms(secs as i64);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, mi, s)
}

/// Convierte epoch segundos a (year, month, day, hour, min, sec) UTC.
/// Implementación civil simple basada en el algoritmo de Howard Hinnant.
fn epoch_to_ymdhms(t: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = t.div_euclid(86_400);
    let secs = t.rem_euclid(86_400) as u32;
    let h = secs / 3600;
    let mi = (secs / 60) % 60;
    let s = secs % 60;
    // Algoritmo Hinnant civil_from_days.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let yy = (y + if m <= 2 { 1 } else { 0 }) as i32;
    (yy, m, d, h, mi, s)
}
