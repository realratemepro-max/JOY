import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Payment } from '../types';
import { Building2, Loader, Copy, Check, Clock, AlertCircle, Info } from 'lucide-react';

export function PaymentMultibanco() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedEntity, setCopiedEntity] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    loadPayment();
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const paymentDoc = await getDoc(doc(db, 'payments', paymentId!));
      if (!paymentDoc.exists()) { setError('Pagamento não encontrado'); return; }
      const data = paymentDoc.data();
      setPayment({
        id: paymentDoc.id, ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        paidAt: data.paidAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Payment);
    } catch { setError('Erro ao carregar pagamento'); }
    finally { setLoading(false); }
  };

  const copyToClipboard = (text: string, type: 'entity' | 'ref') => {
    navigator.clipboard.writeText(text);
    if (type === 'entity') { setCopiedEntity(true); setTimeout(() => setCopiedEntity(false), 2000); }
    else { setCopiedRef(true); setTimeout(() => setCopiedRef(false), 2000); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Loader size={48} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <p>A carregar referência...</p>
        </div>
      </div>
    );
  }

  if (error || !payment || !payment.entity || !payment.reference) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} color="#dc2626" />
          <h2>Erro</h2>
          <p>{error || 'Referência não encontrada'}</p>
          <Link to="/" className="btn btn-primary">Voltar</Link>
        </div>
      </div>
    );
  }

  const daysLeft = payment.expiresAt
    ? Math.ceil((payment.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 7;

  return (
    <div className="mb-page">
      <div className="mb-container">
        <div className="mb-header">
          <div className="mb-icon"><Building2 size={48} /></div>
          <h1>Referência Multibanco</h1>
          <p>Usa os dados abaixo para efetuar o pagamento</p>
        </div>

        {payment.status === 'Paid' && (
          <div className="alert alert-success" style={{ marginBottom: '2rem' }}>
            <Check size={20} /> Pagamento confirmado!
            <Link to="/" style={{ marginLeft: 'auto', fontWeight: 600 }}>Voltar ao início</Link>
          </div>
        )}

        <div className="ref-card">
          <h2>Dados de Pagamento</h2>
          <div className="ref-item">
            <span className="ref-label"><Building2 size={16} /> Entidade</span>
            <div className="ref-value">
              <span className="ref-number">{payment.entity}</span>
              <button className="copy-btn" onClick={() => copyToClipboard(payment.entity!, 'entity')}>
                {copiedEntity ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div className="ref-item">
            <span className="ref-label"><Copy size={16} /> Referência</span>
            <div className="ref-value">
              <span className="ref-number">{payment.reference}</span>
              <button className="copy-btn" onClick={() => copyToClipboard(payment.reference!, 'ref')}>
                {copiedRef ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div className="ref-item">
            <span className="ref-label"><Building2 size={16} /> Montante</span>
            <div className="ref-value"><span className="ref-number" style={{ color: 'var(--primary-dark)' }}>{payment.amount.toFixed(2).replace('.', ',')}€</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef3c7', padding: '0.875rem', borderRadius: 'var(--radius-md)', marginTop: '1.5rem', fontSize: '0.9375rem', color: '#92400e' }}>
            <Clock size={16} />
            <span>Válido por <strong>{daysLeft} dias</strong>{payment.expiresAt && <> (até {payment.expiresAt.toLocaleDateString('pt-PT')})</>}</span>
          </div>
        </div>

        <div className="instructions">
          <h2>Como Pagar</h2>
          <div className="instructions-grid">
            <div>
              <h3>ATM</h3>
              <ol>
                <li>Pagamentos e Outros Serviços</li>
                <li>Pagamento de Serviços</li>
                <li>Entidade: <strong>{payment.entity}</strong></li>
                <li>Referência: <strong>{payment.reference}</strong></li>
                <li>Montante: <strong>{payment.amount.toFixed(2).replace('.', ',')}€</strong></li>
              </ol>
            </div>
            <div>
              <h3>Homebanking</h3>
              <ol>
                <li>Pagamentos</li>
                <li>Pagamento de Serviços</li>
                <li>Entidade: <strong>{payment.entity}</strong></li>
                <li>Referência: <strong>{payment.reference}</strong></li>
                <li>Montante: <strong>{payment.amount.toFixed(2).replace('.', ',')}€</strong></li>
              </ol>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', background: '#dbeafe', borderLeft: '4px solid #3b82f6', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem' }}>
          <Info size={20} style={{ color: '#1e40af', flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', color: '#1e3a8a' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#1e40af' }}>Informação</p>
            <p style={{ margin: 0 }}>O pagamento é confirmado automaticamente. Receberás email de confirmação.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary btn-lg">Voltar ao Início</Link>
          <button className="btn btn-outline btn-lg" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      <style>{`
        .mb-page { min-height: 100vh; background: var(--bg-secondary); padding: 3rem 1.5rem; }
        .mb-container { max-width: 800px; margin: 0 auto; }
        .mb-header { text-align: center; margin-bottom: 2rem; }
        .mb-icon { width: 96px; height: 96px; background: var(--primary-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 1.5rem; }
        .mb-header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .mb-header p { color: var(--text-secondary); font-size: 1.125rem; }
        .ref-card, .instructions { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 2rem; }
        .ref-card h2, .instructions h2 { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; text-align: center; }
        .ref-item { margin-bottom: 1.5rem; }
        .ref-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .ref-value { display: flex; align-items: center; gap: 1rem; }
        .ref-number { flex: 1; font-size: 1.75rem; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 0.05em; }
        .copy-btn { width: 40px; height: 40px; background: var(--beige); border: none; border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition-fast); }
        .copy-btn:hover { background: var(--primary); color: white; }
        .instructions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .instructions h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
        .instructions ol { padding-left: 1.25rem; }
        .instructions li { margin-bottom: 0.5rem; font-size: 0.9375rem; color: var(--text-secondary); }
        .instructions strong { color: var(--text-primary); }

        @media (max-width: 768px) {
          .ref-number { font-size: 1.25rem; }
          .instructions-grid { grid-template-columns: 1fr; }
        }
        @media print { .mb-page { padding: 2rem; } }
      `}</style>
    </div>
  );
}
