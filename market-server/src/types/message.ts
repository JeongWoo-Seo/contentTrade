type KafkaMessageType =
  | "PROOF_REQUESTED"
  | ""

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
// Market Kafka Message
// ============================================================

export type JobFailedMessage =
  | RegistrationJobFailedMessage
  | TradeJobFailedMessage;

export type ProofRequestedMessage =
  | RegistrationProofRequestedMessage
  | TradeProofRequestedMessage

export type MarketKafkaMessage =
  | ProofRequestedMessage
  | JobFailedMessage;