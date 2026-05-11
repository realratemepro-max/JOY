import React, { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { GiftCard, GiftCardStatus } from '../../types';
import { Gift, Plus, X, Search, Copy, CheckCheck, Send, AlertCircle } from 'lucide-react';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VALE-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const STATUS_LABELS: Record<GiftCardStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Ativo',      color: '#166534', bg: '#dcfce7' },
  used:      { label: 'Usado',      color: '#6b7280', bg: '#f3f4f6' },
  expired:   { label: 'Expirado',   color: '#92400e', bg: '#fef3c7' },
  cancelled: { label: 'Cancelado',  color: '#991b1b', bg: '#fee2e2' },
};

const AMOUNT_PRESETS = [25, 50, 75, 100, 150, 200];

function statusBadge(status: GiftCardStatus) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.cancelled;
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

const empty = {
  amount: 50,
  customAmount: '',
  useCustom: false,
  recipientName: '',
  recipientEmail: '',
  purchaserName: '',
  purchaserEmail: '',
  message: '',
  expiryMonths: 12,
  sendEmail: true,
};

export function AdminGiftCards() {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | GiftCardStatus>('all');
  const [search, setSearch] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<GiftCard | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'giftCards'), orderBy('createdAt', 'desc')));
      setGiftCards(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          expiresAt: data.expiresAt?.toDate(),
          usedAt: data.usedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as GiftCard;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    const amount = form.useCustom ? parseFloat(form.customAmount) : form.amount;
    if (!amount || amount <= 0) { alert('Insere um valor válido.'); return; }
    if (!form.recipientEmail && form.sendEmail) { alert('Email do destinatário é obrigatório para enviar email.'); return; }
    setSaving(true);
    try {
      const code = generateCode();
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + form.expiryMonths);
      await addDoc(collection(db, 'giftCards'), {
        code,
        initialBalance: amount,
        remainingBalance: amount,
        purchaserName: form.purchaserName || 'Admin',
        purchaserEmail: form.purchaserEmail || '',
        recipientName: form.recipientName || '',
        recipientEmail: form.recipientEmail || '',
        message: form.message || '',
        status: 'active',
        createdBy: 'admin',
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      setCreateModal(false);
      setForm(empty);
      await load();
    } catch (err) { console.error(err); alert('Erro ao criar vale.'); }
    finally { setSaving(false); }
  };

  const handleCancel = async (card: GiftCard) => {
    if (!confirm(`Cancelar o vale ${card.code}?`)) return;
    await updateDoc(doc(db, 'giftCards', card.id), { status: 'cancelled', updatedAt: new Date() });
    await load();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const displayed = giftCards
    .filter(c => tab === 'all' || c.status === tab)
    .filter(c => !search || c.code.includes(search.toUpperCase()) || (c.recipientName || '').toLowerCase().includes(search.toLowerCase()) || (c.recipientEmail || '').toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all: giftCards.length,
    active: giftCards.filter(c => c.status === 'active').length,
    used: giftCards.filter(c => c.status === 'used').length,
    expired: giftCards.filter(c => c.status === 'expired').length,
    cancelled: giftCards.filter(c => c.status === 'cancelled').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', margin: 0 }}>Vales Oferta</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>Gerir gift cards e vales de oferta</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
          <Plus size={16} /> Criar Vale
        </button>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tabs-bar">
          {(['all', 'active', 'used', 'expired', 'cancelled'] as const).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'all' ? 'Todos' : STATUS_LABELS[t as GiftCardStatus]?.label} ({counts[t]})
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Pesquisar código ou destinatário..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2rem', fontSize: '0.875rem', height: 36 }} />
        </div>
      </div>

      {/* Cards table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          Nenhum vale encontrado
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sand)', background: 'var(--beige)' }}>
                {['Código', 'Destinatário', 'Valor', 'Saldo', 'Estado', 'Validade', 'Origem', ''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(card => (
                <tr key={card.id} style={{ borderBottom: '1px solid var(--sand)', cursor: 'pointer' }} onClick={() => setDetailCard(card)}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>{card.code}</span>
                      <button onClick={e => { e.stopPropagation(); copyCode(card.code, card.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', color: 'var(--text-muted)' }} title="Copiar">
                        {copiedId === card.id ? <CheckCheck size={13} color="var(--success)" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{card.recipientName || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.recipientEmail || ''}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{card.initialBalance.toFixed(2).replace('.', ',')}€</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ fontWeight: 600, color: card.remainingBalance > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {card.remainingBalance.toFixed(2).replace('.', ',')}€
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>{statusBadge(card.status)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {card.expiresAt?.toLocaleDateString('pt-PT') || '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {card.createdBy === 'admin' ? 'Admin' : 'Online'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {card.status === 'active' && (
                      <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleCancel(card); }} style={{ fontSize: '0.75rem' }}>
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Gift size={18} /> Criar Vale Oferta</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setCreateModal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Amount */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Valor (€)</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {AMOUNT_PRESETS.map(a => (
                    <button key={a} onClick={() => setForm(f => ({ ...f, amount: a, useCustom: false }))}
                      style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${!form.useCustom && form.amount === a ? 'var(--primary)' : 'var(--sand)'}`, borderRadius: 'var(--radius-md)', background: !form.useCustom && form.amount === a ? 'var(--primary)' : 'white', color: !form.useCustom && form.amount === a ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                      {a}€
                    </button>
                  ))}
                  <button onClick={() => setForm(f => ({ ...f, useCustom: true }))}
                    style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${form.useCustom ? 'var(--primary)' : 'var(--sand)'}`, borderRadius: 'var(--radius-md)', background: form.useCustom ? 'var(--primary)' : 'white', color: form.useCustom ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                    Outro
                  </button>
                </div>
                {form.useCustom && (
                  <input className="input" type="number" min="1" step="0.01" placeholder="Valor personalizado" value={form.customAmount} onChange={e => setForm(f => ({ ...f, customAmount: e.target.value }))} />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="label">Nome do Destinatário</label>
                  <input className="input" placeholder="Ex: Maria Silva" value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="label">Email do Destinatário</label>
                  <input className="input" type="email" placeholder="email@exemplo.com" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="label">Nome do Comprador</label>
                  <input className="input" placeholder="Ex: João Santos" value={form.purchaserName} onChange={e => setForm(f => ({ ...f, purchaserName: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="label">Validade</label>
                  <select className="input" value={form.expiryMonths} onChange={e => setForm(f => ({ ...f, expiryMonths: parseInt(e.target.value) }))}>
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                    <option value={24}>24 meses</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Mensagem Pessoal (opcional)</label>
                <textarea className="input" rows={3} placeholder="Uma mensagem especial..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={form.sendEmail} onChange={e => setForm(f => ({ ...f, sendEmail: e.target.checked }))} />
                Enviar email ao destinatário com o código do vale
              </label>

              {form.sendEmail && !form.recipientEmail && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.625rem 0.75rem', background: '#fef3c7', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: '#92400e' }}>
                  <AlertCircle size={14} /> Insere o email do destinatário para enviar o código.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> A criar...</> : <><Gift size={14} /> Criar Vale</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCard && (
        <div className="modal-overlay" onClick={() => setDetailCard(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Gift size={18} /> Vale Oferta</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setDetailCard(null)}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', background: 'var(--beige)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>{detailCard.code}</span>
                {statusBadge(detailCard.status)}
              </div>
              {[
                ['Valor inicial', `${detailCard.initialBalance.toFixed(2).replace('.', ',')}€`],
                ['Saldo restante', `${detailCard.remainingBalance.toFixed(2).replace('.', ',')}€`],
                ['Destinatário', detailCard.recipientName || '—'],
                ['Email dest.', detailCard.recipientEmail || '—'],
                ['Comprador', detailCard.purchaserName || '—'],
                ['Validade', detailCard.expiresAt?.toLocaleDateString('pt-PT') || '—'],
                ['Criado em', detailCard.createdAt?.toLocaleDateString('pt-PT') || '—'],
                ['Origem', detailCard.createdBy === 'admin' ? 'Criado pelo admin' : 'Compra online'],
                detailCard.usedAt ? ['Usado em', detailCard.usedAt.toLocaleDateString('pt-PT')] : null,
              ].filter(Boolean).map((row) => { const [label, value] = row as [string, string]; return (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', borderBottom: '1px solid var(--sand)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ); })}
              {detailCard.message && (
                <div style={{ padding: '0.625rem 0.75rem', background: 'var(--beige)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                  "{detailCard.message}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tabs-bar { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); }
        .tab { background: none; border: none; padding: 0.4rem 0.875rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all 0.15s; white-space: nowrap; }
        .tab.active { background: var(--primary); color: white; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal-content { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); width: 100%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--beige); }
        .modal-header h3 { margin: 0; font-family: var(--font-body); font-size: 1.0625rem; font-weight: 600; }
        .modal-body { padding: 1.25rem 1.5rem; }
        .modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--beige); display: flex; gap: 0.75rem; justify-content: flex-end; }
        @media (max-width: 640px) { table td, table th { padding: 0.625rem 0.5rem !important; font-size: 0.75rem !important; } }
      `}</style>
    </div>
  );
}
