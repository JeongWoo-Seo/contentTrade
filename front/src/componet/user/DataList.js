import { useEffect, useState } from "react";
import httpCli from "../../utils/http.js";
import "../../styles/DataList.css";
import { createContractInstance } from "../../contract/contract.js";
import { GANACHE_URL } from "../../contract/config.js";
import { Helmet } from "react-helmet-async";
import useApiErrorHandler from "../../hooks/useApiErrorHandler";
import { orderContent } from "../../service/order.js";

export default function DataList() {
    const [contentData, setContentData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [tradeContract, setTradeContract] = useState(null);
    const { errorMessage, handleError, clearError } = useApiErrorHandler();

    const contentBuy = async (item) => {
        if (!tradeContract) {
            alert("블록체인 컨트랙트가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
            return;
        }
        try {
            const result = await orderContent(item.h_ct,tradeContract);
            if(!result){
                console.error("content 구매 실패");
                alert("content 구매 실패");
            }
            
        } catch (err) {
            handleError(err);
            console.error(err);
        }
    };

    useEffect(() => {
        const getDataListAndInitContract = async () => {
            setLoading(true);
            setError(false);

            try {
                // 1. 콘텐츠 목록 불러오기 (HTTP 요청)
                const list = await httpCli.get("/content/list/getAll");
                
                setContentData(list.data || []);

                // 2. 블록체인 컨트랙트 인스턴스 초기화
                const accountAddress = sessionStorage.getItem("accountAddress");
                if (!accountAddress) {
                    console.warn("세션 스토리지에 계정 주소가 없습니다. 컨트랙트 초기화가 제한될 수 있습니다.");
                }

                const contract = await httpCli.get("/server/contract/contractInfo");

                const instance = await createContractInstance(
                    GANACHE_URL,
                    contract.data.jsonABI,
                    contract.data.address,
                    accountAddress,
                );
                setTradeContract(instance);

            } catch (err) {
                handleError(err);
                console.error(err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        getDataListAndInitContract();
    }, []);


    if (loading) {
        return <p className="status-msg">Loading content and connecting to blockchain...</p>;
    }
    if (error) {
        return <p className="status-msg error">오류가 발생했습니다. 데이터를 불러오거나 블록체인에 연결할 수 없습니다.</p>;
    }
    if (contentData.length === 0) {
        return <p className="status-msg">등록된 콘텐츠가 없습니다.</p>;
    }

    return (
        <>
            <Helmet>
                content 목록
            </Helmet>
            <div className="content-list">
                <h2>Content List</h2>
                <div className="content-items">
                    <table className="content-table">
                        <thead>
                            <tr>
                                <th>번호</th>
                                <th>제목</th>
                                <th>설명</th>
                                <th className="buy-column">구매</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contentData.map((item, index) => (
                                <tr key={item.contentId || index}>
                                    <td>{index + 1}</td>
                                    <td>{item.title}</td>
                                    <td>{item.descript}</td>
                                    <td className="buy-column">
                                        <button
                                            className="buy-button"
                                            onClick={() => contentBuy(item)}
                                            disabled={!tradeContract}
                                            title={!tradeContract ? "블록체인 연결 중..." : "콘텐츠 구매"}
                                        >
                                            구매
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}