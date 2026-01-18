import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Instructions from '../../views/Instructions';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock Helmet to avoid issues in test environment
jest.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>
}));

describe('Instructions View', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders instructions content correctly', () => {
    render(
      <BrowserRouter>
        <Instructions />
      </BrowserRouter>
    );
    expect(screen.getByText(/Pro-Saccade Test Instructions/i)).toBeInTheDocument();
    expect(screen.getByText(/Anti-Saccade Test Instructions/i)).toBeInTheDocument();
  });

  it('navigates to game test on button click', () => {
    render(
      <BrowserRouter>
        <Instructions />
      </BrowserRouter>
    );
    const button = screen.getByRole('button', { name: /Start the test/i });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/gameTest');
  });
});