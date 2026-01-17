import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import Results from '../../views/Results';
import authReducer from '../../store/authSlice';
import * as firestore from 'firebase/firestore';

// Mock Chart.js components to avoid canvas errors
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

// Mock Firebase
jest.mock('../../firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
}));

const renderWithStore = (component, initialState) => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: initialState,
  });
  return render(
    <Provider store={store}>
      <BrowserRouter>{component}</BrowserRouter>
    </Provider>
  );
};

describe('Results View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login prompt when not authenticated', () => {
    renderWithStore(<Results />, { auth: { isAuthenticated: false, user: null } });
    expect(screen.getByText(/Please login to view your results/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('renders loading state initially when authenticated', () => {
    // Mock getDocs to never resolve immediately to test loading state
    firestore.getDocs.mockImplementation(() => new Promise(() => {}));
    
    renderWithStore(<Results />, { auth: { isAuthenticated: true, user: { uid: '123' } } });
    expect(screen.getByText(/Loading your progress/i)).toBeInTheDocument();
  });

  it('renders no results message when history is empty', async () => {
    firestore.getDocs.mockResolvedValue({
      forEach: () => {},
      docs: [],
      empty: true
    });

    renderWithStore(<Results />, { auth: { isAuthenticated: true, user: { uid: '123', name: 'Test User' } } });

    await waitFor(() => {
      expect(screen.getByText(/Welcome, Test User!/i)).toBeInTheDocument();
      expect(screen.getByText(/You haven't completed any tests yet/i)).toBeInTheDocument();
    });
  });

  it('renders dashboard with charts when data exists', async () => {
    const mockSession = {
      timestamp: { toDate: () => new Date('2023-01-01T12:00:00') },
      pro: { 
        stats: { 
          latency: { mean: 200, std: 20 }, 
          accuracy: { mean: 0.9 },
          peakVelocity: { mean: 400 }
        } 
      },
      anti: { 
        stats: { 
          latency: { mean: 300, std: 30 }, 
          accuracy: { mean: 0.8 },
          peakVelocity: { mean: 350 }
        } 
      },
    };

    firestore.getDocs.mockResolvedValue({
      forEach: (callback) => {
        callback({ id: 'session1', data: () => mockSession });
      },
      docs: [{ id: 'session1', data: () => mockSession }],
      empty: false
    });

    renderWithStore(<Results />, { auth: { isAuthenticated: true, user: { uid: '123' } } });

    await waitFor(() => {
      expect(screen.getByText(/Progress Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/Analysis & Interpretation/i)).toBeInTheDocument();
      
      // Check for charts
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0);
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    });
  });
});