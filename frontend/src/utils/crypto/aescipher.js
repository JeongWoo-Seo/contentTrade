import { AES_IV_BYTES } from './constants.js';
import { bytesToHex, hexToBytes } from './util.js';

// Encrypt a UTF-8 string with AES-256-GCM.
// A fresh random 96-bit IV is generated on every call — IVs are never reused.
// Used for both sk_own and the Ethereum private key (each with its own IV).
export async function encryptString(value, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const data = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return { iv: bytesToHex(iv), ciphertext: bytesToHex(new Uint8Array(ciphertext)) };
}

// Decrypt a string produced by encryptString.
export async function decryptString(ciphertext, iv, cryptoKey) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(iv) },
    cryptoKey,
    hexToBytes(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
