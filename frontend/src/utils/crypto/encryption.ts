
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

export type Point = [bigint, bigint];

export interface KeyPair {
    privKey: bigint;
    pubKey: Point;
}

export interface PublicCiphertext {
    c0: Point;
    c1: bigint[];
}

export interface EncResult {
    c0: Point;
    c1: bigint[];
    r_enc: bigint;
}

export class PublicKeyEncryption {
    private constructor(
        private readonly babyjub: BabyJub,
        private readonly poseidon: Poseidon,
    ) { }

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

    private randomScalar(): bigint {
        const random = BigInt(`0x${randomBytes(32).toString("hex")}`);
        return random % this.subOrder;
    }

    private hash(inputs: bigint[]): bigint {
        return this.poseidon.F.toObject(this.poseidon(inputs)) as bigint;
    }

    private encodePoint(point: bigint[]): Point {
        const x = this.babyjub.F.toObject(point[0]) as bigint;
        const y = this.babyjub.F.toObject(point[1]) as bigint;

        return [x, y];
    }

    private decodePoint(point: Point): bigint[] {
        const [x, y] = point;

        if (x < 0n || y < 0n || x >= this.prime || y >= this.prime) {
            throw new RangeError("Point coordinate is out of range");
        }

        return [this.babyjub.F.e(x), this.babyjub.F.e(y)];
    }

    private deriveSharedKey(sharedPoint: bigint[]): bigint {
        const x = this.babyjub.F.toObject(sharedPoint[0]) as bigint;
        const y = this.babyjub.F.toObject(sharedPoint[1]) as bigint;

        return this.hash([x, y, 1n]);
    }

    private encryptMask(key: bigint, index: number): bigint {
        return this.hash([key, BigInt(index), 2n]);
    }

    // ========================================
    // Encryption
    // ========================================

    Enc(pubKey: Point, ...messages: bigint[]): EncResult {
        const publicPoint = this.decodePoint(pubKey);

        for (const [index, message] of messages.entries()) {
            if (message < 0n || message >= this.prime) {
                throw new RangeError(`Message at index ${index} exceeds the field range`);
            }
        }

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
            const mask = this.encryptMask(key, index);
            return this.mod(message + mask, this.prime);
        });

        return {
            r_enc: r,
            c0: this.encodePoint(c0Point),
            c1,
        };
    }

    // ========================================
    // Decryption
    // ========================================

    Dec(ciphertext: PublicCiphertext, privKey: bigint): bigint[] {
        if (privKey <= 0n || privKey >= this.subOrder) {
            throw new RangeError("Private key is out of range");
        }

        const c0Point = this.decodePoint(ciphertext.c0);

        // S = skC0
        const sharedPoint = this.babyjub.mulPointEscalar(
            c0Point,
            privKey,
        );

        const key = this.deriveSharedKey(sharedPoint);

        return ciphertext.c1.map((encrypted, index) => {
            if (encrypted < 0n || encrypted >= this.prime) {
                throw new RangeError(`Ciphertext at index ${index} exceeds the field range`);
            }

            const mask = this.encryptMask(key, index);
            return this.mod(encrypted - mask, this.prime);
        });
    }
}

// ========================================
// Symmetric Key Encryption
// ========================================

export interface Ciphertext {
    r: bigint;
    ct: bigint;
}

export interface CiphertextData {
    r: bigint;
    ct: bigint[];
}

export class SymmetricKeyEncryption {
    private constructor(
        private readonly sk: bigint,
        private readonly p: bigint,
        private readonly poseidon: Poseidon,
        private readonly dataMaxBlockNum: number,
    ) { }

    static async create(privateKey: bigint, dataMaxBlockNum: number): Promise<SymmetricKeyEncryption> {
        const poseidon = await getPoseidon();
        const p = poseidon.F.p as bigint;

        if (privateKey < 0n || privateKey >= p) {
            throw new RangeError("Private key must be in the field range");
        }

        if (!Number.isInteger(dataMaxBlockNum) || dataMaxBlockNum <= 0) {
            throw new RangeError("dataMaxBlockNum must be a positive integer");
        }

        return new SymmetricKeyEncryption(
            privateKey,
            p,
            poseidon,
            dataMaxBlockNum,
        );
    }

    private randomFieldElement(): bigint {
        const byteLength = Math.ceil(
            this.p.toString(2).length / 8,
        );

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

    private validateField(value: bigint): void {
        if (value < 0n || value >= this.p) {
            throw new RangeError("Value exceeds the field range");
        }
    }

    private hash(sk: bigint, r: bigint): bigint {
        return this.poseidon.F.toObject(this.poseidon([sk, r])) as bigint;
    }

    // ========================================
    // Single value encryption
    // ========================================

    Enc(data: bigint): Ciphertext {
        this.validateField(data);

        const r = this.randomFieldElement();
        const mask = this.hash(this.sk, r);
        const ct = (data + mask) % this.p;

        return {
            r,
            ct,
        };
    }

    // ========================================
    // Multiple block encryption
    // ========================================

    EncData(data: bigint[]): CiphertextData {
        if (data.length !== this.dataMaxBlockNum) {
            throw new RangeError(`Expected ${this.dataMaxBlockNum} blocks, got ${data.length}`);
        }

        data.forEach(value => this.validateField(value));

        const r = this.randomFieldElement();

        const ct = data.map((value, i) => {
            const indexedKey = (this.sk + BigInt(i)) % this.p;
            const mask = this.hash(indexedKey, r);

            return (value + mask) % this.p;
        });

        return {
            r,
            ct,
        };
    }

    // ========================================
    // Single value decryption
    // ========================================

    Dec(ciphertext: Ciphertext): bigint {
        this.validateField(ciphertext.r);
        this.validateField(ciphertext.ct);

        const mask = this.hash(this.sk, ciphertext.r);

        return (ciphertext.ct - mask + this.p) % this.p;
    }

    // ========================================
    // Multiple block decryption
    // ========================================

    DecData(ciphertext: CiphertextData): bigint[] {
        if (ciphertext.ct.length !== this.dataMaxBlockNum) {
            throw new RangeError(`Expected ${this.dataMaxBlockNum} blocks, got ${ciphertext.ct.length}`);
        }

        this.validateField(ciphertext.r);
        ciphertext.ct.forEach(value => this.validateField(value));

        return ciphertext.ct.map((value, i) => {
            const indexedKey = (this.sk + BigInt(i)) % this.p;
            const mask = this.hash(indexedKey, ciphertext.r);

            return (value - mask + this.p) % this.p;
        });
    }
}