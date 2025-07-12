import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "../../styles/Logout.css";

export default function Logout() {
  const navigate = useNavigate();

  const onClickLogout = () => {
    sessionStorage.clear();
    window.dispatchEvent(new Event("loginStatusChanged"));//header Logout 표시 변경
    navigate("/");
  };

  return (
    <>
      <Helmet>로그아웃</Helmet>
      <div className="logout-container">
        <h2 className="logout-title">Logout</h2>
        <p className="logout-nickname">
          닉네임: <strong>{sessionStorage.getItem("nickname")}</strong>
        </p>
        <button className="logout-button" onClick={onClickLogout}>
          로그아웃
        </button>
      </div>
    </>
  );
}
