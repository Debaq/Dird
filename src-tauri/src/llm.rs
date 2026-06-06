// LLM local on-demand vía llama.cpp embebido (crate llama-cpp-2).
//
// Catálogo curado de modelos pequeños (GGUF Q4_K_M). El usuario elige qué
// descargar; el bundle de DIRD+ no incluye pesos. La carga del modelo es
// perezosa: sólo se mantiene en memoria si el usuario activó un modelo.
//
// Almacenamiento: `<app_data>/llm/<id>.gguf`.
// Registro: `<app_data>/llm/registry.json`.

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use tauri::{Emitter, Manager};
use thiserror::Error;

const LLM_DIR: &str = "llm";
const REGISTRY: &str = "registry.json";

#[derive(Debug, Error)]
pub enum LlmError {
    #[error("io: {0}")]
    Io(String),
    #[error("llama: {0}")]
    Llama(String),
    #[error("modelo no instalado: {0}")]
    NotInstalled(String),
    #[error("modelo no encontrado en catálogo: {0}")]
    UnknownCatalog(String),
    #[error("ningún modelo cargado")]
    NotLoaded,
    #[error("descarga: {0}")]
    Download(String),
    #[error("registry corrupto: {0}")]
    Corrupt(String),
}

impl serde::Serialize for LlmError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for LlmError {
    fn from(e: std::io::Error) -> Self { LlmError::Io(e.to_string()) }
}
impl From<serde_json::Error> for LlmError {
    fn from(e: serde_json::Error) -> Self { LlmError::Corrupt(e.to_string()) }
}

// ----------------------- Catálogo curado -----------------------

#[derive(Debug, Clone, Serialize)]
pub struct CatalogEntry {
    pub id: &'static str,
    pub name: &'static str,
    pub params: &'static str,
    pub size_mb: u32,
    pub quantization: &'static str,
    pub url: &'static str,
    pub sha256: Option<&'static str>,
    pub license: &'static str,
    pub family: &'static str,
    pub languages: &'static [&'static str],
    pub description: &'static str,
    pub chat_template: ChatTemplate,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChatTemplate {
    /// "<|user|>\n…</s>\n<|assistant|>\n"
    Tinyllama,
    /// "<|im_start|>user\n…<|im_end|>\n<|im_start|>assistant\n"
    ChatML,
    /// "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n…<|eot_id|>…"
    Llama3,
    /// "<|user|>\n…<|end|>\n<|assistant|>\n"
    Phi3,
    /// "<start_of_turn>user\n…<end_of_turn>\n<start_of_turn>model\n"
    Gemma,
    /// Plain instruction format (no chat tags).
    #[allow(dead_code)]
    Plain,
}

/// Catálogo curado. Sólo modelos open-weight con licencia OSS-friendly y
/// soporte español aceptable. Tamaños son aproximados (Q4_K_M).
pub const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "smollm2-360m",
        name: "SmolLM2 360M Instruct",
        params: "360M",
        size_mb: 230,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf",
        sha256: None,
        license: "Apache-2.0",
        family: "SmolLM2",
        languages: &["en"],
        description: "Ultraligero (~230 MB). Inglés sólo. Útil para extraer estructura, no para clínica en español.",
        chat_template: ChatTemplate::ChatML,
    },
    CatalogEntry {
        id: "tinyllama-1.1b-chat",
        name: "TinyLlama 1.1B Chat",
        params: "1.1B",
        size_mb: 670,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        sha256: None,
        license: "Apache-2.0",
        family: "TinyLlama",
        languages: &["en"],
        description: "Pequeño y rápido. Español limitado.",
        chat_template: ChatTemplate::Tinyllama,
    },
    CatalogEntry {
        id: "llama-3.2-1b-instruct",
        name: "Llama 3.2 1B Instruct",
        params: "1.24B",
        size_mb: 770,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        sha256: None,
        license: "Llama-3.2 community",
        family: "Llama-3.2",
        languages: &["en", "es", "fr", "de", "pt", "it"],
        description: "Multilingüe pequeño. Buen balance tamaño/calidad para hardware modesto.",
        chat_template: ChatTemplate::Llama3,
    },
    CatalogEntry {
        id: "qwen2.5-1.5b-instruct",
        name: "Qwen2.5 1.5B Instruct",
        params: "1.5B",
        size_mb: 940,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        sha256: None,
        license: "Apache-2.0",
        family: "Qwen2.5",
        languages: &["en", "es", "zh", "fr", "de", "pt"],
        description: "Bueno en español. Apache-2.0. Recomendado para hardware promedio.",
        chat_template: ChatTemplate::ChatML,
    },
    CatalogEntry {
        id: "smollm2-1.7b-instruct",
        name: "SmolLM2 1.7B Instruct",
        params: "1.7B",
        size_mb: 1100,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf",
        sha256: None,
        license: "Apache-2.0",
        family: "SmolLM2",
        languages: &["en"],
        description: "Rápido en inglés, calidad sólida para texto técnico.",
        chat_template: ChatTemplate::ChatML,
    },
    CatalogEntry {
        id: "gemma-2-2b-it",
        name: "Gemma 2 2B Instruct",
        params: "2B",
        size_mb: 1640,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
        sha256: None,
        license: "Gemma",
        family: "Gemma-2",
        languages: &["en", "es", "fr", "de", "pt", "it", "ja"],
        description: "Google Gemma 2 — buen español. Licencia Gemma (uso comercial permitido con condiciones).",
        chat_template: ChatTemplate::Gemma,
    },
    CatalogEntry {
        id: "llama-3.2-3b-instruct",
        name: "Llama 3.2 3B Instruct",
        params: "3.21B",
        size_mb: 2020,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        sha256: None,
        license: "Llama-3.2 community",
        family: "Llama-3.2",
        languages: &["en", "es", "fr", "de", "pt", "it"],
        description: "3B multilingüe. Buena calidad en español para resúmenes clínicos.",
        chat_template: ChatTemplate::Llama3,
    },
    CatalogEntry {
        id: "qwen2.5-3b-instruct",
        name: "Qwen2.5 3B Instruct",
        params: "3.09B",
        size_mb: 1930,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
        sha256: None,
        license: "Qwen Research",
        family: "Qwen2.5",
        languages: &["en", "es", "zh", "fr", "de", "pt", "ja"],
        description: "Excelente español. Recomendado para texto clínico fluido.",
        chat_template: ChatTemplate::ChatML,
    },
    CatalogEntry {
        id: "phi-3.5-mini-instruct",
        name: "Phi-3.5 Mini Instruct",
        params: "3.8B",
        size_mb: 2400,
        quantization: "Q4_K_M",
        url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
        sha256: None,
        license: "MIT",
        family: "Phi-3.5",
        languages: &["en", "es", "fr", "de", "pt", "it"],
        description: "Microsoft Phi-3.5. Bueno para razonamiento clínico estructurado. Licencia MIT.",
        chat_template: ChatTemplate::Phi3,
    },
];

// ----------------------- Registro + filesystem -----------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledLlm {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub installed_at: String,
    pub active: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Registry {
    installed: Vec<InstalledLlm>,
    active_id: Option<String>,
}

fn llm_dir(handle: &tauri::AppHandle) -> Result<PathBuf, LlmError> {
    let base = handle.path().app_data_dir().map_err(|e| LlmError::Io(e.to_string()))?;
    let dir = base.join(LLM_DIR);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn model_path(handle: &tauri::AppHandle, id: &str) -> Result<PathBuf, LlmError> {
    Ok(llm_dir(handle)?.join(format!("{id}.gguf")))
}

fn registry_path(handle: &tauri::AppHandle) -> Result<PathBuf, LlmError> {
    Ok(llm_dir(handle)?.join(REGISTRY))
}

fn load_registry(handle: &tauri::AppHandle) -> Result<Registry, LlmError> {
    let path = registry_path(handle)?;
    if !path.exists() { return Ok(Registry::default()); }
    Ok(serde_json::from_str(&fs::read_to_string(&path)?)?)
}

fn save_registry(handle: &tauri::AppHandle, reg: &Registry) -> Result<(), LlmError> {
    let path = registry_path(handle)?;
    fs::write(&path, serde_json::to_string_pretty(reg)?)?;
    Ok(())
}

fn find_catalog(id: &str) -> Result<&'static CatalogEntry, LlmError> {
    CATALOG.iter().find(|c| c.id == id).ok_or_else(|| LlmError::UnknownCatalog(id.to_string()))
}

// ----------------------- Estado runtime (modelo cargado) -----------------------

fn backend() -> &'static LlamaBackend {
    static B: OnceLock<LlamaBackend> = OnceLock::new();
    B.get_or_init(|| {
        LlamaBackend::init().expect("no se pudo inicializar llama backend")
    })
}

struct LoadedModel {
    id: String,
    template: ChatTemplate,
    model: Arc<LlamaModel>,
}

fn loaded() -> &'static Mutex<Option<LoadedModel>> {
    static L: OnceLock<Mutex<Option<LoadedModel>>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(None))
}

// ----------------------- Chat templating -----------------------

fn render_prompt(template: ChatTemplate, system: Option<&str>, user: &str) -> String {
    match template {
        ChatTemplate::Tinyllama => {
            let sys = system.unwrap_or("Eres un asistente clínico que responde con precisión.");
            format!("<|system|>\n{sys}</s>\n<|user|>\n{user}</s>\n<|assistant|>\n")
        }
        ChatTemplate::ChatML => {
            let sys = system.unwrap_or("Eres un asistente clínico que responde con precisión.");
            format!("<|im_start|>system\n{sys}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n")
        }
        ChatTemplate::Llama3 => {
            let sys = system.unwrap_or("Eres un asistente clínico que responde con precisión.");
            format!(
                "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{sys}<|eot_id|>\
                 <|start_header_id|>user<|end_header_id|>\n\n{user}<|eot_id|>\
                 <|start_header_id|>assistant<|end_header_id|>\n\n"
            )
        }
        ChatTemplate::Phi3 => {
            let sys = system.unwrap_or("Eres un asistente clínico que responde con precisión.");
            format!("<|system|>\n{sys}<|end|>\n<|user|>\n{user}<|end|>\n<|assistant|>\n")
        }
        ChatTemplate::Gemma => {
            // Gemma 2 no soporta system role nativo; lo prefijamos al user.
            let prefix = system.map(|s| format!("{s}\n\n")).unwrap_or_default();
            format!("<start_of_turn>user\n{prefix}{user}<end_of_turn>\n<start_of_turn>model\n")
        }
        ChatTemplate::Plain => {
            let sys = system.map(|s| format!("{s}\n\n")).unwrap_or_default();
            format!("{sys}{user}")
        }
    }
}

// ----------------------- Tauri commands -----------------------

#[tauri::command]
pub fn llm_catalog() -> Vec<CatalogEntry> {
    CATALOG.to_vec()
}

#[tauri::command]
pub fn llm_installed(handle: tauri::AppHandle) -> Result<Vec<InstalledLlm>, LlmError> {
    let reg = load_registry(&handle)?;
    let active = reg.active_id.clone();
    Ok(reg
        .installed
        .into_iter()
        .map(|mut m| {
            m.active = Some(&m.id) == active.as_ref();
            m
        })
        .collect())
}

#[tauri::command]
pub fn llm_uninstall(handle: tauri::AppHandle, id: String) -> Result<(), LlmError> {
    {
        let mut g = loaded().lock();
        if let Some(l) = g.as_ref() {
            if l.id == id { *g = None; }
        }
    }
    let mut reg = load_registry(&handle)?;
    reg.installed.retain(|m| m.id != id);
    if reg.active_id.as_deref() == Some(&id) {
        reg.active_id = None;
    }
    let path = model_path(&handle, &id)?;
    if path.exists() { fs::remove_file(&path)?; }
    save_registry(&handle, &reg)?;
    Ok(())
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
    id: String,
    received: u64,
    total: u64,
    done: bool,
}

#[tauri::command]
pub async fn llm_download(handle: tauri::AppHandle, id: String) -> Result<InstalledLlm, LlmError> {
    let entry = find_catalog(&id)?;
    let dir = llm_dir(&handle)?;
    let final_path = dir.join(format!("{}.gguf", entry.id));
    let part_path = dir.join(format!("{}.gguf.partial", entry.id));

    if final_path.exists() {
        // Ya descargado.
        let reg = load_registry(&handle)?;
        if let Some(existing) = reg.installed.iter().find(|m| m.id == entry.id) {
            return Ok(existing.clone());
        }
    }

    let resp = reqwest::get(entry.url)
        .await
        .map_err(|e| LlmError::Download(e.to_string()))?
        .error_for_status()
        .map_err(|e| LlmError::Download(e.to_string()))?;
    let total = resp.content_length().unwrap_or(0);

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let mut file = tokio::fs::File::create(&part_path).await?;
    let mut stream = resp.bytes_stream();
    let mut received: u64 = 0;
    let mut last_emit: u64 = 0;
    let emit_step: u64 = 4 * 1024 * 1024; // 4 MiB

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| LlmError::Download(e.to_string()))?;
        file.write_all(&bytes).await?;
        received += bytes.len() as u64;
        if received - last_emit >= emit_step {
            last_emit = received;
            let _ = handle.emit("llm:download_progress", DownloadProgress {
                id: id.clone(),
                received,
                total,
                done: false,
            });
        }
    }
    file.flush().await?;
    drop(file);
    tokio::fs::rename(&part_path, &final_path).await?;

    let installed = InstalledLlm {
        id: entry.id.to_string(),
        name: entry.name.to_string(),
        size_bytes: received,
        installed_at: crate::models::epoch_iso_now(),
        active: false,
    };
    let mut reg = load_registry(&handle)?;
    reg.installed.retain(|m| m.id != installed.id);
    reg.installed.push(installed.clone());
    save_registry(&handle, &reg)?;

    let _ = handle.emit("llm:download_progress", DownloadProgress {
        id, received, total: received, done: true,
    });
    Ok(installed)
}

#[tauri::command]
pub fn llm_load(handle: tauri::AppHandle, id: String) -> Result<(), LlmError> {
    let entry = find_catalog(&id)?;
    let path = model_path(&handle, &id)?;
    if !path.exists() { return Err(LlmError::NotInstalled(id)); }
    let params = LlamaModelParams::default();
    let model = LlamaModel::load_from_file(backend(), &path, &params)
        .map_err(|e| LlmError::Llama(e.to_string()))?;
    let mut g = loaded().lock();
    *g = Some(LoadedModel { id: entry.id.to_string(), template: entry.chat_template, model: Arc::new(model) });
    // Marcar como activo en el registro.
    let mut reg = load_registry(&handle)?;
    reg.active_id = Some(entry.id.to_string());
    save_registry(&handle, &reg)?;
    Ok(())
}

#[tauri::command]
pub fn llm_unload() -> Result<(), LlmError> {
    *loaded().lock() = None;
    Ok(())
}

#[tauri::command]
pub fn llm_active_id() -> Option<String> {
    loaded().lock().as_ref().map(|l| l.id.clone())
}

#[derive(Debug, Deserialize)]
pub struct GenerateParams {
    pub prompt: String,
    pub system: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub seed: Option<u32>,
}

#[tauri::command]
pub fn llm_generate(args: GenerateParams) -> Result<String, LlmError> {
    let guard = loaded().lock();
    let l = guard.as_ref().ok_or(LlmError::NotLoaded)?;
    let model = l.model.clone();
    let template = l.template;
    drop(guard);

    let rendered = render_prompt(template, args.system.as_deref(), &args.prompt);
    let max_new = args.max_tokens.unwrap_or(256) as i32;
    let temperature = args.temperature.unwrap_or(0.6);
    let top_p = args.top_p.unwrap_or(0.95);
    let seed = args.seed.unwrap_or(0xDEADBEEF);

    let ctx_size = NonZeroU32::new(4096).unwrap();
    let ctx_params = LlamaContextParams::default().with_n_ctx(Some(ctx_size));
    let mut ctx = model
        .new_context(backend(), ctx_params)
        .map_err(|e| LlmError::Llama(e.to_string()))?;

    let tokens_list = model
        .str_to_token(&rendered, AddBos::Always)
        .map_err(|e| LlmError::Llama(e.to_string()))?;

    let mut batch = LlamaBatch::new(512, 1);
    let last_idx = tokens_list.len() as i32 - 1;
    for (i, token) in tokens_list.iter().enumerate() {
        let is_last = i as i32 == last_idx;
        batch
            .add(*token, i as i32, &[0], is_last)
            .map_err(|e| LlmError::Llama(e.to_string()))?;
    }
    ctx.decode(&mut batch).map_err(|e| LlmError::Llama(e.to_string()))?;

    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::temp(temperature),
        LlamaSampler::top_p(top_p, 1),
        LlamaSampler::dist(seed),
    ]);

    let mut n_cur = batch.n_tokens();
    let mut out = String::new();
    let mut n_decoded = 0;

    while n_decoded < max_new {
        let new_token_id = sampler.sample(&ctx, batch.n_tokens() - 1);
        sampler.accept(new_token_id);

        if model.is_eog_token(new_token_id) { break; }

        // Reemplaza el deprecado `token_to_bytes(_, Special::Tokenize)`. Replica su
        // comportamiento: intenta con un buffer chico y reintenta con el tamaño exacto
        // si el token (UTF-8 multibyte) no cabe. `special = true` ≡ Special::Tokenize.
        let piece_bytes = match model.token_to_piece_bytes(new_token_id, 8, true, None) {
            Err(llama_cpp_2::TokenToStringError::InsufficientBufferSpace(i)) => {
                let size = usize::try_from(-i).expect("buffer size is positive");
                model.token_to_piece_bytes(new_token_id, size, true, None)
            }
            x => x,
        }
        .map_err(|e| LlmError::Llama(e.to_string()))?;
        out.push_str(&String::from_utf8_lossy(&piece_bytes));

        batch.clear();
        batch
            .add(new_token_id, n_cur, &[0], true)
            .map_err(|e| LlmError::Llama(e.to_string()))?;
        n_cur += 1;
        ctx.decode(&mut batch).map_err(|e| LlmError::Llama(e.to_string()))?;
        n_decoded += 1;
    }

    Ok(out)
}

// ----------------------- Auto-carga del modelo activo -----------------------

/// Carga al inicio el modelo activo del registro (si existe).
pub fn autoload(handle: &tauri::AppHandle) {
    if let Ok(reg) = load_registry(handle) {
        if let Some(id) = reg.active_id {
            let _ = llm_load(handle.clone(), id);
        }
    }
}

