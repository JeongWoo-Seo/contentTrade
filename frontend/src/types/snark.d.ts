declare module "snarkjs" {
    export const groth16: {
        fullProve(
            input: object,
            wasmFile: string | Uint8Array,
            zkeyFile: string | Uint8Array
        ): Promise<{
            proof: object;
            publicSignals: string[];
        }>;
    };
}