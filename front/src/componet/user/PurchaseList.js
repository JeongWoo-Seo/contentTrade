import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import httpCli from "../../utils/http";
import useApiErrorHandler from "../../hooks/useApiErrorHandler";
import { Helmet } from "react-helmet-async";
import "../../styles/PurchaseList.css";

export default function PurchaseList() {
    const [purchaseList, setPurchaseList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { errorMessage, handleError } = useApiErrorHandler();

    useEffect(() => {
        const fetchPurchaseList = async () => {
            setLoading(true);
            try {
                const response = await httpCli.get("/content/list/purchaseList");
                setPurchaseList(response.data || []);
            } catch (error) {
                handleError(error);
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchPurchaseList();
    }, []);

    if (loading) {
        return <p className="status-msg">⏳ Loading data...</p>;
    }

    if (purchaseList.length === 0) {
        return <p className="status-msg">📭 구매된 콘텐츠가 없습니다.</p>;
    }

    return (
        <>
            <Helmet>
                <title>구매 목록</title>
            </Helmet>
            <div className="purchase-list-container">
                <h2>📦 Purchase List</h2>
                <table className="purchase-table">
                    <thead>
                        <tr>
                            <th>번호</th>
                            <th>제목</th>
                            <th>설명</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchaseList.map((item, index) => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{item.title}</td>
                                <td>{item.descript}</td>
                                <td><Link to={`/purchase_list/${item.h_ct}`}>읽기</Link></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
