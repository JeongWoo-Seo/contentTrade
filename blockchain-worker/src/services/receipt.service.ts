import { checkContentRegistrationReceipt, checkTradeApprovalReceipt, checkAccountRegistrationReceipt, checkPurchaseReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { accountRegistrationRepository } from "../repositories/account-registration.repository.js";
import { purchaseVerificationRepository } from "../repositories/purchase-verification.repository.js";
import { transactionRepository } from "../repositories/transation.repository.js";
import { withDbRetry } from "../utils/retry.js";
import type {
  ContentRegistrationTransaction,
  TradeApprovalTransaction,
  OutboxJobType,
} from "@prisma/client";
import type { ReceiptCheckResult, PurchaseReceiptCheckResult } from "../blockchain/type.js";
import { type ReceiptMessage, AccountRegistrationRequestMessage, PurchaseRequestMessage } from "../kafka/types.js";
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

    case "PURCHASE_VERIFICATION":
      await processPurchaseVerificationReceipt(message);
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
    await markReceiptCheckPendingWithRetry(job.jobId, "ACCOUNT_REGISTRATION");
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
    await markReceiptCheckPendingWithRetry(job.jobId, "CONTENT_REGISTRATION");
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
    await markReceiptCheckPendingWithRetry(job.jobId, "TRADE_APPROVAL");
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

async function markReceiptCheckPendingWithRetry(jobId: string, jobType: OutboxJobType): Promise<void> {
  await withDbRetry(
    () => outboxRepository.markPendingForReceiptRetry(jobId, jobType),
    { operationName: `markReceiptCheckPendingRetry:${jobId}` },
  );
}

///////////////////////////////////////////
//        Purchase
///////////////////////////////////////////

async function processPurchaseVerificationReceipt(
  message: PurchaseRequestMessage
): Promise<void> {
  const job = await purchaseVerificationRepository.claimOrCreatePendingReceipt({
    jobId: message.jobId,
    txHash: message.txHash,
    referenceId: message.referenceId,
  });
  if (!job) {
    throw new Error(`Purchase verification claim fail: jobId=${message.jobId}`);
  }
  if (job.status !== "PENDING") {
    return;
  }

  const result = await checkPurchaseReceipt(job.txHash);

  if (result.status === "CONFIRMED") {
    await confirmPurchaseVerificationWithRetry(job.jobId, result);
  } else if (result.status === "PENDING") {
    await markReceiptCheckPendingWithRetry(job.jobId, "PURCHASE_VERIFICATION");
  } else {
    await failPurchaseVerificationWithRetry(job.jobId, result.reason);
  }
}

async function confirmPurchaseVerificationWithRetry(
  jobId: string,
  result: Extract<PurchaseReceiptCheckResult, { status: "CONFIRMED" }>
): Promise<void> {
  await withDbRetry(
    () => purchaseVerificationRepository.confirm(jobId, result),
    { operationName: `confirmPurchaseVerification:${jobId}` },
  );
}

async function failPurchaseVerificationWithRetry(
  jobId: string,
  reason: string,
): Promise<void> {
  await withDbRetry(
    () => purchaseVerificationRepository.fail(jobId, reason),
    { operationName: `failPurchaseVerification:${jobId}` },
  );
}