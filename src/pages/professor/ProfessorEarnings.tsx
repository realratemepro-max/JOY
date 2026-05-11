import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { SessionEarning } from '../../services/earningsCalc';
import { ProfessorPayment } from '../../types';
import { TrendingUp, Download, Calendar, Euro, Users, Clock, ChevronDown, ChevronRight, CreditCard, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';

function isoToday(): string { return new Date().toISOString().slice(0, 10); }
function isoFirstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function toCSV(rows: SessionEarning[]): string {
  const header = ['Data', 'Hora', 'Local', 'Alunos Presentes', 'Ganho Bruto (€)', 'Custo Espaço (€)', 'Líquido (€)', 'Discriminação'];
  const lines = rows.map(r => [
    r.session.date.toLocaleDateString('pt-PT'),
    r.session.startTime,
    r.session.locationName,
    r.attendedStudents.length,
    r.gross.toFixed(2),
    r.spaceCost.toFixed(2),
    r.net.toFixed(2),
    r.attendedStudents.map(s => `${s.userName}: ${s.justification}`).join(' | '),
  ]);
  return [header, ...lines].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

export function ProfessorEarnings() {
  const { professorData } = useAuth();
  const toast = useToast();
  const [from, setFrom] = useState(isoFirstOfMonth());
  const [to, setTo] = useState(isoToday());
  const [rows, setRows] = useState<SessionEarning[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<ProfessorPayment[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (professorData) {
      load();
      loadPayments();
    }
  }, [professorData, from, to]);

  const loadPayments = async () => {
    if (!professorData) return;
    try {
      const snap = await getDocs(query(collection(db, 'professorPayments'), where('professorId', '==', professorData.id)));
      const list: ProfessorPayment[] = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          periodFrom: data.periodFrom?.toDate?.() || new Date(data.periodFrom),
          periodTo: data.periodTo?.toDate?.() || new Date(data.periodTo),
          paidAt: data.paidAt?.toDate?.() || new Date(data.paidAt),
          confirmedAt: data.confirmedAt?.toDate?.() || (data.confirmedAt ? new Date(data.confirmedAt) : null),
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        };
      });
      list.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
      setPayments(list);
    } catch (err) {
      console.error('loadPayments failed', err);
    }
  };

  const confirmPayment = async (id: string) => {
    setConfirmingId(id);
    try {
      await updateDoc(doc(db, 'professorPayments', id), {
        status: 'confirmed',
        confirmedAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success('Pagamento confirmado. Obrigado!');
      await loadPayments();
    } catch (err: any) {
      toast.error('Erro ao confirmar: ' + (err?.message || ''));
    } finally {
      setConfirmingId(null);
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'pending_confirmation');

  const load = async () => {
    if (!professorData) return;
    setLoading(true);
    try {
      const fns = getFunctions(undefined, 'europe-west1');
      const callable = httpsCallable(fns, 'getProfessorEarnings');
      const res: any = await callable({ from, to });
      const raw = (res.data?.rows || []) as any[];
      const computed: SessionEarning[] = raw.map(r => ({
        ...r,
        session: { ...r.session, date: new Date(r.session.date) },
      })) as SessionEarning[];
      setRows(computed);
    } catch (err) {
      console.error('getProfessorEarnings failed', err);
      setRows([]);
    } finally { setLoading(false); }
  };

  const totalGross = rows.reduce((a, r) => a + r.gross, 0);
  const totalSpaceCost = rows.reduce((a, r) => a + r.spaceCost, 0);
  const totalNet = rows.reduce((a, r) => a + r.net, 0);
  const totalStudents = rows.reduce((a, r) => a + r.attendedStudents.length, 0);
  const totalSessions = rows.filter(r => r.attendedStudents.length > 0).length;

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const csv = toCSV(rows);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ganhos_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!professorData) return null;

  return (
    <div>
      <div className="pe-header">
        <div>
          <h2 className="pe-title"><TrendingUp size={20} color="var(--accent)" /> Relatório de Ganhos</h2>
          <p className="pe-subtitle">
            Cálculo: ganhas o que cada aluno presente pagou pela aula{professorData.deductSpaceCost ? ', menos o custo do espaço' : ''}.
          </p>
        </div>
        <button className="btn btn-outline" onClick={handleExport} disabled={rows.length === 0}>
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {pendingPayments.length > 0 && (
        <div className="pe-pending-payments">
          <div className="pe-pending-header">
            <AlertCircle size={18} color="#92400e" />
            <strong>Pagamentos por confirmar</strong>
            <span style={{ fontSize: '0.8125rem', color: '#92400e' }}>O estúdio registou os pagamentos abaixo. Confirma o recebimento.</span>
          </div>
          {pendingPayments.map(p => (
            <div key={p.id} className="pe-pending-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#92400e' }}>
                  {p.amount.toFixed(2)}€
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                  Pago em {p.paidAt.toLocaleDateString('pt-PT')} · {p.paymentMethod === 'transfer' ? 'Transferência' : p.paymentMethod === 'mbway' ? 'MB Way' : p.paymentMethod === 'cash' ? 'Numerário' : 'Outro'}
                  {p.notes ? ` · ${p.notes}` : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                  Período: {p.periodFrom.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => confirmPayment(p.id)}
                disabled={confirmingId === p.id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}
              >
                {confirmingId === p.id ? 'A confirmar...' : <><Check size={14} /> Confirmar recebimento</>}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pe-filters">
        <label className="pe-filter-group">
          <span>De</span>
          <input type="date" className="pe-date-input" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="pe-filter-group">
          <span>Até</span>
          <input type="date" className="pe-date-input" value={to} onChange={e => setTo(e.target.value)} />
        </label>
      </div>

      <div className="pe-summary">
        {[
          { label: 'Aulas com presenças', value: totalSessions, icon: <Calendar size={18} />, color: 'var(--primary)' },
          { label: 'Alunos presentes', value: totalStudents, icon: <Users size={18} />, color: 'var(--accent)' },
          { label: 'Ganho bruto', value: `${totalGross.toFixed(2)}€`, icon: <Euro size={18} />, color: '#059669' },
          ...(totalSpaceCost > 0 ? [{ label: 'Custo espaços', value: `-${totalSpaceCost.toFixed(2)}€`, icon: <Clock size={18} />, color: '#dc2626' }] : []),
          { label: 'Líquido', value: `${totalNet.toFixed(2)}€`, icon: <TrendingUp size={18} />, color: '#1e40af', big: true },
        ].map(card => (
          <div key={card.label} className={`pe-card${(card as any).big ? ' pe-card-accent' : ''}`}>
            <div className="pe-card-icon" style={{ color: card.color }}>{card.icon}</div>
            <div className="pe-card-value" style={{ color: card.color }}>{card.value}</div>
            <div className="pe-card-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="pe-table-wrap">
        {loading ? (
          <div className="pe-loading"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="pe-empty">
            <TrendingUp size={32} color="var(--text-muted)" />
            <p>Nenhuma aula encontrada neste período.</p>
          </div>
        ) : (
          <table className="pe-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Data</th>
                <th>Hora</th>
                <th>Local</th>
                <th>Presentes</th>
                <th>Bruto</th>
                {totalSpaceCost > 0 && <th>Espaço</th>}
                <th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isExpanded = expanded.has(r.session.id);
                const noStudents = r.attendedStudents.length === 0;
                return (
                  <React.Fragment key={r.session.id}>
                    <tr style={{ cursor: noStudents ? 'default' : 'pointer', opacity: noStudents ? 0.5 : 1 }}
                        onClick={() => !noStudents && toggleRow(r.session.id)}>
                      <td>{!noStudents && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}</td>
                      <td>{r.session.date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td>{r.session.startTime}</td>
                      <td>{r.session.locationName}</td>
                      <td>{r.attendedStudents.length}</td>
                      <td className="pe-amount">{r.gross.toFixed(2)}€</td>
                      {totalSpaceCost > 0 && <td className="pe-amount-neg">{r.spaceCost > 0 ? `-${r.spaceCost.toFixed(2)}€` : '—'}</td>}
                      <td className="pe-amount pe-net">{r.net.toFixed(2)}€</td>
                    </tr>
                    {isExpanded && r.attendedStudents.length > 0 && (
                      <tr className="pe-detail-row">
                        <td></td>
                        <td colSpan={6 + (totalSpaceCost > 0 ? 1 : 0)} style={{ padding: 0 }}>
                          <div className="pe-detail-content">
                            <table className="pe-inner-table">
                              <thead>
                                <tr>
                                  <th>Aluno</th>
                                  <th>Origem</th>
                                  <th>Cálculo</th>
                                  <th>Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.attendedStudents.map(s => (
                                  <tr key={s.userId}>
                                    <td>{s.userName}</td>
                                    <td><span className={`pe-source pe-source-${s.source}`}>{s.source === 'dropin' ? 'Aula avulsa' : s.source === 'subscription' ? 'Plano' : s.source === 'cash' ? 'Em mão' : 'Sem registo'}</span></td>
                                    <td className="pe-justify">{s.justification}</td>
                                    <td className="pe-amount-sm">{s.amount.toFixed(2)}€</td>
                                  </tr>
                                ))}
                                <tr className="pe-inner-total">
                                  <td colSpan={3} style={{ textAlign: 'right' }}>Subtotal alunos:</td>
                                  <td className="pe-amount-sm">{r.gross.toFixed(2)}€</td>
                                </tr>
                                {r.spaceCost > 0 && (
                                  <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Custo espaço:</td>
                                    <td className="pe-amount-neg-sm">−{r.spaceCost.toFixed(2)}€</td>
                                  </tr>
                                )}
                                <tr className="pe-inner-net">
                                  <td colSpan={3} style={{ textAlign: 'right' }}><strong>Recebes:</strong></td>
                                  <td className="pe-amount pe-net"><strong>{r.net.toFixed(2)}€</strong></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td colSpan={4} className="pe-total-label">Total</td>
                <td className="pe-amount">{totalGross.toFixed(2)}€</td>
                {totalSpaceCost > 0 && <td className="pe-amount-neg">−{totalSpaceCost.toFixed(2)}€</td>}
                <td className="pe-amount pe-net">{totalNet.toFixed(2)}€</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {payments.length > 0 && (
        <div className="pe-history">
          <h3 className="pe-history-title"><CreditCard size={16} /> Histórico de pagamentos do estúdio</h3>
          <table className="pe-history-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Período</th>
                <th>Método</th>
                <th>Notas</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>{p.paidAt.toLocaleDateString('pt-PT')}</td>
                  <td>{p.periodFrom.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</td>
                  <td>{p.paymentMethod === 'transfer' ? 'Transferência' : p.paymentMethod === 'mbway' ? 'MB Way' : p.paymentMethod === 'cash' ? 'Numerário' : 'Outro'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{p.notes || '—'}</td>
                  <td>
                    {p.status === 'confirmed' ? (
                      <span className="pe-pay-badge pe-pay-confirmed"><Check size={11} /> Confirmado{p.confirmedAt ? ` ${p.confirmedAt.toLocaleDateString('pt-PT')}` : ''}</span>
                    ) : (
                      <span className="pe-pay-badge pe-pay-pending"><AlertCircle size={11} /> Por confirmar</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>{p.amount.toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .pe-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .pe-title { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin: 0 0 0.25rem; display: flex; align-items: center; gap: 0.5rem; }
        .pe-subtitle { font-size: 0.875rem; color: var(--text-secondary); margin: 0; max-width: 540px; line-height: 1.4; }

        .pe-filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; background: white; border-radius: var(--radius-xl); padding: 1rem 1.25rem; box-shadow: var(--shadow-sm); align-items: flex-end; }
        .pe-filter-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .pe-filter-group span { font-size: 0.8125rem; color: var(--text-muted); font-weight: 500; }
        .pe-date-input { border: 1.5px solid var(--sand); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: 0.9375rem; font-family: var(--font-body); color: var(--text-primary); background: white; outline: none; }
        .pe-date-input:focus { border-color: var(--accent); }

        .pe-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .pe-card { background: white; border-radius: var(--radius-xl); padding: 1.25rem; box-shadow: var(--shadow-sm); text-align: center; }
        .pe-card-accent { background: #eff6ff; border: 1.5px solid #bfdbfe; }
        .pe-card-icon { margin-bottom: 0.375rem; display: flex; justify-content: center; }
        .pe-card-value { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); line-height: 1; margin-bottom: 0.25rem; }
        .pe-card-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

        .pe-table-wrap { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); overflow: hidden; }
        .pe-loading { display: flex; justify-content: center; padding: 3rem; }
        .pe-empty { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem; color: var(--text-muted); }

        .pe-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .pe-table th { text-align: left; padding: 0.875rem 1rem; background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--sand); white-space: nowrap; }
        .pe-table td { padding: 0.875rem 1rem; border-bottom: 1px solid var(--beige); vertical-align: middle; }
        .pe-table tbody tr:hover:not(.pe-detail-row) td { background: var(--bg-secondary); }
        .pe-table tfoot td { padding: 0.875rem 1rem; font-weight: 700; font-size: 0.9rem; background: var(--bg-secondary); border-top: 2px solid var(--sand); }
        .pe-total-label { color: var(--text-secondary); }
        .pe-amount { font-weight: 600; color: #059669; white-space: nowrap; }
        .pe-amount-neg { font-weight: 600; color: #dc2626; white-space: nowrap; }
        .pe-net { color: #1d4ed8 !important; }

        .pe-detail-row td { padding: 0; background: var(--bg-secondary); border-bottom: 1px solid var(--beige); }
        .pe-detail-content { padding: 0.75rem 1rem; }
        .pe-inner-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; background: white; border-radius: var(--radius-md); overflow: hidden; }
        .pe-inner-table th { background: var(--beige); padding: 0.5rem 0.75rem; font-size: 0.6875rem; }
        .pe-inner-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--beige); }
        .pe-inner-table tr:last-child td { border-bottom: none; }
        .pe-inner-total td { font-weight: 600; background: var(--bg-secondary); }
        .pe-inner-net td { background: #eff6ff; }

        .pe-justify { font-size: 0.75rem; color: var(--text-secondary); font-family: monospace; }
        .pe-amount-sm { font-weight: 600; color: #059669; white-space: nowrap; text-align: right; }
        .pe-amount-neg-sm { font-weight: 600; color: #dc2626; white-space: nowrap; text-align: right; }

        .pe-source { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
        .pe-source-dropin { background: #fef3c7; color: #92400e; }
        .pe-source-subscription { background: #dbeafe; color: #1e40af; }
        .pe-source-cash { background: #d1fae5; color: #065f46; }
        .pe-source-unknown { background: #f3f4f6; color: #6b7280; }

        .pe-pending-payments { background: #fef3c7; border: 1.5px solid #fcd34d; border-radius: var(--radius-xl); padding: 1rem 1.25rem; margin-bottom: 1.25rem; }
        .pe-pending-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .pe-pending-header strong { color: #92400e; }
        .pe-pending-card { background: white; border: 1px solid #fcd34d; border-radius: var(--radius-lg); padding: 0.875rem 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
        .pe-pending-card:last-child { margin-bottom: 0; }

        .pe-history { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); padding: 1.25rem; margin-top: 1.25rem; }
        .pe-history-title { font-family: var(--font-body); font-size: 1rem; font-weight: 600; margin: 0 0 0.875rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary); }
        .pe-history-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .pe-history-table th { text-align: left; padding: 0.5rem 0.625rem; background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--sand); }
        .pe-history-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid var(--beige); }
        .pe-history-table tr:last-child td { border-bottom: none; }
        .pe-pay-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
        .pe-pay-confirmed { background: #d1fae5; color: #065f46; }
        .pe-pay-pending { background: #fef3c7; color: #92400e; }

        @media (max-width: 768px) {
          .pe-table-wrap { overflow-x: auto; }
          .pe-table { min-width: 720px; }
          .pe-summary { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
