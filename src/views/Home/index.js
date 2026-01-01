import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectAuthLoading } from '../../store/authSlice';
import { Button } from '../../components';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);

  const handleStartProcess = () => {
    if (isAuthenticated) {
      navigate('/calibration');
    } else {
      navigate('/login', { state: { from: '/calibration' } });
    }
  };

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero__content">
          <h1 className="hero__title">What are Saccades?</h1>
          <p className="hero__description">
            Saccades are quick simultaneous movement of both eyes between two or more phases of focal points in the same direction.
          </p>
        </div>
        <div className="hero__image">
          <img src="/assets/Eye_home.jpg" alt="Close up of an eye" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta__image">
          <img src="/assets/ADHD_home.jpg" alt="ADHD illustration" />
        </div>
        <div className="cta__content">
          <h2 className="cta__title">Take the test today</h2>
          <p className="cta__description">
            With some eye-tracking tests we can find identifying traits of ADHD or fatigue based on your results.
          </p>
          <Button 
            variant="primary" 
            onClick={handleStartProcess}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Start the process'}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Home;
