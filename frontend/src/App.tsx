import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import InterviewSetup from './components/InterviewSetup';
import InterviewSession from './components/InterviewSession';
import InterviewReport from './components/InterviewReport';
import { fetchCurrentUser, getAuthToken, fetchInterviewReport } from './services/api';
import './App.css';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation states
  const [view, setView] = useState<string>('dashboard');
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    // Remove light theme class if dark is active
    document.body.classList.remove('theme-light');
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Interview runtime states
  const [activeInterview, setActiveInterview] = useState<any | null>(null);
  const [reportData, setReportData] = useState<any | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await fetchCurrentUser();
      setUser(data);
    } catch (err) {
      console.error("Session check failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    checkAuth();
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Loading Session...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <Navbar user={user} onLogout={handleLogout} setView={setView} theme={theme} setTheme={setTheme} />
      
      {!user ? (
        <Auth onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          {view === 'dashboard' && (
            <Dashboard
              onStartInterview={(resumeId) => {
                setSelectedResumeId(resumeId);
                setView('setup');
              }}
              onViewReport={async (id) => {
                try {
                  const data = await fetchInterviewReport(id);
                  setReportData(data);
                  setView('report');
                } catch (err) {
                  console.error(err);
                }
              }}
            />
          )}
          
          {view === 'setup' && (
            <InterviewSetup
              resumeId={selectedResumeId}
              onBack={() => setView('dashboard')}
              onInterviewStarted={(id, questions, type, difficulty, timeLimit) => {
                setActiveInterview({ id, questions, type, difficulty, timeLimit });
                setView('session');
              }}
            />
          )}
          
          {view === 'session' && activeInterview && (
            <InterviewSession
              interviewId={activeInterview.id}
              questions={activeInterview.questions}
              type={activeInterview.type}
              difficulty={activeInterview.difficulty}
              timeLimit={activeInterview.timeLimit}
              onInterviewCompleted={(evalData) => {
                setReportData(evalData);
                setView('report');
              }}
            />
          )}
          
          {view === 'report' && reportData && (
            <InterviewReport
              reportData={reportData}
              onBack={() => setView('dashboard')}
            />
          )}
        </>
      )}
    </div>
  );
}
