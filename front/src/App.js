import { BrowserRouter, Route, Routes } from "react-router-dom";
import React from "react";
import Home from "./componet/Home";
import Login from "./componet/user/Login";
import Join from "./componet/user/Join";
import Empty from "./componet/Empty";
import Header from "./componet/Header";
import DataList from "./componet/user/DataList";
import RegistData from "./componet/user/RegistData";
import Logout from "./componet/user/Logout";
import PrivateRoute from "./componet/user/PrivateRoute";


function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/join" element={<Join />} />
          <Route
            path="/content_regist"
            element={
              <PrivateRoute>
                <RegistData />
              </PrivateRoute>
            }
          />
          <Route
            path="/content_list"
            element={
              <PrivateRoute>
                <DataList />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Empty />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App