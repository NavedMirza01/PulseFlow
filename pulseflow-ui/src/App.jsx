import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import CommandCenter from './pages/CommandCenter';
import Appointments from './pages/Appointments';
import Triage from './pages/Triage';
import DoctorConsole from './pages/DoctorConsole';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<CommandCenter />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/triage" element={<Triage />} />
            <Route path="/doctor" element={<DoctorConsole />} />
          </Routes>
        </main>
        <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
          PulseFlow Command Center • Built for CODEFESTTHON 2026 Hackathon • Real-Time ER Triage & Automated Bed-Turnover
        </footer>
      </div>
    </BrowserRouter>
  );
}
