import { useEffect, useState } from "react";
import httpCli from "../../utils/http.js";
import { useNavigate } from "react-router-dom";
import "../../styles/DataList.css";

export default function DataList() {
    const [contentData, setContentData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const navigate = useNavigate();

    const contentBuy = (item) => {
        alert(`"${item.title}" 구매 요청이 전송되었습니다.`);
    };

    useEffect(() => {
            if (sessionStorage.getItem("isLogin") !== "true") {
              navigate("/login");
            }
    }, [navigate]);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await httpCli.get("/content/list/getAll");
                if (res.data.flag === false) setError(true);
                else setContentData(res.data.data || []);
            } catch (err) {
                console.error("Error fetching content list:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, []);

    if (loading) return <p className="status-msg">Loading...</p>;
    if (error) return <p className="status-msg error">오류가 발생했습니다. 데이터를 불러올 수 없습니다.</p>;
    if (contentData.length === 0) return <p className="status-msg">등록된 콘텐츠가 없습니다.</p>;

    return (
        <div className="content-list">
            <h2>Content List</h2>
            <div className="content-items">
                <table className="content-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>제목</th>
                            <th>설명</th>
                            <th className="buy-column">구매</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contentData.map((item, index) => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{item.title}</td>
                                <td>{item.descript}</td>
                                <td className="buy-column">
                                    <button className="buy-button" onClick={() => contentBuy(item)}>구매</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}