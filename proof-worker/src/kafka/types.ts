export type KafkaMessageType =
  | "PROOF_REQUESTED"
  | "PROOF_FAILED"
  | "BLOCKCHAIN_TRANSACTION";

type ProofJobType =
  | "CONTENT_REGISTRATION"
  | "TRADE_APPROVAL";

interface BaseMessage {
  jobId: string;
  requestedAt: string;
}

export interface RegistrationProofRequestedMessage
  extends BaseMessage {
  proofType: "CONTENT_REGISTRATION";
  registrationId: number;
}

export interface TradeProofRequestedMessage
  extends BaseMessage {
  proofType: "TRADE_APPROVAL";
  purchaseId: number;
}

// ============================================================
// Job Failed
// ============================================================

export type FailedStage =
  | "PROOF"
  | "BLOCKCHAIN";

export interface BaseJobFailedMessage
  extends BaseMessage {
  failedStage: FailedStage;
  reason: string;
}

export interface RegistrationJobFailedMessage
  extends BaseJobFailedMessage {
  proofType: "CONTENT_REGISTRATION";
  registrationId: number;
}

export interface TradeJobFailedMessage
  extends BaseJobFailedMessage {
  proofType: "TRADE_APPROVAL";
  purchaseId: number;
}

// ============================================================
// Blockchain Transaction (proof-worker → blockchain-worker)
// ============================================================

/**
 * proof 생성 후 blockchain-worker로 작업 전달용 메시지.
 * 큰 데이터(proof, publicSignals)는 DB에 저장되어 있으므로 Kafka에는
 * jobId(과 jobType)만 전달한다. blockchain-worker는 jobId로 DB에서 조회한다.
 */
export interface BlockchainTransactionMessage {
  type: "BLOCKCHAIN_TRANSACTION";
  jobId: string;
  jobType: ProofJobType;
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
