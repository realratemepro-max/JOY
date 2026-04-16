import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Phone, ArrowLeft, Loader } from 'lucide-react';

export function Register() {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('As passwords não coincidem.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A password deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      clearError();
      await register(email, password, name, phone || undefined);
      navigate('/app');
    } catch {
      // error handled by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <button onClick={() => navigate('/')} className="back-link">
          <ArrowLeft size={16} /> Voltar ao site
        </button>

        <div className="register-header">
          <span className="register-logo">JOY</span>
          <h1>Criar Conta</h1>
          <p>Regista-te para reservar aulas e gerir o teu plano</p>
        </div>

        <form onSubmit={handleSubmit}>
          {(error || localError) && <div className="alert alert-error">{localError || error}</div>}

          <div className="form-group">
            <label className="label">Nome Completo</label>
            <div className="input-icon-wrapper">
              <User size={18} className="input-icon" />
              <input type="text" className="input input-with-icon" value={name} onChange={e => setName(e.target.value)} placeholder="O teu nome" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Email</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input type="email" className="input input-with-icon" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.pt" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Telefone <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
            <div className="input-icon-wrapper">
              <Phone size={18} className="input-icon" />
              <input type="tel" className="input input-with-icon" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351 912 345 678" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input type="password" className="input input-with-icon" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Confirmar Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input type="password" className="input input-with-icon" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repete a password" required />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Criar Conta'}
          </button>

          <p className="login-link">
            Já tens conta? <Link to="/login">Entra aqui</Link>
          </p>
        </form>
      </div>

      <style>{`
        .register-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); padding: 2rem; }
        .register-card { width: 100%; max-width: 460px; background: white; border-radius: var(--radius-2xl); padding: 2.5rem; box-shadow: var(--shadow-xl); }
        .back-link { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: var(--text-secondary); background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 2rem; transition: color var(--transition-fast); }
        .back-link:hover { color: var(--primary); }
        .register-header { text-align: center; margin-bottom: 2rem; }
        .register-logo { font-family: var(--font-heading); font-size: 2.5rem; font-weight: 600; color: var(--primary-dark); letter-spacing: 0.1em; }
        .register-header h1 { font-family: var(--font-body); font-size: 1.25rem; font-weight: 500; color: var(--text-secondary); margin-top: 0.25rem; }
        .register-header p { font-size: 0.875rem; color: var(--text-muted); }
        .input-icon-wrapper { position: relative; }
        .input-icon { position: absolute; left: 0.875rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .input-with-icon { padding-left: 2.75rem; }
        .login-link { text-align: center; font-size: 0.875rem; color: var(--text-secondary); margin-top: 1.5rem; }
        .login-link a { color: var(--primary); font-weight: 500; }
      `}</style>
    </div>
  );
}
