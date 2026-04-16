import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Payment } from '../../types';
import { Download } from 'lucide-react';

export function ClientPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadPayments();
  }, [user]);

  const loadPayments = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'payments'), where('userId', '==', user!.uid), orderBy('createdAt', 'desc')));
      setPayments(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate(), paidAt: data.paidAt?.toDate() } as Payment;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          Sem pagamentos registados
        </div>
      ) : (
        <div className="payments-list">
          {payments.map(p => (
            <div key={p.id} className="payment-card">
              <div className="payment-main">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.0625rem', marginBottom: '0.25rem' }}>{p.planName || p.plan || 'Pagamento'}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {p.createdAt.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {p.method && ` · ${p.method}`}
                  </div>
                  {p.locationName && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{p.locationName}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{p.amount.toFixed(2).replace('.', ',')}€</div>
                  <span className={`badge badge-${p.status === 'Paid' ? 'success' : p.status === 'Pending' ? 'warning' : 'error'}`}>
                    {p.status === 'Paid' ? 'Pago' : p.status === 'Pending' ? 'Pendente' : p.status === 'Failed' ? 'Falhado' : p.status}
                  </span>
                </div>
              </div>
              {p.identifier && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--beige)' }}>
                  Ref: {p.identifier}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .payments-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .payment-card { background: white; border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm); }
        .payment-main { display: flex; justify-content: space-between; align-items: flex-start; }
      `}</style>
    </div>
  );
}
