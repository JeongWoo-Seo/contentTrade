import { argon2id } from 'hash-wasm';
import {
  ARGON2_MEMORY_KIB,
  ARGON2_ITERATIONS,
  ARGON2_PARALLELISM,
  AES_KEY_BYTES,
  SALT_BYTES,
} from './constants.js';

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

// Derive an AES-256-GCM key from the password via Argon2id (memory-hard KDF).
// The raw password is never used as a key directly (spec section 9).
export async function deriveAesKey(password, salt) {
  const rawKey = await argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: AES_KEY_BYTES,
    outputType: 'binary', // raw bytes -> import as AES-GCM key
  });

  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
