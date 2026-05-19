import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Expense, ExpenseCategory, ProfessorPayment } from '../../types';
import {
  ChevronLeft, ChevronRight, Euro, TrendingUp, TrendingDown, FileText,
  Plus, Download, Check, X, Edit2, Trash2, AlertCircle, Loader,
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';

interface Payment {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  planName?: string;
  amount: number;
  method?: string;
  status?: string;
  type?: string;
  nif?: string;
  consumidorFinal?: boolean;
  invoiceStatus?: 'pending' | 'issued';
  invoiceNumber?: string;
  invoiceIssuedAt?: Date;
  paymentMethod?: string;
  createdAt?: Date;
  paidAt?: Date;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Renda',
  professor_payment: 'Pagamento Professor',
  material: 'Material',
  marketing: 'Marketing',
  utilities: 'Utilidades',
  tax: 'Impostos',
  other: 'Outro',
};

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function isInMonth(d: any, month: Date): boolean {
  if (!d) return false;
  const x = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
  const { start, end } = getMonthRange(month);
  return x >= start && x <= end;
}

export function AdminAccounting() {
  const toast = useToast();
  const [month, setMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [professorPayments, setProfessorPayments] = useState<ProfessorPayment[]>([]);
  const [tab, setTab] = useState<'resumo' | 'vendas' | 'despesas'>('resumo');

  // Expense form
  const [expForm, setExpForm] = useState<Partial<Expense> | null>(null);
  const [savingExp, setSavingExp] = useState(false);

  // Invoice marking
  const [issuingInvoice, setIssuingInvoice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [paySnap, expSnap, profPaySnap] = await Promise.all([
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'professorPayments')),
      ]);
      setPayments(paySnap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : undefined),
          paidAt: data.paidAt?.toDate?.() || (data.paidAt ? new Date(data.paidAt) : undefined),
          invoiceIssuedAt: data.invoiceIssuedAt?.toDate?.() || (data.invoiceIssuedAt ? new Date(data.invoiceIssuedAt) : undefined),
        };
      }));
      setExpenses(expSnap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          date: data.date?.toDate?.() || new Date(data.date),
          paidAt: data.paidAt?.toDate?.() || (data.paidAt ? new Date(data.paidAt) : undefined),
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as Expense;
      }));
      setProfessorPayments(profPaySnap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          periodFrom: data.periodFrom?.toDate?.() || new Date(data.periodFrom),
          periodTo: data.periodTo?.toDate?.() || new Date(data.periodTo),
          paidAt: data.paidAt?.toDate?.() || new Date(data.paidAt),
          confirmedAt: data.confirmedAt?.toDate?.() || null,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as ProfessorPayment;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ===== Monthly aggregations =====
  const paidPaymentsThisMonth = payments.filter(p =>
    (p.status === 'Paid' || p.status === 'paid' || p.status === 'PAGO') &&
    isInMonth(p.paidAt || p.createdAt, month)
  );
  const totalRevenue = paidPaymentsThisMonth.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalWithNif = paidPaymentsThisMonth.filter(p => p.nif && p.nif.trim() !== '').length;
  const totalConsumidorFinal = paidPaymentsThisMonth.filter(p => p.consumidorFinal || !p.nif).length;
  const invoicesIssued = paidPaymentsThisMonth.filter(p => p.invoiceStatus === 'issued').length;
  const invoicesPending = paidPaymentsThisMonth.length - invoicesIssued;

  const expensesThisMonth = expenses.filter(e => isInMonth(e.date, month));
  const totalExpenses = expensesThisMonth.reduce((acc, e) => acc + (e.amount || 0), 0);

  const professorPaymentsThisMonth = professorPayments.filter(p => isInMonth(p.paidAt, month));
  const totalProfessorPayments = professorPaymentsThisMonth.reduce((acc, p) => acc + (p.amount || 0), 0);

  const netProfit = totalRevenue - totalExpenses - totalProfessorPayments;

  // ===== Handlers =====
  const handleMarkInvoiceIssued = async (paymentId: string) => {
    setIssuingInvoice(paymentId);
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'markInvoiceIssued');
      const res: any = await fn({ paymentId });
      toast.success(`FR ${res.data?.invoiceNumber || ''} emitida.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    } finally {
      setIssuingInvoice(null);
    }
  };

  const handleUnmarkInvoice = async (paymentId: string) => {
    if (!confirm('Remover número de FR deste pagamento?')) return;
    setIssuingInvoice(paymentId);
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'markInvoiceIssued');
      await fn({ paymentId, action: 'unmark' });
      toast.success('FR desmarcada.');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Erro');
    } finally {
      setIssuingInvoice(null);
    }
  };

  const handleSaveExpense = async () => {
    if (!expForm || !expForm.description || !expForm.amount || !expForm.category) {
      toast.error('Preenche descrição, categoria e valor.');
      return;
    }
    setSavingExp(true);
    try {
      const data: any = {
        date: expForm.date instanceof Date ? expForm.date : new Date(expForm.date as any),
        category: expForm.category,
        description: expForm.description,
        amount: Number(expForm.amount),
        vatAmount: Number(expForm.vatAmount || 0),
        supplier: expForm.supplier || '',
        supplierNif: expForm.supplierNif || '',
        invoiceNumber: expForm.invoiceNumber || '',
        paid: !!expForm.paid,
        paymentMethod: expForm.paymentMethod || '',
        notes: expForm.notes || '',
        updatedAt: new Date(),
      };
      if (expForm.id) {
        await updateDoc(doc(db, 'expenses', expForm.id), data);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...data,
          createdBy: 'admin',
          createdAt: new Date(),
        });
      }
      setExpForm(null);
      await load();
      toast.success('Despesa guardada.');
    } catch (err: any) {
      toast.error(err?.message || 'Erro a guardar');
    } finally { setSavingExp(false); }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Apagar esta despesa?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      await load();
    } catch (err) { console.error(err); }
  };

  const exportCSV = () => {
    const monthLabel = month.toLocaleDateString('pt-PT', { month: '2-digit', year: 'numeric' }).replace('/', '-');
    const rows: string[][] = [];

    rows.push(['CONTABILIDADE — ' + monthLabel]);
    rows.push([]);
    rows.push(['VENDAS']);
    rows.push(['Data', 'Cliente', 'Email', 'NIF', 'Plano', 'Valor', 'Método', 'Status FR', 'Nº FR']);
    paidPaymentsThisMonth.forEach(p => {
      const d = p.paidAt || p.createdAt;
      rows.push([
        d ? new Date(d).toLocaleDateString('pt-PT') : '',
        p.userName || '',
        p.userEmail || '',
        p.consumidorFinal ? 'Consumidor final' : (p.nif || ''),
        p.planName || '',
        (p.amount || 0).toFixed(2),
        p.method || p.paymentMethod || '',
        p.invoiceStatus === 'issued' ? 'Emitida' : 'Pendente',
        p.invoiceNumber || '',
      ]);
    });
    rows.push([]);
    rows.push(['DESPESAS']);
    rows.push(['Data', 'Categoria', 'Descrição', 'Fornecedor', 'NIF Fornecedor', 'Valor', 'Pago', 'Método']);
    expensesThisMonth.forEach(e => {
      rows.push([
        new Date(e.date).toLocaleDateString('pt-PT'),
        CATEGORY_LABELS[e.category] || e.category,
        e.description,
        e.supplier || '',
        e.supplierNif || '',
        (e.amount || 0).toFixed(2),
        e.paid ? 'Sim' : 'Não',
        e.paymentMethod || '',
      ]);
    });
    rows.push([]);
    rows.push(['PAGAMENTOS A PROFESSORES']);
    rows.push(['Data', 'Professor', 'Período', 'Valor', 'Método', 'Status']);
    professorPaymentsThisMonth.forEach(p => {
      rows.push([
        p.paidAt.toLocaleDateString('pt-PT'),
        p.professorName,
        `${p.periodFrom.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}`,
        (p.amount || 0).toFixed(2),
        p.paymentMethod,
        p.status,
      ]);
    });
    rows.push([]);
    rows.push(['RESUMO']);
    rows.push(['Receita', totalRevenue.toFixed(2)]);
    rows.push(['Despesas', totalExpenses.toFixed(2)]);
    rows.push(['Pagamentos professores', totalProfessorPayments.toFixed(2)]);
    rows.push(['Margem líquida', netProfit.toFixed(2)]);

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contabilidade_${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Vista de contabilidade — vendas, despesas, pagamentos a professores e emissão de FR.
      </p>

      {/* Month nav + export */}
      <div className="acc-toolbar">
        <div className="acc-month-nav">
          <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d); }}><ChevronLeft size={14} /></button>
          <strong style={{ minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>{month.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</strong>
          <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() + 1); setMonth(d); }}><ChevronRight size={14} /></button>
        </div>
        <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> Exportar CSV</button>
      </div>

      {/* Summary cards */}
      <div className="acc-cards">
        <div className="acc-card">
          <div className="acc-card-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}><TrendingUp size={18} /></div>
          <div className="acc-card-val">{totalRevenue.toFixed(2)}€</div>
          <div className="acc-card-lbl">Receita</div>
          <div className="acc-card-sub">{paidPaymentsThisMonth.length} pagamentos</div>
        </div>
        <div className="acc-card">
          <div className="acc-card-icon" style={{ background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}><TrendingDown size={18} /></div>
          <div className="acc-card-val">−{(totalExpenses + totalProfessorPayments).toFixed(2)}€</div>
          <div className="acc-card-lbl">Despesas</div>
          <div className="acc-card-sub">{totalExpenses.toFixed(2)}€ gerais · {totalProfessorPayments.toFixed(2)}€ professores</div>
        </div>
        <div className="acc-card acc-card-highlight">
          <div className="acc-card-icon" style={{ background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }}><Euro size={18} /></div>
          <div className="acc-card-val" style={{ color: netProfit >= 0 ? '#1d4ed8' : '#dc2626' }}>{netProfit.toFixed(2)}€</div>
          <div className="acc-card-lbl">Margem líquida</div>
          <div className="acc-card-sub">Receita − Despesas</div>
        </div>
        <div className="acc-card">
          <div className="acc-card-icon" style={{ background: 'rgba(124,154,114,0.12)', color: '#7c9a72' }}><FileText size={18} /></div>
          <div className="acc-card-val">{invoicesIssued}/{paidPaymentsThisMonth.length}</div>
          <div className="acc-card-lbl">FR emitidas</div>
          <div className="acc-card-sub">{invoicesPending} pendentes · {totalConsumidorFinal} consumidor final · {totalWithNif} com NIF</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="acc-tabs">
        <button className={`acc-tab ${tab === 'resumo' ? 'active' : ''}`} onClick={() => setTab('resumo')}>Resumo</button>
        <button className={`acc-tab ${tab === 'vendas' ? 'active' : ''}`} onClick={() => setTab('vendas')}>Vendas ({paidPaymentsThisMonth.length})</button>
        <button className={`acc-tab ${tab === 'despesas' ? 'active' : ''}`} onClick={() => setTab('despesas')}>Despesas ({expensesThisMonth.length + professorPaymentsThisMonth.length})</button>
      </div>

      {tab === 'resumo' && (
        <div className="acc-section">
          <h3>Quadro do mês</h3>
          <table className="acc-table">
            <tbody>
              <tr><td>Receita bruta (pagamentos confirmados)</td><td className="acc-pos">+{totalRevenue.toFixed(2)}€</td></tr>
              <tr><td>Despesas gerais ({expensesThisMonth.length})</td><td className="acc-neg">−{totalExpenses.toFixed(2)}€</td></tr>
              <tr><td>Pagamentos a professores ({professorPaymentsThisMonth.length})</td><td className="acc-neg">−{totalProfessorPayments.toFixed(2)}€</td></tr>
              <tr className="acc-total"><td><strong>Margem líquida</strong></td><td style={{ color: netProfit >= 0 ? '#1d4ed8' : '#dc2626' }}><strong>{netProfit.toFixed(2)}€</strong></td></tr>
            </tbody>
          </table>
          <h3 style={{ marginTop: '1.5rem' }}>Fatura/Recibo</h3>
          <table className="acc-table">
            <tbody>
              <tr><td>Pagamentos no mês</td><td>{paidPaymentsThisMonth.length}</td></tr>
              <tr><td>Com NIF (precisa FR)</td><td>{totalWithNif}</td></tr>
              <tr><td>Consumidor final (recibo simples)</td><td>{totalConsumidorFinal}</td></tr>
              <tr><td>FR já emitidas</td><td className="acc-pos">{invoicesIssued}</td></tr>
              <tr><td>FR por emitir</td><td className="acc-neg">{invoicesPending}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'vendas' && (
        <div className="acc-section">
          {paidPaymentsThisMonth.length === 0 ? (
            <div className="acc-empty">Sem vendas neste mês.</div>
          ) : (
            <table className="acc-table acc-table-data">
              <thead>
                <tr>
                  <th>Data</th><th>Cliente</th><th>Plano</th><th>NIF</th><th>Valor</th><th>Método</th><th>FR</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paidPaymentsThisMonth.map(p => (
                  <tr key={p.id}>
                    <td>{(p.paidAt || p.createdAt)?.toLocaleDateString?.('pt-PT')}</td>
                    <td>{p.userName || p.userEmail || '—'}</td>
                    <td>{p.planName || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {p.consumidorFinal ? <span className="acc-badge acc-badge-muted">Cons. final</span> : (p.nif || <span style={{ color: 'var(--text-muted)' }}>—</span>)}
                    </td>
                    <td className="acc-pos">{(p.amount || 0).toFixed(2)}€</td>
                    <td>{p.method || p.paymentMethod || '—'}</td>
                    <td>
                      {p.invoiceStatus === 'issued' ? (
                        <span className="acc-badge acc-badge-ok">{p.invoiceNumber || 'Emitida'}</span>
                      ) : (
                        <span className="acc-badge acc-badge-pending">Pendente</span>
                      )}
                    </td>
                    <td>
                      {p.invoiceStatus === 'issued' ? (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleUnmarkInvoice(p.id)} disabled={issuingInvoice === p.id}>
                          <X size={12} /> Desmarcar
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-primary" onClick={() => handleMarkInvoiceIssued(p.id)} disabled={issuingInvoice === p.id}>
                          {issuingInvoice === p.id ? <Loader size={12} className="spinner" /> : <><Check size={12} /> Marcar FR</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'despesas' && (
        <div className="acc-section">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setExpForm({ date: new Date(), category: 'other', paid: true })}>
              <Plus size={14} /> Nova despesa
            </button>
          </div>

          {expForm && (
            <div className="acc-exp-form">
              <h4>{expForm.id ? 'Editar despesa' : 'Nova despesa'}</h4>
              <div className="acc-exp-grid">
                <label>
                  <span>Data</span>
                  <input type="date" className="input" value={expForm.date ? new Date(expForm.date as any).toISOString().split('T')[0] : ''} onChange={e => setExpForm({ ...expForm, date: new Date(e.target.value) })} />
                </label>
                <label>
                  <span>Categoria</span>
                  <select className="input" value={expForm.category || 'other'} onChange={e => setExpForm({ ...expForm, category: e.target.value as ExpenseCategory })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span>Descrição</span>
                  <input className="input" value={expForm.description || ''} onChange={e => setExpForm({ ...expForm, description: e.target.value })} placeholder="Ex: Renda Maio · Espaço GA" />
                </label>
                <label>
                  <span>Valor (€)</span>
                  <input className="input" type="number" step="0.01" value={expForm.amount as any || ''} onChange={e => setExpForm({ ...expForm, amount: e.target.value as any })} />
                </label>
                <label>
                  <span>IVA incluído (€)</span>
                  <input className="input" type="number" step="0.01" value={expForm.vatAmount as any || ''} onChange={e => setExpForm({ ...expForm, vatAmount: e.target.value as any })} placeholder="Opcional" />
                </label>
                <label>
                  <span>Fornecedor</span>
                  <input className="input" value={expForm.supplier || ''} onChange={e => setExpForm({ ...expForm, supplier: e.target.value })} />
                </label>
                <label>
                  <span>NIF Fornecedor</span>
                  <input className="input" value={expForm.supplierNif || ''} onChange={e => setExpForm({ ...expForm, supplierNif: e.target.value })} />
                </label>
                <label>
                  <span>Nº fatura</span>
                  <input className="input" value={expForm.invoiceNumber || ''} onChange={e => setExpForm({ ...expForm, invoiceNumber: e.target.value })} />
                </label>
                <label>
                  <span>Método</span>
                  <select className="input" value={expForm.paymentMethod || ''} onChange={e => setExpForm({ ...expForm, paymentMethod: e.target.value as any })}>
                    <option value="">—</option>
                    <option value="transfer">Transferência</option>
                    <option value="mbway">MB Way</option>
                    <option value="cash">Numerário</option>
                    <option value="card">Cartão</option>
                    <option value="other">Outro</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'end', paddingBottom: '0.5rem' }}>
                  <input type="checkbox" checked={!!expForm.paid} onChange={e => setExpForm({ ...expForm, paid: e.target.checked })} />
                  <span style={{ fontSize: '0.875rem' }}>Já paga</span>
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span>Notas</span>
                  <textarea className="input" rows={2} value={expForm.notes || ''} onChange={e => setExpForm({ ...expForm, notes: e.target.value })} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setExpForm(null)} disabled={savingExp}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveExpense} disabled={savingExp}>
                  {savingExp ? <Loader size={14} className="spinner" /> : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Expenses */}
          {expensesThisMonth.length === 0 && professorPaymentsThisMonth.length === 0 ? (
            <div className="acc-empty">Sem despesas neste mês.</div>
          ) : (
            <>
              {expensesThisMonth.length > 0 && (
                <table className="acc-table acc-table-data">
                  <thead>
                    <tr>
                      <th>Data</th><th>Categoria</th><th>Descrição</th><th>Fornecedor</th><th>NIF</th><th>Valor</th><th>Pago</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesThisMonth.map(e => (
                      <tr key={e.id}>
                        <td>{e.date.toLocaleDateString('pt-PT')}</td>
                        <td><span className="acc-badge acc-badge-muted">{CATEGORY_LABELS[e.category]}</span></td>
                        <td>{e.description}</td>
                        <td>{e.supplier || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{e.supplierNif || '—'}</td>
                        <td className="acc-neg">−{e.amount.toFixed(2)}€</td>
                        <td>{e.paid ? <span className="acc-badge acc-badge-ok"><Check size={10} /></span> : <span className="acc-badge acc-badge-pending">Pendente</span>}</td>
                        <td style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn-icon" onClick={() => setExpForm(e)}><Edit2 size={12} /></button>
                          <button className="btn-icon" onClick={() => handleDeleteExpense(e.id)} style={{ color: '#dc2626' }}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {professorPaymentsThisMonth.length > 0 && (
                <>
                  <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Pagamentos a professores</h4>
                  <table className="acc-table acc-table-data">
                    <thead>
                      <tr>
                        <th>Data</th><th>Professor</th><th>Período</th><th>Método</th><th>Valor</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {professorPaymentsThisMonth.map(p => (
                        <tr key={p.id}>
                          <td>{p.paidAt.toLocaleDateString('pt-PT')}</td>
                          <td>{p.professorName}</td>
                          <td style={{ textTransform: 'capitalize' }}>{p.periodFrom.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</td>
                          <td>{p.paymentMethod}</td>
                          <td className="acc-neg">−{p.amount.toFixed(2)}€</td>
                          <td>{p.status === 'confirmed' ? <span className="acc-badge acc-badge-ok">Confirmado</span> : <span className="acc-badge acc-badge-pending">Por confirmar</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        .acc-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
        .acc-month-nav { display: flex; align-items: center; gap: 0.5rem; }
        .acc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
        .acc-card { background: white; border-radius: var(--radius-xl); padding: 1rem; box-shadow: var(--shadow-sm); }
        .acc-card-highlight { background: #eff6ff; border: 1.5px solid #bfdbfe; }
        .acc-card-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
        .acc-card-val { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); line-height: 1; }
        .acc-card-lbl { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.25rem; }
        .acc-card-sub { font-size: 0.6875rem; color: var(--text-secondary); margin-top: 0.25rem; }

        .acc-tabs { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); margin-bottom: 1rem; }
        .acc-tab { background: none; border: none; padding: 0.5rem 1rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); }
        .acc-tab.active { background: var(--primary); color: white; }

        .acc-section { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); }
        .acc-section h3 { font-family: var(--font-body); font-size: 1rem; margin: 0 0 0.75rem; }
        .acc-empty { text-align: center; padding: 2rem; color: var(--text-muted); }

        .acc-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .acc-table td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--beige); }
        .acc-table tr.acc-total td { font-weight: 700; border-top: 2px solid var(--sand); border-bottom: none; padding-top: 0.875rem; font-size: 1rem; }
        .acc-table-data th { text-align: left; padding: 0.5rem 0.75rem; background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .acc-pos { color: #059669; font-weight: 600; white-space: nowrap; }
        .acc-neg { color: #dc2626; font-weight: 600; white-space: nowrap; }

        .acc-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
        .acc-badge-ok { background: #d1fae5; color: #065f46; }
        .acc-badge-pending { background: #fef3c7; color: #92400e; }
        .acc-badge-muted { background: #f3f4f6; color: #4b5563; }

        .acc-exp-form { background: var(--bg-secondary); border: 1px solid var(--sand); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1rem; }
        .acc-exp-form h4 { margin: 0 0 0.75rem; font-family: var(--font-body); font-size: 0.9375rem; }
        .acc-exp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
        .acc-exp-grid label { display: flex; flex-direction: column; gap: 0.25rem; }
        .acc-exp-grid label span { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
        @media (max-width: 600px) { .acc-exp-grid { grid-template-columns: 1fr; } }

        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.25rem 0.4rem; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; }
      `}</style>
    </div>
  );
}
