import { useEffect, useState } from "react";
import httpCli from "../../utils/http.js";
import "../../styles/DataList.css";
import { createContractInstance } from "../../contract/contract.js";
import { GANACHE_URL } from "../../contract/config.js";
import TradeABI from "../../contract/Trade.json";

export default function DataList() {
    const [contentData, setContentData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [tradeContract, setTradeContract] = useState(null); 
   

    const contentBuy = async (item) => {
        if (!tradeContract) {
            alert("블록체인 컨트랙트가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
            return;
        }

        alert(`"${item.title}" 구매 요청이 전송되었습니다.`);

        try {
            // 여기에 실제 블록체인 컨트랙트 구매 로직을 추가합니다.
            // 예시: tradeContractInstance.buyContent(item.contentId, item.price);
            // 실제 컨트랙트의 함수 이름과 인자에 맞게 변경해야 합니다.
            console.log(`Attempting to buy content: ${item.title} (ID: ${item.contentId}, Price: ${item.price})`);

            // 가정: Trade 컨트랙트에 buyContent 함수가 있고, contentId와 가격을 인자로 받음.
            // 그리고 가격만큼 이더를 함께 보내야 할 수 있음 (value 옵션 사용)
            // const transaction = await tradeContractInstance.buyContent(item.contentId, {
            //     value: ethers.utils.parseEther(item.price.toString()) // 가격이 이더 단위를 사용한다면
            // });
            // await transaction.wait(); // 트랜잭션이 확정될 때까지 대기

            alert(`"${item.title}" 구매가 성공적으로 처리되었습니다!`);
            // 구매 성공 후 필요한 추가 로직 (예: UI 업데이트, 구매 목록 새로고침 등)
        } catch (err) {
            console.error("콘텐츠 구매 중 오류 발생:", err);
            alert(`"${item.title}" 구매에 실패했습니다. 오류: ${err.message || err}`);
        }
    };

    useEffect(() => {
        const getDataListAndInitContract = async () => {
            setLoading(true);
            setError(false);

            try {
                // 1. 콘텐츠 목록 불러오기 (HTTP 요청)
                const res = await httpCli.get("/content/list/getAll");
                if (res.data.flag === false) {
                    throw new Error("콘텐츠 목록 로드 실패 (서버 응답 오류)");
                }
                setContentData(res.data.data || []);

                // 2. 블록체인 컨트랙트 인스턴스 초기화
                const accountAddress = sessionStorage.getItem("accountAddress");
                if (!accountAddress) {
                    console.warn("세션 스토리지에 계정 주소가 없습니다. 컨트랙트 초기화가 제한될 수 있습니다.");
                }

                const instance = await createContractInstance(
                    GANACHE_URL,
                    TradeABI,
                    accountAddress
                );
                setTradeContract(instance);

            } catch (err) {
                console.error("DApp 초기화 중 오류 발생:", err);
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
    );
}