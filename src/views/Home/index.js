import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components';
import './Home.css';

// Placeholder images - replace with actual images
const eyeImage = 'https://images.unsplash.com/photo-1494869042583-f6c911f04b4c?w=400&h=300&fit=crop';
const adhdImage = 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=400&fit=crop';

const Home = () => {
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
          <img src={eyeImage} alt="Close up of an eye" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta__image">
          <img src={adhdImage} alt="ADHD illustration" />
        </div>
        <div className="cta__content">
          <h2 className="cta__title">Take the test today</h2>
          <p className="cta__description">
            With some eye-tracking tests we can find identifying traits of ADHD or fatigue based on your results.
          </p>
          <Link to="/login">
            <Button variant="primary">Start the process</Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
