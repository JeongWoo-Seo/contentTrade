import { Link } from "react-router-dom";
import "../styles/Home.css";

export default function Home() {
  return (
    <div className="home-container">
      <div className="menu-box">
        <h2 className="menu-title">📚 콘텐츠 메뉴</h2>
        <Link to="/content_regist" className="menu-link">
          Content Register
        </Link>
        <Link to="/content_list" className="menu-link">
          Content List
        </Link>
      </div>
    </div>
  );
}
