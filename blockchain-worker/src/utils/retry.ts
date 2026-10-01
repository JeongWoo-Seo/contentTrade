import { status } from "@grpc/grpc-js";
import retry from "p-retry";

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options?: {
    operationName?: string;
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
  },
): Promise<T> {
  return retry(operation, {
    retries: options?.retries ?? 5,
    factor: options?.factor ?? 3,
    minTimeout: options?.minTimeout ?? 200,
    maxTimeout: options?.maxTimeout ?? 10000,

    onFailedAttempt: (context) => {
      console.error(
        `[DB RETRY] ` +
        `operation=${options?.operationName ?? "unknown"} ` +
        `attempt=${context.attemptNumber} ` +
        `retriesLeft=${context.retriesLeft} ` +
        `error=${context.error.message}`,
      );
    },
  });
}

export async function withGrpcRetry<T>(
  operation: () => Promise<T>,
  options?: {
    operationName?: string;
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
  },
): Promise<T> {
  return retry(operation, {
    retries: options?.retries ?? 3,
    factor: options?.factor ?? 2,
    minTimeout: options?.minTimeout ?? 500,
    maxTimeout: options?.maxTimeout ?? 5000,

    onFailedAttempt: (context) => {
      console.error(
        `[gRPC RETRY] ` +
        `operation=${options?.operationName ?? "unknown"} ` +
        `attempt=${context.attemptNumber} ` +
        `retriesLeft=${context.retriesLeft} ` +
        `error=${context.error.message}`,
      );
    },

    shouldRetry: (error) => {
      const grpcError = error as {
        code?: number;
      };

      return (
        grpcError.code === status.UNAVAILABLE ||
        grpcError.code === status.DEADLINE_EXCEEDED ||
        grpcError.code === status.RESOURCE_EXHAUSTED ||
        grpcError.code === status.ABORTED
      );
    },
  });
}