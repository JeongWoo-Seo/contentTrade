import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { authService } from '../services/authService.js';
import '../styles/SignupForm.css';

// market-server의 username 검증 기준과 동일.
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,100}$/;

export function SignupForm({ onSignupSuccess }) {
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 아이디 중복 검사 상태
  const [checking, setChecking] = useState(false);
  const [checkedUsername, setCheckedUsername] = useState(null); // 검사 완료된 아이디
  const [available, setAvailable] = useState(null); // null=미검사, true=사용가능, false=중복

  const trimmedUsername = username.trim();
  // 현재 입력값과 검사 완료된 아이디가 일치하고, 사용 가능한 경우에만 통과.
  const checkValid = available === true && checkedUsername === trimmedUsername;

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    // 아이디를 수정하면 이전 검사 결과를 무효화한다.
    setCheckedUsername(null);
    setAvailable(null);
    setError('');
  };

  const handleCheck = async () => {
    const value = trimmedUsername;
    if (!value) {
      setError('아이디를 입력해주세요.');
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setError('아이디는 3-100자의 영문, 숫자, _, - 만 사용할 수 있습니다.');
      return;
    }

    setError('');
    setChecking(true);
    try {
      const res = await authService.checkUsername(value);
      setCheckedUsername(value);
      setAvailable(res.available);
    } catch (err) {
      // API/네트워크 오류는 중복 검사 성공으로 처리하지 않는다.
      setCheckedUsername(null);
      setAvailable(null);
      setError(err?.message ?? '중복 검사 중 오류가 발생했습니다.');
    } finally {
      setChecking(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!trimmedUsername) {
      setError('아이디를 입력해주세요.');
      return;
    }
    if (!USERNAME_RE.test(trimmedUsername)) {
      setError('아이디는 3-100자의 영문, 숫자, _, - 만 사용할 수 있습니다.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    // 중복 검사가 현재 입력값과 일치하게 통과해야만 가입 진행.
    if (!checkValid) {
      setError('아이디 중복 검사를 완료해주세요.');
      return;
    }

    setLoading(true);
    try {
      await signup({ username: trimmedUsername, password });
      onSignupSuccess(trimmedUsername);
    } catch (err) {
      setError(err?.message ?? '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h2>회원가입</h2>

      <label className="field">
        <span>아이디</span>
        <div className="username-row">
          <input
            type="text"
            value={username}
            autoComplete="username"
            onChange={handleUsernameChange}
            placeholder="아이디"
          />
          <button
            type="button"
            className="check-button"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? '검사 중…' : '중복 검사'}
          </button>
        </div>
        {!checking && checkedUsername === trimmedUsername && available === true && (
          <span className="check-status check-available">사용 가능한 아이디입니다.</span>
        )}
        {!checking && checkedUsername === trimmedUsername && available === false && (
          <span className="check-status check-taken">이미 사용 중인 아이디입니다.</span>
        )}
      </label>

      <label className="field">
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
        />
      </label>

      <label className="field">
        <span>비밀번호 확인</span>
        <input
          type="password"
          value={passwordConfirm}
          autoComplete="new-password"
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="비밀번호 재입력"
        />
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="auth-submit" disabled={loading || checking}>
        {loading ? '처리 중…' : '가입하기'}
      </button>
    </form>
  );
}
