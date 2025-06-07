import React, { useState, useRef } from "react";
import LoadingPage from "../LoadingPage";
import httpCli from "../../utils/http.js";
import "../../styles/RegistData.css";

export default function RegistData() {
    const maxUtf8DataSize = 16430;
    const fileInput = useRef(null);
    const fileReader = new FileReader();

    const [title, setTitle] = useState("");
    const [textFile, setTextFile] = useState("");
    const [desc, setDesc] = useState("");
    const [loading, setLoading] = useState(false);
    const [register, setRegister] = useState(false);
    const [receipt, setReceipt] = useState(null);

    const titleChangeHandler = e => setTitle(e.target.value);
    const descChangeHandler = e => setDesc(e.target.value);

    const handleFileUploadClick = () => fileInput.current.click();

    const handleChange = e => {
        fileReader.readAsText(e.target.files[0]);
        fileReader.onload = () => {
            const text = fileReader.result;
            if (getByteLengthOfUtf8String(text) > maxUtf8DataSize) {
                alert("파일 크기가 너무 큽니다.");
                return;
            }
            setTextFile(text);
        };
    };

    const getByteLengthOfUtf8String = str => {
        return str ? [...str].reduce((acc, char) => acc + (encodeURI(char).split("%").length - 1 || 1), 0) : 0;
    };

    const registerDataHandler = async () => {
        if (!title.trim() || !desc.trim() || !textFile.trim()) {
            alert("모든 항목을 입력해주세요.");
            return;
        }

        setLoading(true);
        const reqBody = { title, desc, data: textFile };

        try {
            const res = await httpCli.post('/content/registerContent/', reqBody);
            if (!res.data.flag) {
                alert('등록에 실패했습니다.');
                setLoading(false);
                return;
            }

            alert('데이터 등록이 완료되었습니다.');
            //setReceipt(JSON.stringify(res.data.receipt, null, 2));
            setRegister(true);
        } catch (err) {
            alert("에러 발생: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="regist-container">
            {loading ? (
                <LoadingPage />
            ) : (
                <div className="regist-card">
                    <h2>Content Register</h2>

                    <input
                        type="text"
                        className="input-title"
                        value={title}
                        onChange={titleChangeHandler}
                        placeholder="제목을 입력하세요"
                    />

                    <textarea
                        className="input-desc"
                        value={desc}
                        onChange={descChangeHandler}
                        placeholder="작품 설명을 입력하세요"
                    />

                    <input
                        type="file"
                        ref={fileInput}
                        onChange={handleChange}
                        style={{ display: "none" }}
                    />

                    <button className="btn upload-btn" onClick={handleFileUploadClick}>
                        📂 파일 업로드
                    </button>

                    <button className="btn submit-btn" onClick={registerDataHandler}>
                        📤 파일 전송
                    </button>

                    {textFile && (
                        <div className="text-preview">
                            <strong>미리보기:</strong>
                            <pre>{textFile}</pre>
                        </div>
                    )}

                    {register && receipt && (
                        <div className="receipt">
                            <strong>📜 등록 영수증:</strong>
                            <pre>{receipt}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
