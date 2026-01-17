/**
 * Results View Component
 *
 * This component is responsible for fetching, processing, and visualizing the eye-tracking test results
 * for the authenticated user. It connects to Firebase Firestore to retrieve session history and
 * uses Chart.js to display metrics such as latency, accuracy, and peak velocity.
 *
 * Key Features:
 * - Historical timeline of reaction times.
 * - Detailed breakdown of the selected session (Pro vs Anti saccade).
 * - Automated interpretation of results based on clinical research thresholds (ADHD likelihood).
 * - Comparison against control group norms.
 */
import React, {useEffect, useState, useMemo} from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
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

// Research-based thresholds for ADHD likelihood
const ADHD_THRESHOLDS = {
  LATENCY_PRO: 380,    // ms
  LATENCY_ANTI: 450,   // ms
  ACCURACY_ANTI: 70,   // %
  VARIABILITY_PRO: 35  // ms (Standard Deviation)
};

const Results = () => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  // all the test sessions
  const [historyData, setHistoryData] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch saccade metrics history from Firebase Firestore
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

  // Prepare data for the historical timeline chart (last 14 sessions)
  const timelineChartData = useMemo(() => {
    // get history from the last 14 sessions
    const sortedHistory = historyData.slice(0, 14).reverse();

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

  // Prepare data for the current session's latency bar chart
  const barChartData = useMemo(() => {
    if (!selectedSession) return null;
    return {
      labels: ['Pro-Saccade', 'Anti-Saccade'],
      datasets: [
        {
          label: 'Your Latency (ms)',
          data: [
            selectedSession.pro?.stats?.latency?.mean || 0,
            selectedSession.anti?.stats?.latency?.mean || 0
          ],
          backgroundColor: ['rgba(53, 162, 235, 0.8)', 'rgba(255, 99, 132, 0.8)'],
          order: 2
        },
        {
          type: 'line',
          label: 'ADHD Likelihood Threshold',
          data: [ADHD_THRESHOLDS.LATENCY_PRO, ADHD_THRESHOLDS.LATENCY_ANTI],
          borderColor: 'rgba(100, 100, 100, 0.5)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointStyle: 'rectRot',
          pointRadius: 6,
          order: 1
        },
      ],
    };
  }, [selectedSession]);

  /**
   * Generates a text-based interpretation of the results.
   * Compares user metrics against research-based thresholds for ADHD likelihood.
   * Returns a summary string and a list of specific findings.
   */
  const interpretation = useMemo(() => {
    if (!selectedSession) return null;

    const proLat = selectedSession.pro?.stats?.latency?.mean || 0;
    const antiLat = selectedSession.anti?.stats?.latency?.mean || 0;
    const antiAcc = (selectedSession.anti?.stats?.accuracy?.mean || 0) * 100;
    const proSD = selectedSession.pro?.stats?.latency?.std || 0;

    const findings = [];
    let riskCount = 0;

    // 1. Pro-Saccade Latency (Normal: 170-250ms, ADHD: >280ms)
    if (proLat > ADHD_THRESHOLDS.LATENCY_PRO) {
      findings.push(`Pro-saccade reaction time (${Math.round(proLat)}ms) is slower than the typical control range (>280ms).`);
      riskCount++;
    }

    // 2. Anti-Saccade Latency (Normal: 300-340ms, ADHD: >350ms)
    if (antiLat > ADHD_THRESHOLDS.LATENCY_ANTI) {
      findings.push(`Anti-saccade reaction time (${Math.round(antiLat)}ms) is elevated compared to norms (>350ms).`);
      riskCount++;
    }

    // 3. Anti-Saccade Accuracy (Normal Error < 25% -> Acc > 75%, ADHD Error > 30% -> Acc < 70%)
    if (antiAcc < ADHD_THRESHOLDS.ACCURACY_ANTI) {
      findings.push(`Anti-saccade accuracy (${Math.round(antiAcc)}%) is lower than the typical range (>75%), suggesting difficulty with inhibition.`);
      riskCount++;
    }

    // 4. Variability (Pro SD) (Control: ~26ms, ADHD: ~42ms)
    if (proSD > ADHD_THRESHOLDS.VARIABILITY_PRO) {
      findings.push(`Reaction time variability (±${Math.round(proSD)}ms) is higher than the stable control baseline (~26ms).`);
      riskCount++;
    }

    let summary = "";
    if (riskCount >= 3) {
      summary = "Your results show multiple patterns (latency, accuracy, or variability) that align with research markers for attention deficits. The data suggests significant deviations from the neurotypical control group.";
    } else if (riskCount >= 1) {
      summary = "Your results are mostly within the normal range, though there are slight deviations in specific metrics (detailed below) that may indicate mild fatigue or momentary lapses in attention.";
    } else {
      summary = "Your results fall consistently within the normal range for neurotypical adults. Reaction times, accuracy, and consistency match the control group baselines.";
    }

    return { summary, findings };
  }, [selectedSession]);

  const accuracyChartData = useMemo(() => {
    if (!selectedSession) return null;

    const antiAccuracy = (selectedSession.anti?.stats?.accuracy?.mean || 0) * 100;
    const proAccuracy = (selectedSession.pro?.stats?.accuracy?.mean || 0) * 100;

    return {
      labels: ['Correct', 'Incorrect'],
      datasets: [
        // Inner Circle: Anti-Saccade (Green)
        {
          label: 'Anti-Saccade',
          data: [antiAccuracy, 100 - antiAccuracy],
          backgroundColor: ['#4ade80', '#e5e7eb'], // Green & Gray
          borderWidth: 0,
        },
        // Outer Circle: Pro-Saccade (Blue)
        {
          label: 'Pro-Saccade',
          data: [proAccuracy, 100 - proAccuracy],
          backgroundColor: ['#3b82f6', '#e5e7eb'], // Blue & Gray
          borderWidth: 0,
        },
      ],
    };
  }, [selectedSession]);

  const velocityChartData = useMemo(() => {
    if (!selectedSession) return null;
    return {
      labels: ['Pro-Saccade', 'Anti-Saccade'],
      datasets: [
        {
          label: 'Peak Velocity (deg/s)',
          data: [
            selectedSession.pro?.stats?.peakVelocity?.mean || 0,
            selectedSession.anti?.stats?.peakVelocity?.mean || 0
          ],
          backgroundColor: ['rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)'], // Teal & Purple
          borderWidth: 1
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

        <div className="dashboard-grid">

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

          {selectedSession && (
              <>
                <div className="card detail-card full-width">
                  <h3>Analysis & Interpretation</h3>
                  <div className="interpretation-content">
                    <p className="interpretation-summary">{interpretation?.summary}</p>
                    {interpretation?.findings.length > 0 && (
                        <ul className="interpretation-list">
                          {interpretation.findings.map((finding, idx) => (
                              <li key={idx}>{finding}</li>
                          ))}
                        </ul>
                    )}
                    <p className="disclaimer-text">
                      * Comparison based on research thresholds from{' '}
                      <a
                          href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2963044/"
                          target="_blank"
                          rel="noopener noreferrer"
                      >
                        Karatekin et al. (2010)
                      </a>{' '}and{' '}
                      <a
                          href="https://www.mdpi.com/2076-3425/10/12/1016"
                          target="_blank"
                          rel="noopener noreferrer"
                      >
                        Lee et al. (2020)
                      </a>.
                      Values represent mean metrics observed in clinical studies. This is not a medical diagnosis.
                    </p>
                  </div>
                </div>

                <div className="card detail-card">
                  <h3>Reaction Time</h3>
                  <p className="helper-text">For current session</p>
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


                <div className="card detail-card stats-text-card">
                  <h3>Consistency of Reaction Speed</h3>
                  <p className="helper-text">Standard Deviation (lower is better)</p>

                  <div className="stat-row-large">
                    <div className="stat-group">
                      <span className="stat-label">Pro</span>
                      <span className="stat-value">±{Math.round(selectedSession.pro?.stats?.latency?.std || 0)}</span>
                      <small className="ref-text">Control: ~26ms | ADHD: ~42ms</small>
                    </div>
                    <div className="stat-group">
                      <span className="stat-label">Anti</span>
                      <span className="stat-value">±{Math.round(selectedSession.anti?.stats?.latency?.std || 0)}</span>
                      <small className="ref-text">Control: ~59ms | ADHD: ~49ms</small>
                    </div>
                  </div>

                  <div className="quality-indicator">
                    <span>Data Quality:</span>
                    <p className="helper-text">Amount of trials that are valid</p>
                    <div className="progress-bar">
                      <div
                          className="progress-fill"
                          style={{width: `${(selectedSession.anti?.stats?.averageDataQuality || 0) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                </div>


                <div className="card detail-card">
                  <h3>Session Accuracy</h3>

                  <div className="chart-container small-chart donut-container">
                    <Doughnut
                        data={accuracyChartData}
                        options={{
                          cutout: '60%',
                          plugins: {
                            legend: { display: false },
                            tooltip: { enabled: true }
                          }
                        }}
                    />
                  </div>

                  {/* New Custom Legend / Stats Section */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px' }}>

                    {/* Anti-Saccade Stat (Green) */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>
                        {Math.round((selectedSession?.anti?.stats?.accuracy?.mean || 0) * 100)}%
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '-4px' }}>
                        <span style={{ display:'inline-block', width:'8px', height:'8px', backgroundColor:'#4ade80', borderRadius:'50%', marginRight:'5px'}}></span>
                        Anti
                      </div>
                    </div>

                    {/* Pro-Saccade Stat (Blue) */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                        {Math.round((selectedSession?.pro?.stats?.accuracy?.mean || 0) * 100)}%
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '-4px' }}>
                        <span style={{ display:'inline-block', width:'8px', height:'8px', backgroundColor:'#3b82f6', borderRadius:'50%', marginRight:'5px'}}></span>
                        Pro
                      </div>
                    </div>

                  </div>

                  <div className="stat-footer" style={{ textAlign: 'center', marginTop: '15px' }}>
                    <small>Target: >80%</small>
                  </div>
                </div>


                <div className="card detail-card">
                  <h3>Peak Velocity</h3>
                  <div className="chart-container small-chart">
                    <Bar
                        data={velocityChartData}
                        options={{
                          plugins: { legend: { display: false } },
                          scales: {
                            y: {
                              title: { display: true, text: 'deg/s' },
                              beginAtZero: true
                            }
                          }
                        }}
                    />
                  </div>
                  <div className="stat-footer">
                    <small>Measures Alertness / Motor Speed</small>
                  </div>
                </div>
              </>
          )}
        </div>
      </div>
  );
};

export default Results;
