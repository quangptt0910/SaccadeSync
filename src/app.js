import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './views/Home';
import Login from './views/Login';
import Results from './views/Results';
import GameTest from "./views/GameTest";
import Instructions from './views/Instructions';
import Index from "./views/Calibration";
import CalibrationInstructions from "./views/CalibrationInstructions";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="results" element={<Results />} />
        <Route path="gameTest" element={<GameTest />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="calibration-intro" element={<CalibrationInstructions />} />
        <Route path="calibration" element={<Index />} />


      </Route>
    </Routes>
  );
}

export default App;
