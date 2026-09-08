import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/errors.js";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header) {
    next(new ApiError(401, "UNAUTHORIZED"));
    return;
  }

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    next(new ApiError(401, "UNAUTHORIZED"));
    return;
  }

  try {
    const decoded = verifyAccessToken(parts[1]);
    req.userId = Number(decoded.sub);
    next();
  } catch {
    next(new ApiError(401, "UNAUTHORIZED"));
  }
}
