import React from 'react';
import './Button.css';

const Button = ({ children, variant = 'primary', onClick, type = 'button', fullWidth = false }) => {
  return (
    <button 
      className={`btn btn--${variant} ${fullWidth ? 'btn--full' : ''}`}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
};

export default Button;
