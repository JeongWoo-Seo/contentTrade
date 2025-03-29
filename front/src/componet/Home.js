import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <ul className='list'>
        <Link to="/content_registe">Content Registe</Link>
        <Link to="/content_list">Content List</Link>
      </ul>
    </div>
  )
}