
import { randomBytes } from "node:crypto";
import { buildBabyjub, buildPoseidon } from "circomlibjs";

type BabyJub = Awaited<ReturnType<typeof buildBabyjub>>;
type Poseidon = Awaited<ReturnType<typeof buildPoseidon>>;

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
    ) { }

    static async create(): Promise<PublicKeyEncryption> {
        const babyjub = await buildBabyjub();
        const poseidon = await buildPoseidon();

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
        if (!/^[0-9a-fA-F]+$/.test(value)) {
            throw new Error("Invalid hexadecimal value");
        }

        return BigInt(`0x${value}`);
    }

    private randomScalar(): bigint {
        // 데모용: 아래 설명의 운영용 난수 주의사항 참고
        const random = BigInt(`0x${randomBytes(32).toString("hex")}`);

        return random % this.subOrder;
    }

    private hash(inputs: bigint[]): bigint {
        return this.poseidon.F.toObject(
            this.poseidon(inputs),
        );
    }

    private encodePoint(point: bigint[]): string {
        const x = this.babyjub.F.toObject(point[0]);
        const y = this.babyjub.F.toObject(point[1]);

        const xHex = x.toString(16).padStart(64, '0');
        const yHex = y.toString(16).padStart(64, '0');

        // 고정 64자(x) + 고정 64자(y) = 구분자 없는 128자 Hex
        return xHex + yHex;
    }

    private decodePoint(encoded: string): bigint[] {
    if (encoded.length !== 128) {
        throw new Error("Invalid point hex length (must be 128 hex characters)");
    }

    const xHex = encoded.slice(0, 64);
    const yHex = encoded.slice(64, 128);

    const x = BigInt(`0x${xHex}`);
    const y = BigInt(`0x${yHex}`);

    // BigInt 값을 BabyJubjub Field Element 형태로 변환하여 반환
    return [
        this.babyjub.F.e(x),
        this.babyjub.F.e(y)
    ];
}

    private deriveSharedKey(sharedPoint: bigint[]): bigint {
        const x = this.babyjub.F.toObject(sharedPoint[0]);
        const y = this.babyjub.F.toObject(sharedPoint[1]);

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
            const mask = this.encryptMask(key, index);

            return this.toHex(
                this.mod(encrypted - mask, this.prime),
            );
        });
    }
}