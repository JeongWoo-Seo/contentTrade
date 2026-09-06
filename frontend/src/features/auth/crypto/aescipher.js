import { AES_IV_BYTES } from './constants.js';
import { bytesToHex, hexToBytes } from './util.js';

// Encrypt a UTF-8 string (the hex-encoded sk_own) with AES-256-GCM.
// A fresh random 96-bit IV is generated on every call — IVs are never reused.
export async function encryptSecret(plaintextHex, key) {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const data = new TextEncoder().encode(plaintextHex);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: bytesToHex(iv), ciphertext: bytesToHex(new Uint8Array(ciphertext)) };
}

export async function decryptSecret({ iv, ciphertext }, key) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(iv) },
    key,
    hexToBytes(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
