import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAuth,
  SignupForm,
  LoginForm,
  LogoutButton,
} from '../features/auth';

export default function AuthPage() {
  const { status, username, walletAddress } = useAuth();
  const [mode, setMode] = useState('signup');

  if (status === 'authenticated') {
    return (
      <main className="auth-panel">
        <h1>로그인됨</h1>

        <dl className="account-info">
          <dt>아이디</dt>
          <dd>{username}</dd>

          <dt>지갑 주소</dt>
          <dd>{walletAddress}</dd>
        </dl>

        <div className="auth-actions">
          <Link to="/novels" className="auth-novels-link">소설 목록으로 이동</Link>
          <LogoutButton />
        </div>
      </main>
    );
  }

  return (
    <main className="auth-panel">
      <nav className="auth-tabs">
        <button
          type="button"
          className={mode === 'signup' ? 'active' : ''}
          onClick={() => setMode('signup')}
        >
          회원가입
        </button>

        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
        >
          로그인
        </button>
      </nav>

      {mode === 'signup' ? <SignupForm /> : <LoginForm />}
    </main>
  );
}
