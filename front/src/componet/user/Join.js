import { useState } from 'react';
import _ from 'lodash';
import UserKey from '../../wallet/keyStruct'
import httpCli from '../../utils/http';


export default function Join(){
    const [key, setKey]          = useState(null);
    const [nickname, setNickname] = useState(null);
    const [deduplication, setDeduplication] = useState(false);

    const onClickSkOwnGen = async (e) => {   
        //key gen
        const userKey = UserKey.keyGen();
        setKey(userKey);
        console.log(key);

    };

    const onChangeNickname = async (e) => {   
        setNickname(e.taget.value);
    };

    const onClickDeduplication = async (e) => {   
        //get nickname check

    };

    const onClickJoin = async (e) => {   
        //post

    };

    return (
        <div className='Card'>
            <h2>Join</h2>
            {
                <div>
                    <button className='buttonStyle' onClick={onClickSkOwnGen}> 🔑 비밀키 생성기 </button><br/>
                
                    <div className='paragraph'>
                        <strong> SK_own : { !key?'':'0x'+_.get(key, 'skOwn')}</strong><br/>
                        <strong> PK_own : {!key?'':'0x'+_.get(key, 'pkOwn')}</strong><br/>
                        <strong> SK_enc : {!key?'':'0x'+_.get(key, 'skEnc')}</strong><br/>
                        <strong> PK_enc : {!key?'':'0x'+_.get(key, 'pkEnc')}</strong><br/>
                        <strong> addr  : {!key?'':' 0x'+_.get(key, 'ena')}</strong><br/><br/>
                    </div>
                    
                    <div>
                        <input type='text' className='text' onChange={onChangeNickname} placeholder='write your nickname'></input>
                        <button className='buttonStyle' onClick={onClickDeduplication}>중복확인</button><br/>
                    </div>
                    <br />
                    {
                        deduplication ?
                        <div>
                            <button className='buttonStyle' onClick={onClickJoin}>🌈 𝑱 𝐨 ℹ 𝓷✨</button>
                        </div> 
                        :<div><br/><br/></div> 
                    }
                </div>
            }
        </div>
    );
}
