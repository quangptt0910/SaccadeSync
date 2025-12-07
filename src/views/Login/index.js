import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectAuthLoading, selectAuthError, setError } from '../../store/authSlice';
import { useAuth } from '../../hooks';
import { Button, Input } from '../../components';
import './Login.css';

const initialRegisterData = {
  name: '',
  surname: '',
  dateOfBirth: '',
  gender: '',
  medications: '',
  familyHistory: '',
  conditions: '',
  email: '',
  password: '',
  confirmPassword: ''
};

const validateDate = (dateStr) => {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);
  if (!match) return false;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1;
};

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { signIn, register } = useAuth();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [registerData, setRegisterData] = useState(initialRegisterData);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        if (registerData.password !== registerData.confirmPassword) {
          dispatch(setError('Passwords do not match'));
          return;
        }
        if (!validateDate(registerData.dateOfBirth)) {
          dispatch(setError('Invalid date format. Use DD/MM/YYYY'));
          return;
        }
        if (!registerData.gender) {
          dispatch(setError('Please select a gender'));
          return;
        }
        await register(registerData.email, registerData.password, {
          name: registerData.name,
          surname: registerData.surname,
          dateOfBirth: registerData.dateOfBirth,
          gender: registerData.gender,
          medications: registerData.medications,
          familyHistory: registerData.familyHistory,
          conditions: registerData.conditions,
        });
        navigate('/');
      } else {
        await signIn(formData.email, formData.password);
        navigate('/results');
      }
    } catch (err) {
      // Error handled by hook
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setFormData({ email: '', password: '' });
    setRegisterData(initialRegisterData);
  };

  return (
    <div className="login-page">
      <div className={`login-card ${isRegister ? 'login-card--wide' : ''}`}>
        <h1 className="login-title">{isRegister ? 'Sign Up' : 'Login'}</h1>
        
        {error && <p className="login-error">{error}</p>}
        
        <form className="login-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <h2 className="form-section-title">Personal Information</h2>
              <div className="form-row">
                <Input
                  label="Name"
                  type="text"
                  name="name"
                  placeholder="Enter name here"
                  value={registerData.name}
                  onChange={handleRegisterChange}
                />
                <Input
                  label="Surname"
                  type="text"
                  name="surname"
                  placeholder="Enter surname here"
                  value={registerData.surname}
                  onChange={handleRegisterChange}
                />
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label className="input-label">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    className="input-select"
                    value={registerData.dateOfBirth}
                    onChange={handleRegisterChange}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Gender</label>
                  <select
                    name="gender"
                    className="input-select"
                    value={registerData.gender}
                    onChange={handleRegisterChange}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <h2 className="form-section-title">Health Information</h2>
              <Input
                label="Medications"
                type="text"
                name="medications"
                placeholder="Enter any relevant medications"
                value={registerData.medications}
                onChange={handleRegisterChange}
              />
              <div className="form-row">
                <Input
                  label="Family History"
                  type="text"
                  name="familyHistory"
                  placeholder="Enter any family history related to neurodivergent diseases"
                  value={registerData.familyHistory}
                  onChange={handleRegisterChange}
                />
                <Input
                  label="Conditions"
                  type="text"
                  name="conditions"
                  placeholder="Enter any conditions that you have that is related to neurodivergent diseases"
                  value={registerData.conditions}
                  onChange={handleRegisterChange}
                />
              </div>

              <h2 className="form-section-title">Account Creation</h2>
              <Input
                label="Email"
                type="email"
                name="email"
                placeholder="Enter email here"
                value={registerData.email}
                onChange={handleRegisterChange}
              />
              <div className="form-row">
                <Input
                  label="Password"
                  type="password"
                  name="password"
                  placeholder="Enter your password here"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                />
                <Input
                  label="Repeat password"
                  type="password"
                  name="confirmPassword"
                  placeholder="Enter your password here"
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                />
              </div>
            </>
          ) : (
            <>
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
              <button type="button" className="forgot-password">Forget Password?</button>
            </>
          )}
          
          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Loading...' : isRegister ? 'Sign Up' : 'Sign in'}
          </Button>
          
          <p className="register-link">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" className="toggle-mode" onClick={toggleMode}>
              {isRegister ? 'Sign in here' : 'Register here'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
