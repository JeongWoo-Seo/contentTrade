import { prisma } from "../../lib/prisma.js";
import { outboxRepository } from "../../repositories/outbox.repository.js";
import { retryBase } from "../common.service.js";
import {
    simulateTradeApproval as simulateOnChain,
    signTransaction,
    broadcastTransaction,
    getTransaction,
    getPendingNonce,
    estimateGas,
    addGasMargin,
    getEip1559Fee,
    type TransactionInput,
} from "../../blockchain/blockchain.service.js";
import { sleep } from "../../utils/sleep.js";
import { contentTradeContract } from "../../blockchain/blockchian.js";
import {
    isError,
} from "ethers";
import {
    isRetryableRpcError,
    getErrorReason,
} from "../../utils/blockchain-error.js";

/**
 * Trade Approval Transaction 처리
 *
 * 흐름:
 *
 * 1. PENDING → PROCESSING
 * 2. TX Simulation
 * 3. TX 생성
 * 4. TX 전송
 * 5. txHash + nonce 확인
 * 6. DB 저장
 *
 * 확정적인 실패:
 *
 * PROCESSING → FAILED
 *
 * TX 전송 성공:
 *
 * PROCESSING → SUBMITTED
 * → RECEIPT_CHECK_REQUESTED
 */
export async function processTradeApproval(
    jobId: string,
): Promise<void> {
    // ============================================================
    // 1. 작업 선점
    // ============================================================

    const job = await claimTradeApprovalJobWithRetry(jobId);

    if (!job) {
        return;
    }

    try {
        // ============================================================
        // 2. TX Simulation
        // ============================================================

        const simulation = await simulateTradeApprovalWithRetry(job);
        if (!simulation.success) {
            await failTradeApprovalJobWithRetry(
                job,
                simulation.reason,
            );

            return;
        }

        // ============================================================
        // 3. TX 생성
        // ============================================================

        const transaction = await buildTradeApprovalTransactionWithRetry(job);

        // ============================================================
        // 4. TX 전송
        // ============================================================

        const submitted = await submitTransaction(transaction);

        if (!submitted.success) {
            await failTradeApprovalJobWithRetry(
                job,
                submitted.reason,
            );

            return;
        }

        // ============================================================
        // 5. txHash + nonce 확인
        // ============================================================

        // discriminated union이므로
        // success === true이면 txHash / nonce가 보장된다.

        // ============================================================
        // 6. DB 저장
        // ============================================================

        const submittedJob = await markTradeApprovalSubmittedWithRetry({
            jobId: job.jobId,
            txHash: submitted.txHash,
            nonce: submitted.nonce,
        });

        if (!submittedJob) {
            return;
        }

        console.log(
            `[blockchain-worker] trade approval SUBMITTED ` +
            `jobId=${job.jobId} ` +
            `txHash=${submitted.txHash} ` +
            `nonce=${submitted.nonce}`,
        );
    } catch (error) {
        console.error(
            `[blockchain-worker] trade approval processing error ` +
            `jobId=${job.jobId}:`,
            error,
        );

        throw error;
    }
}


// ============================================================
// 1. Claim
// ============================================================

async function claimTradeApprovalJobWithRetry(
    jobId: string,
) {
    return retryBase(
        () => claimTradeApprovalJob(jobId),
        {
            operationName: `claim trade approval jobId=${jobId}`,
        },
    );
}

async function claimTradeApprovalJob(
    jobId: string,
) {
    return prisma.$transaction(async (tx) => {
        const updated = await tx.tradeApprovalTransaction.updateMany({
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

        const job = await tx.tradeApprovalTransaction.findUnique({
            where: {
                jobId,
            },
        });

        if (!job) {
            throw new Error(
                `Trade approval transaction disappeared: ` +
                `jobId=${jobId}`,
            );
        }

        return job;
    });
}


// ============================================================
// 2. Simulation
// ============================================================

async function simulateTradeApprovalWithRetry(
    job: {
        jobId: string;
        proof: string;
        publicSignals: string;
    },
) {
    return retryBase(
        () => simulateTradeApproval(job),
        {
            operationName: `simulate trade approval jobId=${job.jobId}`,
        },
    );
}

export async function simulateTradeApproval(
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
                `[blockchain-worker] trade approval simulation reverted ` +
                `jobId=${job.jobId} reason=${reason}`,
            );

            return {
                success: false,
                reason,
            };
        }

        // RPC / network 오류는 retryBase가 처리
        throw error;
    }
}


// ============================================================
// 3. TX 생성
// ============================================================

async function buildTradeApprovalTransactionWithRetry(
    job: {
        jobId: string;
        proof: string;
        publicSignals: string;
    },
): Promise<TransactionInput> {
    return retryBase(
        () => buildTradeApprovalTransaction(job),
        {
            operationName: `build trade approval jobId=${job.jobId}`,
        },
    );
}

export async function buildTradeApprovalTransaction(
    job: {
        jobId: string;
        proof: string;
        publicSignals: string;
    },
): Promise<TransactionInput> {
    // ============================================================
    // 1. Nonce
    // ============================================================

    const nonce = await getPendingNonce();

    // ============================================================
    // 2. Calldata
    // ============================================================
    const data = contentTradeContract.interface.encodeFunctionData(
        "approveTrade",
        [
            job.proof,
            job.publicSignals,
        ],
    );

    // ============================================================
    // 3. Gas 예상
    // ============================================================

    const estimatedGas = await estimateGas({
        to: contentTradeContract.target as string,
        data,
        value: 0n,
    });

    const gasLimit = addGasMargin(estimatedGas, 20);

    // ============================================================
    // 4. Fee
    // ============================================================

    const {
        maxFeePerGas,
        maxPriorityFeePerGas,
    } = await getEip1559Fee();

    // ============================================================
    // 5. Transaction 조합
    // ============================================================

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


// ============================================================
// 4. TX 전송
// ============================================================

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
    // ============================================================
    // TX 서명
    // ============================================================

    const { signedTx, txHash } = await signTransaction(transaction);

    // ============================================================
    // TX 전송
    // ============================================================

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

        // ============================================================
        // TX 존재 확인
        // ============================================================

        try {
            const tx =
                await getTransaction(txHash);

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


// ============================================================
// 6. SUBMITTED 저장
// ============================================================

async function markTradeApprovalSubmittedWithRetry({
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
            markTradeApprovalSubmitted({
                jobId,
                txHash,
                nonce,
            }),
        {
            operationName:`mark trade approval SUBMITTED jobId=${jobId}`,
        },
    );
}

async function markTradeApprovalSubmitted({
    jobId,
    txHash,
    nonce,
}: {
    jobId: string;
    txHash: string;
    nonce: number;
}) {
    return prisma.$transaction(async (tx) => {
        const updated = await tx.tradeApprovalTransaction.updateMany({
                where: {
                    jobId,
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

            return;
        }

        const outboxJob = await outboxRepository.create(tx, {
                jobId,
                jobType: "TRADE_APPROVAL",
                eventType: "RECEIPT_CHECK_REQUESTED",
            });

        if (!outboxJob) {
            throw new Error(
                `Trade approval transaction disappeared: ` +
                `jobId=${jobId}`,
            );
        }

        return outboxJob;
    });
}


// ============================================================
// FAILED
// ============================================================

async function failTradeApprovalJobWithRetry(
    job: {
        id: number;
        jobId: string;
    },
    reason: string,
) {
    return retryBase(
        () =>
            failTradeApprovalJob(
                job,
                reason,
            ),
        {
            operationName: `fail trade approval jobId=${job.jobId}`,
        },
    );
}

async function failTradeApprovalJob(
    job: {
        id: number;
        jobId: string;
    },
    reason: string,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const updated = await tx.tradeApprovalTransaction.updateMany({
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
            jobType: "TRADE_APPROVAL",
            eventType: "TRANSACTION_FAILED",
        });
    });
}