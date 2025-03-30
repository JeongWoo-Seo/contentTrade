import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <ul className='list'>
        <li>
          <Link to="/content_regist">Content Register</Link>
        </li>
      </ul>
      <ul className='list'>
        <li>
        <Link to="/content_list">Content List</Link>
        </li>
      </ul>
    </div>
  )
}