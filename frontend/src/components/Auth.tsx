import React, { useState } from 'react';
import { loginUser, registerUser } from '../services/api';
import { LogIn, UserPlus } from 'lucide-react';

interface AuthProps {
  onLoginSuccess: () => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await loginUser(email, password);
        onLoginSuccess();
      } else {
        await registerUser({ email, name, password });
        // Auto-login after successful registration
        await loginUser(email, password);
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <h2 className="card-title" style={{ justifyContent: 'center', fontSize: '1.6rem', marginBottom: '8px' }}>
          {isLogin ? 'Welcome Back' : 'Get Started'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
          {isLogin ? 'Enter details to access your preparation dashboard' : 'Create an account to start mock interviews'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            color: 'var(--accent-rose)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (
              <>
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                <span>{isLogin ? 'Log In' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            className="nav-link-btn"
            style={{ fontSize: '0.85rem' }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
}
