
export type TransactionInput = {
  to: string;
  data: string;
  nonce: number;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  value?: bigint;
};

export type SignedTransaction = {
  signedTx: string;
  txHash: string;
};

export type SubmittedTransaction = {
  txHash: string;
  nonce: number;
};

export type Eip1559Fee = {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

export interface ReceiptCheckResult {
  confirmed: boolean;
  failed: boolean;
  status?: number | null;
  transactionHash?: string;
}

export type Groth16Proof = {
  pi_a: [string, string, string];
  pi_b: [
    [string, string],
    [string, string],
    [string, string],
  ];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
};