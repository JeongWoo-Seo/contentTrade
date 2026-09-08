import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";

// OWASP 2023 Argon2id minimum parameters.
const ARGON2_MEMORY_KIB = 19456; // 19 MiB
const ARGON2_ITERATIONS = 2; // time cost t
const ARGON2_PARALLELISM = 1; // lanes p
const ARGON2_HASH_LENGTH = 32; // 256-bit

// Hash a password with Argon2id. Returns a PHC-encoded string that embeds
// the salt and parameters (so it can be verified later without extra storage).
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "encoded",
  });
}

// Verify a password against a stored Argon2id hash.
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2Verify({ password, hash });
}
