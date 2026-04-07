import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';

export function PaymentFailed() {
  const [searchParams] = useSearchParams();
  const method = searchParams.get('method');

  return (
    <div className="payment-result-page">
      <div className="result-container">
        <div className="result-icon error"><XCircle size={64} /></div>
        <h1>Pagamento Não Concluído</h1>
        <p className="result-message">
          {method === 'mbway'
            ? 'O pagamento MB WAY não foi concluído. Pode ter sido cancelado ou rejeitado.'
            : 'O pagamento não foi processado com sucesso.'}
        </p>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-xl)', padding: '2rem', marginBottom: '2rem', textAlign: 'left' }}>
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'center' }}>O que fazer?</h3>
          <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
            <li style={{ marginBottom: '0.75rem' }}>Verifica os teus dados e saldo disponível</li>
            <li style={{ marginBottom: '0.75rem' }}>Volta ao site e tenta novamente</li>
            <li>Experimenta outro método de pagamento</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/#servicos" className="btn btn-primary btn-lg"><ArrowLeft size={20} /> Tentar Novamente</Link>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>
          Problemas? Contacta <a href="mailto:joaquim@joyoga.pt">joaquim@joyoga.pt</a>
        </p>
      </div>

      <style>{`
        .payment-result-page { min-height: 100vh; background: var(--bg-secondary); padding: 3rem 1.5rem; display: flex; align-items: center; justify-content: center; }
        .result-container { max-width: 700px; width: 100%; background: white; border-radius: var(--radius-2xl); padding: 3rem; box-shadow: var(--shadow-xl); text-align: center; }
        .result-icon { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; }
        .result-icon.error { background: #fee2e2; color: #dc2626; }
        .result-container h1 { font-size: 2rem; margin-bottom: 1rem; }
        .result-message { font-size: 1.125rem; color: var(--text-secondary); margin-bottom: 2rem; }
        @media (max-width: 768px) { .result-container { padding: 2rem 1.5rem; } }
      `}</style>
    </div>
  );
}
