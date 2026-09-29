import { ProofWorker } from "./worker.js";
import { env } from "../config/env.js";
import { connectProducer, disconnectProducer, ensureTopics } from "../kafka/producer.js";
import { closeMarketClient } from "../grpc/market.client.js";
import { prisma } from "../lib/prisma.js";

export class WorkerManager {
  private workers: ProofWorker[] = [];

  constructor() {
    for (let i = 1; i <= env.proofWorkerCount; i++) {
      this.workers.push(new ProofWorker(i));
    }
  }

  async start(): Promise<void> {
    await connectProducer();

    // Kafka topic 자동 생성.
    // PROOF_REQUESTED는 proof worker 병렬 처리 수(partition)를 기준으로 생성한다.
    await ensureTopics([
      { topic: env.kafkaRequestTopic, numPartitions: env.proofWorkerCount },
    ]);

    await Promise.all(this.workers.map((worker) => worker.start()));

    console.log(`WorkerManager started: ${this.workers.length} workers`);
  }

  async stop(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.stop()));
    await disconnectProducer();
    closeMarketClient();

    console.log("WorkerManager stopped");
  }
}
