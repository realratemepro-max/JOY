import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PersonalSession, PersonalLocation } from '../../types';
import { Euro, TrendingUp, Download, CheckCircle, Clock, FileText, MapPin, Info, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function computeAmount(s: PersonalSession): number {
  if (s.paymentType === 'fixed') return s.fixedAmount || 0;
  if (s.paymentType === 'per_student') return (s.ratePerStudent || 0) * (s.studentsPresent || 0);
  if (s.paymentType === 'per_occupancy' && s.occupancyTiers?.length && s.studentsExpected) {
    const pct = ((s.studentsPresent || 0) / s.studentsExpected) * 100;
    const tier = s.occupancyTiers.find(t => pct >= t.minPct && pct <= t.maxPct);
    return tier?.amount || 0;
  }
  return s.manualAmount || 0;
}

interface LocationSummary {
  locationId: string;
  locationName: string;
  sessions: PersonalSession[];
  completed: number;
  cancelled: number;
  totalOwed: number;
  totalPaid: number;
  pending: number;
  receiptsIssued: number;
}

export function ProfessorFinanceiro() {
  const { professorData } = useAuth();
  const [sessions, setSessions] = useState<PersonalSession[]>([]);
  const [locations, setLocations] = useState<PersonalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [expandedLoc, setExpandedLoc] = useState<string | null>(null);

  const sessRef = () => collection(db, 'professors', professorData!.id, 'personalSessions');
  const locRef = () => collection(db, 'professors', professorData!.id, 'personalLocations');

  useEffect(() => { if (!professorData) return; loadAll(); }, [professorData]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sessSnap, locSnap] = await Promise.all([
        getDocs(query(sessRef(), orderBy('date', 'asc'))),
        getDocs(query(locRef(), orderBy('createdAt', 'asc'))),
      ]);
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate(), paidAt: d.data().paidAt?.toDate() } as PersonalSession)));
      setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() } as PersonalLocation)));
    } finally { setLoading(false); }
  };

  const monthSessions = useMemo(() => sessions.filter(s => {
    const d = s.date;
    return d.getFullYear() === selMonth.y && d.getMonth() === selMonth.m;
  }), [sessions, selMonth]);

  const summaries: LocationSummary[] = useMemo(() => {
    const map = new Map<string, LocationSummary>();
    for (const s of monthSessions) {
      const key = s.locationId || s.locationName || 'Sem espaço';
      const locName = s.locationId
        ? (locations.find(l => l.id === s.locationId)?.name || s.locationName || 'Espaço desconhecido')
        : (s.locationName || 'Sem espaço');
      if (!map.has(key)) {
        map.set(key, { locationId: key, locationName: locName, sessions: [], completed: 0, cancelled: 0, totalOwed: 0, totalPaid: 0, pending: 0, receiptsIssued: 0 });
      }
      const entry = map.get(key)!;
      entry.sessions.push(s);
      if (s.status === 'completed') {
        entry.completed++;
        const owed = computeAmount(s);
        entry.totalOwed += owed;
        if (s.isPaid) entry.totalPaid += (s.paidAmount ?? owed);
        else entry.pending += owed;
      }
      if (s.status === 'cancelled') entry.cancelled++;
      if (s.receiptIssued) entry.receiptsIssued++;
    }
    return Array.from(map.values());
  }, [monthSessions, locations]);

  const totals = useMemo(() => ({
    owed: summaries.reduce((a, s) => a + s.totalOwed, 0),
    paid: summaries.reduce((a, s) => a + s.totalPaid, 0),
    pending: summaries.reduce((a, s) => a + s.pending, 0),
    completed: summaries.reduce((a, s) => a + s.completed, 0),
  }), [summaries]);

  const markPaid = async (session: PersonalSession) => {
    const amount = computeAmount(session);
    await updateDoc(doc(db, 'professors', professorData!.id, 'personalSessions', session.id), {
      isPaid: true, paidAmount: amount, paidAt: new Date(), updatedAt: serverTimestamp(),
    });
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isPaid: true, paidAmount: amount } : s));
  };

  const markReceiptIssued = async (session: PersonalSession) => {
    await updateDoc(doc(db, 'professors', professorData!.id, 'personalSessions', session.id), {
      receiptIssued: true, updatedAt: serverTimestamp(),
    });
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, receiptIssued: true } : s));
  };

  const downloadLocationPDF = (loc: LocationSummary) => {
    const monthLabel = `${MONTHS_PT[selMonth.m]} ${selMonth.y}`;
    const professorName = professorData?.name || 'Professor';
    const completedSessions = loc.sessions.filter(s => s.status === 'completed');

    const rows = loc.sessions.map(s => {
      const amount = computeAmount(s);
      const isCompleted = s.status === 'completed';
      const statusLabel = s.status === 'completed' ? 'Realizada' : s.status === 'cancelled' ? 'Cancelada' : s.status === 'no_show' ? 'Não realizada' : 'Agendada';
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 12px;white-space:nowrap;">${s.date.toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'})}</td>
          <td style="padding:8px 12px;white-space:nowrap;">${s.startTime}${s.endTime ? ` – ${s.endTime}` : ''}</td>
          <td style="padding:8px 12px;">${s.name}</td>
          <td style="padding:8px 12px;text-align:center;">${s.studentsPresent ?? '—'}</td>
          <td style="padding:8px 12px;text-align:center;">${statusLabel}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:600;">${isCompleted ? `${amount.toFixed(2)}€` : '—'}</td>
          <td style="padding:8px 12px;text-align:center;">${s.isPaid ? '✓ Pago' : isCompleted ? 'Pendente' : '—'}</td>
          <td style="padding:8px 12px;text-align:center;">${s.receiptIssued ? (s.receiptNumber ? `Nº ${s.receiptNumber}` : '✓') : '—'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Aulas — ${loc.locationName} — ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1f2937; padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 600; color: #5a7a50; margin-bottom: 2px; }
    .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    .meta { display: flex; gap: 40px; margin-bottom: 20px; }
    .meta-item { }
    .meta-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-value { font-size: 14px; font-weight: 600; color: #1f2937; }
    .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card { border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
    .summary-card .val { font-size: 18px; font-weight: 700; }
    .summary-card .lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    thead th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
    thead th:last-child, thead th:nth-child(4), thead th:nth-child(5), thead th:nth-child(6), thead th:nth-child(7), thead th:nth-child(8) { text-align: center; }
    thead th:nth-child(6) { text-align: right; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1.5px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    .sig-line { margin-top: 40px; }
    .sig-line p { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .sig-box { border-bottom: 1.5px solid #d1d5db; width: 200px; height: 40px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>Relatório de Aulas</h1>
  <h2>${loc.locationName}</h2>
  <p class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-PT')} · ${monthLabel}</p>

  <div class="meta">
    <div class="meta-item"><div class="meta-label">Professor</div><div class="meta-value">${professorName}</div></div>
    <div class="meta-item"><div class="meta-label">Espaço</div><div class="meta-value">${loc.locationName}</div></div>
    <div class="meta-item"><div class="meta-label">Período</div><div class="meta-value">${monthLabel}</div></div>
  </div>

  <div class="summary-grid">
    <div class="summary-card"><div class="val">${loc.completed}</div><div class="lbl">Realizadas</div></div>
    <div class="summary-card"><div class="val">${loc.cancelled}</div><div class="lbl">Canceladas</div></div>
    <div class="summary-card"><div class="val" style="color:#5a7a50;">${loc.totalOwed.toFixed(2)}€</div><div class="lbl">Total a receber</div></div>
    <div class="summary-card"><div class="val" style="color:${loc.pending > 0 ? '#d97706' : '#059669'};">${loc.pending.toFixed(2)}€</div><div class="lbl">Pendente</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th><th>Horário</th><th>Aula</th><th style="text-align:center">Alunos</th><th style="text-align:center">Estado</th><th style="text-align:right">Valor</th><th style="text-align:center">Pagamento</th><th style="text-align:center">Recibo</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="sig-line" style="margin-top:48px;display:flex;gap:60px;">
    <div><p>Assinatura do Professor</p><div class="sig-box"></div><p style="margin-top:4px;">${professorName}</p></div>
    <div><p>Assinatura / Carimbo do Espaço</p><div class="sig-box" style="width:240px;"></div><p style="margin-top:4px;">${loc.locationName}</p></div>
  </div>

  <div class="footer">
    <span>Relatório gerado automaticamente · ${new Date().toLocaleDateString('pt-PT')}</span>
    <span>${completedSessions.length} aulas realizadas · Total: ${loc.totalOwed.toFixed(2)}€</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const exportCSV = () => {
    const rows = [
      ['Data', 'Hora', 'Aula', 'Espaço', 'Alunos', 'Estado', 'Valor (€)', 'Pago', 'Valor Pago (€)', 'Recibo'],
      ...monthSessions.map(s => [
        s.date.toLocaleDateString('pt-PT'),
        s.startTime,
        s.name,
        s.locationName || '',
        s.studentsPresent ?? '',
        s.status === 'completed' ? 'Realizada' : s.status === 'cancelled' ? 'Cancelada' : s.status === 'no_show' ? 'Não realizada' : 'Agendada',
        computeAmount(s).toFixed(2),
        s.isPaid ? 'Sim' : 'Não',
        s.paidAmount?.toFixed(2) ?? '',
        s.receiptIssued ? (s.receiptNumber || 'Sim') : 'Não',
      ]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro_${MONTHS_PT[selMonth.m]}_${selMonth.y}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!professorData) return null;

  return (
    <div>
      {/* Privacy banner */}
      <div className="pf-privacy">
        <Info size={15} />
        <span>Relatório <strong>pessoal e privado</strong> — não partilhado com o estúdio.</span>
      </div>

      {/* Header */}
      <div className="pf-header">
        <div>
          <h2 className="pf-title"><Euro size={20} color="var(--accent)" /> Financeiro Pessoal</h2>
          <p className="pf-subtitle">Resumo por espaço · pagamentos e recibos</p>
        </div>
        <button className="btn btn-outline" onClick={exportCSV} disabled={monthSessions.length === 0}><Download size={16} /> Exportar CSV</button>
      </div>

      {/* Month selector */}
      <div className="pf-month-nav">
        <button className="pf-nav-btn" onClick={() => setSelMonth(m => { const d = new Date(m.y, m.m - 1); return { y: d.getFullYear(), m: d.getMonth() }; })}><ChevronLeft size={18} /></button>
        <span className="pf-month-label">{MONTHS_PT[selMonth.m]} {selMonth.y}</span>
        <button className="pf-nav-btn" onClick={() => setSelMonth(m => { const d = new Date(m.y, m.m + 1); return { y: d.getFullYear(), m: d.getMonth() }; })}><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Global summary cards */}
          <div className="pf-summary">
            {[
              { label: 'Aulas realizadas', value: totals.completed, icon: <CheckCircle size={18} />, color: '#059669' },
              { label: 'Total a receber', value: `${totals.owed.toFixed(2)}€`, icon: <Euro size={18} />, color: 'var(--accent-dark)' },
              { label: 'Recebido', value: `${totals.paid.toFixed(2)}€`, icon: <TrendingUp size={18} />, color: '#1d4ed8' },
              { label: 'Pendente', value: `${totals.pending.toFixed(2)}€`, icon: <Clock size={18} />, color: totals.pending > 0 ? '#d97706' : '#6b7280' },
            ].map(card => (
              <div key={card.label} className="pf-card">
                <div style={{ color: card.color, marginBottom: '0.375rem' }}>{card.icon}</div>
                <div className="pf-card-value" style={{ color: card.color }}>{card.value}</div>
                <div className="pf-card-label">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Per-location summaries */}
          {summaries.length === 0 ? (
            <div className="pf-empty">
              <Euro size={36} color="var(--text-muted)" />
              <p>Sem aulas registadas em {MONTHS_PT[selMonth.m]}.</p>
            </div>
          ) : (
            summaries.map(loc => (
              <div key={loc.locationId} className="pf-loc-block">
                <div className="pf-loc-header" onClick={() => setExpandedLoc(expandedLoc === loc.locationId ? null : loc.locationId)}>
                  <div className="pf-loc-left">
                    <div className="pf-loc-icon"><MapPin size={16} color="var(--accent)" /></div>
                    <div>
                      <div className="pf-loc-name">{loc.locationName}</div>
                      <div className="pf-loc-sub">{loc.completed} realizadas · {loc.cancelled} canceladas · {loc.receiptsIssued} recibos</div>
                    </div>
                  </div>
                  <div className="pf-loc-amounts">
                    <div className="pf-amount-chip pf-owed">{loc.totalOwed.toFixed(2)}€ total</div>
                    {loc.pending > 0 && <div className="pf-amount-chip pf-pending">{loc.pending.toFixed(2)}€ pendente</div>}
                    {loc.totalPaid > 0 && <div className="pf-amount-chip pf-paid">{loc.totalPaid.toFixed(2)}€ pago</div>}
                    <button className="pf-pdf-btn" onClick={e => { e.stopPropagation(); downloadLocationPDF(loc); }} title="Baixar relatório PDF">
                      <Download size={13} /> PDF
                    </button>
                  </div>
                </div>

                {expandedLoc === loc.locationId && (
                  <div className="pf-sessions-table-wrap">
                    <table className="pf-table">
                      <thead>
                        <tr>
                          <th>Data</th><th>Aula</th><th>Alunos</th><th>Valor</th><th>Pago</th><th>Recibo</th><th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loc.sessions.map(s => {
                          const amount = computeAmount(s);
                          const isCompleted = s.status === 'completed';
                          return (
                            <tr key={s.id} style={{ opacity: isCompleted ? 1 : 0.6 }}>
                              <td>{s.date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} {s.startTime}</td>
                              <td>
                                {s.name}
                                <span className={`pf-status-dot pf-status-${s.status}`} />
                              </td>
                              <td>{s.studentsPresent ?? '—'}</td>
                              <td className="pf-td-amount">{isCompleted ? `${amount.toFixed(2)}€` : '—'}</td>
                              <td>
                                {isCompleted && (s.isPaid
                                  ? <span className="pf-check"><CheckCircle size={14} color="#059669" /> {s.paidAmount?.toFixed(2)}€</span>
                                  : <button className="pf-action-btn" onClick={() => markPaid(s)}>Marcar pago</button>
                                )}
                              </td>
                              <td>
                                {s.receiptIssued
                                  ? <span className="pf-check"><FileText size={14} color="#059669" /> {s.receiptNumber || 'Sim'}</span>
                                  : isCompleted && <button className="pf-action-btn" onClick={() => markReceiptIssued(s)}>Emitido</button>
                                }
                              </td>
                              <td />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      <style>{`
        .pf-privacy { display: flex; align-items: center; gap: 0.625rem; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: var(--radius-lg); padding: 0.625rem 1rem; margin-bottom: 1.25rem; font-size: 0.8125rem; color: #1e40af; }
        .pf-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .pf-title { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin: 0 0 0.25rem; display: flex; align-items: center; gap: 0.5rem; }
        .pf-subtitle { font-size: 0.875rem; color: var(--text-secondary); margin: 0; }
        .pf-month-nav { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 1.5rem; background: white; border-radius: var(--radius-xl); padding: 0.875rem; box-shadow: var(--shadow-sm); }
        .pf-nav-btn { background: none; border: 1.5px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; display: flex; align-items: center; transition: background 0.15s; }
        .pf-nav-btn:hover { background: var(--bg-secondary); }
        .pf-month-label { font-size: 1.125rem; font-weight: 600; min-width: 180px; text-align: center; }
        .pf-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .pf-card { background: white; border-radius: var(--radius-xl); padding: 1.25rem; box-shadow: var(--shadow-sm); text-align: center; }
        .pf-card-value { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); line-height: 1; margin-bottom: 0.25rem; }
        .pf-card-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .pf-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; background: white; border-radius: var(--radius-xl); text-align: center; color: var(--text-muted); }
        .pf-loc-block { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); margin-bottom: 1rem; overflow: hidden; border: 1.5px solid var(--beige); }
        .pf-loc-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; cursor: pointer; gap: 1rem; flex-wrap: wrap; }
        .pf-loc-header:hover { background: var(--bg-secondary); }
        .pf-loc-left { display: flex; align-items: center; gap: 0.875rem; }
        .pf-loc-icon { width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(193,127,89,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pf-loc-name { font-weight: 600; font-size: 1rem; }
        .pf-loc-sub { font-size: 0.8125rem; color: var(--text-muted); }
        .pf-loc-amounts { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .pf-amount-chip { padding: 0.2rem 0.625rem; border-radius: 999px; font-size: 0.8125rem; font-weight: 600; }
        .pf-owed { background: rgba(193,127,89,0.12); color: var(--accent-dark); }
        .pf-pending { background: #fef3c7; color: #92400e; }
        .pf-paid { background: #d1fae5; color: #065f46; }
        .pf-sessions-table-wrap { overflow-x: auto; border-top: 1px solid var(--beige); }
        .pf-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .pf-table th { text-align: left; padding: 0.75rem 1rem; background: var(--bg-secondary); font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; white-space: nowrap; }
        .pf-table td { padding: 0.75rem 1rem; border-top: 1px solid var(--beige); vertical-align: middle; }
        .pf-td-amount { font-weight: 600; color: var(--accent-dark); }
        .pf-status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-left: 0.375rem; vertical-align: middle; }
        .pf-status-completed { background: #059669; }
        .pf-status-cancelled { background: #dc2626; }
        .pf-status-no_show { background: #d97706; }
        .pf-status-scheduled { background: #6b7280; }
        .pf-check { display: flex; align-items: center; gap: 0.375rem; color: #059669; font-size: 0.8125rem; font-weight: 500; }
        .pf-action-btn { font-size: 0.75rem; padding: 0.25rem 0.625rem; border-radius: var(--radius-md); border: 1.5px solid var(--sand); background: none; cursor: pointer; font-family: var(--font-body); color: var(--text-secondary); transition: all 0.15s; white-space: nowrap; }
        .pf-action-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .pf-pdf-btn { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; padding: 0.25rem 0.625rem; border-radius: var(--radius-md); border: 1.5px solid var(--primary); background: none; cursor: pointer; font-family: var(--font-body); color: var(--primary); font-weight: 600; transition: all 0.15s; white-space: nowrap; }
        .pf-pdf-btn:hover { background: var(--primary); color: white; }
        @media (max-width: 768px) { .pf-loc-header { flex-direction: column; align-items: flex-start; } .pf-summary { grid-template-columns: repeat(2,1fr); } }
      `}</style>
    </div>
  );
}
