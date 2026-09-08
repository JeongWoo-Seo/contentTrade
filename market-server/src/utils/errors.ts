import type { NextFunction, Request, Response } from "express";

// Application error with a stable machine-readable code and an HTTP status.
// `message` (when present) is always a safe, user-facing string — never
// internal details (stack traces, SQL, hashes, secrets).
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Wrap an async route handler so rejected promises reach the error middleware.
export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

// Global error handler — never leaks internal information (section 21).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.code,
      ...(err.message && err.message !== err.code ? { message: err.message } : {}),
    });
    return;
  }

  // Unknown error: log internally, return a generic response.
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
}
