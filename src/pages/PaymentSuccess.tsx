import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Payment, SiteConfig } from '../types';
import { getSiteConfig, defaultSiteConfig } from '../services/siteConfig';
import { CheckCircle, Loader, ArrowRight, Download, CalendarPlus } from 'lucide-react';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const paymentId = searchParams.get('paymentId');
  const method = searchParams.get('method');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [isPrivatePlan, setIsPrivatePlan] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    loadPayment();
    getSiteConfig().then(setConfig).catch(() => {});
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
      // Check if plan is private
      const pData = paymentDoc.data();
      if (pData.planId) {
        const planDoc = await getDoc(doc(db, 'plans', pData.planId));
        if (planDoc.exists() && planDoc.data().classType === 'private') {
          setIsPrivatePlan(true);
          // Find the purchase created by webhook
          const purchasesSnap = await getDocs(query(collection(db, 'purchases'), where('paymentId', '==', paymentId)));
          if (!purchasesSnap.empty) setPurchaseId(purchasesSnap.docs[0].id);
        }
      }
      // Fire referral processing (non-blocking, only on actual paid payments)
      if (user && data.status === 'Paid') {
        try {
          const fns = getFunctions(undefined, 'europe-west1');
          await (httpsCallable(fns, 'processReferral'))({ referredUserId: user.uid });
        } catch { /* non-blocking */ }
      }
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
        <h1>{config.paymentSuccessTitle || 'Pagamento Confirmado!'}</h1>
        <p className="result-message">
          {config.paymentSuccessSubtitle || (method === 'mbway'
            ? 'O teu pagamento MB WAY foi processado com sucesso.'
            : 'O teu pagamento foi confirmado.')}
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

        {(config.paymentSuccessSteps && config.paymentSuccessSteps.length > 0) && (
          <div className="next-steps">
            <h3>{config.paymentSuccessStepsTitle || 'Próximos Passos'}</h3>
            <ul>
              {config.paymentSuccessSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        )}

        {isPrivatePlan && (
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1.5px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <CalendarPlus size={32} color="#7c3aed" style={{ marginBottom: '0.75rem' }} />
            <h3 style={{ fontFamily: 'var(--font-body)', color: '#6d28d9', marginBottom: '0.5rem' }}>Aula Privada — Agenda a tua data!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
              Indica as tuas preferências de data e horário. Vamos confirmar contigo em breve.
            </p>
            <Link
              to={`/app/booking-request?purchaseId=${purchaseId || ''}&planId=${payment?.planId || ''}`}
              className="btn btn-primary"
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              <CalendarPlus size={18} /> Agendar Agora
            </Link>
          </div>
        )}

        <div className="action-buttons">
          {user ? (
            <Link to={isPrivatePlan ? '/app' : '/app/plan'} className="btn btn-primary btn-lg">
              <ArrowRight size={20} /> {isPrivatePlan ? 'Ir para o Dashboard' : 'Ver o meu plano'}
            </Link>
          ) : (
            <Link to="/" className="btn btn-primary btn-lg"><ArrowRight size={20} /> Voltar ao Início</Link>
          )}
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
