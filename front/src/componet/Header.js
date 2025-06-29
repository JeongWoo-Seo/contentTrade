import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../styles/Header.css";

export default function Header() {
  const [isLogin, setIsLogin] = useState(
    sessionStorage.getItem("isLogin") === "true"
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setIsLogin(sessionStorage.getItem("isLogin") === "true");
    };

    window.addEventListener("loginStatusChanged", handleStorageChange);

    return () => {
      window.removeEventListener("loginStatusChanged", handleStorageChange);
    };
  }, []);

  return (
    <header className="header">
      <h1 className="logo">
        <Link to="/">Content Trade</Link>
      </h1>
      <nav className="menu">
        {isLogin ?
          <Link to="/logout" className="link">Logout</Link>
          :
          <>
            <Link to="/login" className="link">Login</Link>
            <Link to="/join" className="link">Join</Link>
          </>
        }

      </nav>
    </header>
  );
}
