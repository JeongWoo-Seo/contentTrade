import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import '../styles/LoginForm.css';

export function LoginForm() {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!id.trim() || !password) {
      setError('ID와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // On success the encrypted sk_own is fetched from IndexedDB, decrypted
      // with the password-derived key, and held in memory only.
      await login({ id: id.trim(), password });
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
        <span>ID</span>
        <input
          type="text"
          value={id}
          autoComplete="username"
          onChange={(e) => setId(e.target.value)}
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
