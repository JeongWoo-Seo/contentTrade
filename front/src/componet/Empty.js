import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function Empty() {
  return (
    <>
      <Helmet>
        <title>잘못된 페이지</title>
      </Helmet>

      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h1>🚫 잘못된 접근입니다.</h1>
        <Link to="/" style={{ textDecoration: "underline", color: "#007bff" }}>
          홈으로 돌아가기
        </Link>
      </div>
    </>
  );
}
