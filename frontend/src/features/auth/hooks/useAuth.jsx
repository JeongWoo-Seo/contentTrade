import { createContext, useCallback, useContext, useState } from 'react';
import { Wallet } from 'ethers';
import { generateSkOwn, deriveAccount } from '../crypto/keys.js';
import { deriveAesKey, generateSalt } from '../crypto/kdf.js';
import { encryptString, decryptString } from '../crypto/aescipher.js';
import { saveAccount, getAccount } from '../crypto/indexeddb.js';
import { setSecrets, clearSecrets, getSecrets } from '../crypto/session.js';
import { setWallet, clearWallet, getWallet } from '../crypto/walletStore.js';
import { bytesToHex, hexToBytes } from '../crypto/util.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

// Public (non-secret) auth state lives in React state; secrets (sk_own, sk_enc,
// Ethereum private key) live in module-level memory stores, never in React state.
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: 'anonymous',
    username: null,
    walletAddress: null,
  });

  const signup = useCallback(async ({ username, password }) => {
    // 1. generate an Ethereum test wallet. address -> server, privateKey -> encrypted locally.
    const wallet = Wallet.createRandom();

    // 2. generate sk_own (content encryption secret).
    const skOwn = generateSkOwn();
    const account = await deriveAccount(skOwn);

    // 3. derive the AES-256-GCM key (Argon2id) — reused for both secrets.
    const salt = generateSalt();
    const aesKey = await deriveAesKey(password, salt);

    // 4. encrypt skOwn (IV A) and privateKey (IV B) with separate fresh IVs.
    const { iv: skOwnIv, ciphertext: encryptedSkOwn } = await encryptString(skOwn, aesKey);
    const { iv: privateKeyIv, ciphertext: encryptedPrivateKey } = await encryptString(wallet.privateKey, aesKey);

    // 5. persist encrypted credentials to IndexedDB (never plaintext).
    await saveAccount({
      id: username,
      walletAddress: wallet.address,
      encryptedPrivateKey,
      privateKeyIv,
      encryptedSkOwn,
      skOwnIv,
      salt: bytesToHex(salt),
    });

    // 6. register on the server
    await authService.signup({
      username,
      password,
      eoa: wallet.address,
      pkOwn: account.pkOwn,
      pkEnc: account.pkEnc,
      addr: account.addr,
    });

    setState({status: 'unauthenticated'});
  }, []);

  const login = useCallback(async ({ username, password }) => {
    // 1. server auth — response includes user.walletAddress.
    const res = await authService.login({ username, password });
    const serverWalletAddress = res?.user?.eoa ?? null;

    // 2. load encrypted credentials from IndexedDB.
    const record = await getAccount(username);
    if (!record) throw new Error('계정 키를 찾을 수 없습니다. 다시 회원가입해주세요.');

    // 3. verify the local wallet matches the server before using it.
    if (serverWalletAddress && record.walletAddress) {
      if (serverWalletAddress.toLowerCase() !== record.walletAddress.toLowerCase()) {
        throw new Error('Wallet address mismatch');
      }
    }

    // 4. derive AES key (Argon2id, stored salt).
    const aesKey = await deriveAesKey(password, hexToBytes(record.salt));

    // 5. decrypt skOwn and privateKey.
    const skOwn = await decryptString(record.encryptedSkOwn, record.skOwnIv, aesKey);
    const account = await deriveAccount(skOwn);

    // 6. keep secrets in memory only.
    setSecrets({
      id: username,
      skOwn,
      skEnc: account.skEnc,
      aesKey,
      pkOwn: account.pkOwn,
      pkEnc: account.pkEnc,
      addr: account.addr,
    });

    if (record.encryptedPrivateKey && record.privateKeyIv) {
      const privateKey = await decryptString(record.encryptedPrivateKey, record.privateKeyIv, aesKey);
      setWallet({ address: record.walletAddress, privateKey });
    }

   setState({status: 'authenticated',username,walletAddress: serverWalletAddress});
  }, []);

  const logout = useCallback(async () => {
    clearSecrets();
    clearWallet();
    setState({ status: 'anonymous', username: null, walletAddress: null });

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
    getSecrets,
    getWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
