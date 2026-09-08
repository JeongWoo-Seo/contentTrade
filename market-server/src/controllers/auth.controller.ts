import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from "../utils/cookie.js";

function readRefreshToken(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
}

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const { username, password, addr, pkOwn, pkEnc, eoa } = req.body ?? {};
    const user = await authService.signup({ username, password, addr, pkOwn, pkEnc, eoa });
    res.status(201).json(user);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    const result = await authService.login({ username, password });

    // Refresh token is delivered only via HttpOnly cookie (section 15), not in the body.
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresIn);

    res.json({
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      refreshExpiresIn: result.refreshExpiresIn,
      user: result.user,
    });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = readRefreshToken(req);
    if (!token) {
      throw new ApiError(401, "UNAUTHORIZED");
    }

    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresIn);

    res.json({
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      refreshExpiresIn: result.refreshExpiresIn,
    });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.userId!);
    res.json(user);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.userId!, readRefreshToken(req));
    clearRefreshCookie(res);
    res.json({ message: "Logged out successfully" });
  }),
};
