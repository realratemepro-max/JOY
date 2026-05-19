import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Plan, Session } from '../types';
import { X, Smartphone, Building2, Banknote, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from './ToastProvider';

interface Props {
  session: Session;
  student: { userId: string; userName: string; userEmail?: string; userPhone?: string };
  onClose: () => void;
  onSuccess?: () => void;
  /** Restrict available methods (e.g. professor without canRequestOnlinePayment hides online methods) */
  allowMethods?: Array<'mbway' | 'multibanco' | 'cash'>;
}

type Method = 'mbway' | 'multibanco' | 'cash';

export function RequestStudentPaymentModal({ session, student, onClose, onSuccess, allowMethods = ['mbway', 'multibanco', 'cash'] }: Props) {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [method, setMethod] = useState<Method>(allowMethods[0]);
  const [phone, setPhone] = useState(student.userPhone || '');
  const [cashAmount, setCashAmount] = useState('');
  const [nif, setNif] = useState('');
  const [consumidorFinal, setConsumidorFinal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; msg: string; entity?: string; reference?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [plansSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, 'plans'), orderBy('order'))),
          getDoc(doc(db, 'users', student.userId)).catch(() => null),
        ]);
        const all = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan));
        const relevant = all.filter(p =>
          p.isActive !== false &&
          !(p as any).isContentPlan &&
          (!p.locationId || p.locationId === session.locationId)
        );
        setPlans(relevant);
        const dropin = relevant.find(p => p.billingType === 'dropin');
        setSelectedPlanId((dropin || relevant[0])?.id || '');
        // Pre-fill NIF / consumidorFinal from student's user doc
        if (userSnap && userSnap.exists()) {
          const u = userSnap.data();
          if (u.nif) setNif(u.nif);
          if (u.consumidorFinal) setConsumidorFinal(true);
        }
      } finally { setLoading(false); }
    })();
  }, [session.locationId, student.userId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const planPrice = selectedPlan
    ? (selectedPlan.billingType === 'dropin'
        ? Number(selectedPlan.pricePerSession || selectedPlan.priceMonthly || 0)
        : Number(selectedPlan.priceMonthly || 0))
    : 0;

  const submit = async () => {
    if (!selectedPlan) { toast.error('Escolhe um plano'); return; }
    if (method === 'mbway' && !phone) { toast.error('Telefone obrigatório para MB Way'); return; }

    setSubmitting(true);
    setResult(null);
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'requestStudentPayment');
      const trimmedNif = nif.trim().replace(/\s/g, '');
      const res: any = await fn({
        studentId: student.userId,
        studentEmail: student.userEmail || '',
        studentName: student.userName,
        studentPhone: phone,
        sessionId: session.id,
        planId: selectedPlan.id,
        method,
        cashAmount: method === 'cash' ? Number(cashAmount || planPrice) : undefined,
        nif: consumidorFinal ? '' : trimmedNif,
        consumidorFinal,
      });
      const data = res.data || {};
      if (method === 'mbway') {
        setResult({ kind: 'ok', msg: `Pedido MB Way enviado para ${phone}. O aluno tem 2 minutos para aceitar no telemóvel.` });
      } else if (method === 'multibanco') {
        setResult({ kind: 'ok', msg: 'Referência Multibanco gerada.', entity: data.entity, reference: data.reference });
      } else {
        setResult({ kind: 'ok', msg: `Pagamento em numerário registado (${data.amount?.toFixed(2)}€).` });
        if (onSuccess) onSuccess();
        setTimeout(() => onClose(), 1500);
      }
    } catch (err: any) {
      setResult({ kind: 'err', msg: err?.message || 'Erro ao processar pagamento' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rspm-overlay" onClick={onClose}>
      <div className="rspm-modal" onClick={e => e.stopPropagation()}>
        <div className="rspm-header">
          <div>
            <h3>Pedir pagamento</h3>
            <p>{student.userName} · {session.date?.toLocaleDateString?.('pt-PT')} {session.startTime}</p>
          </div>
          <button className="rspm-close" onClick={onClose}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}><Loader size={24} className="spinner" /></div>
        ) : (
          <div className="rspm-body">
            {/* Product selection */}
            <div className="rspm-section">
              <label className="rspm-label">Produto</label>
              <div className="rspm-options">
                {plans.map(p => {
                  const price = p.billingType === 'dropin'
                    ? Number(p.pricePerSession || p.priceMonthly || 0)
                    : Number(p.priceMonthly || 0);
                  const sessions = p.billingType === 'dropin' ? 1 : (p.sessionsTotal || Math.ceil(((p as any).sessionsPerWeek || 1) * 4.33));
                  return (
                    <label key={p.id} className={`rspm-option ${selectedPlanId === p.id ? 'selected' : ''}`}>
                      <input type="radio" name="plan" checked={selectedPlanId === p.id} onChange={() => setSelectedPlanId(p.id)} />
                      <div style={{ flex: 1 }}>
                        <div className="rspm-option-title">{p.name}</div>
                        <div className="rspm-option-sub">
                          {p.billingType === 'dropin' ? 'Aula avulsa' : `${sessions} aulas`} · <strong>{price.toFixed(2)}€</strong>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Method selection */}
            <div className="rspm-section">
              <label className="rspm-label">Método</label>
              <div className="rspm-methods">
                {allowMethods.includes('mbway') && (
                  <button type="button" className={`rspm-method ${method === 'mbway' ? 'selected' : ''}`} onClick={() => setMethod('mbway')}>
                    <Smartphone size={18} /> MB Way
                  </button>
                )}
                {allowMethods.includes('multibanco') && (
                  <button type="button" className={`rspm-method ${method === 'multibanco' ? 'selected' : ''}`} onClick={() => setMethod('multibanco')}>
                    <Building2 size={18} /> Multibanco
                  </button>
                )}
                {allowMethods.includes('cash') && (
                  <button type="button" className={`rspm-method ${method === 'cash' ? 'selected' : ''}`} onClick={() => setMethod('cash')}>
                    <Banknote size={18} /> Numerário
                  </button>
                )}
              </div>
            </div>

            {method === 'mbway' && (
              <div className="rspm-section">
                <label className="rspm-label">Telefone do aluno</label>
                <input className="rspm-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9XX XXX XXX" />
                <span className="rspm-hint">Aluno recebe notificação MB Way e tem 2 min para aceitar.</span>
              </div>
            )}

            {method === 'cash' && (
              <div className="rspm-section">
                <label className="rspm-label">Valor recebido (€)</label>
                <input className="rspm-input" type="number" step="0.01" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder={planPrice.toFixed(2)} />
                <span className="rspm-hint">Deixa vazio para usar o preço do plano ({planPrice.toFixed(2)}€).</span>
              </div>
            )}

            <div className="rspm-section">
              <label className="rspm-label">NIF (fatura)</label>
              <input className="rspm-input" type="text" inputMode="numeric" maxLength={9} placeholder="9 dígitos" value={nif} onChange={e => setNif(e.target.value.replace(/[^0-9]/g, ''))} disabled={consumidorFinal} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={consumidorFinal} onChange={e => setConsumidorFinal(e.target.checked)} />
                Consumidor final (dispensa NIF)
              </label>
            </div>

            {result && result.kind === 'ok' && (
              <div className="rspm-alert rspm-alert-ok">
                <CheckCircle size={18} />
                <div>
                  <div>{result.msg}</div>
                  {result.entity && result.reference && (
                    <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      Entidade: <strong>{result.entity}</strong><br />
                      Referência: <strong>{result.reference}</strong><br />
                      Valor: <strong>{planPrice.toFixed(2)}€</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result && result.kind === 'err' && (
              <div className="rspm-alert rspm-alert-err">
                <AlertCircle size={18} /> {result.msg}
              </div>
            )}
          </div>
        )}

        {!loading && !result && (
          <div className="rspm-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit} disabled={submitting || !selectedPlanId}>
              {submitting ? <Loader size={16} className="spinner" /> : 'Enviar pedido'}
            </button>
          </div>
        )}

        {result && result.kind === 'ok' && method !== 'cash' && (
          <div className="rspm-footer">
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        )}

        <style>{`
          .rspm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
          .rspm-modal { background: white; border-radius: 18px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
          .rspm-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.5rem 0.75rem; border-bottom: 1px solid var(--beige, #f5f0ea); }
          .rspm-header h3 { margin: 0; font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; }
          .rspm-header p { margin: 0.25rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }
          .rspm-close { background: none; border: none; cursor: pointer; padding: 0.25rem; color: var(--text-muted); }
          .rspm-body { padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
          .rspm-section { display: flex; flex-direction: column; gap: 0.5rem; }
          .rspm-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
          .rspm-options { display: flex; flex-direction: column; gap: 0.375rem; }
          .rspm-option { display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.875rem; background: var(--bg-secondary); border: 1.5px solid transparent; border-radius: 10px; cursor: pointer; }
          .rspm-option:hover { border-color: var(--sand); }
          .rspm-option.selected { border-color: var(--primary); background: rgba(124,154,114,0.06); }
          .rspm-option-title { font-weight: 600; font-size: 0.9375rem; }
          .rspm-option-sub { font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.125rem; }
          .rspm-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
          .rspm-method { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.625rem; background: white; border: 1.5px solid var(--sand); border-radius: 10px; cursor: pointer; font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); transition: all 0.15s; font-family: inherit; }
          .rspm-method:hover { border-color: var(--primary); }
          .rspm-method.selected { border-color: var(--primary); background: rgba(124,154,114,0.08); color: var(--primary-dark); }
          .rspm-input { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid var(--sand); border-radius: 8px; font-family: inherit; font-size: 0.9375rem; }
          .rspm-hint { font-size: 0.75rem; color: var(--text-muted); }
          .rspm-alert { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem 0.875rem; border-radius: 10px; font-size: 0.875rem; line-height: 1.4; }
          .rspm-alert-ok { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
          .rspm-alert-err { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .rspm-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem 1.25rem; border-top: 1px solid var(--beige); }
        `}</style>
      </div>
    </div>
  );
}
