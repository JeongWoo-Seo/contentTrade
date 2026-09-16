
type FailedStage = "PROOF" | "BLOCKCHAIN";

interface BaseMessage {
  jobId: string;
  requestedAt: string;
}

interface BaseJobFailedMessage extends BaseMessage {
  failedStage: FailedStage;
  reason: string;
}

interface RegistrationJobFailedMessage extends BaseJobFailedMessage {
  proofType: "CONTENT_REGISTRATION";
  registrationId: number;
}

interface TradeJobFailedMessage extends BaseJobFailedMessage {
  proofType: "TRADE_APPROVAL";
  purchaseId: number;
}

export type JobFailedMessage = RegistrationJobFailedMessage | TradeJobFailedMessage;
