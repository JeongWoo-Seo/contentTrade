// In-memory-only secret holder. Secrets are NEVER written to
// localStorage/sessionStorage/IndexedDB in plaintext.
//
// On logout, references are dropped (set to null) so the garbage collector
// can reclaim them and they can no longer be used (spec section 14).
//
// Note: auth tokens live in ./tokenStore.js (separate concern).

let session = {
  id: null,
  skOwn: null, // hex string
  skEnc: null, // hex string
  aesKey: null, // CryptoKey (non-extractable)
  pkOwn: null,
  pkEnc: null,
  ena: null,
  authenticated: false,
};

export function setSecrets({ id, skOwn, skEnc, aesKey, pkOwn, pkEnc, ena }) {
  session.id = id;
  session.skOwn = skOwn;
  session.skEnc = skEnc;
  session.aesKey = aesKey;
  session.pkOwn = pkOwn;
  session.pkEnc = pkEnc;
  session.ena = ena;
  session.authenticated = true;
}

export function clearSecrets() {
  session.id = null;
  session.skOwn = null;
  session.skEnc = null;
  session.aesKey = null;
  session.pkOwn = null;
  session.pkEnc = null;
  session.ena = null;
  session.authenticated = false;
}

export function getSecrets() {
  return session;
}
