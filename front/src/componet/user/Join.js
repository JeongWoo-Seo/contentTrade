import React, { useState } from 'react';
import httpCli from '../../utils/http';


export default function Join(){

    const [nickname, setNickname] = useState(null);

    const test1 = async (e) => {
        setNickname(e.target.value);

        //const res = await httpCli.get(`/user/join/check/nickname/${nickname}`);
        console.log("tt");
        //alert(` you can use "${res}"`);
        
    }

    const test2 = async (e) => {
    //const res = await httpCli.post(`/usr/join/check/nickname/${nickname}`);
    }

    return (
        <div className='Card'>
            <h3>Join</h3>
            {
                    <div>
                        <input type='text' className='text' onChange={test1} placeholder='write your nickname'></input>
                        <button className='buttonStyle' onClick={test2}>중복확인</button><br/>
                    </div>
            }
        </div>
    );
}
