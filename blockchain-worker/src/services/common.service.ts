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
    alertEveryRetries = 5,
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

export async function retryWithMaxAttempts<T>(
  operation: () => Promise<T>,
  options: {
    operationName: string;
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const {
    operationName,
    maxAttempts = 5,
    initialDelayMs = 1_000,
    maxDelayMs = 30_000,
  } = options;

  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts) {
        console.error(
          `[blockchain-worker] ` +
            `operation=${operationName} ` +
            `attempt=${attempt} ` +
            `maxAttempts=${maxAttempts} ` +
            `failed`,
          error,
        );

        throw error;
      }

      const delay = Math.min(
        initialDelayMs * 2 ** (attempt - 1),
        maxDelayMs,
      );

      console.error(
        `[blockchain-worker] ` +
          `operation=${operationName} ` +
          `attempt=${attempt} ` +
          `nextRetry=${delay}ms`,
        error,
      );

      await sleep(delay);
    }
  }

  throw new Error(`Unexpected retry loop exit: ${operationName}`);
}