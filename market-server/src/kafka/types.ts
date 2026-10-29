type KafkaMessageType =
  | "PROOF_REQUESTED"
  | "PROOF_FAILED"

type ProofJobType =
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

// 계좌 등록 확인 (Receipt worker 요청용). proof/블록체인 작업 없이
// on-chain 계좌 등록(registUser) 확인을 요청한다.
export interface AccountRegistrationMessage
  extends BaseMessage {
  jobType: "ACCOUNT_REGISTRATION";
  addr: string;
  txHash: string;
  referenceId: number;
}

// 계좌 등록 확인 결과 (blockchain worker → market-server). 
// result에 따라 회원 상태를 ACTIVE 또는 REJECTED로 전이한다.
export interface AccountRegistrationResultMessage {
  jobId: string;
  referenceId: number;
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
