import {getUserInfo,registDataQuery} from "../db/mysql";
import SnarkInput from "../libsnark/struct/snarkInput";
import _ from 'lodash';
import {fileStorePath} from "../config/config";
import fs from 'fs';
import {registData} from "../contract/contract";
import {getContractProof,registDataInputJsonToContractFormat} from "../contract/utils"
//import LibSnark from "../libsnark/libsnark";

export const registDataController = async (req, res) => {
    try {
        
        const jwtHeader = JSON.parse(req.headers['access-token'])
        const lgTk = jwtHeader.loginTk;
        if(lgTk === null){
            return res.send({ flag: false, message: "User not login" });
        }

        const usrInfo = await getUserInfo(lgTk);
        if (!usrInfo) {
            return res.send({ flag: false, message: "User not found" });
        }

        const addr  = usrInfo.eoa;
        const data  = req.body.data;
        const pkOwn = usrInfo.pk_own;

        const snarkInput = new SnarkInput.RegistData();
        
        // upload data 
        snarkInput.uploadDataFromStr(data);

        // upload pk_own 
        snarkInput.uploadPkOwn(pkOwn);

        // encrypt data to make ct_data
        snarkInput.encryptData();

        // make h_k h_data id_data
        snarkInput.makeSnarkInput();

        // libsnarkProver.uploadInputAndRunProof(snarkInput.toSnarkInputFormat(), "_" + snarkInput.gethCt());
        const verifySnarkFormat = JSON.parse(snarkInput.toSnarkVerifyFormat());

        const contractVerifyInput = registDataInputJsonToContractFormat(verifySnarkFormat);

        // const contractProof       = getContractProof(snarkInput.gethCt(), `RegistData`);
        //임시 proof 값
        const contractProof =["0x1","0x1","0x1","0x1","0x1","0x1","0x1","0x1"];

        const result = await registData(contractProof,contractVerifyInput);

        if(result.flag === false){
            return res.send(false);
        }

        const registerDataJson =  _.merge(
            {
                "ct_data" : JSON.parse(snarkInput.getsCtData()),
                'enc_key' : snarkInput.getEncKey(),
                'h_ct'  : snarkInput.gethCt(),
                'h_data'  : snarkInput.getIdData(),
                'data_path' : fileStorePath + snarkInput.gethCt() + '.json',
                'h_k'   : snarkInput.gethK(),
            }, 
            usrInfo, req.body)
            
        if(await registDataQuery(registerDataJson)){
            try {
                fs.writeFileSync(
                    registerDataJson['data_path'],
                    JSON.stringify(registerDataJson, null, 2)
                )

                console.log("regist content successfully");
                return res.send(
                    {
                        flag        : true,
                        //receipt     : result.receipt,
                        h_ct        : snarkInput.gethCt(),
                    }
                );
            } catch (error) {
                console.log(error);
                return res.send({flag : false});
            }
        }
    } catch (error) {
        console.log(error);
        return res.send({flag : false});
    }
}
