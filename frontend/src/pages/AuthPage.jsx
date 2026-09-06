import { useState } from 'react';
import {
  useAuth,
  SignupForm,
  LoginForm,
  LogoutButton,
} from '../features/auth';

export default function AuthPage() {
  const { status, id, ena, pkOwn, pkEnc } = useAuth();
  const [mode, setMode] = useState('signup');

  if (status === 'authenticated') {
    return (
      <main className="auth-panel">
        <h1>로그인됨</h1>

        <dl className="account-info">
          <dt>ID</dt>
          <dd>{id}</dd>

          <dt>ena</dt>
          <dd>{ena}</dd>

          <dt>pk_own</dt>
          <dd>{pkOwn}</dd>

          <dt>pk_enc</dt>
          <dd>{pkEnc}</dd>
        </dl>

        <LogoutButton />
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
