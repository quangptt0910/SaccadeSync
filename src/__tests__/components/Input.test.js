import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../../components';

describe('Input Component', () => {
  it('should render input element', () => {
    render(<Input />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should call onChange when value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('should display controlled value', () => {
    render(<Input value="controlled value" onChange={() => {}} />);
    
    expect(screen.getByRole('textbox')).toHaveValue('controlled value');
  });

  it('should render with label when provided', () => {
    render(<Input label="Username" />);
    
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('should render password type', () => {
    render(<Input type="password" placeholder="Password" />);
    
    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should render email type', () => {
    render(<Input type="email" placeholder="Email" />);
    
    const input = screen.getByPlaceholderText('Email');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should have name attribute', () => {
    render(<Input name="username" />);
    
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'username');
  });

  it('should default to text type', () => {
    render(<Input placeholder="Default" />);
    
    expect(screen.getByPlaceholderText('Default')).toHaveAttribute('type', 'text');
  });

  it('should have input-field class', () => {
    render(<Input />);
    
    expect(screen.getByRole('textbox')).toHaveClass('input-field');
  });
});
