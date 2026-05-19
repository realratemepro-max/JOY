import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Client, Session } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Search, Mail, Phone, Calendar, ShoppingBag, Clock, MessageCircle, ChevronLeft, Send, UserPlus, Banknote, MapPin, User, Trophy } from 'lucide-react';
import { LoyaltyJourneyView } from '../../components/LoyaltyJourneyView';
import { LoyaltyConfig } from '../../types';
import { DEFAULT_LOYALTY, normaliseLoyaltyConfig } from '../../services/loyaltyPresets';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useToast } from '../../components/ToastProvider';

interface NotifLog { id: string; trigger: string; channels: string[]; message: string; createdAt: any; }
interface Purchase { id: string; planName: string; sessionsTotal: number; sessionsUsed: number; sessionsRemaining: number; status: string; startDate: any; endDate: any; priceMonthly: number; }
interface Credit { id: string; type: string; amount: number; reason: string; expiresAt: any; usedAt?: any; createdAt: any; }

export function AdminClients() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Invite new client
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({ name: '', email: '', phone: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);

  const handleCreateAndInvite = async () => {
    if (!inviteData.name || !inviteData.email) return;
    const email = inviteData.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Email inválido.');
      return;
    }
    // Check if email already exists in clients list
    const existing = clients.find(c => (c.email || '').toLowerCase() === email);
    if (existing) {
      toast.error(`Já existe um cliente com este email: ${existing.name}`);
      return;
    }
    setInviting(true);
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'createClientAccount');
      const res: any = await fn({ name: inviteData.name.trim(), email, phone: inviteData.phone.trim() });
      setInviteDone(true);
      if (res.data?.emailSent) {
        toast.success(`Conta criada e email enviado para ${email}`);
      } else if (res.data?.resetLink) {
        toast.warning('Conta criada mas email não foi enviado. Vê a consola para o link.');
        console.log('Reset link para', email, ':', res.data.resetLink);
        if (res.data.emailError) console.warn('Email error:', res.data.emailError);
      } else {
        toast.success(`Conta criada para ${email}`);
      }
      await loadClients();
      setTimeout(() => { setInviteModal(false); setInviteDone(false); setInviteData({ name: '', email: '', phone: '' }); }, 2500);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao criar conta de cliente');
    } finally { setInviting(false); }
  };

  // Client detail panel
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientLogs, setClientLogs] = useState<NotifLog[]>([]);
  const [clientPurchases, setClientPurchases] = useState<Purchase[]>([]);
  const [clientCredits, setClientCredits] = useState<Credit[]>([]);
  const [detailTab, setDetailTab] = useState<'info' | 'purchases' | 'sessions' | 'conquistas' | 'comms' | 'credits'>('info');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loyaltyCfg, setLoyaltyCfg] = useState<LoyaltyConfig>(DEFAULT_LOYALTY);
  const [selectedClientFullDoc, setSelectedClientFullDoc] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { loadClients(); }, []);

  // Sessions where this client is in enrolledStudents
  const clientSessions = (clientId: string) =>
    sessions.filter(s => (s.enrolledStudents || []).some((es: any) => es.userId === clientId));

  // Attended count for the list
  const clientAttendedCount = (clientId: string) =>
    sessions.reduce((acc, s) => {
      const me = (s.enrolledStudents || []).find((es: any) => es.userId === clientId);
      return acc + (me && (me as any).status === 'attended' ? 1 : 0);
    }, 0);

  const loadClients = async () => {
    try {
      // Load registered users + manually added clients, merge by email
      const [usersSnap, clientsSnap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'clients')).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'desc'))),
      ]);

      setSessions(sessionsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Session;
      }));

      const seen = new Set<string>();
      const all: Client[] = [];

      // Registered users first
      usersSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.email) return;
        seen.add(data.email.toLowerCase());
        all.push({
          id: d.id, name: data.name || data.displayName || data.email,
          email: data.email, phone: data.phone || '',
          notes: data.notes || '', status: data.role === 'admin' ? 'lead' : 'active',
          totalSpent: 0, sessionsRemaining: 0, totalSessions: 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as Client);
      });

      // Manual clients not already in users
      (clientsSnap as any).docs.forEach((d: any) => {
        const data = d.data();
        if (data.email && seen.has(data.email.toLowerCase())) return;
        all.push({ id: d.id, ...data, createdAt: data.createdAt?.toDate?.(), updatedAt: data.updatedAt?.toDate?.() } as Client);
      });

      // Sort by createdAt desc
      all.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
      setClients(all);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client);
    setDetailTab('info');
    setLoadingDetail(true);
    try {
      const [logsSnap, purchasesSnap, creditsSnap, loyaltyCfgSnap, userDocSnap] = await Promise.all([
        getDocs(query(collection(db, 'notificationLogs'), where('recipientEmail', '==', client.email), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'purchases'), where('userEmail', '==', client.email), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'credits'), where('userName', '==', client.email))).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'siteConfig', 'main')).catch(() => null),
        getDoc(doc(db, 'users', client.id)).catch(() => null),
      ]);

      if (loyaltyCfgSnap && (loyaltyCfgSnap as any).exists?.() && (loyaltyCfgSnap as any).data()?.loyalty) {
        setLoyaltyCfg(normaliseLoyaltyConfig((loyaltyCfgSnap as any).data().loyalty));
      } else {
        setLoyaltyCfg(DEFAULT_LOYALTY);
      }
      if (userDocSnap && (userDocSnap as any).exists?.()) {
        const data = (userDocSnap as any).data();
        setSelectedClientFullDoc({
          totalAttendances: data?.totalAttendances || 0,
          lastAttendanceAt: data?.lastAttendanceAt?.toDate?.() || (data?.lastAttendanceAt ? new Date(data.lastAttendanceAt) : null),
        });
      } else {
        setSelectedClientFullDoc({ totalAttendances: 0, lastAttendanceAt: null });
      }
      setClientLogs(logsSnap.docs.map((d: any) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })));
      const purchases = purchasesSnap.docs.map((d: any) => ({ id: d.id, ...d.data(), startDate: d.data().startDate?.toDate(), endDate: d.data().endDate?.toDate() }));
      setClientPurchases(purchases);
      setClientCredits(creditsSnap.docs.map((d: any) => ({ id: d.id, ...d.data(), expiresAt: d.data().expiresAt?.toDate(), usedAt: d.data().usedAt?.toDate(), createdAt: d.data().createdAt?.toDate() })));

      // Compute stats from purchases
      const totalSpent = purchases.reduce((sum: number, p: any) => sum + (p.priceMonthly || 0), 0);
      const sessionsUsed = purchases.reduce((sum: number, p: any) => sum + (p.sessionsUsed || 0), 0);
      const sessionsRemaining = purchases.filter((p: any) => p.status === 'active' && p.endDate > new Date()).reduce((sum: number, p: any) => sum + (p.sessionsRemaining || 0), 0);
      const activePurchase = purchases.filter((p: any) => p.status === 'active' && p.endDate > new Date()).sort((a: any, b: any) => (b.endDate?.getTime?.() || 0) - (a.endDate?.getTime?.() || 0))[0];
      setSelectedClient(prev => prev ? { ...prev, totalSpent, totalSessions: sessionsUsed, sessionsRemaining, _activePlanName: activePurchase?.planName, _activePlanExpiry: activePurchase?.endDate } as any : prev);
    } catch (err) { console.error(err); }
    finally { setLoadingDetail(false); }
  };

  const startNew = () => {
    setEditing('new');
    setEditData({ name: '', email: '', phone: '', notes: '', totalSpent: 0, sessionsRemaining: 0, totalSessions: 0, status: 'lead' });
  };
  const startEdit = (c: Client) => { setEditing(c.id); setEditData({ ...c }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'clients')).id : editing!;
      const data = {
        ...editData,
        email: (editData.email || '').trim().toLowerCase(),
        totalSpent: Number(editData.totalSpent),
        sessionsRemaining: Number(editData.sessionsRemaining),
        totalSessions: Number(editData.totalSessions),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      delete data.id;
      await setDoc(doc(db, 'clients', id), data);
      await loadClients();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este cliente?')) return;
    await deleteDoc(doc(db, 'clients', id));
    await loadClients();
  };

  const TRIGGER_LABELS: Record<string, string> = {
    plan_purchased: 'Plano Comprado', session_booked: 'Aula Marcada', session_cancelled: 'Aula Cancelada',
    session_reminder: 'Lembrete', plan_expiring: 'Plano a Expirar', session_cancelled_admin: 'Cancelada (admin)',
    professor_substituted: 'Prof. Substituído', mass_message: 'Mensagem em Massa',
    password_reset: 'Reset de Password', client_invite: 'Convite para Conta',
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  // Client detail panel
  if (selectedClient) {
    const c = selectedClient;
    return (
      <div>
        <button className="btn btn-sm btn-secondary" onClick={() => setSelectedClient(null)} style={{ marginBottom: '1rem' }}>
          <ChevronLeft size={14} /> Voltar à lista
        </button>

        <div className="client-detail-header">
          <div className="client-avatar-lg">{c.name.charAt(0).toUpperCase()}</div>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.25rem' }}>{c.name}</h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={14} /> {c.email}</span>
              {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={14} /> {c.phone}</span>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`badge badge-${c.status === 'active' ? 'success' : c.status === 'lead' ? 'warning' : 'error'}`}>
              {c.status === 'active' ? 'Ativo' : c.status === 'lead' ? 'Lead' : 'Inativo'}
            </span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={async () => {
                try {
                  const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'linkClientPurchases');
                  const res: any = await fn({ email: c.email });
                  const { linked, alreadyOk, totalFound } = res.data || {};
                  if (linked > 0) {
                    toast.success(`${linked} compra(s) vinculadas. ${alreadyOk} já estavam OK.`);
                  } else if (totalFound > 0) {
                    toast.success(`Tudo OK — ${totalFound} compra(s) já vinculadas a esta conta.`);
                  } else {
                    toast.warning('Não foram encontradas compras com este email.');
                  }
                } catch (err: any) {
                  toast.error(err?.message || 'Erro ao vincular compras');
                }
              }}
              title="Associar compras feitas como convidado à conta atual"
            >
              <ShoppingBag size={14} /> Vincular compras
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={async () => {
                if (!confirm(`Enviar link de recuperação de password para ${c.email}?`)) return;
                try {
                  const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'sendClientPasswordReset');
                  const res: any = await fn({ email: c.email, name: c.name });
                  if (res.data?.emailSent) {
                    toast.success(`Link enviado para ${c.email}`);
                  } else if (res.data?.resetLink) {
                    toast.warning('Email falhou. Link na consola para partilhares manualmente.');
                    console.log('Reset link para', c.email, ':', res.data.resetLink);
                  } else {
                    toast.success('Link de reset gerado.');
                  }
                } catch (err: any) {
                  toast.error(err?.message || 'Erro ao gerar reset');
                }
              }}
              title="Enviar email para a cliente repor a password"
            >
              <Mail size={14} /> Enviar reset password
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => { startEdit(c); setSelectedClient(null); }}><Edit2 size={14} /> Editar</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="detail-tabs">
          {([['info', 'Resumo'], ['sessions', 'Aulas'], ['conquistas', 'Conquistas'], ['purchases', 'Compras'], ['credits', 'Créditos'], ['comms', 'Comunicações']] as const).map(([id, label]) => (
            <button key={id} className={`detail-tab ${detailTab === id ? 'active' : ''}`} onClick={() => setDetailTab(id)}>{label}</button>
          ))}
        </div>

        <div className="detail-content">
          {loadingDetail ? <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div> : (
            <>
              {/* INFO */}
              {detailTab === 'info' && (
                <>
                  {(c as any)._activePlanName && (
                    <div style={{ background: 'rgba(124,154,114,0.08)', border: '1px solid rgba(124,154,114,0.3)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9375rem' }}>{(c as any)._activePlanName}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        Válido até <strong>{(c as any)._activePlanExpiry?.toLocaleDateString('pt-PT')}</strong>
                      </span>
                    </div>
                  )}
                  <div className="detail-stats-grid">
                    <div className="detail-stat-box">
                      <ShoppingBag size={20} style={{ color: 'var(--primary)' }} />
                      <span className="stat-val">{clientPurchases.length}</span>
                      <span className="stat-lbl">Compras</span>
                    </div>
                    <div className="detail-stat-box">
                      <Calendar size={20} style={{ color: 'var(--success)' }} />
                      <span className="stat-val">{c.totalSessions}</span>
                      <span className="stat-lbl">Aulas Usadas</span>
                    </div>
                    <div className="detail-stat-box">
                      <Clock size={20} style={{ color: 'var(--warning)' }} />
                      <span className="stat-val">{c.sessionsRemaining}</span>
                      <span className="stat-lbl">Disponíveis</span>
                    </div>
                    <div className="detail-stat-box">
                      <Mail size={20} style={{ color: '#5b8db8' }} />
                      <span className="stat-val">{clientLogs.length}</span>
                      <span className="stat-lbl">Emails Enviados</span>
                    </div>
                    <div className="detail-stat-box">
                      <span className="stat-val" style={{ color: 'var(--success)' }}>{c.totalSpent.toFixed(0)}€</span>
                      <span className="stat-lbl">Total Gasto</span>
                    </div>
                    <div className="detail-stat-box">
                      <span className="stat-val">{clientCredits.filter(cr => !cr.usedAt && cr.expiresAt > new Date()).length}</span>
                      <span className="stat-lbl">Créditos Ativos</span>
                    </div>
                  </div>
                </>
              )}

              {/* PURCHASES */}
              {detailTab === 'purchases' && (
                clientPurchases.length === 0 ? <div className="empty-msg">Sem compras registadas.</div> : (
                  <div className="detail-list">
                    {clientPurchases.map(p => (
                      <div key={p.id} className="detail-list-item">
                        <ShoppingBag size={16} style={{ color: p.status === 'active' ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <strong>{p.planName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.startDate?.toLocaleDateString('pt-PT')} → {p.endDate?.toLocaleDateString('pt-PT')} · {p.sessionsUsed}/{p.sessionsTotal} aulas · {p.priceMonthly?.toFixed(0)}€
                          </div>
                        </div>
                        <span className={`badge badge-sm badge-${p.status === 'active' && p.endDate > new Date() ? 'success' : 'error'}`}>
                          {p.status === 'active' && p.endDate > new Date() ? 'Ativo' : 'Expirado'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* SESSIONS */}
              {detailTab === 'sessions' && (() => {
                const cs = clientSessions(c.id);
                if (cs.length === 0) return <div className="empty-msg">Sem aulas registadas.</div>;
                const now = new Date();
                const past = cs.filter(s => s.date < now).sort((a, b) => b.date.getTime() - a.date.getTime());
                const upcoming = cs.filter(s => s.date >= now).sort((a, b) => a.date.getTime() - b.date.getTime());
                const attendedCount = past.filter(s => {
                  const me = (s.enrolledStudents || []).find((es: any) => es.userId === c.id);
                  return me && (me as any).status === 'attended';
                }).length;
                const absentCount = past.filter(s => {
                  const me = (s.enrolledStudents || []).find((es: any) => es.userId === c.id);
                  return me && (me as any).status === 'absent';
                }).length;

                const renderRow = (s: Session) => {
                  const me = (s.enrolledStudents || []).find((es: any) => es.userId === c.id) as any;
                  const status = me?.status || 'enrolled';
                  const isCancelled = s.status === 'cancelled';
                  const finalStatus = isCancelled ? 'cancelled' : status;
                  const label =
                    finalStatus === 'attended' ? 'Presente' :
                    finalStatus === 'absent' ? 'Faltou' :
                    finalStatus === 'cancelled' ? 'Cancelada' :
                    s.date < now ? 'Sem registo' : 'Marcada';
                  const cls =
                    finalStatus === 'attended' ? 'sess-attended' :
                    finalStatus === 'absent' ? 'sess-absent' :
                    finalStatus === 'cancelled' ? 'sess-cancelled' :
                    s.date < now ? 'sess-pending' : 'sess-scheduled';
                  return (
                    <tr key={s.id}>
                      <td>{s.date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td>{s.startTime}</td>
                      <td>{s.name || s.locationName}</td>
                      <td>{s.professorName || '—'}</td>
                      <td>{s.locationName}</td>
                      <td><span className={`sess-badge ${cls}`}>{label}</span></td>
                    </tr>
                  );
                };

                return (
                  <div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <span className="sess-badge sess-attended">Presente: {attendedCount}</span>
                      {absentCount > 0 && <span className="sess-badge sess-absent">Faltou: {absentCount}</span>}
                      {upcoming.length > 0 && <span className="sess-badge sess-scheduled">Marcadas: {upcoming.length}</span>}
                    </div>

                    {past.length > 0 && (
                      <>
                        <h4 className="sess-section-title">Histórico</h4>
                        <div className="sess-table-wrap">
                          <table className="sess-table">
                            <thead>
                              <tr>
                                <th>Data</th><th>Hora</th><th>Aula</th><th>Professor</th><th>Local</th><th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>{past.map(renderRow)}</tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {upcoming.length > 0 && (
                      <>
                        <h4 className="sess-section-title" style={{ marginTop: past.length > 0 ? '1.25rem' : 0 }}>Próximas</h4>
                        <div className="sess-table-wrap">
                          <table className="sess-table">
                            <thead>
                              <tr>
                                <th>Data</th><th>Hora</th><th>Aula</th><th>Professor</th><th>Local</th><th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>{upcoming.map(renderRow)}</tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* CONQUISTAS */}
              {detailTab === 'conquistas' && (
                <LoyaltyJourneyView
                  totalAttended={selectedClientFullDoc?.totalAttendances || 0}
                  lastAttendanceAt={selectedClientFullDoc?.lastAttendanceAt || null}
                  loyalty={loyaltyCfg}
                  showName={c.name}
                />
              )}

              {/* CREDITS */}
              {detailTab === 'credits' && (
                clientCredits.length === 0 ? <div className="empty-msg">Sem créditos.</div> : (
                  <div className="detail-list">
                    {clientCredits.map(cr => {
                      const isValid = !cr.usedAt && cr.expiresAt > new Date();
                      return (
                        <div key={cr.id} className="detail-list-item">
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isValid ? 'var(--success)' : cr.usedAt ? 'var(--primary)' : 'var(--error)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{cr.amount} sessão — {cr.reason}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {cr.usedAt ? `Usado: ${cr.usedAt.toLocaleDateString('pt-PT')}` : `Expira: ${cr.expiresAt?.toLocaleDateString('pt-PT')}`}
                            </div>
                          </div>
                          <span className={`badge badge-sm badge-${isValid ? 'success' : cr.usedAt ? 'primary' : 'error'}`}>
                            {isValid ? 'Ativo' : cr.usedAt ? 'Usado' : 'Expirado'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* COMMUNICATIONS */}
              {detailTab === 'comms' && (
                clientLogs.length === 0 ? <div className="empty-msg">Sem comunicações registadas.</div> : (
                  <div className="detail-list">
                    {clientLogs.map(log => (
                      <div key={log.id} className="detail-list-item comm-item">
                        <div className="comm-icon">
                          {log.channels?.some((ch: string) => ch.startsWith('email')) ? <Mail size={14} /> :
                           log.channels?.some((ch: string) => ch.startsWith('whatsapp')) ? <MessageCircle size={14} /> :
                           log.channels?.some((ch: string) => ch.startsWith('telegram')) ? <Send size={14} /> : <Mail size={14} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.8125rem' }}>{TRIGGER_LABELS[log.trigger] || log.trigger}</strong>
                            {log.channels?.map((ch: string, i: number) => (
                              <span key={i} className={`badge badge-sm badge-${ch.includes('ok') ? 'success' : ch.includes('fail') ? 'error' : 'warning'}`}>
                                {ch}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                            {log.message?.substring(0, 100)}{log.message?.length > 100 ? '...' : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {log.createdAt?.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} {log.createdAt?.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>

        <style>{`
          .client-detail-header { display: flex; align-items: center; gap: 1rem; background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); margin-bottom: 1rem; flex-wrap: wrap; }
          .client-avatar-lg { width: 56px; height: 56px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700; flex-shrink: 0; }
          .detail-tabs { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); margin-bottom: 1rem; }
          .detail-tab { background: none; border: none; padding: 0.5rem 1rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
          .detail-tab.active { background: var(--primary); color: white; }
          .detail-content { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); }
          .detail-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
          .detail-stat-box { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-lg); text-align: center; }
          .stat-val { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); }
          .stat-lbl { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
          .detail-list { display: flex; flex-direction: column; gap: 0.5rem; }
          .detail-list-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--beige); border-radius: var(--radius-md); }
          .detail-list-item:hover { background: var(--bg-secondary); }
          .empty-msg { text-align: center; padding: 2rem; color: var(--text-muted); }
          .comm-icon { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
          .badge-sm { font-size: 0.5625rem; padding: 0.1rem 0.3rem; }
          .sess-section-title { font-family: var(--font-body); font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
          .sess-table-wrap { background: white; border: 1px solid var(--beige); border-radius: var(--radius-md); overflow: hidden; }
          .sess-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
          .sess-table th { text-align: left; padding: 0.5rem 0.75rem; background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--sand); }
          .sess-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--beige); }
          .sess-table tr:last-child td { border-bottom: none; }
          .sess-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
          .sess-attended { background: #d1fae5; color: #065f46; }
          .sess-absent { background: #fee2e2; color: #991b1b; }
          .sess-cancelled { background: #f3f4f6; color: #6b7280; }
          .sess-scheduled { background: #dbeafe; color: #1e40af; }
          .sess-pending { background: #fef3c7; color: #92400e; }
          @media (max-width: 768px) { .detail-stats-grid { grid-template-columns: repeat(2, 1fr); } .client-detail-header { flex-direction: column; text-align: center; } .sess-table-wrap { overflow-x: auto; } .sess-table { min-width: 580px; } }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '2.5rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar clientes..." />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              if (!confirm('Normalizar todos os emails existentes para minúsculas? Atualiza users, clients, professors, purchases, payments e logs. Seguro de correr várias vezes.')) return;
              try {
                const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'normalizeEmailsCase');
                const res: any = await fn({});
                const results = res.data?.results || {};
                let totalUpdated = 0;
                Object.values(results).forEach((r: any) => { totalUpdated += r.updated || 0; });
                toast.success(`Migração concluída — ${totalUpdated} emails normalizados.`);
                console.table(results);
              } catch (err: any) {
                toast.error(err?.message || 'Erro na migração');
              }
            }}
            title="Normalizar emails antigos para minúsculas (one-off)"
            style={{ fontSize: '0.8125rem' }}
          >
            🔠 Normalizar Emails
          </button>
          <button className="btn btn-secondary" onClick={() => { setInviteModal(true); setInviteDone(false); setInviteData({ name: '', email: '', phone: '' }); }}>
            <UserPlus size={16} /> Criar e Convidar
          </button>
          <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Cliente</button>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModal && (
        <div className="modal-overlay" onClick={() => !inviting && setInviteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3><UserPlus size={18} /> Criar Conta e Convidar</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setInviteModal(false)} disabled={inviting}><X size={14} /></button>
            </div>
            {inviteDone ? (
              <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                <p style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>Conta criada e email enviado!</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{inviteData.name} receberá um email para definir a sua password.</p>
              </div>
            ) : (
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Cria uma conta para um novo aluno e envia-lhe um email para definir a sua própria password.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Nome *</label>
                    <input className="input" value={inviteData.name} onChange={e => setInviteData(d => ({ ...d, name: e.target.value }))} placeholder="Nome completo" autoFocus />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Email *</label>
                    <input className="input" type="email" value={inviteData.email} onChange={e => setInviteData(d => ({ ...d, email: e.target.value }))} placeholder="email@exemplo.com" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Telefone</label>
                    <input className="input" value={inviteData.phone} onChange={e => setInviteData(d => ({ ...d, phone: e.target.value }))} placeholder="+351 9XX XXX XXX" />
                  </div>
                </div>
              </div>
            )}
            {!inviteDone && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setInviteModal(false)} disabled={inviting}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateAndInvite}
                  disabled={inviting || !inviteData.name || !inviteData.email}
                >
                  {inviting
                    ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> A criar...</>
                    : <><Send size={14} /> Criar e Enviar Convite</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Cliente' : 'Editar Cliente'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>
          <div className="edit-grid">
            <div className="form-group"><label className="label">Nome</label><input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></div>
            <div className="form-group"><label className="label">Email</label><input className="input" type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} /></div>
            <div className="form-group"><label className="label">Telefone</label><input className="input" value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} /></div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="input" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>
                <option value="lead">Lead</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="form-group"><label className="label">Sessões Restantes</label><input className="input" type="number" value={editData.sessionsRemaining} onChange={e => setEditData({ ...editData, sessionsRemaining: e.target.value })} /></div>
            <div className="form-group"><label className="label">Total de Sessões</label><input className="input" type="number" value={editData.totalSessions} onChange={e => setEditData({ ...editData, totalSessions: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="label">Notas</label><textarea className="input textarea" rows={3} value={editData.notes || ''} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="Observações sobre o cliente..." /></div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state"><p>Sem clientes{search ? ' encontrados' : '. Adiciona o primeiro!'}</p></div>
      ) : (
        <div className="clients-list">
          {filtered.map(c => (
            <div key={c.id} className="client-row" onClick={() => { if (!editing) openClientDetail(c); }} style={{ cursor: editing ? 'default' : 'pointer' }}>
              <div className="client-avatar">{c.name.charAt(0).toUpperCase()}</div>
              <div className="client-info" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{c.name}</strong>
                  <span className={`badge badge-${c.status === 'active' ? 'success' : c.status === 'lead' ? 'warning' : 'error'}`}>
                    {c.status === 'active' ? 'Ativo' : c.status === 'lead' ? 'Lead' : 'Inativo'}
                  </span>
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.email}{c.phone ? ` | ${c.phone}` : ''}</span>
              </div>
              <div style={{ textAlign: 'right', minWidth: 110 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'flex-end', fontSize: '0.875rem', color: clientAttendedCount(c.id) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                  <Calendar size={12} /> {clientAttendedCount(c.id)} aulas
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>presenças</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(c)} disabled={!!editing}><Edit2 size={14} /></button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)} disabled={!!editing}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; }
        .clients-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .client-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); transition: all var(--transition-fast); }
        .client-row:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .client-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        @media (max-width: 768px) { .edit-grid { grid-template-columns: 1fr; } .client-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
