import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Plan, Location } from '../../types';
import { MapPin, Calendar, Clock, Check, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';

interface Purchase {
  id: string; planId: string; planName: string; locationName: string;
  sessionsTotal: number; sessionsUsed: number; sessionsRemaining: number;
  priceMonthly: number; status: string; startDate: Date; endDate: Date;
  billingType?: 'subscription' | 'dropin';
}

export function ClientPlan() {
  const { user } = useAuth();
  const [activePurchases, setActivePurchases] = useState<Purchase[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    try {
      // Load active purchases (plans + drop-ins)
      const purchasesSnap = await getDocs(query(collection(db, 'purchases'), where('userId', '==', user!.uid), where('status', '==', 'active')));
      const now = new Date();
      const active = purchasesSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, startDate: data.startDate?.toDate(), endDate: data.endDate?.toDate() } as Purchase;
      }).filter(p => p.endDate >= now);
      // Sort: subscriptions first, then drop-ins; within each, by endDate ascending
      active.sort((a, b) => {
        const aDrop = a.billingType === 'dropin' ? 1 : 0;
        const bDrop = b.billingType === 'dropin' ? 1 : 0;
        if (aDrop !== bDrop) return aDrop - bDrop;
        return a.endDate.getTime() - b.endDate.getTime();
      });
      setActivePurchases(active);

      // Load available plans
      const [plansSnap, locsSnap] = await Promise.all([
        getDocs(query(collection(db, 'plans'), where('isActive', '==', true), orderBy('order'))),
        getDocs(query(collection(db, 'locations'), where('isActive', '==', true), orderBy('order'))),
      ]);
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const subscriptionPurchases = activePurchases.filter(p => p.billingType !== 'dropin');
  const dropinPurchases = activePurchases.filter(p => p.billingType === 'dropin');

  return (
    <div>
      {/* Subscription plans */}
      {subscriptionPurchases.map(p => {
        const daysLeft = Math.max(0, Math.ceil((p.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        return (
          <div key={p.id} className="plan-card">
            <div className="plan-header">
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontFamily: 'var(--font-heading)', fontSize: '1.75rem' }}>{p.planName}</h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}><MapPin size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> {p.locationName}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{p.priceMonthly?.toFixed(0)}€</div>
              </div>
            </div>
            <div className="plan-stats">
              <div className="stat">
                <span className="stat-value">{p.sessionsUsed}/{p.sessionsTotal}</span>
                <span className="stat-label">aulas usadas</span>
              </div>
              <div className="stat">
                <span className="stat-value">{p.sessionsRemaining}</span>
                <span className="stat-label">restantes</span>
              </div>
              <div className="stat">
                <span className="stat-value">{daysLeft}d</span>
                <span className="stat-label">para expirar</span>
              </div>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.8125rem', opacity: 0.8 }}>
              <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {p.startDate.toLocaleDateString('pt-PT')} → {p.endDate.toLocaleDateString('pt-PT')}
            </div>
          </div>
        );
      })}

      {/* Drop-in cards */}
      {dropinPurchases.length > 0 && (
        <div className="dropins-section">
          <h3 className="dropins-title">Aulas avulsas</h3>
          <div className="dropins-grid">
            {dropinPurchases.map(p => {
              const used = p.sessionsRemaining === 0;
              return (
                <div key={p.id} className={`dropin-card ${used ? 'dropin-used' : ''}`}>
                  <div className="dropin-card-top">
                    <span className="dropin-badge">{used ? 'Marcada' : 'Por usar'}</span>
                    <span className="dropin-amount">{p.priceMonthly?.toFixed(0)}€</span>
                  </div>
                  <p className="dropin-name">{p.planName}</p>
                  {p.locationName && <p className="dropin-location"><MapPin size={12} /> {p.locationName}</p>}
                  <p className="dropin-expiry">Válida até {p.endDate.toLocaleDateString('pt-PT')}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No plan + no drop-in */}
      {activePurchases.length === 0 && (
        <div className="no-plan-card">
          <AlertCircle size={40} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '1.25rem', margin: '0.75rem 0 0.25rem' }}>Sem plano ativo</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>Escolhe um plano abaixo para começar a praticar.</p>
        </div>
      )}

      {/* Available Plans */}
      <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.125rem', fontWeight: 600, margin: '2rem 0 1rem', color: 'var(--text-primary)' }}>
        {activePurchases.length > 0 ? 'Renovar ou mudar de plano' : 'Planos disponíveis'}
      </h3>

      <div className="plans-grid">
        {plans.map(plan => {
          const loc = locations.find(l => l.id === plan.locationId);
          const price = plan.billingType === 'dropin' ? plan.pricePerSession : plan.priceMonthly;
          const priceLabel = plan.billingType === 'dropin' ? '/aula' : `/${(plan as any).validityDays || 30} dias`;
          return (
            <div key={plan.id} className={`plan-option ${plan.isPopular ? 'popular' : ''}`}>
              {plan.isPopular && <span className="popular-badge">Mais Popular</span>}
              <h4>{plan.name}</h4>
              {loc && <span className="plan-location"><MapPin size={12} /> {loc.name}</span>}
              <div className="plan-price">
                <span className="price-value">{price?.toFixed(0)}€</span>
                <span className="price-label">{priceLabel}</span>
              </div>
              <p className="plan-desc">{plan.description}</p>
              {plan.features && plan.features.length > 0 && (
                <ul className="plan-features">
                  {plan.features.map((f, i) => <li key={i}><Check size={14} /> {f}</li>)}
                </ul>
              )}
              <Link to={`/checkout?plan=${plan.id}&type=${plan.billingType === 'dropin' ? 'dropin' : 'subscription'}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {plan.billingType === 'dropin' ? 'Comprar Aula' : 'Comprar Plano'} <ArrowRight size={16} />
              </Link>
            </div>
          );
        })}
      </div>

      <style>{`
        .plan-card { background: var(--primary-gradient); color: white; border-radius: var(--radius-xl); padding: 2rem; margin-bottom: 1rem; }
        .plan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .plan-stats { display: flex; gap: 2rem; }
        .stat { display: flex; flex-direction: column; }
        .stat-value { font-size: 1.25rem; font-weight: 700; }
        .stat-label { font-size: 0.75rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; }

        .no-plan-card { text-align: center; padding: 2.5rem; background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); margin-bottom: 1rem; }

        .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .plan-option { background: white; border-radius: var(--radius-xl); padding: 1.75rem; box-shadow: var(--shadow-sm); border: 2px solid transparent; transition: all var(--transition-fast); position: relative; display: flex; flex-direction: column; }
        .plan-option:hover { box-shadow: var(--shadow-md); border-color: var(--primary-light); }
        .plan-option.popular { border-color: var(--primary); }
        .popular-badge { position: absolute; top: -10px; right: 1rem; background: var(--primary); color: white; font-size: 0.6875rem; font-weight: 600; padding: 0.2rem 0.75rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; }
        .plan-option h4 { margin: 0 0 0.25rem; font-family: var(--font-body); font-size: 1.125rem; }
        .plan-location { font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.75rem; }
        .plan-price { margin-bottom: 0.75rem; }
        .price-value { font-size: 2rem; font-weight: 700; font-family: var(--font-heading); color: var(--primary-dark); }
        .price-label { font-size: 0.875rem; color: var(--text-muted); margin-left: 0.25rem; }
        .plan-desc { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1rem; flex: 1; }
        .plan-features { list-style: none; padding: 0; margin: 0 0 1.25rem; }
        .plan-features li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; padding: 0.25rem 0; color: var(--text-secondary); }
        .plan-features li svg { color: var(--primary); flex-shrink: 0; }

        /* Drop-ins */
        .dropins-section { margin: 1.25rem 0 0.5rem; }
        .dropins-title { font-family: var(--font-body); font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.625rem; }
        .dropins-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
        .dropin-card { background: white; border-radius: var(--radius-lg); padding: 1rem 1.125rem; box-shadow: var(--shadow-sm); border-left: 4px solid var(--accent); }
        .dropin-card.dropin-used { opacity: 0.7; border-left-color: var(--text-muted); }
        .dropin-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .dropin-badge { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #92400e; background: #fef3c7; padding: 0.2rem 0.5rem; border-radius: 999px; }
        .dropin-card.dropin-used .dropin-badge { background: var(--bg-secondary); color: var(--text-muted); }
        .dropin-amount { font-weight: 700; font-family: var(--font-heading); color: var(--text-heading); }
        .dropin-name { margin: 0.125rem 0; font-weight: 600; font-size: 0.9375rem; }
        .dropin-location { margin: 0; font-size: 0.8125rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.25rem; }
        .dropin-expiry { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--text-muted); }

        @media (max-width: 768px) {
          .plan-header { flex-direction: column; gap: 1rem; }
          .plan-stats { flex-wrap: wrap; }
          .plans-grid { grid-template-columns: 1fr; }
          .dropins-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
