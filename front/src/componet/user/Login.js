import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom";
import httpCli from '../../utils/http';
import mimc from '../../crypto/mimc';
import types from '../../utils/types';

export default function Login() {
    const mimc7 = new mimc.MiMC7();
    const nameRef = useRef();
    const keyRef = useRef();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    function onSubmit(e) {
        e.preventDefault();
        
        setIsLoading(false);
        if (!isLoading) {
            setIsLoading(true);
            const loginTk = mimc7.hash(keyRef.current.value, types.asciiToHex('login'));
            const loginData = {nickname:nameRef.current.value,login_tk: loginTk }
            httpCli.post("/user/login", loginData).then(res => {
                console.log(res.data);
                if (res.data["flag"] === false) {
                    navigate('/login');
                    return;
                }
                navigate('/');
                setIsLoading(false);
            });
        }
    }

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={onSubmit}>
                <div className='input_area'>
                    <label>Name</label>
                    <input type='text' ref={nameRef} />
                </div>
                <div className='input_area'>
                    <label>Secret Key</label>
                    <input type='text' ref={keyRef} />
                </div>
                <button styled={{ opacity: isLoading ? 0.3 : 1 }} >
                    Login
                </button>
            </form>
        </div>
    )
}