import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../../store/authSlice';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoginPage = location.pathname === '/login';

  return (
    <nav className={`navbar ${isLoginPage ? 'navbar--login' : ''}`}>
      <Link to="/" className="navbar__logo">
        Saccade Sync
      </Link>
      <div className="navbar__links">
        <Link to="/results" className="navbar__link">
          {isAuthenticated ? 'My Results' : 'Results'}
        </Link>
        <Link 
          to="/login" 
          className={`navbar__link ${isLoginPage ? 'navbar__link--active' : ''}`}
        >
          Login
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
