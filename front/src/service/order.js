import _ from 'lodash'

import DBInstance from "../../db";

import PublicKey from "../libsanrk/struct/pk.js";
import UserKey from "../wallet/keyStruct.js";
import Encryption from '../crypto/encryption.js';
import SnarkInputs from '../libsnark/struct/snarkInput.js';
import Libsnark from '../libsnark/libsnark.js';
import { getTradeContract } from '../web3';
import httpCli from "../utils/http.js";

// let snarkClass = new Libsnark();

// export const initLibSnark = async () => {
//     await snarkClass.init();
  
//     await snarkClass.readVerifyKeyFromFile('/crs/');
//     await snarkClass.readProofKeyFromFile('/crs/');
  
// }

export const orderData = async (h_ct) => {
    try {
        // server key setting
        const delKeys = await httpCli.get('server/keys');
        const pubkey_del = new PublicKey(delKeys.pk_own,delKeys.pk_enc, type = 'del');
        
        // consumer key setting
        const consKey = await httpCli.get('');
        const pubkey_cons = PublicKey.fromUserKey(consKey, type='cons')

        // peer(writer) key setting
        const info = (await httpCli.get(`data/info/${h_ct}`))
        console.log('peer Info', info, typeof info);
        const pubkey_peer = new PublicKey(info.pk_own,info.pk_enc,type='peer');

        const symEnc = new Encryption.symmetricKeyEncryption(consKey.skEnc)
        const ENA = symEnc.Enc(BigInt(100000).toString(16))
        const ENA_ = symEnc.Enc(BigInt(2000).toString(16));

        console.log('start GenTrade ', info.h_k)
        let GenTradeInputs = new SnarkInputs(
            pubkey_peer,
            pubkey_del,
            pubkey_cons,
            ENA, 
            ENA_,
            consKey.skEnc,
            info.h_k
        )
        GenTradeInputs.init()
        console.log(GenTradeInputs.toJson())

        //const contractProof = await snarkClass.runProof(GenTradeInputs.toSnarkInput());
        //console.log(proof);
        //임시 proof 값
        const contractProof =["0x1","0x1","0x1","0x1","0x1","0x1","0x1","0x1"];

        const contractInputs = GenTradeInputs.toContractInput();
        
        const receipt = await getTradeContract().genTrade(
            contractProof,
            contractInputs,
            consKey.eoa,//account
            consKey.eoa_sk//account privKey
        )
        console.log(receipt, typeof receipt);

        const genTradeRes = await httpCli.post("/",h_ct, receipt.transactionHash);
        const resJson = genTradeRes.data;

        if(resJson.flag === false){
            return [false, undefined, undefined, undefined]
        }

        console.log(
            decodeURIComponent(resJson['data'])
        )
        let { title, owner, key, data} = resJson
        data= decodeURIComponent(data)

        await DBInstance.dataDB.insertData(
            data, 
            owner,
            title,
            key,
            h_ct,
            idx
        );

        return [true, title, owner, data]
    } catch (error) {
        console.log(error)
        return [false, undefined, undefined, undefined]
    }
    
}