import { createHash, randomBytes, randomUUID } from "node:crypto";
import { userRepository } from "../repositories/user.repository.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { isAddress } from "ethers";
import { ApiError } from "../utils/errors.js";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,100}$/;
const MIN_PASSWORD_LENGTH = 8;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// placeholder account address (spec 1.7: addr is implemented later)
function generateAddrPlaceholder(): string {
  return randomBytes(32).toString("hex");
}


interface SignupInput {
  username: string;
  password: string;
  addr: string;
  pkOwn: string ;
  pkEnc: string;
  eoa: string;
}

interface UserInfo {
  id: number;
  username: string;
  addr: string;
  pkOwn: string;
  pkEnc: string;
  eoa: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshExpiresIn: number;
  user: UserInfo;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshExpiresIn: number;
}

export const authService = {
  async signup({ username, password, addr, pkOwn, pkEnc, eoa }: SignupInput): Promise<UserInfo> {
    if (typeof username !== "string" || !USERNAME_RE.test(username)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "username must be 3-100 characters (alphanumeric, _ or -)",
      );
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, "VALIDATION_ERROR", `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (typeof eoa !== "string" || !isAddress(eoa)) {
      throw new ApiError(400, "VALIDATION_ERROR", "walletAddress must be a valid Ethereum address");
    }

    const existingUsername = await userRepository.findByUsername(username);
    if (existingUsername) {
      throw new ApiError(409, "USERNAME_ALREADY_EXISTS");
    }

    const existingWallet = await userRepository.findByWalletAddress(addr);
    if (existingWallet) {
      throw new ApiError(409, "WALLET_ALREADY_EXISTS");
    }

    const passwordHash = await hashPassword(password);

    try {
      const user = await userRepository.create({
        username,
        passwordHash,
        addr,
        pkOwn: pkOwn,
        pkEnc: pkEnc,
        eoa: eoa,
      });
      return { id: user.id, username: user.username, addr: user.addr, pkOwn: user.pkOwn, pkEnc: user.pkEnc, eoa: user.eoa };
    } catch (error) {
      // Race condition: the DB UNIQUE constraint (P2002) is the final guard.
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        let target = "";
        if ("meta" in error && typeof error.meta === "object" && error.meta !== null && "target" in error.meta) {
          const t = error.meta.target;
          target = Array.isArray(t) ? t.join(",") : String(t ?? "");
        }
        throw new ApiError(409, target.includes("wallet_address") ? "WALLET_ALREADY_EXISTS" : "USERNAME_ALREADY_EXISTS");
      }
      throw error;
    }
  },

  async login({ username, password }: { username: string; password: string }): Promise<LoginResult> {
    const user = await userRepository.findByUsername(username);

    // Same response for unknown username and wrong password (no user enumeration).
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED");
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "UNAUTHORIZED");
    }

    const access = signAccessToken(user.id);
    const refresh = signRefreshToken(user.id);

    // Each login starts a new rotation family.
    await refreshTokenRepository.create({
      userId: user.id,
      tokenHash: hashToken(refresh.token),
      jti: refresh.jti,
      familyId: randomUUID(),
      expiresAt: refresh.expiresAt,
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: "Bearer",
      expiresIn: access.expiresIn,
      refreshExpiresIn: refresh.expiresIn,
      user: { id: user.id, username: user.username, addr: user.addr, pkOwn: user.pkOwn, pkEnc: user.pkEnc, eoa: user.eoa },
    };
  },

  async refresh(refreshToken: string): Promise<RefreshResult> {
    // Verify signature + iss + aud + exp + type=refresh.
    const decoded = verifyRefreshToken(refreshToken);
    const userId = Number(decoded.sub);

    const stored = await refreshTokenRepository.findByJti(decoded.jti);
    if (!stored) {
      throw new ApiError(401, "UNAUTHORIZED");
    }

    // Token hash must match what was stored at issue time.
    if (stored.tokenHash !== hashToken(refreshToken)) {
      throw new ApiError(401, "UNAUTHORIZED");
    }

    // Reuse detection: a revoked token is replayed -> revoke the whole family.
    if (stored.revokedAt) {
      await refreshTokenRepository.revokeFamily(stored.familyId);
      throw new ApiError(401, "UNAUTHORIZED");
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(401, "UNAUTHORIZED");
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED");
    }

    const access = signAccessToken(user.id);
    const refresh = signRefreshToken(user.id);

    // Atomic rotation (revoke old + insert new, same family).
    const rotated = await refreshTokenRepository.rotate(stored.id, refresh.jti, {
      userId: user.id,
      tokenHash: hashToken(refresh.token),
      jti: refresh.jti,
      familyId: stored.familyId,
      expiresAt: refresh.expiresAt,
    });

    if (!rotated) {
      // Concurrent rotation or replay -> revoke the family.
      await refreshTokenRepository.revokeFamily(stored.familyId);
      throw new ApiError(401, "UNAUTHORIZED");
    }

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: "Bearer",
      expiresIn: access.expiresIn,
      refreshExpiresIn: refresh.expiresIn,
    };
  },

  async me(userId: number): Promise<UserInfo> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "NOT_FOUND");
    }
    return { id: user.id, username: user.username, addr: user.addr, pkOwn: user.pkOwn, pkEnc: user.pkEnc, eoa: user.eoa };
  },

  async logout(userId: number, refreshToken?: string): Promise<void> {
    // Revoke the current session (the rotation family of the presented token).
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const stored = await refreshTokenRepository.findByJti(decoded.jti);
        if (stored) {
          await refreshTokenRepository.revokeFamily(stored.familyId);
          return;
        }
      } catch {
        // invalid/expired presented token -> fall through to revoke-all
      }
    }
    await refreshTokenRepository.revokeAllForUser(userId);
  },
};
