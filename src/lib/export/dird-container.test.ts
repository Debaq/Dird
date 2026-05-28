import { describe, it, expect } from 'vitest';
import { isEncryptedContainer, parseHeader, DirdContainerError } from './dird-container';

describe('isEncryptedContainer', () => {
  it('detecta el magic DIRD', () => {
    const bytes = new Uint8Array(120);
    bytes[0] = 0x44; bytes[1] = 0x49; bytes[2] = 0x52; bytes[3] = 0x44; // "DIRD"
    expect(isEncryptedContainer(bytes)).toBe(true);
  });

  it('rechaza bytes sin magic', () => {
    const bytes = new Uint8Array(120);
    bytes[0] = 0x50; bytes[1] = 0x4b; // "PK" (ZIP)
    expect(isEncryptedContainer(bytes)).toBe(false);
  });

  it('rechaza input muy corto', () => {
    expect(isEncryptedContainer(new Uint8Array([0x44, 0x49, 0x52, 0x44]))).toBe(false);
  });
});

describe('parseHeader', () => {
  function buildValidHeader(): Uint8Array {
    const buf = new Uint8Array(120);
    const dv = new DataView(buf.buffer);
    // magic
    buf[0] = 0x44; buf[1] = 0x49; buf[2] = 0x52; buf[3] = 0x44;
    dv.setUint16(4, 2, true);   // version
    dv.setUint16(6, 0, true);   // flags
    dv.setUint8(8, 1);          // kdf_algo = Argon2id
    dv.setUint32(9, 65536, true);
    dv.setUint32(13, 3, true);
    dv.setUint8(17, 4);
    // salt at 18..34, wrapped_dek_nonce at 34..46, wrapped_dek at 46..94, content_nonce at 94..106
    return buf;
  }

  it('parsea un header válido', () => {
    const h = parseHeader(buildValidHeader());
    expect(h.version).toBe(2);
    expect(h.kdfAlgo).toBe(1);
    expect(h.kdfMKib).toBe(65536);
    expect(h.kdfT).toBe(3);
    expect(h.kdfP).toBe(4);
    expect(h.salt).toHaveLength(16);
    expect(h.wrappedDek).toHaveLength(48);
    expect(h.contentNonce).toHaveLength(12);
  });

  it('rechaza magic incorrecto', () => {
    const bad = new Uint8Array(120);
    expect(() => parseHeader(bad)).toThrow(DirdContainerError);
  });

  it('rechaza version distinta a 2', () => {
    const buf = buildValidHeader();
    const dv = new DataView(buf.buffer);
    dv.setUint16(4, 99, true);
    expect(() => parseHeader(buf)).toThrow(DirdContainerError);
  });

  it('rechaza kdf_algo distinto a 1', () => {
    const buf = buildValidHeader();
    new DataView(buf.buffer).setUint8(8, 99);
    expect(() => parseHeader(buf)).toThrow(DirdContainerError);
  });

  it('rechaza header truncado', () => {
    const buf = new Uint8Array(50);
    buf[0] = 0x44; buf[1] = 0x49; buf[2] = 0x52; buf[3] = 0x44;
    expect(() => parseHeader(buf)).toThrow(DirdContainerError);
  });
});
