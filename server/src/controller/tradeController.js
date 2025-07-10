import _ from 'lodash'
import fs from 'fs'
import mimc from '../crypto/mimc';
import Config from '../utils/config';
import Encryption from '../crypto/encryption';
import { getDataEncKeyFromHct, getDataInfoFromHct, getUserKeysFromId } from "../db/mysql";
import { contractAcceptTrade, getTransaction } from "../contract/contract";
import SnarkInput from '../libsnark/struct/snarkInput';
import { acceptTradeInputJsonToContractFormat, getContractProof } from '../contract/utils';
import dotenv from 'dotenv';

dotenv.config();
//import LibSnark from '../libsnark/libsnark';

const pubEnc = new Encryption.publicKeyEncryption();

//const libsnarkProver = new LibSnark("AcceptTrade");

export const acceptTradeController = async (req, res) => {
    try {
        const { h_ct, tx_hash } = req.params;

        // 1. DB에서 콘텐츠 및 유저 정보 조회
        const dataInfo = await getDataInfoFromHct(h_ct);
        if (!dataInfo) {
            return res.status(404).send({ message: "해당 콘텐츠의 정보가 존재하지 않습니다." });
        }

        const usrInfo = await getUserKeysFromId(dataInfo.user_id);
        if (!usrInfo) {
            return res.status(404).json({ message: "해당 콘텐츠의 정보가 존재하지 않습니다." });
        }

        // 2. 트랜잭션 정보 조회
        const receipt = await getTransaction(tx_hash);
        if (!receipt) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const inputData = _.get(receipt, 'input', '').slice(10);
        for (let i = 0; i < 27; i++) {
            console.log(i, inputData.slice(i * 64, (i + 1) * 64));
        }

        const dec_ct = decrypCT(inputData, usrInfo.sk_enc);
        const serverPkOwn = process.env.PK_OWN;
        const isValid = checkCM(data, decrypted, usrInfo.pk_own, serverPkOwn);
        if (!isValid) {
            return res.status(400).json({ message: "커밋먼트 오류" });
        }

        const keyInfo = await getDataEncKeyFromHct(h_ct);
        if (!keyInfo) {
            return res.status(404).json({ message: "해당 콘텐츠의 정보가 존재하지 않습니다.",});
        }

        const { enc_key, data_path } = keyInfo;
        const symEnc = new Encryption.symmetricKeyEncryption(enc_key)
        const CT = _.get(JSON.parse(fs.readFileSync(data_path, 'utf-8')), 'ct_data');
        const dec = symEnc.DecData(new Encryption.sCTdata(CT.r, CT.ct));
        const dataString = hexStrToString(dec)

        const acceptTradeReceipt = acceptTrade(
            serverPkOwn,
            usrInfo.pk_own,
            dec_ct[0],
            enc_key,
            dec_ct[2],
            dec_ct[3],
            dec_ct[4]
        )

        if(!acceptTradeReceipt){
            return res.status(500).json({ message: "Trade 수락 실패" });
        }

        res.status(200).send({
            owner: usrInfo.user_id,
            title: dataInfo.title,
            key: enc_key,
            h_ct: h_ct,
            data: dataString
        });
    } catch (error) {
        console.error("acceptTradeController 오류:", error);
        res.status(500).json({message: "서버 오류가 발생했습니다."});
    }
}

// 2        : g^r
// 3        : c1
// 12 ~ 17  : CT
const decrypCT = (data, sk_enc_peer) => {
    const c0 = sliceData(data, 2)
    const c1 = sliceData(data, 3)

    let c2 = []
    for (let i = 12; i < 18; i++) {
        c2.push(sliceData(data, i))
    }

    return pubEnc.Dec(
        new Encryption.pCT(c0, c1, c2),
        sk_enc_peer
    )
}

// 4        : cm_own = Hash(pk_own_peer || r || fee_peer || h_k || pk_enc_cons)
// 5        : cm_del = Hash(pk_own_del  || r || fee_del  || h_k || pk_enc_cons)
const checkCM = (data, decCT, pk_own_peer, pk_own_del) => {

    const mimc7 = new mimc.MiMC7();

    const cm_own = sliceData(data, 4)
    const cm_del = sliceData(data, 5)

    const [
        pk_enc_cons,
        pk_own_cons,
        r_cm,
        fee_own,
        fee_del,
        h_k] = decCT;

    const cm_own_calc = mimc7.hash(
        pk_own_peer,
        r_cm,
        fee_own,
        h_k,
        pk_enc_cons
    )
    const cm_del_calc = mimc7.hash(
        pk_own_del,
        r_cm,
        fee_del.padStart(64, '0'),
        h_k,
        pk_enc_cons
    )

    console.log(cm_own_calc, cm_own)
    console.log(cm_del_calc, cm_del)

    return cm_own_calc.padStart(64, '0') === cm_own.padStart(64, '0') && cm_del_calc.padStart(64, '0') === cm_del.padStart(64, '0')
}

const sliceData = (data, idx) => {
    if (typeof data !== 'string') { throw Error('data must be string') }
    return data.slice(idx * 64, (idx + 1) * 64)
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

const acceptTrade = async (
    pk_own_del,
    pk_own_peer,
    pk_enc_cons,
    dataEncKey,
    r_cm,
    fee_own,
    fee_del
) => {
    try {
        // Snark 입력 객체 생성
        const snarkInput = new SnarkInput.AcceptTrade(
            pk_own_del,
            pk_own_peer,
            pk_enc_cons,
            dataEncKey,
            r_cm,
            fee_own,
            fee_del
        );

        // zk-SNARK 검증을 위한 입력 포맷 변환
        const verifyInputJson = JSON.parse(snarkInput.toSnarkVerifyFormat());
        const contractInput = acceptTradeInputJsonToContractFormat(verifyInputJson);

        // TODO: 실제 zk-SNARK proof 생성 코드 필요
        // libsnarkProver.uploadInputAndRunProof(snarkInput.toSnarkInputFormat(), '_' + r_cm);
        // const contractProof = getContractProof(r_cm, 'AcceptTrade');

        // 임시 proof 값 사용 (테스트 목적)
        const contractProof = Array(8).fill("0x1");

        // 스마트 컨트랙트에 거래 수락 요청
        const receipt = await contractAcceptTrade(contractProof, contractInput);

        return receipt;
    } catch (error) {
        console.error("acceptTrade 오류:", error);
        throw error;
    }
};
