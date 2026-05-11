import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { createMbWayPayment, createMultibancoPayment } from '../services/eupago';
import { Gift, ArrowLeft, Smartphone, Building2, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const AMOUNT_PRESETS = [25, 50, 75, 100, 150, 200];

type Step = 'details' | 'payment' | 'done';
type PayMethod = 'mbway' | 'multibanco';

export function BuyGiftCard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');

  // Gift card details
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');

  // Payment
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalAmount = useCustom ? parseFloat(customAmount) || 0 : amount;

  const handleProceedToPayment = () => {
    if (!finalAmount || finalAmount < 5) { setError('Valor mínimo: 5€'); return; }
    if (!purchaserEmail) { setError('O teu email é obrigatório'); return; }
    if (!recipientEmail) { setError('O email do destinatário é obrigatório'); return; }
    setError(null);
    setStep('payment');
  };

  const handlePay = async () => {
    if (!payMethod) { setError('Escolhe o método de pagamento'); return; }
    if (payMethod === 'mbway' && phone.length < 9) { setError('Insere um número de telefone válido'); return; }
    setProcessing(true);
    setError(null);
    try {
      const userId = `gift_${Date.now()}`;
      const giftMetadata = { recipientName, recipientEmail, purchaserName, giftMessage: message };

      if (payMethod === 'mbway') {
        const result = await createMbWayPayment({
          planId: 'gift_card',
          planName: `Vale Oferta ${finalAmount}€`,
          amount: finalAmount,
          phoneNumber: phone,
          userEmail: purchaserEmail,
          userId,
          type: 'gift_card' as any,
        });
        if (result.success && result.paymentId) {
          await updateDoc(doc(db, 'payments', result.paymentId), giftMetadata);
          navigate(`/payment-success?method=mbway&paymentId=${result.paymentId}&gift=1`);
        } else {
          setError(result.error || 'Erro ao processar MB WAY');
        }
      } else {
        const result = await createMultibancoPayment({
          planId: 'gift_card',
          planName: `Vale Oferta ${finalAmount}€`,
          amount: finalAmount,
          userEmail: purchaserEmail,
          userId,
          type: 'gift_card' as any,
        });
        if (result.success && result.paymentId) {
          await updateDoc(doc(db, 'payments', result.paymentId), giftMetadata);
          navigate(`/payment-multibanco?paymentId=${result.paymentId}&gift=1`);
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--beige)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Voltar ao início
        </Link>

        <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'var(--primary-gradient)', padding: '2rem', textAlign: 'center', color: 'white' }}>
            <Gift size={40} style={{ marginBottom: '0.75rem', opacity: 0.9 }} />
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', margin: '0 0 0.5rem' }}>Vale Oferta</h1>
            <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9375rem' }}>Oferece bem-estar a quem mais gostas</p>
          </div>

          <div style={{ padding: '2rem' }}>
            {step === 'details' && (
              <>
                {/* Amount */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Valor do Vale</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
                    {AMOUNT_PRESETS.map(a => (
                      <button key={a} onClick={() => { setAmount(a); setUseCustom(false); }}
                        style={{ padding: '0.5rem 1rem', border: `2px solid ${!useCustom && amount === a ? 'var(--primary)' : 'var(--sand)'}`, borderRadius: 'var(--radius-md)', background: !useCustom && amount === a ? 'var(--primary)' : 'white', color: !useCustom && amount === a ? 'white' : 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                        {a}€
                      </button>
                    ))}
                    <button onClick={() => setUseCustom(true)}
                      style={{ padding: '0.5rem 1rem', border: `2px solid ${useCustom ? 'var(--primary)' : 'var(--sand)'}`, borderRadius: 'var(--radius-md)', background: useCustom ? 'var(--primary)' : 'white', color: useCustom ? 'white' : 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                      Outro
                    </button>
                  </div>
                  {useCustom && (
                    <input style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '1.125rem', fontWeight: 600 }}
                      type="number" min="5" step="0.01" placeholder="Valor em €" value={customAmount} onChange={e => setCustomAmount(e.target.value)} />
                  )}
                </div>

                {/* Purchaser */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Os teus dados</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <input style={{ padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem' }}
                      placeholder="O teu nome" value={purchaserName} onChange={e => setPurchaserName(e.target.value)} />
                    <input style={{ padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem' }}
                      type="email" placeholder="O teu email *" value={purchaserEmail} onChange={e => setPurchaserEmail(e.target.value)} />
                  </div>
                </div>

                {/* Recipient */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Para quem é o vale</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <input style={{ padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem' }}
                      placeholder="Nome do destinatário" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                    <input style={{ padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem' }}
                      type="email" placeholder="Email do destinatário *" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                  </div>
                  <textarea style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', resize: 'vertical', fontFamily: 'inherit' }}
                    rows={3} placeholder="Mensagem pessoal (opcional)" value={message} onChange={e => setMessage(e.target.value)} />
                </div>

                {error && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', background: '#fee2e2', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                <button onClick={handleProceedToPayment} style={{ width: '100%', padding: '0.875rem', background: 'var(--primary-gradient)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                  Continuar — {finalAmount > 0 ? `${finalAmount.toFixed(2).replace('.', ',')}€` : '—'}
                </button>
              </>
            )}

            {step === 'payment' && (
              <>
                <button onClick={() => setStep('details')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem', padding: 0, marginBottom: '1.25rem' }}>
                  <ArrowLeft size={14} /> Editar detalhes
                </button>

                {/* Summary */}
                <div style={{ background: 'var(--beige)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Vale Oferta de {finalAmount.toFixed(2).replace('.', ',')}€</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Para: {recipientName || recipientEmail}</div>
                </div>

                {/* Method */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.75rem' }}>Método de pagamento</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { method: 'mbway' as const, icon: Smartphone, label: 'MB WAY', desc: 'Pagamento imediato via app' },
                      { method: 'multibanco' as const, icon: Building2, label: 'Multibanco', desc: 'Referência válida por 3 dias' },
                    ].map(({ method, icon: Icon, label, desc }) => (
                      <button key={method} onClick={() => setPayMethod(method)}
                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', border: `2px solid ${payMethod === method ? 'var(--primary)' : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: payMethod === method ? 'rgba(124,154,114,0.06)' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                        <Icon size={22} color={payMethod === method ? 'var(--primary)' : 'var(--text-muted)'} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {payMethod === 'mbway' && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Número de telemóvel</label>
                    <input style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '1rem' }}
                      type="tel" placeholder="9XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} maxLength={9} />
                  </div>
                )}

                {error && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', background: '#fee2e2', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                <button onClick={handlePay} disabled={processing || !payMethod}
                  style={{ width: '100%', padding: '0.875rem', background: processing || !payMethod ? '#ccc' : 'var(--primary-gradient)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '1rem', cursor: processing || !payMethod ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {processing ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> A processar...</> : `Pagar ${finalAmount.toFixed(2).replace('.', ',')}€`}
                </button>
              </>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          O destinatário receberá o código por email assim que o pagamento for confirmado.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
