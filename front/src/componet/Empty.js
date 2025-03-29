import { Link } from "react-router-dom";

export default function Empty(){
    return (
        <div>
            <h1>잘못된 접근입니다.</h1>
            <Link to ='/'>돌아가기</Link>
        </div>
    )
}