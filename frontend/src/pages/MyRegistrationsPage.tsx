import { Link } from 'react-router-dom';
import { LogoutButton } from '../features/auth';
import { MyRegistrations } from '../features/novel';
import '../App.css';

export default function MyRegistrationsPage() {
  return (
    <main className="page">
      <nav className="page-nav">
        <span className="brand">소설 마켓</span>
        <Link to="/novels">목록</Link>
        <Link to="/novels/new">등록</Link>
        <Link to="/novels/mine">내 소설</Link>
        <LogoutButton />
      </nav>

      <MyRegistrations />
    </main>
  );
}
