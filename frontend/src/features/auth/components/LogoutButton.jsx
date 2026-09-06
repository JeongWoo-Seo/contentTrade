import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import '../styles/LogoutButton.css';

export function LogoutButton() {
  const { logout, id } = useAuth();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await logout();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="logout-button" onClick={onClick} disabled={loading}>
      {loading ? '로그아웃 중…' : `로그아웃${id ? ` (${id})` : ''}`}
    </button>
  );
}
