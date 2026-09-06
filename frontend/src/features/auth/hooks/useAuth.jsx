import { createContext, useCallback, useContext, useState } from 'react';
import { generateSkOwn, deriveAccount } from '../crypto/keys.js';
import { deriveAesKey, generateSalt } from '../crypto/kdf.js';
import { encryptSecret, decryptSecret } from '../crypto/aescipher.js';
import { saveAccount, getAccount } from '../crypto/indexeddb.js';
import { setSecrets, clearSecrets, getSecrets } from '../crypto/session.js';
import { bytesToHex, hexToBytes } from '../crypto/util.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

// Public (non-secret) auth state lives in React state; secrets live in the
// module-level session store (memory only), never in React state.
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: 'anonymous',
    id: null,
    ena: null,
    pkOwn: null,
    pkEnc: null,
  });

  const signup = useCallback(async ({ id, password }) => {
    // 1. CSPRNG sk_own (Web Crypto)
    const skOwn = generateSkOwn();
    // 2. derive pk_own / sk_enc / pk_enc / ena (Poseidon + ECC)
    const account = await deriveAccount(skOwn);
    // 3. password -> AES-GCM key (Argon2id)
    const salt = generateSalt();
    const aesKey = await deriveAesKey(password, salt);
    // 4. encrypt sk_own
    const { iv, ciphertext } = await encryptSecret(skOwn, aesKey);
    // 5. persist encrypted sk_own to IndexedDB (never plaintext)
    await saveAccount({ id, encryptedSkOwn: ciphertext, iv, salt: bytesToHex(salt) });
    // 6. register on server — public values only (sk_own/sk_enc never sent)
    await authService.signup({
      id,
      password,
      ena: account.ena,
      pkOwn: account.pkOwn,
      pkEnc: account.pkEnc,
    });
    // 7. keep secrets in memory only
    setSecrets({
      id,
      skOwn,
      skEnc: account.skEnc,
      aesKey,
      pkOwn: account.pkOwn,
      pkEnc: account.pkEnc,
      ena: account.ena,
    });
    setState({ status: 'authenticated', id, ena: account.ena, pkOwn: account.pkOwn, pkEnc: account.pkEnc });
  }, []);

  const login = useCallback(async ({ id, password }) => {
    // 1. server auth — issues access + refresh tokens (stored in tokenStore)
    await authService.login({ id, password });
    // 2. load encrypted sk_own from IndexedDB
    const record = await getAccount(id);
    if (!record) throw new Error('계정 키를 찾을 수 없습니다. 다시 회원가입해주세요.');
    // 3. password -> AES key (Argon2id, stored salt)
    const aesKey = await deriveAesKey(password, hexToBytes(record.salt));
    // 4. decrypt sk_own
    const skOwn = await decryptSecret({ iv: record.iv, ciphertext: record.encryptedSkOwn }, aesKey);
    // 5. re-derive key set from sk_own
    const account = await deriveAccount(skOwn);

    //서버에서 이더리움 계좌 정보 가져오기

    // 6. memory only
    setSecrets({
      id,
      skOwn,
      skEnc: account.skEnc,
      aesKey,
      pkOwn: account.pkOwn,
      pkEnc: account.pkEnc,
      ena: account.ena,
    });
    setState({ status: 'authenticated', id, ena: account.ena, pkOwn: account.pkOwn, pkEnc: account.pkEnc });
  }, []);

  const logout = useCallback(async () => {
    // Drop sk_own/sk_enc/aesKey references immediately (spec section 14).
    clearSecrets();
    setState({ status: 'anonymous', id: null, ena: null, pkOwn: null, pkEnc: null });
    // Best-effort server-side token invalidation; tokenStore is always cleared.
    try {
      await authService.logout();
    } catch {
      // ignore — tokens are cleared client-side regardless
    }
  }, []);

  const value = {
    ...state,
    signup,
    login,
    logout,
    refresh: authService.refresh,
    authFetch: authService.authFetch,
    getSecrets, // expose for ZK witness/proof generation later
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
