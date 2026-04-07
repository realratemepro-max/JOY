import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Payment } from '../types';
import { CheckCircle, Loader, ArrowRight, Download } from 'lucide-react';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const method = searchParams.get('method');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="payment-result-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Loader size={48} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <p>A verificar pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="payment-result-page">
        <div className="result-container">
          <h1>Erro</h1>
          <p>{error || 'Pagamento não encontrado'}</p>
          <Link to="/" className="btn btn-primary">Voltar ao Início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div className="result-container">
        <div className="result-icon success"><CheckCircle size={64} /></div>
        <h1>Pagamento Confirmado!</h1>
        <p className="result-message">
          {method === 'mbway'
            ? 'O teu pagamento MB WAY foi processado com sucesso.'
            : 'O teu pagamento foi confirmado.'}
        </p>

        <div className="payment-details">
          <h2>Detalhes</h2>
          <div className="details-grid">
            <div className="detail-item"><span className="detail-label">Serviço</span><span className="detail-value">{payment.plan}</span></div>
            <div className="detail-item"><span className="detail-label">Valor</span><span className="detail-value">{payment.amount.toFixed(2).replace('.', ',')}€</span></div>
            <div className="detail-item"><span className="detail-label">Método</span><span className="detail-value">{payment.method}</span></div>
            <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value" style={{ color: 'var(--success)' }}>{payment.status === 'Paid' ? 'Pago' : payment.status}</span></div>
            <div className="detail-item"><span className="detail-label">Data</span><span className="detail-value">{(payment.paidAt || payment.createdAt).toLocaleDateString('pt-PT')}</span></div>
            <div className="detail-item"><span className="detail-label">Referência</span><span className="detail-value">{payment.identifier}</span></div>
          </div>
        </div>

        <div className="next-steps">
          <h3>Próximos Passos</h3>
          <ul>
            <li>O Joaquim entrará em contacto para agendar a tua aula</li>
            <li>Receberás um email de confirmação</li>
            <li>Prepara roupa confortável para a prática</li>
          </ul>
        </div>

        <div className="action-buttons">
          <Link to="/" className="btn btn-primary btn-lg"><ArrowRight size={20} /> Voltar ao Início</Link>
          <button className="btn btn-outline btn-lg" onClick={() => window.print()}><Download size={20} /> Imprimir</button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>
          Dúvidas? <a href="mailto:joaquim@joyoga.pt">joaquim@joyoga.pt</a>
        </p>
      </div>

      <style>{`
        .payment-result-page { min-height: 100vh; background: var(--bg-secondary); padding: 3rem 1.5rem; display: flex; align-items: center; justify-content: center; }
        .result-container { max-width: 700px; width: 100%; background: white; border-radius: var(--radius-2xl); padding: 3rem; box-shadow: var(--shadow-xl); text-align: center; }
        .result-icon { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; }
        .result-icon.success { background: #dcfce7; color: #16a34a; }
        .result-container h1 { font-size: 2rem; margin-bottom: 1rem; }
        .result-message { font-size: 1.125rem; color: var(--text-secondary); margin-bottom: 2rem; }
        .payment-details { background: var(--bg-secondary); border-radius: var(--radius-xl); padding: 2rem; margin-bottom: 2rem; text-align: left; }
        .payment-details h2 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin-bottom: 1.25rem; text-align: center; }
        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        .detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
        .detail-label { font-size: 0.8125rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .detail-value { font-size: 1rem; font-weight: 600; }
        .next-steps { background: var(--bg-secondary); border-radius: var(--radius-xl); padding: 2rem; margin-bottom: 2rem; text-align: left; }
        .next-steps h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; text-align: center; }
        .next-steps ul { list-style: none; padding: 0; margin: 0; }
        .next-steps li { padding: 0.5rem 0; font-size: 0.9375rem; color: var(--text-secondary); }
        .next-steps li::before { content: "\\2713  "; color: var(--primary); font-weight: bold; }
        .action-buttons { display: flex; gap: 1rem; justify-content: center; }

        @media (max-width: 768px) {
          .result-container { padding: 2rem 1.5rem; }
          .details-grid { grid-template-columns: 1fr; }
          .action-buttons { flex-direction: column; }
          .action-buttons .btn { width: 100%; }
        }
        @media print { .action-buttons { display: none; } }
      `}</style>
    </div>
  );
}
