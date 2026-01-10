import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../../components/Button';

describe('Button Component', () => {
  it('should render button with children', () => {
    render(<Button>Click Me</Button>);
    
    expect(screen.getByRole('button')).toHaveTextContent('Click Me');
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should have correct type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('should default to button type', () => {
    render(<Button>Default</Button>);
    
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('should apply primary variant class by default', () => {
    render(<Button>Primary</Button>);
    
    expect(screen.getByRole('button')).toHaveClass('btn--primary');
  });

  it('should apply secondary variant class', () => {
    render(<Button variant="secondary">Secondary</Button>);
    
    expect(screen.getByRole('button')).toHaveClass('btn--secondary');
  });

  it('should apply fullWidth class when prop is true', () => {
    render(<Button fullWidth>Full Width</Button>);
    
    expect(screen.getByRole('button')).toHaveClass('btn--full');
  });

  it('should not have fullWidth class by default', () => {
    render(<Button>Normal</Button>);
    
    expect(screen.getByRole('button')).not.toHaveClass('btn--full');
  });
});
