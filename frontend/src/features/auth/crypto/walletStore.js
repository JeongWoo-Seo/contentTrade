// In-memory holder for the DECRYPTED Ethereum wallet (test wallet).
//
// The private key is persisted only in its AES-GCM-encrypted form (IndexedDB).
// This module holds the decrypted copy in memory for the current session,
// so it can be handed to a ZK worker as a witness. It is cleared on logout.
let wallet = null; // { address: string, privateKey: string }

export function setWallet(w) {
  wallet = w;
}

export function getWallet() {
  return wallet;
}

export function clearWallet() {
  wallet = null;
}
