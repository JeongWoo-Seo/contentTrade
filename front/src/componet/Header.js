import { Link } from "react-router-dom"

export default function Header(){
    return (
        <div className="header">
            <h1>
                <Link to='/'>Content Trade</Link> 
            </h1>
            <div className='menu'>
                <Link to='/login' className='link'>Login</Link>
                <Link to='/join' className='link'>Join</Link>
            </div>
        </div>
    )
}