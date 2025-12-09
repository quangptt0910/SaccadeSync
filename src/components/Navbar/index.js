import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectUser } from '../../store/authSlice';
import { useAuth } from '../../hooks';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const { logOut } = useAuth();
  const isLoginPage = location.pathname === '/login';

  const handleLogout = async () => {
    await logOut();
  };

  const getDisplayName = () => {
    if (user?.name) {
      return user.name;
    }
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    return 'User';
  };

  return (
    <nav className={`navbar ${isLoginPage ? 'navbar--login' : ''}`}>
      <Link to="/" className="navbar__logo">
        Saccade Sync
      </Link>
      <div className="navbar__links">
        <Link to="/results" className="navbar__link">
          {isAuthenticated ? 'My Results' : 'Results'}
        </Link>
        {isAuthenticated ? (
          <>
            <span className="navbar__welcome">Welcome, {getDisplayName()}</span>
            <button onClick={handleLogout} className="navbar__link navbar__logout">
              Logout
            </button>
          </>
        ) : (
          <Link 
            to="/login" 
            className={`navbar__link ${isLoginPage ? 'navbar__link--active' : ''}`}
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
