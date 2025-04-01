import { useState } from 'react';
import UserKey from '../../wallet/keyStruct'
import httpCli from '../../utils/http';
import mimc7 from '../../crypto/mimc';
import types from '../../utils/types';


export default function Join() {
    const [key, setKey] = useState(null);
    const [nickname, setNickname] = useState(null);
    const [deduplication, setDeduplication] = useState(false);

    const onClickSkOwnGen = async (e) => {
        //key gen
        const userKey = UserKey.keyGen();
        setKey(userKey.toObject());

        alert("Secret Key를 반드시 기억하세요!")
        alert('0x' + userKey.skOwn);
        setNickname(null);
        setDeduplication(false);
    };

    const onChangeNickname = async (e) => {
        setNickname(e.target.value);
        setDeduplication(false);
    };

    const onClickDeduplication = async (e) => {
        //get nickname check

        setDeduplication(true);

    };

    const onClickJoin = async (e) => {
        const userData = {
            loginTk: mimc7.hash(key.skOwn, types.asciiToHex('login')),
            nickname: nickname,
            skEnc: key.skEnc,
            pkOwn: key.pkOwn,
            pkEnc: key.pkEnc,
            addr: key.ena
        }
      /*  httpCli.post("/", userData).then(res => {
            if (res.data["flag"] === false) {
                alert("이미가입되었거나 올바르지 않은 주소입니다.");
                return;
            }
            console.log(res.data['receipt']['blockHash'], res.data['receipt']['transactionHash'])
            alert("sucess Join" + "\n\nblockHash : " + res.data['receipt']['blockHash'] +
                "\ntxHash : " + res.data['receipt']['transactionHash'] + '\n');
            sessionStorage.removeItem('key');
            navigate(`/`);
        });*/

    };

    return (
        <div className='Card'>
            <h2>Join</h2>
            {
                <div>
                    <button className='buttonStyle' onClick={onClickSkOwnGen}> 🔑 비밀키 생성기 </button><br />

                    <div className='paragraph'>
                        <strong> SK_own : {!key ? '' : '0x' + key.skOwn}</strong><br />
                        <strong> PK_own : {!key ? '' : '0x' + key.pkOwn}</strong><br />
                        <strong> SK_enc : {!key ? '' : '0x' + key.skEnc}</strong><br />
                        <strong> PK_enc : {!key ? '' : '0x' + key.pkEnc}</strong><br />
                        <strong> addr  : {!key ? '' : ' 0x' + key.ena}</strong><br /><br />
                    </div>

                    <div>
                        <input type='text' className='text' onChange={onChangeNickname} placeholder='write your name'></input>
                        <button className='buttonStyle' onClick={onClickDeduplication}>중복확인</button><br />
                    </div>
                    <br />
                    {
                        deduplication ?
                            <div>
                                <button className='buttonStyle' onClick={onClickJoin}>JOIN</button>
                            </div>
                            : <div><br /><br /></div>
                    }
                </div>
            }
        </div>
    );
}
