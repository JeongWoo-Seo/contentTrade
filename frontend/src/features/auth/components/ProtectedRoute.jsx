import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

// 인증이 필요한 라우트를 감싸는 가드. 미인증 시 "/" (로그인)로 리다이렉트.
export function ProtectedRoute({ children }) {
  const { status } = useAuth();
  if (status !== 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return children;
}
