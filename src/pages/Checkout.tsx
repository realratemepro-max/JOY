import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Plan, YogaEvent } from '../types';
import { createMbWayPayment, createMultibancoPayment } from '../services/eupago';
import { validatePromoCode } from '../services/promoCode';
import {
  CreditCard, Smartphone, Building2, ArrowLeft, Loader,
  CheckCircle, AlertCircle, Tag, X
} from 'lucide-react';

type PaymentMethod = 'mbway' | 'multibanco';

export function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const planId = searchParams.get('plan');
  const eventId = searchParams.get('event');
  const purchaseType = searchParams.get('type') || 'subscription'; // subscription, dropin, pack
  const isEvent = !!eventId;

  const [service, setService] = useState<Plan | null>(null);
  const [event, setEvent] = useState<YogaEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client info (for non-logged-in purchases)
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoValid, setPromoValid] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<{
    promoCodeId: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  useEffect(() => {
    if (!planId && !eventId) {
      navigate('/');
      return;
    }
    if (eventId) {
      loadEvent();
    } else {
      loadService();
    }
  }, [planId, eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const eventDoc = await getDoc(doc(db, 'events', eventId!));
      if (!eventDoc.exists()) { setError('Evento não encontrado'); return; }
      const data = eventDoc.data();
      setEvent({ id: eventDoc.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as YogaEvent);
      if (!data.isActive) setError('Este evento não está disponível');
    } catch (err) { console.error(err); setError('Erro ao carregar evento'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (user?.email) setClientEmail(user.email);
    if (user?.displayName) setClientName(user.displayName);
  }, [user]);

  const loadService = async () => {
    try {
      setLoading(true);
      // Try plans collection first, fallback to services for legacy
      let serviceDoc = await getDoc(doc(db, 'plans', planId!));
      if (!serviceDoc.exists()) {
        serviceDoc = await getDoc(doc(db, 'services', planId!));
      }
      if (!serviceDoc.exists()) {
        setError('Plano não encontrado');
        return;
      }
      const data = serviceDoc.data();
      setService({ id: serviceDoc.id, ...data, createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Plan);
      if (!data.isActive) setError('Este plano não está disponível no momento');
    } catch (err) {
      console.error('Error loading plan:', err);
      setError('Erro ao carregar plano');
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePromo = async () => {
    if (!service || !promoCode.trim()) return;
    try {
      setValidatingPromo(true);
      setPromoError(null);
      const checkId = isEvent ? event!.id : service!.id;
      const result = await validatePromoCode({ code: promoCode, planId: checkId, amount: itemPrice });
      if (result.valid) {
        setPromoValid(true);
        setPromoDiscount({
          promoCodeId: result.promoCodeId!,
          discountType: result.discountType!,
          discountValue: result.discountValue!,
          discountAmount: result.discountAmount!,
          finalAmount: result.finalAmount!,
        });
      } else {
        setPromoValid(false);
        setPromoError(result.error || 'Código inválido');
      }
    } catch {
      setPromoError('Erro ao validar código');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoValid(false);
    setPromoDiscount(null);
    setPromoError(null);
  };

  const handlePayment = async () => {
    if ((!service && !event) || !paymentMethod) return;
    if (!clientEmail) { setError('Por favor insere o teu email'); return; }
    if (paymentMethod === 'mbway' && phoneNumber.length < 9) {
      setError('Por favor, insere um número de telefone válido');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      const finalAmount = promoDiscount ? promoDiscount.finalAmount : itemPrice;
      const userId = user?.uid || 'guest_' + Date.now();

      if (paymentMethod === 'mbway') {
        const result = await createMbWayPayment({
          planId: isEvent ? event!.id : service!.id,
          amount: finalAmount,
          phoneNumber,
          userEmail: clientEmail,
          userId,
        });
        if (result.success) {
          navigate(`/payment-success?method=mbway&paymentId=${result.paymentId}`);
        } else {
          setError(result.error || 'Erro ao processar pagamento MB WAY');
        }
      } else {
        const result = await createMultibancoPayment({
          planId: isEvent ? event!.id : service!.id,
          amount: finalAmount,
          userEmail: clientEmail,
          userId,
        });
        if (result.success) {
          navigate(`/payment-multibanco?paymentId=${result.paymentId}`);
        } else {
          setError(result.error || 'Erro ao gerar referência Multibanco');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="checkout-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
          <Loader size={48} className="spinner" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  if (error && !service) {
    return (
      <div className="checkout-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="#dc2626" />
          <h2>Erro</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <Link to="/" className="btn btn-primary">Voltar ao Início</Link>
        </div>
      </div>
    );
  }

  // For events, use event data; for plans, use service data
  const itemName = isEvent ? event?.name : service?.name;
  const itemDesc = isEvent ? event?.description : service?.description;
  const itemFeatures = isEvent ? (event?.features || []) : (service?.features || []);

  // Calculate price based on purchase type
  let itemPrice = 0;
  let itemPriceLabel = '';
  if (isEvent) {
    itemPrice = event?.price || 0;
    itemPriceLabel = `${event?.date?.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })} · ${event?.startTime}-${event?.endTime}`;
  } else if (service) {
    if (purchaseType === 'dropin' && service.allowDropIn && service.dropInPrice) {
      itemPrice = service.dropInPrice;
      itemPriceLabel = `Aula avulsa · ${service.sessionDuration}min`;
    } else if (purchaseType === 'pack' && service.allowPack && service.packPrice) {
      itemPrice = service.packPrice;
      itemPriceLabel = `Pack ${service.packSessions} aulas · ${service.sessionDuration}min`;
    } else {
      itemPrice = service.priceMonthly || (service as any)?.price || 0;
      itemPriceLabel = service.sessionsPerWeek ? `${service.sessionsPerWeek}x/sem · ${service.sessionDuration}min · /mês` : (service as any)?.duration || '';
    }
  }

  if (!service && !event) return null;

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <Link to="/#servicos" className="back-button">
          <ArrowLeft size={18} /> Voltar
        </Link>

        <div className="checkout-layout">
          {/* Service Summary */}
          <div className="plan-summary">
            <h2>Resumo</h2>
            <div className="plan-details">
              <div className="plan-header">
                <h3>{itemName}</h3>
                <p className="plan-description">{itemDesc}</p>
                <div className="plan-price">
                  <span className="amount">{itemPrice.toFixed(2).replace('.', ',')}€</span>
                  <span className="period">{itemPriceLabel}</span>
                </div>
                {isEvent && event?.locationName && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{event.locationName}</p>
                )}
              </div>

              {itemFeatures.length > 0 && (
                <div className="plan-features">
                  <h4>Incluído:</h4>
                  <ul>
                    {itemFeatures.map((f, i) => (
                      <li key={i}><CheckCircle size={16} />{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Promo Code */}
              <div className="promo-code-section">
                {!promoValid ? (
                  <div className="promo-input-group">
                    <input
                      type="text"
                      placeholder="Código promocional"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleValidatePromo()}
                      disabled={validatingPromo}
                    />
                    <button className="btn btn-outline btn-sm" onClick={handleValidatePromo} disabled={!promoCode.trim() || validatingPromo}>
                      {validatingPromo ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><Tag size={16} /> Aplicar</>}
                    </button>
                  </div>
                ) : (
                  <div className="promo-applied">
                    <div className="promo-info"><Tag size={16} /><span>Código <strong>{promoCode}</strong> aplicado!</span></div>
                    <button className="remove-promo" onClick={handleRemovePromo}><X size={16} /></button>
                  </div>
                )}
                {promoError && <p className="promo-error">{promoError}</p>}
              </div>

              {/* Total */}
              <div className="payment-total">
                {promoDiscount && (
                  <>
                    <div className="subtotal-row"><span>Subtotal</span><span>{itemPrice.toFixed(2).replace('.', ',')}€</span></div>
                    <div className="discount-row">
                      <span>Desconto ({promoDiscount.discountType === 'percentage' ? `${promoDiscount.discountValue}%` : `${promoDiscount.discountValue}€`})</span>
                      <span className="discount-amount">-{promoDiscount.discountAmount.toFixed(2).replace('.', ',')}€</span>
                    </div>
                  </>
                )}
                <div className="total-row">
                  <span>Total</span>
                  <span className="total-amount">{(promoDiscount ? promoDiscount.finalAmount : itemPrice).toFixed(2).replace('.', ',')}€</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="payment-section">
            <h2>Dados e Pagamento</h2>

            {error && <div className="alert alert-error"><AlertCircle size={20} /><span>{error}</span></div>}

            {/* Client info */}
            <div className="client-info">
              <div className="form-group">
                <label className="label">Nome</label>
                <input className="input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="O teu nome" required />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@exemplo.pt" required />
              </div>
            </div>

            {/* Payment Methods */}
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Método de Pagamento</h3>
            <div className="payment-methods">
              <button className={`payment-method-card ${paymentMethod === 'mbway' ? 'selected' : ''}`} onClick={() => setPaymentMethod('mbway')} disabled={processing}>
                <div className="method-icon"><Smartphone size={28} /></div>
                <div className="method-info"><h4>MB WAY</h4><p>Pagamento instantâneo via telemóvel</p></div>
                {paymentMethod === 'mbway' && <CheckCircle size={20} className="selected-check" />}
              </button>
              <button className={`payment-method-card ${paymentMethod === 'multibanco' ? 'selected' : ''}`} onClick={() => setPaymentMethod('multibanco')} disabled={processing}>
                <div className="method-icon"><Building2 size={28} /></div>
                <div className="method-info"><h4>Multibanco</h4><p>Referência ATM ou homebanking</p></div>
                {paymentMethod === 'multibanco' && <CheckCircle size={20} className="selected-check" />}
              </button>
            </div>

            {paymentMethod === 'mbway' && (
              <div className="form-group">
                <label className="label">Número de Telemóvel</label>
                <div className="phone-input-wrapper">
                  <span className="country-code">+351</span>
                  <input type="tel" placeholder="912345678" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} maxLength={9} disabled={processing} />
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Vais receber uma notificação no telemóvel para aprovar o pagamento
                </p>
              </div>
            )}

            {paymentMethod === 'multibanco' && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.5rem' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                  Após confirmar, receberás uma referência Multibanco para efetuar o pagamento.
                </p>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg w-full"
              onClick={handlePayment}
              disabled={!paymentMethod || processing || (paymentMethod === 'mbway' && phoneNumber.length < 9) || !clientEmail}
            >
              {processing ? (
                <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> A processar...</>
              ) : (
                <><CreditCard size={20} /> {paymentMethod === 'mbway' ? 'Pagar com MB WAY' : paymentMethod === 'multibanco' ? 'Gerar Referência' : 'Seleciona método'}</>
              )}
            </button>

            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--success)', marginTop: '1rem' }}>
              <CheckCircle size={16} /> Pagamento 100% seguro via EuPago
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .checkout-page { min-height: 100vh; background: var(--bg-secondary); padding: 2rem 1.5rem 4rem; }
        .checkout-container { max-width: 1000px; margin: 0 auto; }
        .back-button { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); text-decoration: none; margin-bottom: 2rem; transition: color var(--transition-fast); }
        .back-button:hover { color: var(--primary); }
        .checkout-layout { display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem; }
        .plan-summary { height: fit-content; position: sticky; top: 2rem; }
        .plan-summary h2, .payment-section h2 { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; }
        .plan-details, .payment-section { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); }
        .plan-header { text-align: center; padding-bottom: 1.5rem; border-bottom: 2px solid var(--beige); margin-bottom: 1.5rem; }
        .plan-header h3 { font-size: 1.5rem; margin: 0 0 0.5rem 0; }
        .plan-description { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem; }
        .plan-price { display: flex; align-items: baseline; justify-content: center; gap: 0.5rem; }
        .plan-price .amount { font-size: 2.5rem; font-weight: 700; font-family: var(--font-heading); }
        .plan-price .period { font-size: 0.875rem; color: var(--text-secondary); }
        .plan-features h4 { font-size: 0.8125rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.75rem; letter-spacing: 0.05em; }
        .plan-features ul { list-style: none; padding: 0; margin: 0 0 1.5rem 0; }
        .plan-features li { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.375rem 0; font-size: 0.9375rem; color: var(--text-primary); }
        .plan-features li svg { color: var(--primary); flex-shrink: 0; margin-top: 2px; }
        .promo-code-section { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--beige); }
        .promo-input-group { display: flex; gap: 0.5rem; }
        .promo-input-group input { flex: 1; padding: 0.625rem 0.875rem; border: 1px solid var(--sand); border-radius: var(--radius-md); font-size: 0.875rem; text-transform: uppercase; }
        .promo-input-group input:focus { outline: none; border-color: var(--primary); }
        .promo-applied { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #dcfce7; border-radius: var(--radius-md); border: 1px solid #bbf7d0; }
        .promo-info { display: flex; align-items: center; gap: 0.5rem; color: #065f46; font-size: 0.875rem; }
        .remove-promo { background: none; border: none; padding: 0.25rem; cursor: pointer; color: #065f46; border-radius: var(--radius-sm); }
        .promo-error { margin-top: 0.5rem; font-size: 0.8125rem; color: #dc2626; }
        .payment-total { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--beige); }
        .subtotal-row, .discount-row, .total-row { display: flex; justify-content: space-between; margin-bottom: 0.75rem; }
        .total-row { margin-bottom: 0; font-size: 1.125rem; font-weight: 600; padding-top: 0.75rem; border-top: 1px solid var(--beige); }
        .subtotal-row, .discount-row { font-size: 0.9375rem; color: var(--text-secondary); }
        .discount-amount { color: #10b981; font-weight: 600; }
        .total-amount { font-size: 1.5rem; color: var(--primary-dark); }
        .client-info { margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--beige); }
        .payment-methods { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .payment-method-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: white; border: 2px solid var(--sand); border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast); text-align: left; width: 100%; }
        .payment-method-card:hover:not(:disabled) { border-color: var(--primary); }
        .payment-method-card.selected { border-color: var(--primary); background: rgba(124, 154, 114, 0.05); }
        .payment-method-card:disabled { opacity: 0.6; cursor: not-allowed; }
        .method-icon { width: 52px; height: 52px; background: var(--beige); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); flex-shrink: 0; }
        .payment-method-card.selected .method-icon { background: var(--primary-gradient); color: white; }
        .method-info { flex: 1; }
        .method-info h4 { font-family: var(--font-body); font-size: 1rem; margin: 0 0 0.125rem 0; font-weight: 600; }
        .method-info p { font-size: 0.8125rem; color: var(--text-secondary); margin: 0; }
        .selected-check { color: var(--primary); }
        .phone-input-wrapper { display: flex; align-items: center; border: 2px solid var(--sand); border-radius: var(--radius-lg); overflow: hidden; transition: border-color var(--transition-fast); }
        .phone-input-wrapper:focus-within { border-color: var(--primary); }
        .country-code { background: var(--beige); padding: 0.75rem 1rem; font-weight: 600; color: var(--text-secondary); font-size: 0.9375rem; }
        .phone-input-wrapper input { flex: 1; border: none; padding: 0.75rem 1rem; font-size: 1rem; outline: none; font-family: var(--font-body); }

        @media (max-width: 768px) {
          .checkout-page { padding: 1.5rem 1rem 2rem; }
          .checkout-layout { grid-template-columns: 1fr; }
          .plan-summary { position: static; }
          .plan-details, .payment-section { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
