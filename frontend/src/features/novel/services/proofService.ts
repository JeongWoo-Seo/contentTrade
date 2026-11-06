import { groth16 } from "snarkjs";

export async function generateTradeProof(input: object) {
    const wasmPath = "../../../../public/circuit/generate_trade/generate_trade.wasm";
    const zkeyPath = "../../../../public/circuit/generate_trade/generate_trade_final.zkey";

    const { proof, publicSignals } = await groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
    );

    return {
        proof,
        publicSignals,
    };
}