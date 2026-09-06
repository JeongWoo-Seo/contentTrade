// Cryptographic constants for the auth feature.
// All values target BN254 (alt_bn128 scalar field) — the same field used by
// Poseidon and the ZK circuit, matching the existing project's EC_ALT_BN128 prime.

// BN254 scalar field prime (BabyJubjub base field).
export const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// BabyJubjub subgroup order (r). Used to reduce sk_enc to a valid ECC scalar.
export const SUBGROUP_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;

// sk_own: 32 bytes (256 bits) from a CSPRNG. Reduced mod FIELD_PRIME before hashing.
export const SK_OWN_BYTES = 32;

// AES-256-GCM.
export const AES_IV_BYTES = 12;
export const AES_KEY_BYTES = 32; // 256-bit key

// Client-side KDF (password -> AES-GCM key). Argon2id (memory-hard), OWASP 2023 minimum.
// Used ONLY to protect sk_own at rest in IndexedDB — never the raw password as key.
export const ARGON2_MEMORY_KIB = 19456; // 19 MiB
export const ARGON2_ITERATIONS = 2; // time cost t
export const ARGON2_PARALLELISM = 1; // lanes p
export const SALT_BYTES = 16;

// IndexedDB storage.
export const IDB_NAME = 'contentTrade';
export const IDB_STORE = 'account';
