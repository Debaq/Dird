// Contenedor cifrado `.dird` v2.0
//
// Formato binario (little-endian):
//
//   offset  size  field
//   0       4     magic "DIRD"
//   4       2     version (u16)         — 2 = v2.0
//   6       2     flags (u16)           — reservado, 0
//   8       1     kdf_algo (u8)         — 1 = Argon2id
//   9       4     kdf_m_kib (u32)       — memory cost (KiB)
//   13      4     kdf_t (u32)           — time cost (iterations)
//   17      1     kdf_p (u8)            — parallelism
//   18      16    salt                  — Argon2id salt
//   34      12    wrapped_dek_nonce     — GCM nonce para envolver la DEK
//   46      48    wrapped_dek           — 32-byte DEK cifrada + 16-byte tag
//   94      12    content_nonce         — GCM nonce para el ZIP
//   106     ...   ciphertext            — ZIP cifrado, tag GCM al final
//
// AAD:
//   - wrap DEK:   "DIRD-DEK-v2"
//   - content:    "DIRD-v2"

import { deriveKey, aeadSeal, aeadOpen, randomBytes } from '@/lib/crypto';

const MAGIC = new Uint8Array([0x44, 0x49, 0x52, 0x44]); // "DIRD"
const VERSION_V2 = 2;
const KDF_ARGON2ID = 1;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const WRAPPED_DEK_LEN = 48; // 32 + 16 tag
const HEADER_LEN = 4 + 2 + 2 + 1 + 4 + 4 + 1 + SALT_LEN + NONCE_LEN + WRAPPED_DEK_LEN + NONCE_LEN; // 106

// Mantener en sync con `src-tauri/src/crypto.rs` ARGON2_*.
const ARGON2_M_KIB = 65_536;
const ARGON2_T = 3;
const ARGON2_P = 4;

const AAD_DEK = new TextEncoder().encode('DIRD-DEK-v2');
const AAD_CONTENT = new TextEncoder().encode('DIRD-v2');

export interface ContainerHeader {
  version: number;
  flags: number;
  kdfAlgo: number;
  kdfMKib: number;
  kdfT: number;
  kdfP: number;
  salt: Uint8Array;
  wrappedDekNonce: Uint8Array;
  wrappedDek: Uint8Array;
  contentNonce: Uint8Array;
}

export class DirdContainerError extends Error {}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Detecta si los bytes empiezan con el magic `DIRD`. */
export function isEncryptedContainer(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_LEN) return false;
  return (
    bytes[0] === MAGIC[0] &&
    bytes[1] === MAGIC[1] &&
    bytes[2] === MAGIC[2] &&
    bytes[3] === MAGIC[3]
  );
}

export function parseHeader(bytes: Uint8Array): ContainerHeader {
  if (!isEncryptedContainer(bytes)) {
    throw new DirdContainerError('Magic bytes "DIRD" no encontrados.');
  }
  if (bytes.length < HEADER_LEN) {
    throw new DirdContainerError('Header truncado.');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint16(4, true);
  if (version !== VERSION_V2) {
    throw new DirdContainerError(`Versión de contenedor no soportada: ${version}.`);
  }
  const flags = dv.getUint16(6, true);
  const kdfAlgo = dv.getUint8(8);
  if (kdfAlgo !== KDF_ARGON2ID) {
    throw new DirdContainerError(`KDF no soportado: ${kdfAlgo}.`);
  }
  const kdfMKib = dv.getUint32(9, true);
  const kdfT = dv.getUint32(13, true);
  const kdfP = dv.getUint8(17);
  const salt = bytes.slice(18, 18 + SALT_LEN);
  const wrappedDekNonce = bytes.slice(34, 34 + NONCE_LEN);
  const wrappedDek = bytes.slice(46, 46 + WRAPPED_DEK_LEN);
  const contentNonce = bytes.slice(94, 94 + NONCE_LEN);
  return { version, flags, kdfAlgo, kdfMKib, kdfT, kdfP, salt, wrappedDekNonce, wrappedDek, contentNonce };
}

function buildHeader(header: ContainerHeader): Uint8Array {
  const buf = new Uint8Array(HEADER_LEN);
  const dv = new DataView(buf.buffer);
  buf.set(MAGIC, 0);
  dv.setUint16(4, header.version, true);
  dv.setUint16(6, header.flags, true);
  dv.setUint8(8, header.kdfAlgo);
  dv.setUint32(9, header.kdfMKib, true);
  dv.setUint32(13, header.kdfT, true);
  dv.setUint8(17, header.kdfP);
  buf.set(header.salt, 18);
  buf.set(header.wrappedDekNonce, 34);
  buf.set(header.wrappedDek, 46);
  buf.set(header.contentNonce, 94);
  return buf;
}

/**
 * Cifra `zipBytes` con la contraseña de exportación y devuelve un blob `.dird` v2.0.
 */
export async function encryptContainer(
  zipBytes: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  if (!password) throw new DirdContainerError('Contraseña vacía.');

  const salt = await randomBytes(SALT_LEN);
  const kek = await deriveKey(password, salt);
  const dek = await randomBytes(32);

  const sealedDek = await aeadSeal(kek, dek, AAD_DEK);
  if (sealedDek.ciphertext.length !== WRAPPED_DEK_LEN) {
    throw new DirdContainerError('wrapped DEK tiene longitud inesperada.');
  }

  const sealedContent = await aeadSeal(dek, zipBytes, AAD_CONTENT);

  const header = buildHeader({
    version: VERSION_V2,
    flags: 0,
    kdfAlgo: KDF_ARGON2ID,
    kdfMKib: ARGON2_M_KIB,
    kdfT: ARGON2_T,
    kdfP: ARGON2_P,
    salt,
    wrappedDekNonce: sealedDek.nonce,
    wrappedDek: sealedDek.ciphertext,
    contentNonce: sealedContent.nonce,
  });

  return concat([header, sealedContent.ciphertext]);
}

/**
 * Intenta descifrar un contenedor `.dird` v2.0. Lanza si la contraseña es incorrecta
 * o el contenedor está corrupto.
 */
export async function decryptContainer(
  containerBytes: Uint8Array,
  password: string,
): Promise<{ zipBytes: Uint8Array; header: ContainerHeader }> {
  const header = parseHeader(containerBytes);
  const kek = await deriveKey(password, header.salt);
  const dek = await aeadOpen(kek, header.wrappedDekNonce, header.wrappedDek, AAD_DEK).catch(() => {
    throw new DirdContainerError('Contraseña incorrecta o contenedor manipulado.');
  });
  const cipher = containerBytes.slice(HEADER_LEN);
  const zipBytes = await aeadOpen(dek, header.contentNonce, cipher, AAD_CONTENT).catch(() => {
    throw new DirdContainerError('Contenido del contenedor manipulado.');
  });
  return { zipBytes, header };
}
