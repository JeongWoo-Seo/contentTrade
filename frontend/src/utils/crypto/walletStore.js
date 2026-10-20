import { HDNodeWallet } from "ethers";

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


const TEST_MNEMONIC = "test test test test test test test test test test test junk";

export function getTestWallet(accountIndex) {
  if (
    !Number.isSafeInteger(accountIndex) ||
    accountIndex < 0 ||
    accountIndex >= 10
  ) {
    throw new Error("Invalid test account index");
  }

  return HDNodeWallet.fromPhrase(
    TEST_MNEMONIC,
    undefined,
    `m/44'/60'/0'/0/${accountIndex}`,
  );
}

const TEST_ACCOUNT_INDEX_KEY = "test-account-index";

export function getNextTestAccountIndex() {
  const storedIndex = localStorage.getItem(TEST_ACCOUNT_INDEX_KEY);
  const accountIndex = storedIndex === null ? 1 : Number(storedIndex);

  if (
    !Number.isSafeInteger(accountIndex) ||
    accountIndex < 1 ||
    accountIndex >= 10
  ) {
    throw new Error("No available Anvil test accounts");
  }

  localStorage.setItem(
    TEST_ACCOUNT_INDEX_KEY,
    String(accountIndex + 1),
  );

  return accountIndex;
}