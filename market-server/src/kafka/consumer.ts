import { Kafka, type Consumer } from "kafkajs";
import os from "node:os";

import { env } from "../config/env.js";
import type { JobFailedMessage } from "./types.js";
import { novelService } from "../services/novel.service.js"

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
        topic: env.kafkaFailureTopic,
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

                // 오류 발생시 kafka message는 oommit 되지 않고 메시지를 재처리하도록 함
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

    if (message.proofType === "CONTENT_REGISTRATION") {
        console.log(
            `[market-server] proof failed ` +
            `registrationId=${message.registrationId}` +
            `jobId=${message.jobId}, ` +
            `failedStage=${message.failedStage}, ` +
            `reason=${message.reason}`
        );
        await novelService.failedRegistration({ registrationId: message.registrationId, reason: message.reason })
    }
    //
    // if (message.proofType === "TRADE_APPROVAL") {
    //   await buyHistoryService.markFailed(...);
    // }
}