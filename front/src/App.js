import React from "react";
import JoinService from "./user/join/join";
import { BrowserRouter as Router, Route, Routes,Outlet, Link, useNavigate, Navigate } from "react-router-dom";


function App() {
  return (

      <Router>
        <Routes>
        
        <Route path="/" element={<Layout />}/>
        
        
       
        <Route path="Join" element={<JoinApp />} />
        </Routes>
      </Router>

  );
}

function Layout() {
  return (
    <div>
      <nav>
        <ul className="App-text">
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/Join">Join</Link>
          </li>
          <li>
            <Link to="/Login">Login</Link>
          </li>
          <li>
            <Link to="/Logout">Logout</Link>
          </li>
          <li>
            <Link to="/Regist">Regist Data</Link>
          </li>
          <li>
            <Link to="/list">Data List</Link>
          </li>
          <li>
            <Link to="/nothing-here">Nothing Here</Link>
          </li>
        </ul>
      </nav>

      <hr />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
      <Outlet />
    </div>
  );
}

function Home() {
  
  return(
    <div className='myCard'>
     <input type="text" className='text'  placeholder="write your secret key"></input>
        <button className='buttonStyle' >login</button><br/>
    </div>
  );
}

function JoinApp() {
  
  return(

    <div className='myCard'>
      <JoinService />
    </div>
    
  );
}

export default App