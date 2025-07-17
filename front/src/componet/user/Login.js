import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import httpCli from "../../utils/http";
import mimc from "../../crypto/mimc";
import types from "../../utils/types";
import { Helmet } from "react-helmet-async";
import useApiErrorHandler from "../../hooks/useApiErrorHandler";
import "../../styles/Login.css";

export default function Login() {
  const mimc7 = new mimc.MiMC7();
  const nameRef = useRef();
  const keyRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { errorMessage, handleError, clearError } = useApiErrorHandler();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    const loginTk = mimc7.hash(keyRef.current.value, types.asciiToHex("login"));
    const loginData = {
      nickname: nameRef.current.value,
      login_tk: loginTk,
    };

    try {
      const res = await httpCli.post("/user/login", loginData);
      const data = res.data;

      if (!data.success) {
        alert("로그인 실패. 다시 시도해주세요.");
        navigate("/login");
        return;
      }

      sessionStorage.setItem("isLogin", "true");
      sessionStorage.setItem("nickname", data.nickname);
      sessionStorage.setItem("jwtToken", data.token);
      sessionStorage.setItem("accountAddress", data.eoa);
      sessionStorage.setItem("user_id", data.user_id);

      window.dispatchEvent(new Event("loginStatusChanged")); //header Login 표시 변경

      httpCli.defaults.headers.common["access-token"] = JSON.stringify(data);
      navigate("/");
    } catch (err) {
      handleError(err);
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        로그인
      </Helmet>

      <div className="login-container">
        <h2>Login</h2>
        <form onSubmit={onSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="nickname">Nickname</label>
            <input id="nickname" type="text" ref={nameRef} required />
          </div>
          <div className="input-group">
            <label htmlFor="secret">Secret Key</label>
            <input id="secret" type="password" ref={keyRef} required />
          </div>
          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </>
  );
}
