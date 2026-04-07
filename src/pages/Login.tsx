import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowLeft, Loader } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const { login, resetPassword, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      clearError();
      await login(email, password);
      navigate('/admin');
    } catch {
      // error handled by context
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return;
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      // error handled by context
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button onClick={() => navigate('/')} className="back-link">
          <ArrowLeft size={16} /> Voltar ao site
        </button>

        <div className="login-header">
          <span className="login-logo">JOY</span>
          <h1>Backoffice</h1>
          <p>Acede ao painel de gestão</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {resetSent && <div className="alert alert-success">Email de recuperação enviado!</div>}

          <div className="form-group">
            <label className="label">Email</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                className="input input-with-icon"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@joyoga.pt"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                className="input input-with-icon"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <Loader size={20} className="spinner" style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : 'Entrar'}
          </button>

          <button type="button" onClick={handleReset} className="forgot-link" disabled={!email}>
            Esqueci a password
          </button>
        </form>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          padding: 2rem;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: white;
          border-radius: var(--radius-2xl);
          padding: 2.5rem;
          box-shadow: var(--shadow-xl);
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-bottom: 2rem;
          transition: color var(--transition-fast);
        }

        .back-link:hover {
          color: var(--primary);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-logo {
          font-family: var(--font-heading);
          font-size: 2.5rem;
          font-weight: 600;
          color: var(--primary-dark);
          letter-spacing: 0.1em;
        }

        .login-header h1 {
          font-family: var(--font-body);
          font-size: 1.25rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .login-header p {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .input-icon-wrapper {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .input-with-icon {
          padding-left: 2.75rem;
        }

        .forgot-link {
          display: block;
          width: 100%;
          text-align: center;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 1rem;
          padding: 0.5rem;
          transition: color var(--transition-fast);
        }

        .forgot-link:hover:not(:disabled) {
          color: var(--primary);
        }

        .forgot-link:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
