import { useState, useRef, Fragment } from "react";
import LoadingPage from "../LoadingPage";

export default function RegistData(){
    const fileInput = useRef(null);

    const [title, setTitle] = useState(null);
    const [textFile, setTextFile] = useState(null);
    const [desc, setDesc] = useState("");
    const [loading, setLoading] = useState(false);
    const [register, setRegister] = useState(false);

    const [hCt, setHCt] = useState(null);
    const [proof, setProof] = useState([]);
    const [receipt, setReceipt] = useState(null);

    const titleChangeHandler = e => {
        
    }

    const descChangeHandler = e => {
        
    }

    const handleButtonClick = e => {
        
    }

    const handleChange = e => {
        
        
    };

    const PrintProof = () =>{
        return(
            1
        );
    }

    const RegisterDataHandler = async (e) => {
       
    }

    return (
        <div className='myCard'>
            {loading? <LoadingPage /> :
            <div>
                <h2>Content Register</h2>
                <input type='text' className='title' onChange={titleChangeHandler} placeholder=' 제목을 입력하시오.'></input><br/>
                <textarea className='textDesc' onChange={descChangeHandler} placeholder='작품 설명을 입력하시오.'></textarea><br/>
                <Fragment>
                    <button className='buttonStyle' onClick={handleButtonClick}>파일 업로드</button>
                    <input type="file"
                        ref={fileInput}
                        onChange={handleChange}
                        style={{ display: "none" }} />
                </Fragment><br/>
                
                <button className='buttonStyle' onClick={RegisterDataHandler}> 파일 전송 </button>
                <p className='paragraph'> {textFile} </p>
                {register?
                <div>
                    
                    <div>
                        <PrintProof /><br/>
                        <strong className='paragraph'>receipt : {'\n'+receipt}</strong>
                    </div><br/>
                </div>:
                <div></div>
                }
            </div>
            }
        </div>
    )
}