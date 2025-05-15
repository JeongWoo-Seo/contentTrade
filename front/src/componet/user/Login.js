import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom";
import httpCli from '../../utils/http';
import mimc7 from '../../crypto/mimc';
import types from '../../utils/types';

export default function Login() {
    const nameRef = useRef();
    const keyRef = useRef();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    function onSubmit(e) {
        e.preventDefault();

        if (!isLoading) {
            setIsLoading(true);
            const login_tk = mimc7.hash(keyRef, types.asciiToHex('login'));
            httpCli.get("/usr/login", { 'nickname':nameRef,'login_tk': loginTk }).then(res => {
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