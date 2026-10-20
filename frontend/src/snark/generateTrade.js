import Encryption from "../crypto/encryption.js";

export default class GenerateTradeSnark {
    constructor({
        peer,
        del,
        cons,
        ena,
        ena_,
        k_ena,
        h_k,
        cm,
        encryption,
    }) {
        this.pk_enc_peer = peer.pk_enc;
        this.pk_own_peer = peer.pk_own;

        this.pk_enc_cons = cons.pk_enc;
        this.pk_own_cons = cons.pk_own;

        this.pk_own_del = del.pk_own;

        this.ENA = ena;
        this.ENA_ = ena_;

        this.k_ena = k_ena;
        this.h_k = h_k;

        this.coinCommitment = coinCommitment;
        this.encryption = encryption;

        this.initialized = false;
    }

    static async create(options) {
        const encryption = await Encryption.create();

        return new SnarkInputs({
            ...options,
            encryption,
        });
    }

    async init() {
        // TODO: SymmetricKeyEncryption 구현 후 복호화 및 수수료 계산 추가
        /*
        const symEnc = new SymmetricKeyEncryption(this.k_ena);

        const fee =
            BigInt(`0x${symEnc.Dec(this.ENA)}`) -
            BigInt(`0x${symEnc.Dec(this.ENA_)}`);
        */

        this.fee_del = BigInt(2000)
            .toString(16)
            .padStart(64, "0");

        this.fee_own = BigInt(96000)
            .toString(16)
            .padStart(64, "0");

        // 기존 CoinCommitment 규칙을 사용하는 구현체 필요
        const { commitment, randomness } =
            this.coinCommitment.generate(
                this.pk_own_peer,
                this.pk_own_del,
                this.pk_enc_cons,
                this.fee_own,
                this.fee_del,
                this.h_k,
            );

        this.cm_del = commitment.cm_del;
        this.cm_own = commitment.cm_own;
        this.r_cm = randomness;

        // TODO: 회로의 메시지 스키마 확정 후 공개키 암호화 추가
        /*
        const ciphertext = this.encryption.publicKeyEncryption.Enc(
            this.pk_enc_cons,
            ...messages,
        );

        this.g_r = ciphertext.c0;
        this.c1 = ciphertext.c1[0];
        this.CT_cons = ciphertext.c1.slice(1);
        */

        this.initialized = true;

        return this;
    }

    toJson() {
        return JSON.stringify(this, null, 2);
    }

    toSnarkInput() {
        if (!this.initialized) {
            throw new Error("SnarkInputs.init() must be called first");
        }

        const json = {
            ...this,
            ENA: this.ENA.toList(),
            ENA_: this.ENA_.toList(),
        };

        // 클래스 인스턴스와 암호화 객체 전체를 직렬화하지 않도록 제외
        delete json.encryption;
        delete json.coinCommitment;

        return JSON.stringify(json, null, 2);
    }

    toContractInput() {
        if (!this.initialized) {
            throw new Error("SnarkInputs.init() must be called first");
        }

        const contractInputs = [
            "1",
            this.g_r,
            this.c1,
            this.cm_own,
            this.cm_del,
            ...this.ENA.toList(),
            ...this.ENA_.toList(),
            this.fee_del,
            this.fee_own,
            ...this.CT_cons,
        ];

        return contractInputs.map(hexStrToDec);
    }
}

function hexStrToDec(value) {
    const normalized = value.startsWith("0x")
        ? value
        : `0x${value}`;

    return BigInt(normalized).toString(10);
}