'use client';
import React, { useContext } from 'react';

export default function DashboardShell({ children }: { children?: React.ReactNode }) {
  // Use generic theme toggle or use a proper context if ThemeProvider exposes one
  const toggleTheme = () => {
    const current = document.documentElement.className;
    document.documentElement.className = current === 'dark' ? 'light' : 'dark';
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">EDUVIA.</div>
        <nav className="nav-links">
          <a href="#" className="nav-link active">Dashboard</a>
          <a href="#" className="nav-link">Students</a>
          <a href="#" className="nav-link">Academics</a>
          <a href="#" className="nav-link">Attendance</a>
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        <header className="header">
          <div className="header-welcome">Welcome, Admin ✨</div>
          <button 
            onClick={toggleTheme}
            className="theme-toggle"
          >
            Toggle Theme
          </button>
        </header>
        
        <main className="content-area">
          {children || (
            <>
              <h2 className="page-title">Overview</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Students</div>
                  <div className="stat-value">1,248</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Average Attendance</div>
                  <div className="stat-value">94.2%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Active Teachers</div>
                  <div className="stat-value">86</div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
