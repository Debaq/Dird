// SQLCipher data layer DIRD+ v2.0
//
// - Clave derivada con Argon2id (módulo `crypto`), pasada a SQLCipher como raw hex
//   vía `PRAGMA key = "x'<hex>'"`, lo que omite el PBKDF2 propio de SQLCipher.
// - Salt persistido en `<app_data>/dird.salt` (16 bytes random, una vez).
// - Conexión global protegida por `parking_lot::Mutex`.
// - Migración inicial embebida vía `include_str!`.

use crate::crypto;
use parking_lot::Mutex;
use rusqlite::{params_from_iter, types::Value as SqlValue, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::Manager;
use thiserror::Error;

const INIT_SQL: &str = include_str!("../migrations/0001_init.sql");
const DB_FILENAME: &str = "dird.db";
const SALT_FILENAME: &str = "dird.salt";

#[derive(Debug, Error)]
pub enum DbError {
    #[error("db already open")]
    AlreadyOpen,
    #[error("db not open")]
    NotOpen,
    #[error("io: {0}")]
    Io(String),
    #[error("sqlite: {0}")]
    Sqlite(String),
    #[error("crypto: {0}")]
    Crypto(String),
    #[error("invalid param: {0}")]
    InvalidParam(String),
}

impl serde::Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for DbError {
    fn from(e: std::io::Error) -> Self { DbError::Io(e.to_string()) }
}
impl From<rusqlite::Error> for DbError {
    fn from(e: rusqlite::Error) -> Self { DbError::Sqlite(e.to_string()) }
}
impl From<crypto::CryptoError> for DbError {
    fn from(e: crypto::CryptoError) -> Self { DbError::Crypto(e.to_string()) }
}

static CONN: OnceLock<Mutex<Option<Connection>>> = OnceLock::new();

fn conn_slot() -> &'static Mutex<Option<Connection>> {
    CONN.get_or_init(|| Mutex::new(None))
}

fn app_data_dir(handle: &tauri::AppHandle) -> Result<PathBuf, DbError> {
    handle
        .path()
        .app_data_dir()
        .map_err(|e| DbError::Io(format!("app_data_dir: {e}")))
}

fn load_or_create_salt(dir: &PathBuf) -> Result<Vec<u8>, DbError> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(SALT_FILENAME);
    if path.exists() {
        let bytes = std::fs::read(&path)?;
        if bytes.len() != crypto::SALT_LEN {
            return Err(DbError::Io(format!(
                "salt file corrupt: expected {} bytes, got {}",
                crypto::SALT_LEN,
                bytes.len()
            )));
        }
        Ok(bytes)
    } else {
        let salt = crypto::random_bytes(crypto::SALT_LEN);
        std::fs::write(&path, &salt)?;
        Ok(salt)
    }
}

fn pragma_key(conn: &Connection, key_hex: &str) -> Result<(), DbError> {
    // SQLCipher: con "x'<hex>'" se salta el KDF interno y usa la clave raw.
    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", key_hex))?;
    // Asegurar que la clave funciona ejecutando una consulta trivial.
    conn.query_row("SELECT count(*) FROM sqlite_master;", [], |_| Ok(()))?;
    Ok(())
}

fn schema_version(conn: &Connection) -> Result<Option<i64>, DbError> {
    let row: rusqlite::Result<String> = conn.query_row(
        "SELECT value FROM meta WHERE key='schema_version'",
        [],
        |r| r.get(0),
    );
    match row {
        Ok(s) => Ok(s.parse::<i64>().ok()),
        Err(rusqlite::Error::SqliteFailure(_, _)) => Ok(None),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(DbError::Sqlite(e.to_string())),
    }
}

fn ensure_schema(conn: &Connection) -> Result<(), DbError> {
    let has_meta: i64 = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='meta'",
        [],
        |r| r.get(0),
    )?;
    if has_meta == 0 {
        conn.execute_batch(INIT_SQL)?;
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(tag = "t", content = "v", rename_all = "lowercase")]
pub enum SqlParam {
    Null,
    Int(i64),
    Real(f64),
    Text(String),
    /// BLOB recibido como array de bytes.
    Blob(Vec<u8>),
    Bool(bool),
}

impl SqlParam {
    fn to_sql_value(&self) -> SqlValue {
        match self {
            SqlParam::Null => SqlValue::Null,
            SqlParam::Int(n) => SqlValue::Integer(*n),
            SqlParam::Real(f) => SqlValue::Real(*f),
            SqlParam::Text(s) => SqlValue::Text(s.clone()),
            SqlParam::Blob(b) => SqlValue::Blob(b.clone()),
            SqlParam::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "t", content = "v", rename_all = "lowercase")]
pub enum SqlCell {
    Null,
    Int(i64),
    Real(f64),
    Text(String),
    /// BLOB devuelto como array de bytes.
    Blob(Vec<u8>),
}

impl From<SqlValue> for SqlCell {
    fn from(v: SqlValue) -> Self {
        match v {
            SqlValue::Null => SqlCell::Null,
            SqlValue::Integer(i) => SqlCell::Int(i),
            SqlValue::Real(f) => SqlCell::Real(f),
            SqlValue::Text(s) => SqlCell::Text(s),
            SqlValue::Blob(b) => SqlCell::Blob(b),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ExecResult {
    pub rows_affected: u64,
    pub last_insert_id: i64,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<SqlCell>>,
}

// ---------------- Tauri commands ----------------

#[tauri::command]
pub fn db_open(handle: tauri::AppHandle, password: String) -> Result<(), DbError> {
    let slot = conn_slot();
    let mut guard = slot.lock();
    if guard.is_some() {
        return Err(DbError::AlreadyOpen);
    }

    let dir = app_data_dir(&handle)?;
    let salt = load_or_create_salt(&dir)?;
    let key = crypto::derive_key(password.as_bytes(), &salt)?;
    let key_hex = {
        let mut s = String::with_capacity(key.0.len() * 2);
        for b in &key.0 {
            s.push_str(&format!("{:02x}", b));
        }
        s
    };

    let db_path = dir.join(DB_FILENAME);
    let conn = Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )?;
    pragma_key(&conn, &key_hex)?;
    conn.execute_batch(
        "PRAGMA cipher_page_size = 4096;\
         PRAGMA foreign_keys = ON;\
         PRAGMA journal_mode = WAL;\
         PRAGMA synchronous = NORMAL;",
    )?;
    ensure_schema(&conn)?;

    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
pub fn db_close() -> Result<(), DbError> {
    let slot = conn_slot();
    let mut guard = slot.lock();
    *guard = None;
    Ok(())
}

#[tauri::command]
pub fn db_is_open() -> bool {
    conn_slot().lock().is_some()
}

/// Devuelve true si el archivo `dird.db` ya existe en `<app_data>`.
#[tauri::command]
pub fn db_exists(handle: tauri::AppHandle) -> Result<bool, DbError> {
    let dir = app_data_dir(&handle)?;
    Ok(dir.join(DB_FILENAME).exists())
}

#[tauri::command]
pub fn db_schema_version() -> Result<Option<i64>, DbError> {
    let slot = conn_slot();
    let guard = slot.lock();
    let conn = guard.as_ref().ok_or(DbError::NotOpen)?;
    schema_version(conn)
}

#[tauri::command]
pub fn db_execute(sql: String, params: Vec<SqlParam>) -> Result<ExecResult, DbError> {
    let slot = conn_slot();
    let guard = slot.lock();
    let conn = guard.as_ref().ok_or(DbError::NotOpen)?;
    let mut stmt = conn.prepare(&sql)?;
    let values: Vec<SqlValue> = params.iter().map(SqlParam::to_sql_value).collect();
    let rows_affected = stmt.execute(params_from_iter(values.iter()))? as u64;
    Ok(ExecResult {
        rows_affected,
        last_insert_id: conn.last_insert_rowid(),
    })
}

#[tauri::command]
pub fn db_query(sql: String, params: Vec<SqlParam>) -> Result<QueryResult, DbError> {
    let slot = conn_slot();
    let guard = slot.lock();
    let conn = guard.as_ref().ok_or(DbError::NotOpen)?;
    let mut stmt = conn.prepare(&sql)?;
    let columns: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    let values: Vec<SqlValue> = params.iter().map(SqlParam::to_sql_value).collect();
    let n = columns.len();
    let rows_iter = stmt.query_map(params_from_iter(values.iter()), |row| {
        let mut cells: Vec<SqlCell> = Vec::with_capacity(n);
        for i in 0..n {
            let v: SqlValue = row.get(i)?;
            cells.push(v.into());
        }
        Ok(cells)
    })?;
    let mut rows: Vec<Vec<SqlCell>> = Vec::new();
    for r in rows_iter {
        rows.push(r?);
    }
    Ok(QueryResult { columns, rows })
}

/// Cambia la contraseña re-keyando SQLCipher y persistiendo nueva salt atómicamente.
#[tauri::command]
pub fn db_change_password_with_handle(
    handle: tauri::AppHandle,
    new_password: String,
) -> Result<(), DbError> {
    let slot = conn_slot();
    let mut guard = slot.lock();
    let conn = guard.as_mut().ok_or(DbError::NotOpen)?;

    let dir = app_data_dir(&handle)?;
    let new_salt = crypto::random_bytes(crypto::SALT_LEN);
    let new_key = crypto::derive_key(new_password.as_bytes(), &new_salt)?;
    let new_key_hex = {
        let mut s = String::with_capacity(new_key.0.len() * 2);
        for b in &new_key.0 {
            s.push_str(&format!("{:02x}", b));
        }
        s
    };
    conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", new_key_hex))?;
    std::fs::write(dir.join(SALT_FILENAME), &new_salt)?;
    Ok(())
}

// ---------------- Tests ----------------

#[cfg(test)]
mod tests {
    use super::*;

    fn open_inmemory_with_pass(pass: &str) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        let salt = b"0123456789abcdef";
        let key = crypto::derive_key(pass.as_bytes(), salt).unwrap();
        let mut key_hex = String::new();
        for b in &key.0 { key_hex.push_str(&format!("{:02x}", b)); }
        pragma_key(&conn, &key_hex).unwrap();
        conn.execute_batch("PRAGMA cipher_page_size = 4096;").unwrap();
        ensure_schema(&conn).unwrap();
        conn
    }

    #[test]
    fn schema_creates_all_tables() {
        let conn = open_inmemory_with_pass("pw");
        let v = schema_version(&conn).unwrap();
        assert_eq!(v, Some(1));
        let count: i64 = conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            [], |r| r.get(0),
        ).unwrap();
        // 9 tablas de dominio + meta = 10.
        assert_eq!(count, 10);
    }

    #[test]
    fn insert_and_query_patient() {
        let conn = open_inmemory_with_pass("pw");
        conn.execute(
            "INSERT INTO patients (patient_id, name, date_of_birth, status, diabetes, hta, dlp, medications, created_at, updated_at) \
             VALUES (?,?,?,?,?,?,?,?,?,?)",
            rusqlite::params![
                "P001", "Juan", "1980-01-01", "active",
                1, 0, 0, "[]",
                "2026-05-27T00:00:00Z", "2026-05-27T00:00:00Z",
            ],
        ).unwrap();
        let name: String = conn.query_row(
            "SELECT name FROM patients WHERE patient_id=?",
            ["P001"], |r| r.get(0),
        ).unwrap();
        assert_eq!(name, "Juan");
    }

    #[test]
    fn fk_cascade_delete() {
        let conn = open_inmemory_with_pass("pw");
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute(
            "INSERT INTO patients (patient_id, name, date_of_birth, status, medications, created_at, updated_at) \
             VALUES ('P','N','1980-01-01','active','[]','t','t')",
            [],
        ).unwrap();
        let pid = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO sessions (patient_id, session_number, date, created_at, updated_at) \
             VALUES (?, 1, 't', 't', 't')",
            [pid],
        ).unwrap();
        conn.execute("DELETE FROM patients WHERE id=?", [pid]).unwrap();
        let n: i64 = conn.query_row("SELECT count(*) FROM sessions", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn wrong_passphrase_fails() {
        // Cifra y vuelve a abrir con otra clave.
        let tmp = tempfile_path();
        {
            let conn = Connection::open(&tmp).unwrap();
            let salt = b"0123456789abcdef";
            let key = crypto::derive_key(b"correct", salt).unwrap();
            let mut hex = String::new();
            for b in &key.0 { hex.push_str(&format!("{:02x}", b)); }
            pragma_key(&conn, &hex).unwrap();
            ensure_schema(&conn).unwrap();
        }
        // Re-abrir con clave incorrecta.
        let conn = Connection::open(&tmp).unwrap();
        let bad = crypto::derive_key(b"wrong", b"0123456789abcdef").unwrap();
        let mut hex = String::new();
        for b in &bad.0 { hex.push_str(&format!("{:02x}", b)); }
        let err = pragma_key(&conn, &hex);
        assert!(err.is_err());
        let _ = std::fs::remove_file(&tmp);
    }

    fn tempfile_path() -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("dird-test-{}.db", crate::crypto::random_bytes(8).iter().map(|b| format!("{:02x}", b)).collect::<String>()));
        p
    }
}
