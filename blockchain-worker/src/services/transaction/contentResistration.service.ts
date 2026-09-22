import { prisma } from "../../lib/prisma.js";
import { outboxRepository } from "../../repositories/outbox.repository.js";
import { retryBase } from "../common.service.js";
import {
  simulateContentRegistration as simulateOnChain,
  signTransaction,
  broadcastTransaction,
  getTransaction,
  getPendingNonce,
  estimateGas,
  addGasMargin,
  getEip1559Fee
} from "../../blockchain/blockchain.service.js";
import { sleep } from "../../utils/sleep.js";
import { contentTradeContract } from "../../blockchain/blockchian.js";
import { isError } from "ethers";
import {isRetryableRpcError,getErrorReason} from "../../utils/blockchain-error.js"
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
      await failContentRegistrationJob(
        job,
        submitted.reason,
      );

      return;
    }


    // ============================================================
    // 5. txHash + nonce 확인
    // ============================================================
    if (!submitted.txHash || submitted.nonce === undefined
    ) {
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
      `[blockchain-worker] content registration processing error ` +
      `jobId=${job.jobId}:`,
      error,
    );

    throw error;
  }
}

async function claimContentRegistrationJobWithRetry(
  jobId: string,
) {
  return retryBase(
    () => claimContentRegistrationJob(jobId),
    {
      operationName: `claim content registration jobId=${jobId}`
    },
  );
}

async function claimContentRegistrationJob(
  jobId: string,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.contentRegistrationTransaction.updateMany({//status 조건을 위해 updateMany 사용
      where: {
        jobId,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const job = await tx.contentRegistrationTransaction.findUnique({
      where: { jobId },
    });

    if (!job) {
      throw new Error(`Content registration transaction disappeared: jobId=${jobId}`);
    }

    return job;
  });
}

async function simulateContentRegistrationWithRetry(
  job: {
    jobId: string;
    proof: string;
    publicSignals: string;
  },
) {
  return retryBase(
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
  try {
    await simulateOnChain(
      job.proof,
      job.publicSignals,
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
  return retryBase(
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
  // 1. Nonce
  const nonce = await getPendingNonce();

  // 2. Calldata
  const data = contentTradeContract.interface.encodeFunctionData(
    "registerContent",
    [
      job.proof,
      job.publicSignals,
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
  const { signedTx, txHash } = await signTransaction(transaction);

  while (true) {
    try {
      await broadcastTransaction(signedTx);
    } catch (error) {
      if (isRetryableRpcError(error)) {
        await sleep(1_000);
        continue;
      }

      return {
        success: false,
        reason: getErrorReason(error),
      };
    }

    try {
      const tx = await getTransaction(txHash);

      if (tx) {
        return {
          success: true,
          txHash,
          nonce: transaction.nonce,
        };
      }
    } catch (error) {
      if (isRetryableRpcError(error)) {
        await sleep(1_000);
        continue;
      }

      return {
        success: false,
        reason: getErrorReason(error),
      };
    }

    await sleep(1_000);
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
  return retryBase(
    () =>
      markContentRegistrationSubmitted({
        jobId,
        txHash,
        nonce,
      }),
    {
      operationName: `mark content registration SUBMITTED ` + `jobId=${jobId}`,
    },
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
  },
  reason: string,
) {
  return retryBase(
    () => failContentRegistrationJob(job, reason),
    {
      operationName: `fail content registration jobId=${job.jobId}`
    },
  );
}

async function failContentRegistrationJob(
  job: {
    id: number;
    jobId: string;
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
    });
  });
}