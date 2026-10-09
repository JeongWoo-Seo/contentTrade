import { buildPoseidon } from "circomlibjs";
import { randomBytes } from "node:crypto";

const poseidon = await buildPoseidon();
const F = poseidon.F;
const POSEIDON_CHUNK_SIZE = 16;

// BN254 scalar field (r)
export const BN254_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

// ------------------------------------------------------------
// RegistContent(DATA_BLOCK_NUM) 회로 파라미터
//
// data[i] 는 31-byte block(248-bit) 을 bigint 로 변환한 field element.
// 254-bit BN254 scalar field 에 맞추기 위해 32-byte 가 아닌 31-byte 를 사용한다.
//
// circomlibjs Poseidon 은 최대 16개 입력(t=17)까지 지원한다.
// DATA_BLOCK_NUM 은 이 한계 안에서 회로와 동일한 값이어야 한다.
// ------------------------------------------------------------

// data block 1개의 byte 크기 (248-bit < 254-bit field)
export const DATA_BLOCK_BYTES = 31;

// 회로 RegistContent(DATA_BLOCK_NUM) 의 블록 수
export const DATA_BLOCK_NUM = 487;

// field element → canonical 32-byte big-endian
export function fieldToBytes32(value: bigint): Uint8Array<ArrayBuffer> {
  if (value < 0n || value >= BN254_SCALAR_FIELD) {
    throw new Error("field element out of BN254 scalar field range");
  }

  const hex = value.toString(16).padStart(64, "0");

  return Uint8Array.from(Buffer.from(hex, "hex"));
}

// field element → canonical 64-char hex string (bigint.toString(16).padStart(64, "0"))
export function fieldToHexString(value: bigint): string {
  if (value < 0n || value >= BN254_SCALAR_FIELD) {
    throw new Error("field element out of BN254 scalar field range");
  }

  return value.toString(16).padStart(64, "0");
}

// 32-byte big-endian → field element (fieldToBytes32 의 역변환)
export function bytes32ToField(bytes: Uint8Array): bigint {
  if (bytes.length !== 32) {
    throw new Error(`Expected exactly 32 bytes, got ${bytes.length}`);
  }

  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value;
}

// 31-byte block → bigint (big-endian)
export function bytes31ToField(bytes: Uint8Array): bigint {
  if (bytes.length !== DATA_BLOCK_BYTES) {
    throw new Error(
      `Expected exactly ${DATA_BLOCK_BYTES} bytes, got ${bytes.length}`,
    );
  }

  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value;
}

// N-input Poseidon (회로의 Poseidon(N) 과 동일)
export function poseidonHash(inputs: bigint[]): bigint {
  const result = poseidon(inputs);

  return BigInt(F.toString(result));
}

// 2-input Poseidon (회로의 Poseidon(2) 과 동일)
export function poseidon2(a: bigint, b: bigint): bigint {
  return poseidonHash([a, b]);
}

export function poseidon16(inputs: bigint[]): bigint {
  if (inputs.length !== POSEIDON_CHUNK_SIZE) {
    throw new Error(`Poseidon16 requires exactly ${POSEIDON_CHUNK_SIZE} inputs`);
  }

  return BigInt(F.toString(poseidon(inputs)));
}

export function poseidonHash484(inputs: bigint[]): bigint {
  if (inputs.length !== DATA_BLOCK_NUM) {
    throw new Error(`poseidonHash requires exactly ${DATA_BLOCK_NUM} inputs, got ${inputs.length}`);
  }

  // ========================================================
  // Level 0
  // 484 → 31
  // ========================================================

  const level0: bigint[] = [];

  for (let i = 0; i < 484; i += 16) {
    const chunk = inputs.slice(i, i + 16);

    while (chunk.length < 16) {
      chunk.push(0n);
    }

    level0.push(poseidon16(chunk));
  }


  // ========================================================
  // Level 1
  // 31 → 2
  // ========================================================

  const level1: bigint[] = [];

  for (let i = 0; i < level0.length; i += 16) {
    const chunk = level0.slice(i, i + 16);

    while (chunk.length < 16) {
      chunk.push(0n);
    }

    level1.push(poseidon16(chunk));
  }


  // ========================================================
  // Level 2
  // 2 → 1
  // ========================================================

  return poseidon2(level1[0],level1[1]);
}

// [1, r-1] 범위의 random field element
export function randomFieldElement(): bigint {
  for (;;) {
    const buf = randomBytes(32);

    let value = 0n;

    for (const byte of buf) {
      value = (value << 8n) | BigInt(byte);
    }

    value %= BN254_SCALAR_FIELD;

    if (value !== 0n) {
      return value;
    }
  }
}

// field element (< 2^248) → 31-byte big-endian (bytes31ToField 의 역변환)
export function fieldToBytes31(value: bigint): Uint8Array<ArrayBuffer> {
  if (value < 0n || value >= (1n << 248n)) {
    throw new Error("value out of 31-byte range");
  }

  const hex = value.toString(16).padStart(DATA_BLOCK_BYTES * 2, "0");

  return Uint8Array.from(Buffer.from(hex, "hex"));
}

// 문자열 → field element
//  - "0x" prefix → hex
//  - 64자리 hex (bigintToHex64, "0x" 없음) → hex
//  - 그 외 → decimal
export function parseFieldElement(value: string): bigint {
  const trimmed = value.trim();

  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return BigInt("0x" + trimmed);
  }

  const parsed = BigInt(trimmed);

  if (parsed < 0n || parsed >= BN254_SCALAR_FIELD) {
    throw new Error("field element out of BN254 scalar field range");
  }

  return parsed;
}
