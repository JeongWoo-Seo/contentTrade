import { Contract, JsonRpcProvider, type HDNodeWallet } from 'ethers';
import { SymmetricKeyEncryption } from '../../../utils/crypto/encryption';
import { pointFromHex, type Account } from '../../../utils/crypto/keys';
import type { Ena } from '../../../utils/crypto/balance';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const RPC_URL = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545';

// ContentTrade.registUser ABI (필요한 함수만 최소 정의)
const REGIST_USER_ABI = [
  {
    type: 'function',
    name: 'registUser',
    stateMutability: 'payable',
    inputs: [
      { name: 'addr', type: 'uint256' },
      { name: 'pk_own', type: 'uint256' },
      { name: 'pk_enc', type: 'uint256[2]' },
      { name: 'r', type: 'uint256' },
      { name: 'ct', type: 'uint256' },
    ],
    outputs: [],
  },
];

// ContentTrade._ena getter ABI (계좌 암호화 잔액 조회)
const ENA_ABI = [
  {
    type: 'function',
    name: '_ena',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'r', type: 'uint256' },
      { name: 'ct', type: 'uint256' },
    ],
  },
];
export interface ContractDeployment {
  chainId: number;
  contentTrade: string;
  registContentVerifier: string;
  deployedAt: number;
}

/**
 * market-server의 컨트랙트 배포 정보 API에서 컨트랙트 주소를 조회한다.
 */
export async function getContractAddress(): Promise<ContractDeployment> {
  const res = await fetch(`${BASE_URL}/api/contracts/address`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || '컨트랙트 주소를 불러오지 못했습니다.');
  }
  return res.json() as Promise<ContractDeployment>;
}

/**
 * 사용자의 addr로 스마트 컨트랙트에서 암호화된 계좌 잔액(ENA = {r, ct})을 조회한다.
 * 계좌가 등록되지 않았으면(r === 0) 오류를 던진다.
 */
export async function getEna(addr: string, contractAddress: string): Promise<Ena> {
  const provider = new JsonRpcProvider(RPC_URL);
  const contract = new Contract(contractAddress, ENA_ABI, provider);
  const [r, ct] = (await contract._ena(BigInt(`0x${addr}`))) as [bigint, bigint];

  if (r === 0n) {
    throw new Error('등록된 계좌가 없습니다.');
  }

  return { r, ct };
}
interface RegisterAccountParams {
  wallet: HDNodeWallet;
  account: Account;
  contractAddress: string;
}

/**
 * ContentTrade.registUser(addr, pk_own, pk_enc, r, ct) 트랜잭션을 전송한다.
 *
 * - addr / pk_own / pk_enc : 기존 계좌·키 생성(deriveAccount) 결과 사용
 * - r / ct                 : ENA 커밋먼트. SymmetricKeyEncryption.Enc(sk_enc)로 생성한다.
 */
export async function registerAccount({
  wallet,
  account,
  contractAddress,
}: RegisterAccountParams): Promise<string> {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = wallet.connect(provider);
  const contract = new Contract(
    contractAddress,
    REGIST_USER_ABI,
    signer,
  );

  const addr = BigInt(`0x${account.addr}`);
  const pkOwn = BigInt(`0x${account.pkOwn}`);
  const kENA = BigInt(`0x${account.kENA}`);
  const pkEnc = pointFromHex(account.pkEnc);

  // 암호화할 초기 잔고 (10진수)
  const balance = 50000000000n;

  // SymmetricKeyEncryption 초기화
  // dataMaxBlockNum은 이 예제의 단일 값 암호화에서는 사용하지 않음
  const encryption = await SymmetricKeyEncryption.create(kENA, 1);
  const encrypted = encryption.Enc(balance);

  const tx = await contract.registUser(
    addr,
    pkOwn,
    pkEnc,
    encrypted.r,
    encrypted.ct,
  );

  await tx.wait();

  return tx.hash;
}
