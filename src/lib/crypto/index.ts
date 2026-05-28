import { invoke } from '@tauri-apps/api/core';

export const SALT_LEN = 16;
export const KEY_LEN = 32;
export const NONCE_LEN = 12;

export interface Sealed {
  nonce_hex: string;
  ciphertext_hex: string;
}

export interface DerivedKey {
  key_hex: string;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex length not even');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function randomHex(n: number): Promise<string> {
  return invoke<string>('crypto_random_hex', { n });
}

export async function randomBytes(n: number): Promise<Uint8Array> {
  return hexToBytes(await randomHex(n));
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const dto = await invoke<DerivedKey>('crypto_derive_key', {
    password,
    saltHex: bytesToHex(salt),
  });
  return hexToBytes(dto.key_hex);
}

export async function aeadSeal(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(),
): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
  const dto = await invoke<Sealed>('crypto_aead_seal', {
    keyHex: bytesToHex(key),
    plaintextHex: bytesToHex(plaintext),
    aadHex: bytesToHex(aad),
  });
  return {
    nonce: hexToBytes(dto.nonce_hex),
    ciphertext: hexToBytes(dto.ciphertext_hex),
  };
}

export async function aeadOpen(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array = new Uint8Array(),
): Promise<Uint8Array> {
  const hex = await invoke<string>('crypto_aead_open', {
    keyHex: bytesToHex(key),
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
    aadHex: bytesToHex(aad),
  });
  return hexToBytes(hex);
}

/**
 * Wrap (envuelve) una DEK aleatoria con la KEK derivada de la contraseña.
 * El blob resultante contiene salt + nonce + ciphertext y se puede persistir.
 */
export async function wrapDek(kek: Uint8Array, dek: Uint8Array): Promise<{
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}> {
  return aeadSeal(kek, dek);
}

export async function unwrapDek(
  kek: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  return aeadOpen(kek, nonce, ciphertext);
}
