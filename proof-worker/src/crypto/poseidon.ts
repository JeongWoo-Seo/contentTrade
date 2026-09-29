import { buildPoseidon } from "circomlibjs";

const poseidon = await buildPoseidon();
const F = poseidon.F;
const BLOCK_SIZE = 32;
const HALF_BLOCK_SIZE = 16;

export function bytes16ToField(
    bytes: Uint8Array,
): bigint {
    if (bytes.length !== HALF_BLOCK_SIZE) {
        throw new Error("Expected exactly 16 bytes");
    }

    let value = 0n;

    for (const byte of bytes) {
        value = (value << 8n) | BigInt(byte);
    }

    return value;
}

export function block32ToFields(
    block: Uint8Array,
): [bigint, bigint] {
    if (block.length !== BLOCK_SIZE) {
        throw new Error("Expected exactly 32 bytes");
    }

    return [
        bytes16ToField(block.subarray(0, 16),),
        bytes16ToField(block.subarray(16, 32)),
    ];
}

export function poseidon2(
    a: bigint,
    b: bigint,
): bigint {
    const result = poseidon([a, b]);

    return BigInt(F.toString(result));
}

export function hashBlock(
    block: Uint8Array,
): bigint {
    const [left, right] = block32ToFields(block);

    return poseidon2(left, right);
}

export function hashBlocks(
    blocks: Uint8Array[],
): bigint {
    let hash = 0n;

    for (const block of blocks) {
        const blockHash = hashBlock(block);

        hash = poseidon2(hash, blockHash);
    }

    return hash;
}

export function calculateKeyHash(
    authorPkOwn: string,
    dataKey: Uint8Array,
): bigint {
    const authorPkOwnField = BigInt(authorPkOwn);

    const [dataKeyLeft, dataKeyRight] = block32ToFields(dataKey);
    const dataKeyHash = poseidon2(dataKeyLeft, dataKeyRight);

    return poseidon2(authorPkOwnField, dataKeyHash);
}