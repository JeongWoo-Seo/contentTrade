import { useRef, useState } from "react"

export default function Login(){
    const nameRef = useRef();
    const keyRef = useRef();
    const [isLoading,setIsLoading] = useState(false);

    function onSubmit(e){
        e.preventDefault();

        if (!isLoading) {

            //
            setIsLoading(true);
        }
    }

    return(
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