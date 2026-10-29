export type KafkaMessageType =
  | "PROOF_REQUESTED"
  | "PROOF_FAILED"
  | "BLOCKCHAIN_TRANSACTION";

type jobType =
  | "CONTENT_REGISTRATION"
  | "TRADE_APPROVAL";

interface BaseMessage {
  jobId: string;
  requestedAt: string;
  referenceId: number;
}

export interface RegistrationProofRequestedMessage
  extends BaseMessage {
  jobType: "CONTENT_REGISTRATION";
}

export interface TradeProofRequestedMessage
  extends BaseMessage {
  jobType: "TRADE_APPROVAL";
}

// ============================================================
// Job Failed
// ============================================================

export type FailedStage =
  | "PROOF"
  | "BLOCKCHAIN";

export interface BaseJobFailedMessage
  extends BaseMessage {
  jobId: string;
  failedStage: FailedStage;
  reason: string;
  referenceId: number;
}

export interface RegistrationJobFailedMessage
  extends BaseJobFailedMessage {
  jobType: "CONTENT_REGISTRATION";
}

export interface TradeJobFailedMessage
  extends BaseJobFailedMessage {
  jobType: "TRADE_APPROVAL";
}

// ============================================================
// Blockchain Transaction (proof-worker → blockchain-worker)
// ============================================================
export interface BlockchainTransactionMessage {
  type: "BLOCKCHAIN_TRANSACTION";
  jobId: string;
  jobType: jobType;
}

// ============================================================
// Union
// ============================================================

export type JobFailedMessage =
  | RegistrationJobFailedMessage
  | TradeJobFailedMessage;

export type ProofRequestedMessage =
  | RegistrationProofRequestedMessage
  | TradeProofRequestedMessage;

export type MarketKafkaMessage =
  | ProofRequestedMessage
  | JobFailedMessage;
