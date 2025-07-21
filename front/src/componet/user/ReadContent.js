import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useApiErrorHandler from "../../hooks/useApiErrorHandler";
import httpCli from "../../utils/http";
import "../../styles/ReadContent.css";

export default function ReadContent() {
    const { h_ct } = useParams();
    const [contentData, setContentData] = useState(null);
    const [loading, setLoading] = useState(false);
    const { errorMessage, handleError } = useApiErrorHandler();

    useEffect(() => {
        const fetchContentData = async () => {
            setLoading(true);
            try {
                const response = await httpCli.get(`/content/list/purchaseList/purchaseInfo/h_ct/${h_ct}`);
                setContentData(response.data || null);
            } catch (error) {
                handleError(error);
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchContentData();
    }, [h_ct]); // URL param 변경에 대응

    if (loading) {
        return <p className="status-msg">⏳ Loading content...</p>;
    }

    if (errorMessage) {
        return <p className="status-msg error">⚠️ {errorMessage}</p>;
    }

    if (!contentData) {
        return <p className="status-msg">📭 콘텐츠가 없습니다.</p>;
    }

    return (
        <div className="read-content-container">
            <h2 className="content-title">{contentData.title || "제목 없음"}</h2>
            <div className="content-description">{contentData.data || "설명 없음"}</div>
        </div>
    );
}
