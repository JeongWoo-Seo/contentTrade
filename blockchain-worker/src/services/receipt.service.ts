import { checkContentRegistrationReceipt, checkTradeApprovalReceipt, checkAccountRegistrationReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { accountRegistrationRepository } from "../repositories/account-registration.repository.js";
import { transactionRepository } from "../repositories/transation.repository.js";
import { withDbRetry } from "../utils/retry.js";
import type {
  ContentRegistrationTransaction,
  TradeApprovalTransaction,
} from "@prisma/client";
import type { ReceiptCheckResult } from "../blockchain/type.js";
import { type ReceiptMessage, AccountRegistrationRequestMessage } from "../kafka/types.js";
import { outboxRepository } from "../repositories/outbox.repository.js";

export async function processReceiptCheck(
  message: ReceiptMessage
): Promise<void> {
  switch (message.jobType) {
    case "CONTENT_REGISTRATION":
      await processContentRegistrationReceipt(message.jobId);
      break;

    case "TRADE_APPROVAL":
      await processTradeApprovalReceipt(message.jobId);
      break;

    case "ACCOUNT_REGISTRATION":
      await processAccountRegistrationReceipt(message);
      break;

    default:
      throw new Error(`Unsupported receipt job type`);
  }
}

///////////////////////////////////////////
//        AccountRegistration
///////////////////////////////////////////

async function processAccountRegistrationReceipt(
  message: AccountRegistrationRequestMessage
): Promise<void> {
  //validateAccountRegistrationMessage(message);

  const job = await accountRegistrationRepository.claimOrCreatePendingReceipt({
    jobId: message.jobId,
    userId: message.referenceId,
    addr: message.addr,
    txHash: message.txHash,
  });
  if (!job) {
    throw new Error(`Account registration accountRegistrationRepository claimOrCreatePendingReceipt fail: jobId=${message.jobId}`);
  }
  if (job.status !== "PENDING") {
    return;
  }

  const result = await checkAccountRegistrationReceipt(job.txHash, job.addr);

  // 아직 블록에 포함되지 않음 → Outbox를 PENDING으로 되돌려 재발행
  if (result.status === "CONFIRMED") {
    await confirmAccountRegistrationWithRetry(job.jobId);
  } else if (result.status === "PENDING") {
    await markReceiptCheckPendingWithRetry(job.jobId);
  }// 블록체인 실행 실패
  else {
    await failAccountRegistrationWithRetry(job.jobId, result);
  }
}

async function confirmAccountRegistrationWithRetry(jobId: string): Promise<void> {
  withDbRetry(
    () => transactionRepository.accountRegistrationConfirm(jobId),
    { operationName: `confirmAccountRegistration:${jobId}` },
  );
}

async function failAccountRegistrationWithRetry(
  jobId: string,
  result: Extract<ReceiptCheckResult, { status: "FAILED" }>,
): Promise<void> {
  withDbRetry(
    () => transactionRepository.accountRegistratioFail(jobId, result.reason),
    { operationName: `failAccountRegistration:${jobId}` },
  );
}

///////////////////////////////////////////
//        ContentRegistration
///////////////////////////////////////////

async function processContentRegistrationReceipt(
  jobId: string,
): Promise<void> {
  const job = await contentRegistrationTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") {
    return;
  }

  const result = await checkContentRegistrationReceipt(job.txHash!);

  // 아직 블록에 포함되지 않음 → Outbox를 PENDING으로 되돌려 재발행
  if (result.status === "PENDING") {
    await markReceiptCheckPendingWithRetry(job.jobId);
  }
  // 블록체인 실행 실패
  else if (result.status === "FAILED") {
    await failContentRegistrationWithRetry(job, result);
  } else {
    // 블록체인 실행 성공
    await confirmContentRegistrationWithRetry(job);
  }
}

async function failContentRegistrationWithRetry(
  job: ContentRegistrationTransaction,
  receipt: ReceiptCheckResult,
): Promise<boolean> {
  const failureReason = `Transaction reverted (status=${receipt.status})`;

  return withDbRetry(
    () => transactionRepository.failContentRegistration(job, failureReason),
    {
      operationName: `failContentRegistration:${job.jobId}`,
    },
  );
}

async function confirmContentRegistrationWithRetry(
  job: ContentRegistrationTransaction,
): Promise<boolean> {
  return withDbRetry(
    () => transactionRepository.confirmContentRegistration(job),
    {
      operationName: `confirmContentRegistration:${job.jobId}`,
    },
  );
}

///////////////////////////////////////////
//        TradeApproval
///////////////////////////////////////////

async function processTradeApprovalReceipt(jobId: string): Promise<void> {
  const job = await tradeApprovalTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") {
    return;
  }

  const result = await checkTradeApprovalReceipt(job.txHash!);

  if (result.status === "PENDING") {
    await markReceiptCheckPendingWithRetry(job.jobId);
    return;
  } else if (result.status === "FAILED") {
    await failTradeApprovalWithRetry(job, result);
    return;
  } else {
    await confirmTradeApprovalWithRetry(job);
  }
}

async function failTradeApprovalWithRetry(
  job: TradeApprovalTransaction,
  receipt: ReceiptCheckResult,
): Promise<boolean> {
  const failureReason = `Transaction reverted (status=${receipt.status})`;

  return withDbRetry(
    () => transactionRepository.failTradeApproval(job, failureReason),
    {
      operationName: `failTradeApproval:${job.jobId}`,
    },
  );
}

async function confirmTradeApprovalWithRetry(
  job: TradeApprovalTransaction,
): Promise<boolean> {
  return withDbRetry(
    () => transactionRepository.confirmTradeApproval(job),
    {
      operationName: `confirmTradeApproval:${job.jobId}`,
    },
  );
}

async function markReceiptCheckPendingWithRetry(jobId: string): Promise<void> {
  await withDbRetry(
    () => outboxRepository.markPendingForReceiptRetry(jobId),
    { operationName: `markReceiptCheckPendingRetry:${jobId}` },
  );
}