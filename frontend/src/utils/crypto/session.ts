// In-memory-only secret holder. Secrets are NEVER written to
// localStorage/sessionStorage/IndexedDB in plaintext.
//
// On logout, references are dropped (set to null) so the garbage collector
// can reclaim them and they can no longer be used (spec section 14).
//
// Note: auth tokens live in ./tokenStore (separate concern).

export interface Session {
  id: string | null;
  skOwn: string | null; // hex string
  skEnc: string | null; // hex string
  aesKey: CryptoKey | null; // CryptoKey (non-extractable)
  pkOwn: string | null;
  pkEnc: string | null;
  addr: string | null; // account commitment
  authenticated: boolean;
}

let session: Session = {
  id: null,
  skOwn: null,
  skEnc: null,
  aesKey: null,
  pkOwn: null,
  pkEnc: null,
  addr: null,
  authenticated: false,
};

export interface SessionSecrets {
  id: string;
  skOwn: string;
  skEnc: string;
  aesKey: CryptoKey;
  pkOwn: string;
  pkEnc: string;
  addr: string;
}

export function setSecrets({ id, skOwn, skEnc, aesKey, pkOwn, pkEnc, addr }: SessionSecrets): void {
  session.id = id;
  session.skOwn = skOwn;
  session.skEnc = skEnc;
  session.aesKey = aesKey;
  session.pkOwn = pkOwn;
  session.pkEnc = pkEnc;
  session.addr = addr;
  session.authenticated = true;
}

export function clearSecrets(): void {
  session.id = null;
  session.skOwn = null;
  session.skEnc = null;
  session.aesKey = null;
  session.pkOwn = null;
  session.pkEnc = null;
  session.addr = null;
  session.authenticated = false;
}

export function getSecrets(): Session {
  return session;
}
