/* global BigInt */
import constants from '../utils/constants.js';
import Curve from '../crypto/curve.js';
import mimc from '../crypto/mimc.js';
import types from '../utils/types.js';
import math from '../utils/math.js';


export default class UserKey {
    // ena : wallet addr
    constructor({ena, pkOwn, pkEnc}, skEnc, skOwn){
        this.pk = {
            ena : ena,
            pkOwn : pkOwn,
            pkEnc : pkEnc
        };
        this.skEnc = skEnc;
        this.skOwn = skOwn;
    }

    toJson(){
        return JSON.stringify({
            ena   : this.pk.ena,
            pkOwn : this.pk.pkOwn,
            pkEnc : this.pk.pkEnc,
            skEnc : this.skEnc,
            skOwn : this.skOwn,
        });
    }

    pubKeyToJson(){
        return JSON.stringify({
            ena   : this.pk.ena,
            pkOwn : this.pk.pkOwn,
            pkEnc : this.pk.pkEnc,
        });
    }

    static keyGen() {
        const mimc7 = new mimc.MiMC7();

        const sk_own = math.randomFieldElement(constants.SUBGROUP_ORDER).toString(16);
        const pk_own = mimc7.hash(sk_own,types.asciiToHex('pk_own'));
        const sk_enc = mimc7.hash(sk_own,types.asciiToHex('sk_enc'));
        const pk_enc = Curve.basePointMul(types.hexToInt(sk_enc)).toString(16);
        const ena = mimc7.hash(pk_own,pk_enc);

        const userPublicKey = {
            ena : ena,
            pkOwn : pk_own,
            pkEnc : pk_enc
        };

        return new UserKey(userPublicKey, sk_enc, sk_own);
    }
}