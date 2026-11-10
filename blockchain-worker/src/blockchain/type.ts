
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

export type ReceiptCheckResult =
  | {
    status: "PENDING";
    txHash: string;
    reason: null;
  }
  | {
    status: "CONFIRMED";
    txHash: string;
    reason: null;
  }
  | {
    status: "FAILED";
    txHash: string;
    reason: string;
  };

export type PurchaseReceiptCheckResult =
  | {
    status: "PENDING";
    txHash: string;
    reason: null;
  }
  | {
    status: "CONFIRMED";
    txHash: string;
    reason: null;
    tradeData: {
      cmSvr: string;
      cmAuth: string;
      c0: [string, string];
      c1: [string, string, string, string, string];
    };
  }
  | {
    status: "FAILED";
    txHash: string;
    reason: string;
  };

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