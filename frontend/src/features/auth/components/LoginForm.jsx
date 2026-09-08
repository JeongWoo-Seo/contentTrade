import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import '../styles/LoginForm.css';

export function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err) {
      setError(err?.message ?? '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h2>로그인</h2>

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
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
        />
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? '처리 중…' : '로그인'}
      </button>
    </form>
  );
}
