import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogoutButton } from '../features/auth';
import { NovelList } from '../features/novel';
import '../App.css';

export default function NovelsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (location.state?.registered) {
      setShowSuccess(true);
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  return (
    <main className="page">
      <nav className="page-nav">
        <span className="brand">소설 마켓</span>
        <Link to="/novels">목록</Link>
        <Link to="/novels/new">등록</Link>
        <Link to="/novels/mine">내 소설</Link>
        <LogoutButton />
      </nav>

      {showSuccess && <div className="success-banner">소설이 등록되었습니다.</div>}

      <NovelList />
    </main>
  );
}
