import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../../store/authSlice';
import { Button, Input } from '../../components';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simple login - in production, this would call an API
    dispatch(login({ 
      email: formData.email,
      name: formData.email.split('@')[0] 
    }));
    navigate('/results');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Login</h1>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="Enter email here"
            value={formData.email}
            onChange={handleChange}
          />
          
          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="Enter your password here"
            value={formData.password}
            onChange={handleChange}
          />
          
          <Link to="#" className="forgot-password">Forget Password?</Link>
          
          <Button type="submit" variant="primary" fullWidth>
            Sign in
          </Button>
          
          <p className="register-link">
            Dont have an account? <Link to="#">Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
