import { prisma } from "../../lib/prisma.js";
import { outboxRepository } from "../../repositories/outbox.repository.js";
import { retryWithMaxAttempts } from "../common.service.js";
import { withDbRetry } from "../../utils/retry.js";
import {
  simulateContentRegistration as simulateOnChain,
  getPendingNonce,
  estimateGas,
  addGasMargin,
  getEip1559Fee
} from "../../blockchain/blockchain.service.js";
import { contentTradeContract, wallet } from "../../blockchain/blockchian.js";
import { isError } from "ethers";
import { isRetryableRpcError, getErrorReason } from "../../utils/blockchain-error.js"
import { type TransactionInput } from "../../blockchain/type.js";
/**
 * Content Registration Transaction 처리
 *
 * 흐름:
 *
 * 1. PENDING → PROCESSING
 * 2. TX Simulation
 * 3. TX 생성
 * 4. TX 전송
 * 5. txHash + nonce 확인
 * 6. DB 저장 PROCESSING → SUBMITTED
 */
export async function processContentRegistration(
  jobId: string,
): Promise<void> {
  // ============================================================
  // 1. 작업 선점
  // ============================================================
  const job = await claimContentRegistrationJobWithRetry(jobId);

  if (!job) {
    return;
  }

  try {
    // ============================================================
    // 2. TX Simulation
    // ============================================================
    const simulation = await simulateContentRegistrationWithRetry(job);

    if (!simulation.success) {
      await failContentRegistrationJobWithRetry(
        job,
        simulation.reason,
      );

      return;
    }

    // ============================================================
    // 3. TX 생성
    // ============================================================
    const transaction = await buildContentRegistrationTransactioneWithRetry(job);

    // ============================================================
    // 4. TX 전송
    // ============================================================
    const submitted = await submitTransaction(transaction);
    if (!submitted.success) {
      await failContentRegistrationJobWithRetry(
        job,
        submitted.reason,
      );

      return;
    }

    // ============================================================
    // 5. txHash + nonce 확인
    // ============================================================
    if (!submitted.txHash || submitted.nonce === undefined) {
      return
    }

    // ============================================================
    // 6. DB 저장
    // ============================================================
    const submittedJdob = await markContentRegistrationSubmittedWithRetry({
      jobId: job.jobId,
      txHash: submitted.txHash,
      nonce: submitted.nonce,
    });

    if (!submittedJdob) {
      return;
    }

    console.log(
      `[blockchain-worker] content registration SUBMITTED ` +
      `jobId=${job.jobId} ` +
      `txHash=${submitted.txHash} ` +
      `nonce=${submitted.nonce}`,
    );
  } catch (error) {
    console.error(
      `[blockchain-worker] content registration  error ` +
      `jobId=${job.jobId}:`,
      error,
    );

    return;
  }
}

async function claimContentRegistrationJobWithRetry(
  jobId: string,
) {
  return withDbRetry(
    () => claimContentRegistrationJob(jobId),
    {
      operationName: `claimContentRegistrationJob:${jobId}`,
    },
  );
}

async function claimContentRegistrationJob(
  jobId: string,
) {
  const updated = await prisma.contentRegistrationTransaction.updateManyAndReturn({
    where: {
      jobId,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      processingStartedAt: new Date(),
    },
  });

  if (updated.length === 0) {
    return null;
  }

  return updated[0];
}

async function simulateContentRegistrationWithRetry(
  job: {
    jobId: string;
    proof: string;
    publicSignals: string;
  },
) {
  return retryWithMaxAttempts(
    () => simulateContentRegistration(job),
    {
      operationName: `simulate content registration jobId=${job.jobId}`,
    },
  );
}

export async function simulateContentRegistration(
  job: {
    jobId: string;
    proof: string;
    publicSignals: string;
  },
) {
  const proof = JSON.parse(job.proof);
  const publicSignals = JSON.parse(job.publicSignals);

  try {
    await simulateOnChain(
      proof,
      publicSignals,
    );

    return {
      success: true,
      reason: "",
    };
  } catch (error) {
    if (isError(error, "CALL_EXCEPTION")) {
      const reason =
        error.reason ??
        error.shortMessage ??
        "Contract execution reverted";

      console.error(
        `[blockchain-worker] content registration simulation reverted ` +
        `jobId=${job.jobId} reason=${reason}`,
      );

      return {
        success: false,
        reason,
      };
    }

    // RPC / network 오류는 retryBase가 처리하도록 throw
    throw error;
  }
}

async function buildContentRegistrationTransactioneWithRetry(
  job: {
    jobId: string;
    proof: string;
    publicSignals: string;
  }) {
  return retryWithMaxAttempts(
    () => buildContentRegistrationTransaction(job),
    {
      operationName: `build content registeration jobId=${job.jobId}`,
    },
  );
}

export async function buildContentRegistrationTransaction(
  job: {
    jobId: string;
    proof: string;
    publicSignals: string;
  })
  : Promise<TransactionInput> {

  const proof = JSON.parse(job.proof);
  const publicSignals = JSON.parse(job.publicSignals);
  // 1. Nonce
  const nonce = await getPendingNonce();

  // 2. Calldata
  const data = contentTradeContract.interface.encodeFunctionData(
    "registerContent",
    [
      proof,
      publicSignals,
    ],
  );

  // 3. Gas 예상 가스 측정 시뮬
  const estimatedGas = await estimateGas({
    to: contentTradeContract.target as string,
    data,
    value: 0n,
  });

  // 마진 추가
  const gasLimit = addGasMargin(estimatedGas, 20);

  // 4. Fee
  const { maxFeePerGas, maxPriorityFeePerGas } = await getEip1559Fee();

  // 5. Transaction 조합
  return {
    to: contentTradeContract.target as string,
    data,
    nonce,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    value: 0n,
  };
}

type SubmitTransactionResult =
  | {
    success: true;
    txHash: string;
    nonce: number;
  }
  | {
    success: false;
    reason: string;
  };

async function submitTransaction(
  transaction: TransactionInput,
): Promise<SubmitTransactionResult> {
  try {
    const txResponse = await wallet.sendTransaction(transaction);

    return {
      success: true,
      txHash: txResponse.hash,
      nonce: txResponse.nonce,
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      reason,
    };
  }
}

async function markContentRegistrationSubmittedWithRetry({
  jobId,
  txHash,
  nonce,
}: {
  jobId: string;
  txHash: string;
  nonce: number;
}) {
  return withDbRetry(
    () =>
      markContentRegistrationSubmitted({
        jobId,
        txHash,
        nonce,
      }),
    { operationName: `mark content registration SUBMITTED jobId=${jobId}` },
  );
}


async function markContentRegistrationSubmitted({
  jobId,
  txHash,
  nonce,
}: {
  jobId: string;
  txHash: string;
  nonce: number;
}) {
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.contentRegistrationTransaction.updateMany({
      where: {
        jobId: jobId,
        status: "PROCESSING",
      },
      data: {
        status: "SUBMITTED",
        txHash,
        nonce,
        submittedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      console.warn(
        `[blockchain-worker] failed to transition ` +
        `PROCESSING → SUBMITTED, job may already be handled ` +
        `jobId=${jobId}`,
      );
      return
    }

    const job = await outboxRepository.create(tx, {
      jobId: jobId,
      jobType: "CONTENT_REGISTRATION",
      eventType: "RECEIPT_CHECK_REQUESTED",
    });

    if (!job) {
      throw new Error(`Content registration transaction disappeared: jobId=${jobId}`);
    }

    return job;
  });
}

async function failContentRegistrationJobWithRetry(
  job: {
    id: number;
    jobId: string;
    registrationId: number;
    createdAt: Date;
  },
  reason: string,
) {
  return withDbRetry(() => failContentRegistrationJob(job, reason), {
    operationName: `fail content registration jobId=${job.jobId}`,
  });
}

async function failContentRegistrationJob(
  job: {
    id: number;
    jobId: string;
    registrationId: number;
    createdAt: Date;
  },
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.contentRegistrationTransaction.updateMany({
      where: {
        id: job.id,
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
        failureReason: reason,
      },
    });

    if (updated.count === 0) {
      console.warn(
        `[blockchain-worker] failed to transition ` +
        `PROCESSING → FAILED, job may already be handled ` +
        `jobId=${job.jobId}`,
      );

      return;
    }

    await outboxRepository.create(tx, {
      jobId: job.jobId,
      jobType: "CONTENT_REGISTRATION",
      eventType: "TRANSACTION_FAILED",
      registrationId: job.registrationId,
      requestedAt: job.createdAt,
      failedStage: "BLOCKCHAIN",
      failReason: reason,
    });
  });
}