import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Smartphone, Building2, CheckCircle, AlertCircle, Loader, Calendar, Clock, MapPin, User } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  billingType: 'subscription' | 'dropin';
  priceMonthly: number;
  pricePerSession: number;
  sessionsTotal: number;
}

interface TokenInfo {
  status: 'pending' | 'awaiting_confirmation' | 'paid' | 'expired';
  studentName?: string;
  sessionDate?: string;
  sessionStartTime?: string;
  locationName?: string;
  professorName?: string;
  plans?: Plan[];
  paidVia?: string;
  expiresAt?: string;
}

type Method = 'mbway' | 'multibanco';

export function PayWithToken() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<TokenInfo | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [method, setMethod] = useState<Method>('mbway');
  const [phone, setPhone] = useState('');
  const [nif, setNif] = useState('');
  const [consumidorFinal, setConsumidorFinal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; entity?: string; reference?: string; amount?: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'getPaymentTokenInfo');
        const res: any = await fn({ token });
        setInfo(res.data);
        const plans = res.data?.plans || [];
        const dropin = plans.find((p: Plan) => p.billingType === 'dropin');
        setSelectedPlanId((dropin || plans[0])?.id || '');
      } catch (err: any) {
        setError(err?.message || 'Link inválido');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const selectedPlan = info?.plans?.find(p => p.id === selectedPlanId);
  const price = selectedPlan
    ? (selectedPlan.billingType === 'dropin' ? selectedPlan.pricePerSession : selectedPlan.priceMonthly)
    : 0;

  const submit = async () => {
    if (!selectedPlanId) return;
    if (method === 'mbway' && (!phone || phone.length < 9)) {
      setResult({ ok: false, msg: 'Telefone MB Way obrigatório (9 dígitos).' });
      return;
    }
    const trimmedNif = nif.trim().replace(/\s/g, '');
    if (!consumidorFinal && !/^\d{9}$/.test(trimmedNif)) {
      setResult({ ok: false, msg: 'Indica o teu NIF (9 dígitos) ou marca "Sou consumidor final".' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'processTokenPayment');
      const res: any = await fn({ token, planId: selectedPlanId, method, phone, nif: consumidorFinal ? '' : trimmedNif, consumidorFinal });
      if (method === 'mbway') {
        setResult({ ok: true, msg: `Pedido MB Way enviado para ${phone}. Tens 2 minutos para aceitar no telemóvel.` });
      } else {
        setResult({ ok: true, msg: 'Referência Multibanco gerada — paga em qualquer ATM ou homebanking.', entity: res.data.entity, reference: res.data.reference, amount: res.data.amount });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message || 'Erro a processar pagamento.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pwt-page">
        <div className="pwt-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={36} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>A carregar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pwt-page">
        <div className="pwt-card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <AlertCircle size={48} color="#dc2626" style={{ marginBottom: '1rem' }} />
            <h2>Link inválido</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        </div>
        <style>{pwtStyles}</style>
      </div>
    );
  }

  if (info?.status === 'expired') {
    return (
      <div className="pwt-page">
        <div className="pwt-card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
            <h2>Link expirado</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Pede ao estúdio para te enviar um novo link.</p>
          </div>
        </div>
        <style>{pwtStyles}</style>
      </div>
    );
  }

  if (info?.status === 'paid') {
    return (
      <div className="pwt-page">
        <div className="pwt-card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
            <h2>Já pago ✓</h2>
            <p style={{ color: 'var(--text-secondary)' }}>A tua aula está confirmada. Até já!</p>
          </div>
        </div>
        <style>{pwtStyles}</style>
      </div>
    );
  }

  const sessionDate = info?.sessionDate ? new Date(info.sessionDate) : null;

  return (
    <div className="pwt-page">
      <div className="pwt-card">
        <div className="pwt-header">
          <div className="pwt-logo">JOY</div>
          <h2>Pagar a tua aula</h2>
          {info?.studentName && <p className="pwt-subtitle">Olá {info.studentName.split(' ')[0]} 👋</p>}
        </div>

        {sessionDate && (
          <div className="pwt-session">
            <div className="pwt-row"><Calendar size={15} /> {sessionDate.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
            <div className="pwt-row"><Clock size={15} /> {info?.sessionStartTime}</div>
            <div className="pwt-row"><MapPin size={15} /> {info?.locationName}</div>
            {info?.professorName && <div className="pwt-row"><User size={15} /> {info.professorName}</div>}
          </div>
        )}

        {!result && (
          <>
            <div className="pwt-section">
              <label className="pwt-label">Escolhe o plano</label>
              <div className="pwt-plans">
                {(info?.plans || []).map(p => {
                  const planPrice = p.billingType === 'dropin' ? p.pricePerSession : p.priceMonthly;
                  return (
                    <label key={p.id} className={`pwt-plan ${selectedPlanId === p.id ? 'selected' : ''}`}>
                      <input type="radio" name="plan" checked={selectedPlanId === p.id} onChange={() => setSelectedPlanId(p.id)} />
                      <div style={{ flex: 1 }}>
                        <div className="pwt-plan-name">{p.name}</div>
                        <div className="pwt-plan-sub">
                          {p.billingType === 'dropin' ? 'Aula avulsa' : `${p.sessionsTotal} aulas`} · <strong>{planPrice.toFixed(2)}€</strong>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pwt-section">
              <label className="pwt-label">Método de pagamento</label>
              <div className="pwt-methods">
                <button className={`pwt-method ${method === 'mbway' ? 'selected' : ''}`} onClick={() => setMethod('mbway')}>
                  <Smartphone size={20} /> MB Way
                </button>
                <button className={`pwt-method ${method === 'multibanco' ? 'selected' : ''}`} onClick={() => setMethod('multibanco')}>
                  <Building2 size={20} /> Multibanco
                </button>
              </div>
            </div>

            {method === 'mbway' && (
              <div className="pwt-section">
                <label className="pwt-label">O teu telefone</label>
                <input className="pwt-input" type="tel" inputMode="numeric" placeholder="9XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} />
                <span className="pwt-hint">Vais receber um pedido no telemóvel. Tens 2 minutos para aceitar.</span>
              </div>
            )}

            <div className="pwt-section">
              <label className="pwt-label">NIF (para fatura)</label>
              <input
                className="pwt-input"
                type="text"
                inputMode="numeric"
                maxLength={9}
                placeholder="9 dígitos"
                value={nif}
                onChange={e => setNif(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={consumidorFinal}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={consumidorFinal} onChange={e => setConsumidorFinal(e.target.checked)} />
                Sou consumidor final (dispensa NIF)
              </label>
            </div>

            <button className="pwt-submit" onClick={submit} disabled={submitting || !selectedPlanId}>
              {submitting ? <Loader size={18} className="spinner" /> : `Pagar ${price.toFixed(2)}€`}
            </button>
          </>
        )}

        {result && (
          <div className={`pwt-result ${result.ok ? 'ok' : 'err'}`}>
            {result.ok ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
            <p>{result.msg}</p>
            {result.entity && result.reference && (
              <div className="pwt-mb-ref">
                <div><span>Entidade</span><strong>{result.entity}</strong></div>
                <div><span>Referência</span><strong>{result.reference}</strong></div>
                <div><span>Valor</span><strong>{result.amount?.toFixed(2)}€</strong></div>
              </div>
            )}
            {result.ok && method === 'mbway' && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                Depois de confirmares no telemóvel, a tua aula fica garantida. Podes fechar esta página.
              </p>
            )}
            {result.ok && method === 'multibanco' && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                Guarda estes dados ou tira print. Tens 72 horas para pagar em qualquer ATM ou homebanking.
              </p>
            )}
            {!result.ok && (
              <button className="pwt-submit" style={{ marginTop: '1rem' }} onClick={() => setResult(null)}>Tentar de novo</button>
            )}
          </div>
        )}
      </div>

      <style>{pwtStyles}</style>
    </div>
  );
}

const pwtStyles = `
  .pwt-page { min-height: 100vh; background: var(--bg-secondary, #faf8f5); display: flex; align-items: center; justify-content: center; padding: 1.5rem 1rem; }
  .pwt-card { background: white; border-radius: 20px; width: 100%; max-width: 480px; padding: 2rem 1.75rem; box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
  .pwt-header { text-align: center; margin-bottom: 1.5rem; }
  .pwt-logo { font-family: var(--font-heading, Georgia, serif); font-size: 2rem; font-weight: 700; color: var(--primary, #7c9a72); letter-spacing: 0.08em; }
  .pwt-header h2 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 500; color: var(--text-secondary); margin: 0.25rem 0 0; }
  .pwt-subtitle { color: var(--text-muted); font-size: 0.9375rem; margin: 0.375rem 0 0; }
  .pwt-session { background: var(--bg-secondary, #faf8f5); border-radius: 14px; padding: 0.875rem 1rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.375rem; }
  .pwt-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; color: var(--text-primary); text-transform: capitalize; }
  .pwt-row svg { color: var(--primary, #7c9a72); flex-shrink: 0; }
  .pwt-section { margin-bottom: 1.25rem; }
  .pwt-label { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 0.5rem; }
  .pwt-plans { display: flex; flex-direction: column; gap: 0.5rem; }
  .pwt-plan { display: flex; align-items: center; gap: 0.625rem; padding: 0.75rem 0.875rem; border: 2px solid var(--sand, #e5dfd4); border-radius: 12px; cursor: pointer; background: white; }
  .pwt-plan:hover { border-color: var(--primary, #7c9a72); }
  .pwt-plan.selected { border-color: var(--primary, #7c9a72); background: rgba(124,154,114,0.06); }
  .pwt-plan-name { font-weight: 600; font-size: 0.9375rem; }
  .pwt-plan-sub { font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.125rem; }
  .pwt-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
  .pwt-method { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.375rem; padding: 1rem; background: white; border: 2px solid var(--sand, #e5dfd4); border-radius: 12px; cursor: pointer; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); font-family: inherit; transition: all 0.15s; }
  .pwt-method:hover { border-color: var(--primary, #7c9a72); }
  .pwt-method.selected { border-color: var(--primary, #7c9a72); background: rgba(124,154,114,0.06); color: var(--primary-dark, #5d7855); }
  .pwt-method svg { color: var(--primary, #7c9a72); }
  .pwt-input { width: 100%; padding: 0.75rem 0.875rem; border: 2px solid var(--sand, #e5dfd4); border-radius: 10px; font-family: inherit; font-size: 1rem; }
  .pwt-input:focus { outline: none; border-color: var(--primary, #7c9a72); }
  .pwt-hint { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.375rem; }
  .pwt-submit { width: 100%; background: var(--primary, #7c9a72); color: white; border: none; border-radius: 12px; padding: 0.875rem; font-size: 1rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .pwt-submit:hover:not(:disabled) { background: var(--primary-dark, #5d7855); }
  .pwt-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .pwt-result { text-align: center; padding: 1rem 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  .pwt-result.ok svg { color: #10b981; }
  .pwt-result.err svg { color: #dc2626; }
  .pwt-result p { margin: 0.25rem 0 0; font-size: 0.9375rem; color: var(--text-primary); }
  .pwt-mb-ref { background: var(--bg-secondary, #faf8f5); border-radius: 12px; padding: 0.875rem; margin-top: 1rem; width: 100%; display: flex; flex-direction: column; gap: 0.375rem; }
  .pwt-mb-ref > div { display: flex; justify-content: space-between; align-items: center; font-family: monospace; }
  .pwt-mb-ref span { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .pwt-mb-ref strong { font-size: 1rem; }
`;
