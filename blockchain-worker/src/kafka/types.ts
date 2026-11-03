import type { OutboxEventType, OutboxJobType } from "@prisma/client";

type FailedStage = "PROOF" | "BLOCKCHAIN";

interface BaseMessage {
  jobId: string;
  requestedAt: string;
}

interface BaseJobFailedMessage extends BaseMessage {
  failedStage: FailedStage;
  reason: string;
  referenceId: number;
}

interface RegistrationJobFailedMessage extends BaseJobFailedMessage {
  jobType: "CONTENT_REGISTRATION";
}

interface TradeJobFailedMessage extends BaseJobFailedMessage {
  jobType: "TRADE_APPROVAL";
}

export type JobFailedMessage = RegistrationJobFailedMessage | TradeJobFailedMessage;

export interface AccountResultMessage {
  jobId: string;
  jobType: "ACCOUNT_REGISTRATION";
  eventType: string;
  result: "ACTIVE" | "REJECTED";
  reason?: string;
  referenceId: number;
}

export interface AccountRegistrationRequestMessage {
  jobId: string;
  jobType: "ACCOUNT_REGISTRATION";
  eventType: string;
  addr: string;
  txHash: string;
  referenceId: number;
}

export interface proofWorkMessage {
  jobId: string;
  jobType: "CONTENT_REGISTRATION" | "TRADE_APPROVAL";
  eventType: OutboxEventType;
}

export type ReceiptMessage = proofWorkMessage | AccountRegistrationRequestMessage;