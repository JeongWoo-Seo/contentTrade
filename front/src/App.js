import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./componet/Home";
import Login from "./componet/user/Login";
import Join from "./componet/user/Join";
import Empty from "./componet/Empty";
import Header from "./componet/Header";
import DataList from "./componet/user/DataList";
import RegistData from "./componet/user/RegistData";


function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<Join />} />
          <Route path="/content_regist" element= {<RegistData />}/>
          <Route path="/content_list" element={<DataList />} />
          <Route path="*" element={<Empty />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App