import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar';
import './Layout.css';

const Layout = () => {
  return (
    <div className="layout">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
