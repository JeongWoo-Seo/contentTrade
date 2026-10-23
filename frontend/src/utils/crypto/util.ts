import { FIELD_PRIME } from './constants';

const HEX_RE = /^[0-9a-fA-F]*$/;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('odd-length hex string');
  if (!HEX_RE.test(clean)) throw new Error('invalid hex string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Deterministic mapping of an ASCII string to a field element (< FIELD_PRIME).
// Used only for domain-separation tags (never for secrets).
export function strToField(str: string): bigint {
  const bytes = new TextEncoder().encode(str);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n % FIELD_PRIME;
}

// bigint -> 64-char zero-padded hex (matches the project's storage convention).
export function bigintToHex64(n: bigint): string {
  return n.toString(16).padStart(64, '0');
}
