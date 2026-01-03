import React, {useEffect, useState, useMemo} from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser, selectIsAuthenticated } from '../../store/authSlice';
import { Button } from '../../components';
import './Results.css';
import {db} from "../../firebase";
import {collection, getDocs, orderBy, query} from "firebase/firestore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const Results = () => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // all the test sessions
  const [historyData, setHistoryData] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // fetch data from Firebase
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!user?.uid) return;
      setLoading(true);

      try {
        const metricsRef = collection(db, "users", user.uid, "saccadeMetrics");
        const q = query(metricsRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedSessions = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Convert Firebase Timestamp to a readable JS Date object
          const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();

          fetchedSessions.push({
            id: doc.id,
            date: dateObj,
            formattedDate: dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ...data
          });
        });

        setHistoryData(fetchedSessions);

        if (fetchedSessions.length > 0) {
          setSelectedSession(fetchedSessions[0]);
        }

      } catch (error) {
        console.error("Error fetching metrics results", error);
        setError("Failed to load results. Please try again");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchMetrics();
    }
  }, [user, isAuthenticated]);

  const handleSessionSelect = (e) => {
    const sessionId = e.target.value;
    const session = historyData.find(s => s.id === sessionId);
    setSelectedSession(session);
  };

  // --- CHART CONFIGURATIONS ---

  // 1. Timeline Chart Data (Memoized for performance)
  const timelineChartData = useMemo(() => {
    // Reverse array so graph goes Left (Old) -> Right (New)
    const sortedHistory = [...historyData].reverse();

    return {
      labels: sortedHistory.map(s => s.date.toLocaleDateString(undefined, {month:'short', day:'numeric'})),
      datasets: [
        {
          label: 'Pro-Saccade (Reaction)',
          data: sortedHistory.map(s => s.pro?.stats?.latency?.mean || 0),
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
          tension: 0.3,
        },
        {
          label: 'Anti-Saccade (Reaction)',
          data: sortedHistory.map(s => s.anti?.stats?.latency?.mean || 0),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          tension: 0.3,
        },
      ],
    };
  }, [historyData]);

  // 2. Bar Chart Data (Specific Session)
  const barChartData = useMemo(() => {
    if (!selectedSession) return null;
    return {
      labels: ['Pro-Saccade', 'Anti-Saccade'],
      datasets: [
        {
          label: 'Latency (ms)',
          data: [
            selectedSession.pro?.stats?.latency?.mean || 0,
            selectedSession.anti?.stats?.latency?.mean || 0
          ],
          backgroundColor: ['rgba(53, 162, 235, 0.8)', 'rgba(255, 99, 132, 0.8)'],
        },
      ],
    };
  }, [selectedSession]);

  // 3. Accuracy Doughnut Data
  const accuracyChartData = useMemo(() => {
    if (!selectedSession) return null;
    const accuracy = (selectedSession.anti?.stats?.accuracy?.mean || 0) * 100;
    return {
      labels: ['Correct', 'Incorrect'],
      datasets: [
        {
          data: [accuracy, 100 - accuracy],
          backgroundColor: ['#4ade80', '#e5e7eb'], // Green vs Gray
          borderWidth: 0,
        },
      ],
    };
  }, [selectedSession]);

  if (!isAuthenticated) {
    return (
      <div className="results-page">
        <div className="results-card">
          <h1>My Results</h1>
          <p>Please login to view your results.</p>
          <Link to="/login">
            <Button variant="primary">Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="results-page"><div className="results-card">Loading your progress...</div></div>;
  }

  if (error) {
    return <div className="results-page"><div className="results-card error">{error}</div></div>;
  }

  if (historyData.length === 0) {
    return (
        <div className="results-page">
          <div className="results-card">
            <h1>Welcome, {user?.name}!</h1>
            <p>You haven't completed any tests yet.</p>
            <div className="results-placeholder">
              <Button variant="primary" onClick={() => navigate('/calibration')}>Start First Test</Button>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="results-page dashboard-layout">

        {/* ZONE 1: HEADER & CONTROLS */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>Progress Dashboard</h1>
            <p className="subtitle">Tracking {historyData.length} sessions</p>
          </div>

          <div className="header-right">
            <div className="session-selector-container">
              <label className="selector-label">Viewing Session:</label>
              <div className="custom-select-wrapper">
                <select
                    value={selectedSession?.id || ''}
                    onChange={handleSessionSelect}
                    className="modern-select"
                >
                  {historyData.map(session => (
                      <option key={session.id} value={session.id}>
                        {session.formattedDate}
                      </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>
            <Button variant="primary" onClick={() => navigate('/calibration')}>New Test</Button>
          </div>
        </header>

        {/* ZONE 2: GRAPHS CONTAINER */}
        <div className="dashboard-grid">

          {/* TOP ROW: Global Timeline */}
          <div className="card timeline-card full-width">
            <div className="card-header">
              <h3>Reaction Time History</h3>
              <span className="badge">Over Time</span>
            </div>
            <div className="chart-container timeline-chart">
              <Line
                  data={timelineChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: false }
                    },
                    scales: {
                      y: { title: { display: true, text: 'Latency (ms)' } }
                    }
                  }}
              />
            </div>
          </div>

          {/* BOTTOM ROW: Specific Session Details */}
          {selectedSession && (
              <>
                {/* 1. Bar Chart: Reaction Speed */}
                <div className="card detail-card">
                  <h3>Reaction Speed</h3>
                  <div className="chart-container small-chart">
                    <Bar
                        data={barChartData}
                        options={{
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true } }
                        }}
                    />
                  </div>
                  <div className="stat-footer">
                    <small>Cost: {Math.round(selectedSession.comparison?.latency?.difference || 0)}ms</small>
                  </div>
                </div>

                {/* 2. Doughnut Chart: Accuracy */}
                <div className="card detail-card">
                  <h3>Inhibition Accuracy</h3>
                  <div className="chart-container small-chart donut-container">
                    <Doughnut
                        data={accuracyChartData}
                        options={{
                          cutout: '70%',
                          plugins: { legend: { display: false } }
                        }}
                    />
                    <div className="donut-center-text">
                      <strong>{Math.round((selectedSession.anti?.stats?.accuracy?.mean || 0) * 100)}%</strong>
                    </div>
                  </div>
                  <div className="stat-footer">
                    <small>Target: >80%</small>
                  </div>
                </div>

                {/* 3. Stats Card: Consistency */}
                <div className="card detail-card stats-text-card">
                  <h3>Consistency</h3>
                  <p className="helper-text">Standard Deviation (lower is better)</p>

                  <div className="stat-row-large">
                    <div className="stat-group">
                      <span className="stat-label">Pro</span>
                      <span className="stat-value">±{Math.round(selectedSession.pro?.stats?.latency?.std || 0)}</span>
                    </div>
                    <div className="stat-group">
                      <span className="stat-label">Anti</span>
                      <span className="stat-value">±{Math.round(selectedSession.anti?.stats?.latency?.std || 0)}</span>
                    </div>
                  </div>

                  <div className="quality-indicator">
                    <span>Data Quality:</span>
                    <div className="progress-bar">
                      <div
                          className="progress-fill"
                          style={{width: `${(selectedSession.anti?.stats?.averageDataQuality || 0) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
              </>
          )}
        </div>
      </div>
  );
};

export default Results;
