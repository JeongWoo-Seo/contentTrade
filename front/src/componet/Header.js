import { Link } from "react-router-dom";
import "../styles/Header.css"; // CSS 파일 임포트

export default function Header() {
  return (
    <header className="header">
      <h1 className="logo">
        <Link to="/">Content Trade</Link>
      </h1>
      <nav className="menu">
        <Link to="/login" className="link">Login</Link>
        <Link to="/join" className="link">Join</Link>
      </nav>
    </header>
  );
}
