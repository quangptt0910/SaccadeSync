import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './views/Home';
import Login from './views/Login';
import Results from './views/Results';
import GameTest from "./views/GameTest";
import Instructions from './views/Instructions';
import Calibration from "./views/Calibration/Calibration";
import CalibrationIntro from "./views/CalibrationIntro";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="results" element={<Results />} />
        <Route path="gameTest" element={<GameTest />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="calibration-intro" element={<CalibrationIntro />} />
        <Route path="calibration" element={<Calibration />} />


      </Route>
    </Routes>
  );
}

export default App;
