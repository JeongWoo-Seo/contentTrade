/* global BigInt */
import _ from 'lodash'

import PublicKey from "../libsnark/struct/pk.js";
import UserKey from "../wallet/keyStruct.js";
import Encryption from '../crypto/encryption.js';
import SnarkInputs from '../libsnark/struct/snarkInput.js';
//import Libsnark from '../libsnark/libsnark.js';
import httpCli from "../utils/http.js";

// let snarkClass = new Libsnark();

// export const initLibSnark = async () => {
//     await snarkClass.init();
  
//     await snarkClass.readVerifyKeyFromFile('/crs/');
//     await snarkClass.readProofKeyFromFile('/crs/');
  
// }

export const orderContent = async (h_ct,tradeContract) => {
    try {
        // server key setting
        const delKeyInfo = await httpCli.get('server/key/publicKey');
        const delKey = delKeyInfo.data;
        const pubkey_del = new PublicKey(delKey.pk_own,delKey.pk_enc,'del');
        
        // consumer key setting
        const consKeyInfo = await httpCli.get('user/key/keyInfo');
        const consKey = consKeyInfo.data;
        const pubkey_cons = PublicKey.fromUserKey(consKey,'cons')

        // get content info to h_ct
        const contentInfo = await httpCli.get(`content/list/contentInfo/hct/${h_ct}`);
        const content = contentInfo.data;
        const pubkey_peer = new PublicKey(content.pk_own,content.pk_enc,'peer');
        
        const symEnc = new Encryption.symmetricKeyEncryption(consKey.sk_enc);
        const ENA = symEnc.Enc(BigInt(100000).toString(16));
        const ENA_ = symEnc.Enc(BigInt(2000).toString(16));

        console.log('start GenTrade ', content.h_k)
        let GenTradeInputs = new SnarkInputs(
            pubkey_peer,
            pubkey_del,
            pubkey_cons,
            ENA, 
            ENA_,
            consKey.sk_enc,
            content.h_k
        )
        GenTradeInputs.init()
        console.log(GenTradeInputs.toJson())

        //const contractProof = await snarkClass.runProof(GenTradeInputs.toSnarkInput());
        //console.log(proof);
        //임시 proof 값
        const contractProof =["0x1","0x1","0x1","0x1","0x1","0x1","0x1","0x1"];

        const contractInputs = GenTradeInputs.toContractInput();
        
        const receipt = await tradeContract.genTrade(
            contractProof,
            contractInputs
        )
        console.log(receipt, typeof receipt);

        const reqBody = {h_ct, tx_hash : receipt.hash};
        const genTradeRes = await httpCli.post("/content/buy/requestTrade",reqBody);
        const resJson = genTradeRes.data;

        if(!resJson){
            return false;
        }

        return true;
    } catch (error) {
        console.log("orderContent",error);
        throw error;
    }
    
}