type KafkaMessageType =
  | "PROOF_REQUESTED"
  | "PROOF_FAILED"

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

// 계좌 등록 확인 (Receipt worker 요청용). proof/블록체인 작업 없이
// on-chain 계좌 등록(registUser) 확인을 요청한다.
export interface AccountRegistrationMessage
  extends BaseMessage {
  proofType: "ACCOUNT_REGISTRATION";
  addr: string;
  txHash: string;
}

// 계좌 등록 확인 결과 (blockchain worker → market-server). 
// result에 따라 회원 상태를 ACTIVE 또는 REJECTED로 전이한다.
export interface AccountRegistrationResultMessage {
  jobId: string;
  result: "ACTIVE" | "REJECTED";
  reason?: string;
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
  | TradeProofRequestedMessage;

export type MarketKafkaMessage =
  | ProofRequestedMessage
  | AccountRegistrationMessage
  | JobFailedMessage;
