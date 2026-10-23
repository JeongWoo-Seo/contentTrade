
import { randomBytes } from "node:crypto";
import { buildBabyjub, buildPoseidon } from "circomlibjs";

type BabyJub = Awaited<ReturnType<typeof buildBabyjub>>;
type Poseidon = Awaited<ReturnType<typeof buildPoseidon>>;

// ========================================
// circomlibjs 초기화 결과 캐싱
// ========================================

let babyjubPromise: ReturnType<typeof buildBabyjub> | undefined;
let poseidonPromise: ReturnType<typeof buildPoseidon> | undefined;

function getBabyjub(): ReturnType<typeof buildBabyjub> {
    if (!babyjubPromise) {
        babyjubPromise = buildBabyjub().catch((error: unknown) => {
            babyjubPromise = undefined;
            throw error;
        });
    }

    return babyjubPromise;
}

function getPoseidon(): ReturnType<typeof buildPoseidon> {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon().catch((error: unknown) => {
            poseidonPromise = undefined;
            throw error;
        });
    }

    return poseidonPromise;
}

// ========================================
// Public Key Encryption
// ========================================

export interface KeyPair {
    privKey: string;
    pubKey: string;
}

export interface PublicCiphertext {
    c0: string;
    c1: string[];
}

export class PublicKeyEncryption {
    private constructor(
        private readonly babyjub: BabyJub,
        private readonly poseidon: Poseidon,
    ) {}

    static async create(): Promise<PublicKeyEncryption> {
        const [babyjub, poseidon] = await Promise.all([
            getBabyjub(),
            getPoseidon(),
        ]);

        return new PublicKeyEncryption(babyjub, poseidon);
    }

    private get prime(): bigint {
        return this.babyjub.F.p;
    }

    private get subOrder(): bigint {
        return this.babyjub.subOrder;
    }

    private mod(value: bigint, modulus: bigint): bigint {
        return ((value % modulus) + modulus) % modulus;
    }

    private toHex(value: bigint): string {
        return value.toString(16);
    }

    private fromHex(value: string): bigint {
        if (!/^(?:0x)?[0-9a-fA-F]+$/.test(value)) {
            throw new Error("Invalid hexadecimal value");
        }

        return BigInt(value.startsWith("0x") ? value : `0x${value}`);
    }

    private randomScalar(): bigint {
        // 기존 방식 유지: 아래 운영용 난수 주의사항 참고
        const random = BigInt(`0x${randomBytes(32).toString("hex")}`);
        return random % this.subOrder;
    }

    private hash(inputs: bigint[]): bigint {
        return this.poseidon.F.toObject(
            this.poseidon(inputs),
        ) as bigint;
    }

    private encodePoint(point: bigint[]): string {
        const x = this.babyjub.F.toObject(point[0]) as bigint;
        const y = this.babyjub.F.toObject(point[1]) as bigint;

        const xHex = x.toString(16).padStart(64, "0");
        const yHex = y.toString(16).padStart(64, "0");

        return xHex + yHex;
    }

    private decodePoint(encoded: string): bigint[] {
        if (!/^[0-9a-fA-F]{128}$/.test(encoded)) {
            throw new Error("Invalid point encoding (expected 128 hex characters)");
        }

        const x = BigInt(`0x${encoded.slice(0, 64)}`);
        const y = BigInt(`0x${encoded.slice(64, 128)}`);

        return [this.babyjub.F.e(x),this.babyjub.F.e(y)];
    }

    private deriveSharedKey(sharedPoint: bigint[]): bigint {
        const x = this.babyjub.F.toObject(sharedPoint[0]) as bigint;
        const y = this.babyjub.F.toObject(sharedPoint[1]) as bigint;

        return this.hash([x, y, 1n]);
    }

    private encryptMask(key: bigint, index: number): bigint {
        return this.hash([key, BigInt(index), 2n]);
    }

    generateKeyPair(): KeyPair {
        const sk = this.randomScalar();

        if (sk === 0n) {
            return this.generateKeyPair();
        }

        const publicPoint = this.babyjub.mulPointEscalar(
            this.babyjub.Base8,
            sk,
        );

        return {
            privKey: this.toHex(sk),
            pubKey: this.encodePoint(publicPoint),
        };
    }

    Enc(pubKey: string, ...messages: string[]): PublicCiphertext {
        const publicPoint = this.decodePoint(pubKey);
        const r = this.randomScalar();

        if (r === 0n) {
            return this.Enc(pubKey, ...messages);
        }

        // C0 = rG
        const c0Point = this.babyjub.mulPointEscalar(
            this.babyjub.Base8,
            r,
        );

        // S = rPK
        const sharedPoint = this.babyjub.mulPointEscalar(
            publicPoint,
            r,
        );

        const key = this.deriveSharedKey(sharedPoint);

        const c1 = messages.map((message, index) => {
            const plaintext = this.fromHex(message);

            if (plaintext >= this.prime) {
                throw new RangeError(
                    `Message at index ${index} exceeds the field range`,
                );
            }

            const mask = this.encryptMask(key, index);

            return this.toHex(
                this.mod(plaintext + mask, this.prime),
            );
        });

        return {
            c0: this.encodePoint(c0Point),
            c1,
        };
    }

    Dec(
        ciphertext: PublicCiphertext,
        privKey: string,
    ): string[] {
        const sk = this.fromHex(privKey);

        if (sk <= 0n || sk >= this.subOrder) {
            throw new RangeError("Private key is out of range");
        }

        const c0Point = this.decodePoint(ciphertext.c0);

        // S = skC0
        const sharedPoint = this.babyjub.mulPointEscalar(
            c0Point,
            sk,
        );

        const key = this.deriveSharedKey(sharedPoint);

        return ciphertext.c1.map((value, index) => {
            const encrypted = this.fromHex(value);

            if (encrypted >= this.prime) {
                throw new RangeError(
                    `Ciphertext at index ${index} exceeds the field range`,
                );
            }

            const mask = this.encryptMask(key, index);

            return this.toHex(
                this.mod(encrypted - mask, this.prime),
            );
        });
    }
}

// ========================================
// Symmetric Key Encryption
// ========================================

export interface Ciphertext {
    r: string;
    ct: string;
}

export interface CiphertextData {
    r: string;
    ct: string[];
}

export class SymmetricKeyEncryption {
    private constructor(
        private readonly sk: bigint,
        private readonly p: bigint,
        private readonly poseidon: Poseidon,
        private readonly dataMaxBlockNum: number,
    ) {}

    static async create(
        privateKey: string,
        dataMaxBlockNum: number,
    ): Promise<SymmetricKeyEncryption> {
        const poseidon = await getPoseidon();

        const p = poseidon.F.p as bigint;
        const normalizedKey = privateKey.startsWith("0x")
            ? privateKey
            : `0x${privateKey}`;

        const sk = BigInt(normalizedKey);

        if (sk < 0n || sk >= p) {
            throw new RangeError(
                "Private key must be in the field range",
            );
        }

        if (
            !Number.isInteger(dataMaxBlockNum) ||
            dataMaxBlockNum <= 0
        ) {
            throw new RangeError(
                "dataMaxBlockNum must be a positive integer",
            );
        }

        return new SymmetricKeyEncryption(
            sk,
            p,
            poseidon,
            dataMaxBlockNum,
        );
    }

    private randomFieldElement(): bigint {
        const byteLength = Math.ceil(this.p.toString(2).length / 8);
        const range = 1n << BigInt(byteLength * 8);
        const limit = range - (range % this.p);

        while (true) {
            const candidate = BigInt(
                `0x${randomBytes(byteLength).toString("hex")}`,
            );

            if (candidate < limit) {
                return candidate % this.p;
            }
        }
    }

    private hash(sk: bigint, r: bigint): bigint {
        return this.poseidon.F.toObject(
            this.poseidon([sk, r]),
        ) as bigint;
    }

    private parseField(value: string | bigint): bigint {
        const n = typeof value === "bigint"
            ? value
            : BigInt(value);

        if (n < 0n || n >= this.p) {
            throw new RangeError(
                "Data must be in the field range",
            );
        }

        return n;
    }

    private toHex(value: bigint): string {
        return value.toString(16);
    }

    // ct = (data + Poseidon(sk, r)) mod p
    Enc(data: string | bigint): Ciphertext {
        const r = this.randomFieldElement();
        const plaintext = this.parseField(data);
        const mask = this.hash(this.sk, r);
        const ct = (plaintext + mask) % this.p;

        return {
            r: this.toHex(r),
            ct: this.toHex(ct),
        };
    }

    // ct[i] = (data[i] + Poseidon(sk + i, r)) mod p
    EncData(
        data: Array<string | bigint>,
    ): CiphertextData {
        if (data.length !== this.dataMaxBlockNum) {
            throw new RangeError(
                `Expected ${this.dataMaxBlockNum} blocks, got ${data.length}`,
            );
        }

        const r = this.randomFieldElement();

        const ct = data.map((value, i) => {
            const plaintext = this.parseField(value);
            const indexedKey = (this.sk + BigInt(i)) % this.p;
            const mask = this.hash(indexedKey, r);

            return this.toHex(
                (plaintext + mask) % this.p,
            );
        });

        return {
            r: this.toHex(r),
            ct,
        };
    }

    // data = (ct - Poseidon(sk, r) + p) mod p
    Dec(ciphertext: Ciphertext): string {
        const r = this.parseField(`0x${ciphertext.r}`);
        const ct = this.parseField(`0x${ciphertext.ct}`);
        const mask = this.hash(this.sk, r);

        return this.toHex(
            (ct - mask + this.p) % this.p,
        );
    }

    DecData(ciphertext: CiphertextData): string[] {
        if (ciphertext.ct.length !== this.dataMaxBlockNum) {
            throw new RangeError(
                `Expected ${this.dataMaxBlockNum} blocks, got ${ciphertext.ct.length}`,
            );
        }

        const r = this.parseField(`0x${ciphertext.r}`);

        return ciphertext.ct.map((value, i) => {
            const ct = this.parseField(`0x${value}`);
            const indexedKey = (this.sk + BigInt(i)) % this.p;
            const mask = this.hash(indexedKey, r);

            return this.toHex(
                (ct - mask + this.p) % this.p,
            );
        });
    }
}
