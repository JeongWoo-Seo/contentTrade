import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import UserKey from '../../wallet/keyStruct';
import httpCli from '../../utils/http';
import mimc from '../../crypto/mimc';
import types from '../../utils/types';
import { Helmet } from 'react-helmet-async';
import '../../styles/Join.css';

export default function Join() {
  const mimc7 = new mimc.MiMC7();
  const [key, setKey] = useState(null);
  const [nickname, setNickname] = useState('');
  const [deduplication, setDeduplication] = useState(false);
  const navigate = useNavigate();

  const onClickSkOwnGen = () => {
    const userKey = UserKey.keyGen();
    setKey(userKey.toObject());
    alert("Secret Key를 반드시 기억하세요!\n\n" + '0x' + userKey.skOwn);
    setNickname('');
    setDeduplication(false);
  };

  const onChangeNickname = (e) => {
    setNickname(e.target.value);
    setDeduplication(false);
  };

  const onClickDeduplication = async () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    const res = await httpCli.get(`/user/join/check/nickname/${nickname}`);
    if (!res.data) {
      alert("이미 사용 중인 닉네임입니다.");
    } else {
      alert(`사용 가능한 닉네임입니다: "${nickname}"`);
      setDeduplication(true);
    }
  };

  const onClickJoin = async () => {
    if (!key || !nickname || !deduplication) {
      alert("모든 항목을 입력하고 중복 확인을 완료해주세요.");
      return;
    }

    const userData = {
      loginTk: mimc7.hash(key.skOwn, types.asciiToHex('login')),
      nickname: nickname,
      skEnc: key.skEnc,
      pkOwn: key.pkOwn,
      pkEnc: key.pkEnc,
      addr: key.ena
    };

    const res = await httpCli.post("/user/join/join/", userData);
    if (!res.data.flag) {
      alert("가입 실패: 이미 가입된 계정이거나 잘못된 주소입니다.");
      return;
    }

    alert("가입이 완료되었습니다.");
    navigate('/');
  };

  return (
    <>
      <Helmet>
        회원가입
      </Helmet>
      <div className="join-container">
        <h2>Join</h2>

        <button className="join-button" onClick={onClickSkOwnGen}>🔑 비밀키 생성</button>

        {key && (
          <div className="key-info">
            <p><strong>SK_own:</strong> 0x{key.skOwn}</p>
            <p><strong>PK_own:</strong> 0x{key.pkOwn}</p>
            <p><strong>SK_enc:</strong> 0x{key.skEnc}</p>
            <p><strong>PK_enc:</strong> 0x{key.pkEnc}</p>
            <p><strong>Addr:</strong> 0x{key.ena}</p>
          </div>
        )}

        <div className="nickname-section">
          <input
            type="text"
            value={nickname}
            onChange={onChangeNickname}
            placeholder="닉네임 입력"
          />
          <button className="check-button" onClick={onClickDeduplication}>중복 확인</button>
        </div>

        {deduplication && (
          <button className="join-button" onClick={onClickJoin}>가입하기</button>
        )}
      </div>
    </>
  );
}
