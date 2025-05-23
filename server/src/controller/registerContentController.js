import {getUserInfo,registDataQuery} from "../db/mysql";
import SnarkInput from "../libsnark/struct/snarkInput";
import _ from 'lodash';


export const registDataController = async (req, res) => {
    try {
        const usrInfo = await getUserInfo(req.body.loginTk);//사용자 정보를 얻어올 필요가 있음
        const addr       = usrInfo['eoa'];
        const data       = req.body['data'];
        const pkOwn      = usrInfo['pk_own'];

        console.log(usrInfo, data);

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
        // const verifySnarkFormat = JSON.parse(snarkInput.toSnarkVerifyFormat());

        // const contractVerifyInput = registDataInputJsonToContractFormat(verifySnarkFormat);
        // const contractProof       = getContractProof(snarkInput.gethCt(), `RegistData`);
        
        // // send regist data contract
        // console.log("proof", contractProof);
        // console.log("verify input", contractVerifyInput);

        // const receipt = await getTradeContract().registData(
        //     contractProof,
        //     contractVerifyInput,
        // )

        // if(!(await getTradeContract().isRegisteredData(contractVerifyInput[3]))){
        //     return res.send(false);
        // }

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
        
        console.log(registerDataJson);    
        if(await registDataQuery(registerDataJson)){
            try {
                fs.writeFileSync(
                    registerDataJson['data_path'],
                    JSON.stringify(registerDataJson, null, 2)
                )
                return res.send(
                    {
                        flag        : true,
                        receipt     : receipt,
                        h_ct        : snarkInput.gethCt(),
                        proof       : contractProof,
                        contractAddr: getContractAddr(),
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
