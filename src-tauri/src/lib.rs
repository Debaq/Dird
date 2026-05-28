mod crypto;
mod db;
mod llm;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Cargar perezosamente el LLM activo (si el usuario seleccionó uno).
      let handle = app.handle().clone();
      std::thread::spawn(move || llm::autoload(&handle));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      crypto::crypto_random_hex,
      crypto::crypto_derive_key,
      crypto::crypto_aead_seal,
      crypto::crypto_aead_open,
      db::db_open,
      db::db_close,
      db::db_is_open,
      db::db_exists,
      db::db_schema_version,
      db::db_execute,
      db::db_query,
      db::db_change_password_with_handle,
      models::models_install,
      models::models_list,
      models::models_uninstall,
      models::models_set_active,
      models::models_get_active,
      models::models_get_files,
      models::models_read_onnx_bytes,
      llm::llm_catalog,
      llm::llm_installed,
      llm::llm_uninstall,
      llm::llm_download,
      llm::llm_load,
      llm::llm_unload,
      llm::llm_active_id,
      llm::llm_generate,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
