import { Kafka, type Consumer } from "kafkajs";
import { env } from "../config/env.js";
import type { JobFailedMessage, AccountRegistrationResultMessage } from "./types.js";
import { novelService } from "../services/novel.service.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { withDbRetry } from "../utils/retry.js";

const kafka = new Kafka({
    clientId: `${env.kafkaServerIdPrefix}-consumer`,
    brokers: env.kafkaBrokers,
});

const consumer: Consumer = kafka.consumer({
    groupId: env.kafkaGroupId,
});

export async function connectProofFailedConsumer(): Promise<void> {
    await consumer.connect();

    await consumer.subscribe({
        topic: env.kafkaJobFailedTopic,
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) {
                return;
            }

            try {
                const data = JSON.parse(
                    message.value.toString()
                ) as JobFailedMessage;

                await handleProofFailed(data);
            } catch (error) {
                console.error("[market-server] failed to process proof_failed", error);

                // 오류 발생시 kafka message는 commit 되지 않고 메시지를 재처리하도록 함
                throw error;
            }
        },
    });

    console.log("[market-server] Kafka PROOF_FAILED consumer connected");
}

export async function disconnectProofFailedConsumer(): Promise<void> {
    await consumer.disconnect();
}

async function handleProofFailed(
    message: JobFailedMessage
): Promise<void> {

    if (message.jobType === "CONTENT_REGISTRATION") {
        console.log(
            `[market-server] proof failed ` +
            `registrationId=${message.referenceId}` +
            `jobId=${message.jobId}, ` +
            `failedStage=${message.failedStage}, ` +
            `reason=${message.reason}`
        );
        await novelService.failedRegistration({ registrationId: message.referenceId, reason: message.reason })
    }
    //
    // if (message.proofType === "TRADE_APPROVAL") {
    //   await buyHistoryService.markFailed(...);
    // }
}

// ============================================================
// 가입 확인 결과 Consumer
// ============================================================

// blockchain-worker가 발행하는 가입 확인 결과를 소비해 회원 상태를 전이한다.
// job_failed와는 별도 group으로, 결과 토픽을 전용으로 소비한다.
const accountResultConsumer: Consumer = kafka.consumer({
    groupId: `${env.kafkaGroupId}-account-result`,
});

export async function connectAccountResultConsumer(): Promise<void> {
    await accountResultConsumer.connect();

    await accountResultConsumer.subscribe({
        topic: env.kafkaAccountRegistrationResultTopic,
        fromBeginning: false,
    });

    await accountResultConsumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) {
                return;
            }

            try {
                const data = JSON.parse(
                    message.value.toString()
                ) as AccountRegistrationResultMessage;

                await handleAccountResult(data);
            } catch (error) {
                console.error("[market-server] failed to process account result", error);

                // 오류 발생시 commit하지 않아 재처리하도록 함
                throw error;
            }
        },
    });

    console.log("[market-server] Kafka account result consumer connected");
}

export async function disconnectAccountResultConsumer(): Promise<void> {
    await accountResultConsumer.disconnect();
}

/**
 * 가입 확인 결과 처리. jobId → outbox.referenceId(user.id)로 매핑해
 * 회원 상태를 ACTIVE/REJECTED로 전이한다(중복 메시지에도 멱등).
 */
export async function handleAccountResult(
    message: AccountRegistrationResultMessage
): Promise<void> {
    const outbox = await withDbRetry(
        () => outboxRepository.findByJobId(message.jobId),
        { operationName: `findOutboxByJobId:${message.jobId}` },
    );

    if (!outbox) {
        console.warn(`[market-server] account result for unknown jobId=${message.jobId} — skipping`);
        return;
    }

    await withDbRetry(
        () => userRepository.markAccountStatus(outbox.referenceId, message.result),
        { operationName: `markAccountStatus:${message.jobId}` },
    );

    console.log(
        `[market-server] account ${message.result} ` +
        `jobId=${message.jobId} userId=${outbox.referenceId}` +
        (message.reason ? ` reason=${message.reason}` : "")
    );
}
