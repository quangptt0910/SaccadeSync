import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './views/Home';
import Login from './views/Login';
import Results from './views/Results';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="results" element={<Results />} />
      </Route>
    </Routes>
  );
}

export default App;
