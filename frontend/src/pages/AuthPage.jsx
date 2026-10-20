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
  const [mode, setMode] = useState('login');
  const [signupMessage, setSignupMessage] = useState('');

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

  // 탭 전환 시 이전 성공 메시지 초기화
  const switchTab = (next) => {
    setMode(next);
    setSignupMessage('');
  };

  // 회원가입 성공 → 성공 메시지 표시 + 로그인 화면으로 전환
  const handleSignupSuccess = (signedUpUsername) => {
    setSignupMessage(`${signedUpUsername}님, 회원가입이 완료되었습니다. 로그인해주세요.`);
    setMode('login');
  };

  return (
    <main className="auth-panel">
      <nav className="auth-tabs">
        <button
          type="button"
          className={mode === 'signup' ? 'active' : ''}
          onClick={() => switchTab('signup')}
        >
          회원가입
        </button>

        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => switchTab('login')}
        >
          로그인
        </button>
      </nav>

      {signupMessage && <div className="success-banner">{signupMessage}</div>}

      {mode === 'signup' ? <SignupForm onSignupSuccess={handleSignupSuccess} /> : <LoginForm />}
    </main>
  );
}
