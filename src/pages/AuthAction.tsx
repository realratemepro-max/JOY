import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth';
import { Eye, EyeOff, CheckCircle, XCircle, Loader } from 'lucide-react';

export function AuthAction() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode') || '';

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const auth = getAuth();
    if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, oobCode)
        .then(e => { setEmail(e); setStatus('ready'); })
        .catch(() => { setErrorMsg('Este link expirou ou já foi utilizado.'); setStatus('error'); });
    } else if (mode === 'verifyEmail') {
      applyActionCode(auth, oobCode)
        .then(() => setStatus('success'))
        .catch(() => { setErrorMsg('Link de verificação inválido ou expirado.'); setStatus('error'); });
    } else {
      setErrorMsg('Ação desconhecida.'); setStatus('error');
    }
  }, [mode, oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setErrorMsg('A password deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { setErrorMsg('As passwords não coincidem.'); return; }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await confirmPasswordReset(getAuth(), oobCode, password);
      setStatus('success');
    } catch {
      setErrorMsg('Erro ao definir a password. Tenta gerar um novo link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: '2.5rem', width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 600, color: 'var(--accent-dark)', letterSpacing: '0.12em' }}>JOY</div>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', marginTop: 2 }}>Joaquim Oliveira Yoga</div>
        </div>

        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
            <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <p>A verificar link...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <XCircle size={48} color="var(--error)" />
            <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Link inválido</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>{errorMsg}</p>
            <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/login')}>Ir para o login</button>
          </div>
        )}

        {status === 'success' && mode === 'resetPassword' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <CheckCircle size={48} color="var(--success)" />
            <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Password definida!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>Já podes entrar no teu portal.</p>
            <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => navigate('/login')}>Ir para o login</button>
          </div>
        )}

        {status === 'success' && mode === 'verifyEmail' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <CheckCircle size={48} color="var(--success)" />
            <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Email verificado!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>A tua conta está ativa.</p>
            <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => navigate('/login')}>Ir para o login</button>
          </div>
        )}

        {status === 'ready' && mode === 'resetPassword' && (
          <form onSubmit={handleReset} style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1.25rem', marginBottom: '0.25rem' }}>Define a tua password</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Para a conta <strong>{email}</strong></p>

            <div className="form-group">
              <label className="label">Nova password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  style={{ paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Confirmar password</label>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repete a password"
              />
            </div>

            {errorMsg && <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{errorMsg}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting || !password || !confirm} style={{ width: '100%', marginTop: '0.5rem' }}>
              {submitting ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Guardar password'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
