import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowLeft, Loader, X } from 'lucide-react';

const RECENT_EMAILS_KEY = 'joy_recent_emails_v1';
const MAX_RECENT = 4;

function loadRecentEmails(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMAILS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(e => typeof e === 'string').slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

function pushRecentEmail(email: string) {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  try {
    const current = loadRecentEmails().filter(e => e !== normalized);
    current.unshift(normalized);
    localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(current.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function removeRecentEmail(email: string) {
  try {
    const current = loadRecentEmails().filter(e => e !== email);
    localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(current));
  } catch { /* ignore */ }
}

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const registerLink = next ? `/register?next=${encodeURIComponent(next)}` : '/register';
  const { login, resetPassword, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  useEffect(() => { setRecentEmails(loadRecentEmails()); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      clearError();
      await login(email, password);
      pushRecentEmail(email);
      // Redirect happens automatically via GuestRoute
    } catch {
      // error handled by context
    } finally {
      setLoading(false);
    }
  };

  const handlePickRecent = (e: string) => {
    setEmail(e);
    // Focus password field so browser autofill takes over
    setTimeout(() => {
      const pw = document.getElementById('login-password') as HTMLInputElement | null;
      pw?.focus();
    }, 50);
  };

  const handleRemoveRecent = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    removeRecentEmail(value);
    setRecentEmails(loadRecentEmails());
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
          <h1>Entrar</h1>
          <p>Acede à tua área pessoal</p>
        </div>

        <form onSubmit={handleSubmit} name="joy-login" autoComplete="on">
          {error && <div className="alert alert-error">{error}</div>}
          {resetSent && <div className="alert alert-success">Email de recuperação enviado!</div>}

          {recentEmails.length > 0 && (
            <div className="recent-emails">
              <div className="recent-emails-label">Contas usadas neste dispositivo</div>
              <div className="recent-emails-list">
                {recentEmails.map(e => (
                  <button
                    key={e}
                    type="button"
                    className={`recent-chip${email === e ? ' selected' : ''}`}
                    onClick={() => handlePickRecent(e)}
                    title={`Usar ${e}`}
                  >
                    <span className="recent-chip-email">{e}</span>
                    <span
                      className="recent-chip-x"
                      onClick={(ev) => handleRemoveRecent(ev, e)}
                      title="Remover"
                      role="button"
                    ><X size={11} /></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="label" htmlFor="login-email">Email</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                className="input input-with-icon"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@joyoga.pt"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="login-password">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
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

          <p className="register-link">
            Não tens conta? <Link to={registerLink}>Regista-te aqui</Link>
          </p>
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

        .register-link {
          text-align: center;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 1rem;
        }

        .register-link a {
          color: var(--primary);
          font-weight: 500;
        }

        .recent-emails {
          margin-bottom: 1.25rem;
          padding: 0.75rem 0.875rem;
          background: var(--bg-secondary, #faf8f5);
          border: 1px solid var(--sand, #e5dfd4);
          border-radius: var(--radius-md, 10px);
        }
        .recent-emails-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--text-muted, #888);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.5rem;
        }
        .recent-emails-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }
        .recent-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: white;
          border: 1.5px solid var(--sand, #e5dfd4);
          border-radius: 999px;
          padding: 0.3rem 0.5rem 0.3rem 0.7rem;
          font-size: 0.8125rem;
          color: var(--text-primary, #333);
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          max-width: 100%;
        }
        .recent-chip:hover {
          border-color: var(--primary, #7c9a72);
          background: rgba(124,154,114,0.05);
        }
        .recent-chip.selected {
          border-color: var(--primary, #7c9a72);
          background: rgba(124,154,114,0.1);
          color: var(--primary-dark, #5d7855);
          font-weight: 600;
        }
        .recent-chip-email {
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .recent-chip-x {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          color: var(--text-muted, #888);
          cursor: pointer;
        }
        .recent-chip-x:hover { background: rgba(0,0,0,0.07); color: var(--error, #d22); }

        .forgot-link:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
