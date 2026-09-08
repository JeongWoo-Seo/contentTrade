import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import '../styles/SignupForm.css';

export function SignupForm() {
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('아이디를 입력해주세요.');
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

    setLoading(true);
    try {
      await signup({ username: username.trim(), password });
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
        <input
          type="text"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="아이디"
        />
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

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? '처리 중…' : '가입하기'}
      </button>
    </form>
  );
}
