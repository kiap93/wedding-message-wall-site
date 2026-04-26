import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Guest from './pages/Guest';
import Display from './pages/Display';
import TemplateSelector from './pages/TemplateSelector';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/templates" element={<TemplateSelector />} />
        <Route path="/guest" element={<Guest />} />
        <Route path="/display" element={<Display />} />
        <Route path="/" element={<Navigate to="/templates" replace />} />
        <Route path="*" element={<Navigate to="/templates" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
