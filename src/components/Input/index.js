import React from 'react';
import './Input.css';

const Input = ({ label, type = 'text', placeholder, value, onChange, name }) => {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input
        className="input-field"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        name={name}
      />
    </div>
  );
};

export default Input;
