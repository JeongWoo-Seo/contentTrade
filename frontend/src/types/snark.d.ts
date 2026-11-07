declare module "snarkjs" {
    export interface Groth16Proof {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
        protocol: string;
        curve: string;
    }

    export const groth16: {
        fullProve(
            input: object,
            wasmFile: string | Uint8Array,
            zkeyFile: string | Uint8Array
        ): Promise<{
            proof: Groth16Proof;
            publicSignals: string[];
        }>;
    };
}