import React,{ useState, useRef } from "react";
import LoadingPage from "../LoadingPage";
import httpCli from "../../utils/http.js";

export default function RegistData() {
    const maxUtf8DataSize = 16430;
    const fileInput = useRef(null);
    let fileReader = new FileReader();

    const [title, setTitle] = useState(null);
    const [textFile, setTextFile] = useState(null);
    const [desc, setDesc] = useState("");
    const [loading, setLoading] = useState(false);
    const [register, setRegister] = useState(false);

    const [hCt, setHCt] = useState(null);
    const [proof, setProof] = useState([]);
    const [receipt, setReceipt] = useState(null);

    const titleChangeHandler = e => {
        setTitle(e.target.value);
    }

    const descChangeHandler = e => {
        setDesc(e.target.value);
    }

    const handleButtonClick = e => {
        fileInput.current.click();
    }

    const handleChange = e => {
        fileReader.readAsText(e.target.files[0]);//read to text
        fileReader.onload = () => {
            const text = fileReader.result;
            if (getByteLengthOfUtf8String(text) > maxUtf8DataSize) {
                alert("size is too big");
                return;
            }

            setTextFile(fileReader.result);
        };

    };
    
    function getByteLengthOfUtf8String(s) {
        let b, i, c;
        if (s != undefined && s != "") {
            for (b = i = 0; c = s.charCodeAt(i++); b += c >> 11 ? 3 : c >> 7 ? 2 : 1);
            return b;
        }
        return 0;
    }

    const PrintProof = () => {
        return (
            1
        );
    }

    const RegisterDataHandler = async (e) => {
        setLoading(true);

        const reqBody = {
            "title" : `${title}`,
            "desc"  : `${desc}`,
            "data"  : `${textFile}`
        }

        //post
    }

    return (
        <div className='myCard'>
            {loading ? <LoadingPage /> :
                <div>
                    <h2>Content Register</h2>
                    <input type='text' className='title' onChange={titleChangeHandler} placeholder=' 제목을 입력하시오.'></input><br />
                    <textarea className='textDesc' onChange={descChangeHandler} placeholder='작품 설명을 입력하시오.'></textarea><br />
        
                    <input type="file"
                        ref={fileInput}
                        onChange={handleChange}
                        style={{ display: "none" }} />
                    <button
                        className="file-upload"
                        onClick={handleButtonClick}
                    >
                        파일 업로드
                    </button>

                    <button className='buttonStyle' onClick={RegisterDataHandler}> 파일 전송 </button>
                    <p className='paragraph'> {textFile} </p>
                    {register ?
                        <div>

                            <div>
                                <PrintProof /><br />
                                <strong className='paragraph'>receipt : {'\n' + receipt}</strong>
                            </div><br />
                        </div> :
                        <div></div>
                    }
                </div>
            }
        </div>
    )
}