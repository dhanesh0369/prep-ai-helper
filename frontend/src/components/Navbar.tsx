import React from 'react';
import { User, LogOut, Award, Sun, Moon } from 'lucide-react';
import { removeAuthToken } from '../services/api';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  setView: (view: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
}

export default function Navbar({ user, onLogout, setView, theme, setTheme }: NavbarProps) {
  const handleLogout = () => {
    removeAuthToken();
    onLogout();
  };

  return (
    <nav className="navbar">
      <div className="nav-logo" onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>
        <Award size={24} />
        <span>PrepAI</span>
      </div>
      
      <div className="nav-links">
        {/* Theme Toggle Icon Button */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn btn-secondary"
          style={{ 
            padding: '8px', 
            borderRadius: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            transition: 'all 0.25s ease'
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Green Mode'}
        >
          {theme === 'dark' ? (
            <Sun size={18} style={{ color: 'var(--accent-cyan)' }} />
          ) : (
            <Moon size={18} style={{ color: 'var(--accent-purple)' }} />
          )}
        </button>

        {user && (
          <>
            <button className="nav-link-btn" onClick={() => setView('dashboard')}>Dashboard</button>
            <div className="nav-user">
              <User size={16} />
              <span>{user.name}</span>
            </div>
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
