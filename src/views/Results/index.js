import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser, selectIsAuthenticated } from '../../store/authSlice';
import { Button } from '../../components';
import './Results.css';

const Results = () => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="results-page">
        <div className="results-card">
          <h1>My Results</h1>
          <p>Please login to view your results.</p>
          <Link to="/login">
            <Button variant="primary">Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="results-page">
      <div className="results-card">
        <h1>Welcome, {user?.name}!</h1>
        <p>Your test results will appear here.</p>
        <div className="results-placeholder">
          <p>No tests completed yet.</p>
          <Button variant="primary">Start a Test</Button>
        </div>
      </div>
    </div>
  );
};

export default Results;
