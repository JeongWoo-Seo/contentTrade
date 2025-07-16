import { 
    getUserInfo, 
    registDataQuery, 
    getAllDataList, 
    getDataInfoFromHct, 
    getUserKeysFromId,
    getPurchaseHistory,
    getDataEncKeyFromHct } from "../db/mysql";
import SnarkInput from "../libsnark/struct/snarkInput";
import _ from 'lodash';
import { fileStorePath } from "../config/config";
import fs from 'fs';
import { contractRegistData } from "../contract/contract";
import { getContractProof, registDataInputJsonToContractFormat } from "../contract/utils";
import Encryption from '../crypto/encryption';

//import LibSnark from "../libsnark/libsnark";

//const libsnarkProver = new LibSnark("RegistData");

const pubEnc = new Encryption.publicKeyEncryption();

export const registDataController = async (req, res) => {
    try {
        const jwtHeader = JSON.parse(req.headers['access-token'])
        const loginTk = jwtHeader.loginTk;
        if (!loginTk) {
            return res.status(401).json({ message: "User not logged in" });
        }

        const usrInfo = await getUserInfo(loginTk);

        if (!usrInfo) {
            return res.status(404).json({ message: "User not found" });
        }

        const addr = usrInfo.eoa;
        const data = req.body.data;
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
        const contractProof = ["0x1", "0x1", "0x1", "0x1", "0x1", "0x1", "0x1", "0x1"];

        const receipt = await contractRegistData(contractProof, contractVerifyInput);

        if (!receipt) {
            return res.status(500).json({ message: "컨트랙트 등록 실패" });
        }

        const registerDataJson = _.merge(
            {
                "ct_data": JSON.parse(snarkInput.getsCtData()),
                'enc_key': snarkInput.getEncKey(),
                'h_ct': snarkInput.gethCt(),
                'h_data': snarkInput.getIdData(),
                'data_path': fileStorePath + snarkInput.gethCt() + '.json',
                'h_k': snarkInput.gethK(),
            },
            usrInfo, req.body)

        const queryResult = await registDataQuery(registerDataJson)
        if (queryResult === true) {
            try {
                fs.writeFileSync(
                    registerDataJson['data_path'],
                    JSON.stringify(registerDataJson, null, 2)
                )

                console.log("regist content successfully");
                return res.status(200).send(
                    {
                        //receipt     : receipt,
                        h_ct: snarkInput.gethCt(),
                    }
                );
            } catch (error) {
                console.error("파일 저장 중 오류:", error);
                return res.status(500).json({ message: "파일 저장 중 오류가 발생했습니다." });
            }
        }
        else {
            console.log("registData error");
            return res.status(500).json({ message: "DB 저장 중 오류가 발생했습니다." });
        }
    } catch (error) {
        console.log("registDataController", error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
}

export const getAllContentListController = async (req, res) => {
    try {
        const dataList = await getAllDataList();

        return res.status(200).send(dataList);
    } catch (error) {
        console.error("getAllContentListController 오류:", error);
        return res.status(500).json({ message: "DB 오류가 발생했습니다." });
    }
};

export const getContentDatafromHctController = async (req, res) => {
    try {
        const h_ct = req.params.h_ct;

        const dataInfo = await getDataInfoFromHct(h_ct);
        if (!dataInfo) {
            return res.status(404).json({ message: "해당 콘텐츠가 존재하지 않습니다." });
        }

        const usrInfo = await getUserKeysFromId(dataInfo.user_id);
        if (!usrInfo) {
            return res.status(404).json({ message: "해당 콘텐츠의 사용자 정보가 존재하지 않습니다." });
        }

        const mergedData = _.merge({}, dataInfo, usrInfo);

        return res.status(200).send(mergedData);
    } catch (error) {
        console.error("getContentDatafromHctController 오류:", error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};

export const getContentDataController = async (req, res) => {
    try {
        const jwtHeader = JSON.parse(req.headers['access-token'])
        const loginTk = jwtHeader.loginTk;
        if (!loginTk) {
            return res.status(401).json({ message: "User not logged in" });
        }

        const h_ct = req.params.h_ct;
        if (!h_ct) {
            console.warn("Content hash (h_ct) missing from request parameters.");
            return res.status(400).json({ message: "콘텐츠 식별자가 제공되지 않았습니다." });
        }

        //  구매 이력 확인 (사용자가 콘텐츠를 구매했는지 확인)
        const purchaseInfo = await getPurchaseHistory(loginTk, h_ct);

        // getPurchaseHistory가 빈 배열을 반환하면 구매 이력이 없는 것
        if (!purchaseInfo || purchaseInfo.length === 0) {
            console.warn(`User ${loginTk} has not purchased content ${h_ct}.`);
            return res.status(403).json({ message: "해당 콘텐츠를 구매하지 않았습니다." });
        }

        const contentInfo = await getDataEncKeyFromHct(h_ct);
        if (!contentInfo || !contentInfo.enc_key || !contentInfo.data_path) {
            console.error(`Content info for h_ct ${h_ct} not found or incomplete.`);
            return res.status(500).json({ message: "콘텐츠 정보를 불러올 수 없습니다." });
        }
        const { enc_key, data_path } = contentInfo;
        const symEnc = new Encryption.symmetricKeyEncryption(enc_key)
        const CT = _.get(JSON.parse(fs.readFileSync(data_path, 'utf-8')), 'ct_data');
        const dec = symEnc.DecData(new Encryption.sCTdata(CT.r, CT.ct));
        const dataString = hexStrToString(dec)

        res.status(200).send(dataString);
    } catch (error) {
        console.error("콘텐츠 데이터 조회 중 예상치 못한 서버 오류:", error);
        res.status(500).json({ message: "콘텐츠를 불러오는 중 서버 오류가 발생했습니다." });
    }
}


const hexStrToString = (strArr) => {
    let ret = ''
    for (let i = 0; i < Number(Config.dataBlockNum); i++) {
        if (strArr[i] === '0') continue;
        console.log(strArr[i]);
        ret += Buffer.from(strArr[i].padStart(64, '0'), 'hex')
    }
    return ret
}