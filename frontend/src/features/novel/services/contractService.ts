import { Contract, JsonRpcProvider, Wallet, type HDNodeWallet } from 'ethers';
import type { Groth16Proof } from 'snarkjs';
import { SymmetricKeyEncryption } from '../../../utils/crypto/encryption';
import { pointFromHex, type Account } from '../../../utils/crypto/keys';
import type { Ena } from '../../../utils/crypto/balance';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const RPC_URL = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545';

// ContentTrade._ena getter ABI (계좌 암호화 잔액 조회)
const ENA_ABI = [
  {
    type: 'function',
    name: 'ena',
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
  const [r, ct] = (await contract.ena(BigInt(`0x${addr}`))) as [bigint, bigint];

  if (r === 0n) {
    throw new Error('등록된 계좌가 없습니다.');
  }

  return { r, ct };
}

// ContentTrade.purchaseContent ABI (구매 ZK proof 검증)
const PURCHASE_ABI = [
  {
    type: 'function',
    name: 'purchaseContent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'a', type: 'uint256[2]' },
      { name: 'b', type: 'uint256[2][2]' },
      { name: 'c', type: 'uint256[2]' },
      { name: 'publicSignals', type: 'uint256[13]' },
    ],
    outputs: [{ name: 'orderNumber', type: 'uint256' }],
  },
];

/**
 * ContentTrade.purchaseContent(a, b, c, publicSignals[13]) 트랜잭션을 전송한다.
 *
 * snarkjs Groth16 proof를 Solidity Groth16Verifier 형식으로 변환한다:
 * - a = [pi_a[0], pi_a[1]]
 * - b = [[pi_b[0][1], pi_b[0][0]], [pi_b[1][1], pi_b[1][0]]] (G2 좌표 순서 스왑)
 * - c = [pi_c[0], pi_c[1]]
 * - publicSignals = 13개 public input (문자열 → bigint)
 *
 * 반환값: tx 해시(오더 번호(orderNumber)가 아닌 tx 해시만 반환).
 */
export async function submitPurchaseContent({
  privateKey,
  contractAddress,
  proof,
  publicSignals,
}: {
  privateKey: string;
  contractAddress: string;
  proof: Groth16Proof;
  publicSignals: string[];
}): Promise<string> {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, PURCHASE_ABI, signer);

  const a = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const b = [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
  ];
  const c = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
  const pubSignals = publicSignals.map((s) => BigInt(s));

  const tx = await contract.purchaseContent(a, b, c, pubSignals);
  await tx.wait();

  return tx.hash;
}
