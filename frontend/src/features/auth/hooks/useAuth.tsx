import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { generateSkOwn, deriveAccount } from '../../../utils/crypto/keys';
import { deriveAesKey, generateSalt } from '../../../utils/crypto/kdf';
import { encryptString, decryptString } from '../../../utils/crypto/aescipher';
import { saveAccount, getAccount } from '../../../utils/crypto/indexeddb';
import { setSecrets, clearSecrets, getSecrets, type Session } from '../../../utils/crypto/session';
import { setWallet, clearWallet, getWallet, getTestWallet, getNextTestAccountIndex, type Wallet } from '../../../utils/crypto/walletStore';
import { bytesToHex, hexToBytes } from '../../../utils/crypto/util';
import { authService, setOnRefreshFailed, type AuthFetchOptions } from '../services/authService';
import { getContractAddress, registerAccount } from '../services/contractService';

type AuthStatus = 'anonymous' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  username: string | null;
  walletAddress: string | null;
}

interface AuthContextValue extends AuthState {
  signup: (input: { username: string; password: string }) => Promise<void>;
  login: (input: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: typeof authService.refresh;
  authFetch: (path: string, options?: AuthFetchOptions) => Promise<Response>;
  getSecrets: () => Session;
  getWallet: () => Wallet | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Public (non-secret) auth state lives in React state; secrets (sk_own, sk_enc,
// Ethereum private key) live in module-level memory stores, never in React state.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'anonymous',
    username: null,
    walletAddress: null,
  });

  // Access Token 갱신 실패 시 인증 상태 초기화.
  // 상태가 'anonymous'가 되면 ProtectedRoute가 로그인 화면(/)으로 리다이렉트한다.
  useEffect(() => {
    setOnRefreshFailed(() => {
      clearSecrets();
      clearWallet();
      setState({ status: 'anonymous', username: null, walletAddress: null });
    });

    return () => setOnRefreshFailed(null);
  }, []);

  const signup = useCallback(async ({ username, password }: { username: string; password: string }) => {
    // 1. generate an Ethereum test wallet. address -> server, privateKey -> encrypted locally.
    const accountIndex = getNextTestAccountIndex();
    const wallet = getTestWallet(accountIndex);

    // 2. generate sk_own (content encryption secret).
    const skOwn = generateSkOwn()
    const account = await deriveAccount(skOwn);

    // 3. 컨트랙트 주소 조회 + 계좌 등록 트랜잭션 (블록체인)
    //    (4단계 서버 addr 중복 확인·가입 승인은 이후 단계에서 구현)
    const deployment = await getContractAddress();
    const txHash = await registerAccount({
      wallet,
      account,
      contractAddress: deployment.contentTrade,
    });
    console.log(`[signup] registUser tx: ${txHash}`);

    // 4. derive the AES-256-GCM key (Argon2id) — reused for both secrets.
    const salt = generateSalt();
    const aesKey = await deriveAesKey(password, salt);

    // 5. encrypt skOwn (IV A) and privateKey (IV B) with separate fresh IVs.
    const { iv: skOwnIv, ciphertext: encryptedSkOwn } = await encryptString(account.skOwn, aesKey);
    const { iv: privateKeyIv, ciphertext: encryptedPrivateKey } = await encryptString(wallet.privateKey, aesKey);

    // 6. persist encrypted credentials to IndexedDB (never plaintext).
    await saveAccount({
      id: username,
      walletAddress: wallet.address,
      encryptedPrivateKey,
      privateKeyIv,
      encryptedSkOwn,
      skOwnIv,
      salt: bytesToHex(salt),
    });

    // 7. register on the server
    await authService.signup({
      username,
      password,
      eoa: wallet.address,
      pkOwn: account.pkOwn,
      pkEnc: account.pkEnc,
      addr: account.addr,
    });

    setState({ status: 'unauthenticated', username: null, walletAddress: null });
  }, []);

  const login = useCallback(async ({ username, password }: { username: string; password: string }) => {
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

    setState({ status: 'authenticated', username, walletAddress: serverWalletAddress });
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

  const value: AuthContextValue = {
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
