import {sleep} from "../utils/sleep.js"

export async function retryBase<T>(
  operation: () => Promise<T>,
  options: {
    operationName: string;
    alertEveryRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const {
    operationName,
    alertEveryRetries = 10,
    initialDelayMs = 1_000,
    maxDelayMs = 30_000,
  } = options;

  let retryCount = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      retryCount++;

      if (retryCount % alertEveryRetries === 0) {
        // await alertMonitoring({
        //   operation: operationName,
        //   retryCount,
        //   error,
        // });
      }

      const delay = Math.min(
        initialDelayMs * 2 ** (retryCount - 1),
        maxDelayMs,
      );

      console.error(
        `[blockchain-worker] ` +
          `operation=${operationName} ` +
          `retry=${retryCount} ` +
          `nextRetry=${delay}ms`,
        error,
      );

      await sleep(delay);
    }
  }
}