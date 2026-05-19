import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, updateDoc, addDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../services/firebase';
import { Professor, Session, Location, Plan, Subscription, DEFAULT_PROFESSOR_PERMISSIONS, ProfessorPermissions, ProfessorPayment, ProfessorPaymentMethod, LocationMonthlyCost } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, User, DollarSign, Calendar, TrendingUp, Users, Mail, ShieldCheck, Unlink, Send, Copy, Check, RefreshCw, Eye, ChevronDown, ChevronRight, Euro, CreditCard, AlertCircle } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';
import { useToast } from '../../components/ToastProvider';
import { computeSessionEarning, SessionEarning, PurchaseLite } from '../../services/earningsCalc';

const PERMISSION_LABELS: { key: keyof ProfessorPermissions; label: string; description: string }[] = [
  { key: 'canMarkAttendance',      label: 'Marcar Presenças',       description: 'Pode marcar/desmarcar presenças dos alunos' },
  { key: 'canManageWaitlist',      label: 'Gerir Lista de Espera',  description: 'Pode promover ou remover alunos da lista de espera' },
  { key: 'canEditSessions',        label: 'Editar Aulas',           description: 'Pode alterar hora, espaço e detalhes das suas aulas' },
  { key: 'canCancelSessions',      label: 'Cancelar Aulas',         description: 'Pode cancelar as suas próprias aulas' },
  { key: 'canSubstituteSession',   label: 'Substituir Professor',   description: 'Pode atribuir outro professor para substituir nas suas aulas' },
  { key: 'canCreateSessions',      label: 'Criar Aulas',            description: 'Pode criar novas aulas (ficam associadas a si)' },
  { key: 'canViewStudentContacts',   label: 'Ver Contactos dos Alunos', description: 'Tem acesso ao telefone e email dos alunos' },
  { key: 'canViewEarnings',          label: 'Ver Ganhos',             description: 'Pode consultar o resumo dos seus pagamentos' },
  { key: 'canAddStudentsToSession',  label: 'Adicionar Alunos à Aula', description: 'Pode inscrever alunos registados diretamente numa aula' },
  { key: 'canAcceptCashPayment',     label: 'Aceitar Pagamento em Mão', description: 'Pode registar pagamentos em numerário no portal' },
  { key: 'canRequestOnlinePayment',  label: 'Pedir Pagamento Online',  description: 'Pode disparar pedidos MB Way / Multibanco em nome do aluno' },
];

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

// Count how many times a specific day of week occurs in a month
function countDayInMonth(date: Date, dayOfWeek: number): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(year, month, d).getDay() === dayOfWeek) count++;
  }
  return count;
}

export function AdminProfessors() {
  const toast = useToast();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(new Date());
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [resetLink, setResetLink] = useState<{ email: string; link: string } | null>(null);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [highlightInput, setHighlightInput] = useState('');
  const [earningsModal, setEarningsModal] = useState<Professor | null>(null);
  const [purchasesById, setPurchasesById] = useState<Map<string, PurchaseLite>>(new Map());
  const [monthlyOverrides, setMonthlyOverrides] = useState<Map<string, LocationMonthlyCost>>(new Map());
  const [expandedSessionRows, setExpandedSessionRows] = useState<Set<string>>(new Set());
  const [professorPayments, setProfessorPayments] = useState<ProfessorPayment[]>([]);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState<{ amount: string; method: ProfessorPaymentMethod; notes: string; paidAt: string }>({ amount: '', method: 'transfer', notes: '', paidAt: new Date().toISOString().slice(0,10) });
  const [savingPay, setSavingPay] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profsSnap, sessSnap, locsSnap, plansSnap, subsSnap, purchasesSnap, paySnap, monthlySnap] = await Promise.all([
        getDocs(query(collection(db, 'professors'), orderBy('name'))),
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc'))),
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
        getDocs(query(collection(db, 'plans'), orderBy('order'))),
        getDocs(collection(db, 'subscriptions')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'professorPayments')),
        getDocs(collection(db, 'locationMonthlyCosts')),
      ]);

      const mocMap = new Map<string, LocationMonthlyCost>();
      monthlySnap.docs.forEach(d => {
        const data = d.data() as any;
        mocMap.set(d.id, {
          id: d.id,
          locationId: data.locationId,
          year: data.year,
          month: data.month,
          base: Number(data.base || 0),
          vatPercent: Number(data.vatPercent || 0),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        });
      });
      setMonthlyOverrides(mocMap);
      setProfessors(profsSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Professor)));
      setSessions(sessSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Session;
      }));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
      setSubscriptions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription)));

      const pMap = new Map<string, PurchaseLite>();
      purchasesSnap.docs.forEach(d => {
        const data = d.data() as any;
        pMap.set(d.id, {
          id: d.id,
          billingType: data.billingType,
          pricePerSession: data.pricePerSession,
          priceMonthly: data.priceMonthly,
          sessionsTotal: data.sessionsTotal,
          planName: data.planName,
        });
      });
      setPurchasesById(pMap);

      setProfessorPayments(paySnap.docs.map(d => {
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
        } as ProfessorPayment;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRegisterPayment = async (prof: Professor, defaultAmount: number, periodFrom: Date, periodTo: Date) => {
    if (!payForm.amount || isNaN(Number(payForm.amount))) {
      toast.error('Indica um valor válido');
      return;
    }
    setSavingPay(true);
    try {
      await addDoc(collection(db, 'professorPayments'), {
        professorId: prof.id,
        professorName: prof.name,
        amount: Number(payForm.amount),
        periodFrom,
        periodTo,
        paidAt: new Date(payForm.paidAt + 'T12:00:00'),
        paymentMethod: payForm.method,
        notes: payForm.notes || '',
        status: 'pending_confirmation',
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success('Pagamento registado. Aguarda confirmação do professor.');
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'transfer', notes: '', paidAt: new Date().toISOString().slice(0,10) });
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registar pagamento: ' + (err?.message || ''));
    } finally {
      setSavingPay(false);
    }
    void defaultAmount;
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Apagar este registo de pagamento?')) return;
    try {
      await deleteDoc(doc(db, 'professorPayments', paymentId));
      await loadData();
    } catch (err) { console.error(err); }
  };

  const loadProfessors = loadData;

  const startNew = () => {
    setEditing('new');
    setEditData({ name: '', style: '', age: '', bio: '', photoUrl: '', isActive: true, paymentModel: 'per_hour', rates: { group: '', private: '', event: '' }, pricePerStudent: '', deductSpaceCost: true, permissions: { ...DEFAULT_PROFESSOR_PERMISSIONS }, linkedUserId: '', linkedEmail: '', dateOfBirth: '', showOnLanding: false, landingSpecialty: '', landingBio: '', landingHighlights: [] });
    setLinkEmail('');
    setLinkError('');
  };
  const startEdit = (p: Professor) => {
    setEditing(p.id);
    setEditData({ ...p, rates: p.rates || { group: '', private: '', event: '' }, paymentModel: p.paymentModel || 'per_hour', pricePerStudent: p.pricePerStudent || '', deductSpaceCost: p.deductSpaceCost !== false, permissions: p.permissions || { ...DEFAULT_PROFESSOR_PERMISSIONS }, dateOfBirth: p.dateOfBirth || '', showOnLanding: p.showOnLanding || false, landingSpecialty: p.landingSpecialty || '', landingBio: p.landingBio || '', landingHighlights: p.landingHighlights || [] });
    setLinkEmail(p.linkedEmail || '');
    setLinkError('');
    setPortalLink(null);
    setCopiedLink(false);
  };
  const cancelEdit = () => { setEditing(null); setEditData(null); setPortalLink(null); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'professors')).id : editing!;
      const data = {
        name: editData.name, style: editData.style,
        age: editData.age ? Number(editData.age) : null,
        bio: editData.bio, photoUrl: editData.photoUrl || '',
        isActive: editData.isActive,
        paymentModel: editData.paymentModel || 'per_hour',
        rates: {
          group: editData.rates?.group ? Number(editData.rates.group) : null,
          private: editData.rates?.private ? Number(editData.rates.private) : null,
          event: editData.rates?.event ? Number(editData.rates.event) : null,
        },
        pricePerStudent: editData.pricePerStudent ? Number(editData.pricePerStudent) : null,
        deductSpaceCost: editData.deductSpaceCost || false,
        dateOfBirth: editData.dateOfBirth || null,
        showOnLanding: editData.showOnLanding || false,
        landingSpecialty: editData.landingSpecialty || null,
        landingBio: editData.landingBio || null,
        landingHighlights: editData.landingHighlights || [],
        permissions: editData.permissions || DEFAULT_PROFESSOR_PERMISSIONS,
        linkedUserId: editData.linkedUserId || null,
        linkedEmail: editData.linkedEmail || null,
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'professors', id), data);
      await loadData();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // Monthly earnings calculation per professor — uses new per-student paid model
  const getProfessorSummary = (prof: Professor) => {
    const { start, end } = getMonthRange(summaryMonth);
    const now = new Date();
    const profSessions = sessions.filter(s => s.professorId === prof.id && s.date >= start && s.date <= end);
    const completed = profSessions.filter(s => s.status === 'completed' || (s.status === 'scheduled' && s.date < now));
    const upcoming = profSessions.filter(s => s.status === 'scheduled' && s.date >= now);

    const calcEarnings = (sessionList: Session[]) => {
      if (prof.paymentModel === 'per_student' || !prof.paymentModel) {
        let total = 0;
        for (const s of sessionList) {
          const r = computeSessionEarning(s, prof, locations, purchasesById, sessions, monthlyOverrides);
          total += r.net;
        }
        return total;
      }
      // per_hour model
      let total = 0;
      for (const s of sessionList) {
        const durationHours = (s.duration || 60) / 60;
        const rate = s.classType === 'private' ? (prof.rates?.private || 0) : (prof.rates?.group || 0);
        const r = computeSessionEarning(s, prof, locations, purchasesById, sessions, monthlyOverrides);
        // For per_hour we ignore gross from students; only space cost from earningsCalc
        total += (durationHours * rate) - r.spaceCost;
      }
      return total;
    };

    // Detailed sessions for the modal
    const detailedSessions: SessionEarning[] = profSessions.map(s =>
      computeSessionEarning(s, prof, locations, purchasesById, sessions, monthlyOverrides)
    );

    return {
      totalSessions: profSessions.length,
      completedSessions: completed.length,
      upcomingSessions: upcoming.length,
      earned: calcEarnings(completed),
      projected: calcEarnings(completed) + calcEarnings(upcoming),
      detailedSessions,
    };
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este professor?')) return;
    await deleteDoc(doc(db, 'professors', id));
    await loadProfessors();
  };

  const handleCreateAccount = async () => {
    if (!linkEmail.trim() || !editing || editing === 'new') return;
    const prof = professors.find(p => p.id === editing);
    if (!prof) return;

    const email = linkEmail.trim().toLowerCase();
    // Validate email format
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setLinkError('Email inválido.');
      toast.error('Email inválido.');
      return;
    }

    // Check duplicate — already linked to another professor?
    const duplicateProf = professors.find(p => p.id !== editing && (p.linkedEmail || '').toLowerCase() === email);
    if (duplicateProf) {
      const msg = `Este email já está associado ao professor "${duplicateProf.name}". Cada email só pode estar vinculado a um professor.`;
      setLinkError(msg);
      toast.error(msg);
      return;
    }

    setLinking(true);
    setLinkError('');
    try {
      const fns = getFunctions(undefined, 'europe-west1');
      const createAccount = httpsCallable(fns, 'createProfessorAccount');
      const result: any = await createAccount({ email, professorId: editing, professorName: editData.name });
      setEditData((d: any) => ({ ...d, linkedUserId: result.data.uid, linkedEmail: email }));
      setLinkError('');
      await loadData();
      if (result.data.emailSent) {
        toast.success(`Conta criada e convite enviado para ${email}`);
      } else if (result.data.emailError) {
        toast.warning(`Conta criada mas email falhou: ${result.data.emailError}. Usa o link abaixo.`);
      } else {
        toast.success(`Conta criada para ${email}`);
      }
      if (result.data.resetLink) {
        setResetLink({ email, link: result.data.resetLink });
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Erro ao criar conta. Verifica o email e tenta novamente.';
      setLinkError(msg);
      toast.error(msg);
    }
    finally { setLinking(false); }
  };

  const handleUnlinkUser = async () => {
    if (!editing || editing === 'new') return;
    await updateDoc(doc(db, 'professors', editing), { linkedUserId: null, linkedEmail: null, updatedAt: new Date() });
    setEditData((d: any) => ({ ...d, linkedUserId: '', linkedEmail: '' }));
    setLinkEmail('');
    await loadData();
  };

  const handleGenerateLink = async (sendEmail = false) => {
    if (!editData?.linkedEmail) return;
    setGeneratingLink(true);
    setLinkError('');
    try {
      const fns = getFunctions(undefined, 'europe-west1');
      const genLink = httpsCallable(fns, 'generateProfessorResetLink');
      const result: any = await genLink({ email: editData.linkedEmail, professorName: editData.name, sendEmail });
      setPortalLink(result.data.resetLink);
      setCopiedLink(false);
      if (sendEmail) {
        if (result.data.emailSent) {
          setLinkError('✅ Email enviado com sucesso para ' + editData.linkedEmail);
        } else {
          setLinkError('⚠️ Email não enviado: ' + (result.data.emailError || 'erro desconhecido'));
        }
      }
    } catch (err: any) {
      console.error(err);
      setLinkError('Erro: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = () => {
    if (!portalLink) return;
    navigator.clipboard.writeText(portalLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const togglePermission = (key: keyof ProfessorPermissions) => {
    setEditData((d: any) => ({ ...d, permissions: { ...d.permissions, [key]: !d.permissions?.[key] } }));
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Professores que dão aulas nos teus espaços.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Professor</button>
      </div>

      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Professor' : 'Editar Professor'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>
          <div className="edit-grid">
            <div className="form-group"><label className="label">Nome</label><input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Joaquim Oliveira" /></div>
            <div className="form-group"><label className="label">Estilo de Yoga</label><input className="input" value={editData.style} onChange={e => setEditData({ ...editData, style: e.target.value })} placeholder="Vinyasa, Hatha, Yin..." /></div>
            <div className="form-group"><label className="label">Idade</label><input className="input" type="number" min="0" max="120" value={editData.age || ''} onChange={e => setEditData({ ...editData, age: e.target.value })} style={{ width: 100 }} /></div>
            <div className="form-group">
              <label className="label">
                Data de Nascimento
                {!editData.dateOfBirth && <span style={{ color: 'var(--accent)', fontSize: '0.8125rem', marginLeft: '0.25rem' }}>*</span>}
              </label>
              <input className="input" type="date" value={editData.dateOfBirth || ''} onChange={e => setEditData({ ...editData, dateOfBirth: e.target.value })} />
            </div>
            <ImageUpload value={editData.photoUrl || ''} onChange={url => setEditData({ ...editData, photoUrl: url })} folder="professors" label="Foto" />
          </div>
          <div className="form-group"><label className="label">Biografia</label><textarea className="input textarea" rows={4} value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} placeholder="Formação, experiência, filosofia..." /></div>

          {/* Payment Model */}
          <div className="form-group">
            <label className="label">Modelo de Pagamento</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label className={`payment-option ${editData.paymentModel === 'per_hour' ? 'active' : ''}`}>
                <input type="radio" name="paymentModel" value="per_hour" checked={editData.paymentModel === 'per_hour'} onChange={() => setEditData({ ...editData, paymentModel: 'per_hour' })} />
                <DollarSign size={16} /> <strong>Preço/Hora</strong>
                <small>Por tipo de aula</small>
              </label>
              <label className={`payment-option ${editData.paymentModel === 'per_student' ? 'active' : ''}`}>
                <input type="radio" name="paymentModel" value="per_student" checked={editData.paymentModel === 'per_student'} onChange={() => setEditData({ ...editData, paymentModel: 'per_student' })} />
                <Users size={16} /> <strong>Por Aluno</strong>
                <small>Ocupação da aula</small>
              </label>
            </div>
          </div>

          {editData.paymentModel === 'per_hour' ? (
            <div className="edit-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-group">
                <label className="label">€/h Grupo</label>
                <input className="input" type="number" min="0" step="0.5" value={editData.rates?.group || ''} onChange={e => setEditData({ ...editData, rates: { ...editData.rates, group: e.target.value } })} placeholder="15" />
              </div>
              <div className="form-group">
                <label className="label">€/h Privada</label>
                <input className="input" type="number" min="0" step="0.5" value={editData.rates?.private || ''} onChange={e => setEditData({ ...editData, rates: { ...editData.rates, private: e.target.value } })} placeholder="25" />
              </div>
              <div className="form-group">
                <label className="label">€/h Evento</label>
                <input className="input" type="number" min="0" step="0.5" value={editData.rates?.event || ''} onChange={e => setEditData({ ...editData, rates: { ...editData.rates, event: e.target.value } })} placeholder="20" />
              </div>
            </div>
          ) : (
            <div>
              <div className="per-student-info">
                <div className="info-box">
                  <strong>Como funciona:</strong>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}>
                    <li><strong>Aula avulsa</strong> → usa o preço do plano drop-in do espaço</li>
                    <li><strong>Subscrição</strong> → preço mensal ÷ (sessões/semana × semanas do mês)</li>
                    <li>Cada aluno contribui com o valor real que paga pela aula</li>
                  </ul>
                </div>
              </div>
              <div className="edit-grid" style={{ marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label className="label">€ por Aluno (fallback)</label>
                  <input className="input" type="number" min="0" step="0.5" value={editData.pricePerStudent || ''} onChange={e => setEditData({ ...editData, pricePerStudent: e.target.value })} placeholder="Só se não houver plano" />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>Usado apenas se o aluno não tiver plano/subscrição associados.</span>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                    <input type="checkbox" checked={editData.deductSpaceCost} onChange={e => setEditData({ ...editData, deductSpaceCost: e.target.checked })} />
                    Descontar custo do espaço
                  </label>
                </div>
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1.5rem' }}>
            <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} /> Ativo
          </label>

          {/* Landing Page */}
          <div style={{ borderTop: '1px solid var(--sand)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Eye size={16} color="var(--primary)" />
              <strong style={{ fontSize: '0.9375rem' }}>Landing Page</strong>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={editData.showOnLanding} onChange={e => setEditData({ ...editData, showOnLanding: e.target.checked })} />
              Mostrar na landing page (secção "A Nossa Equipa")
            </label>
            {editData.showOnLanding && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Especialidade (landing page)</label>
                  <input className="input" value={editData.landingSpecialty} onChange={e => setEditData({ ...editData, landingSpecialty: e.target.value })} placeholder="Hatha Yoga · Meditação" />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Aparece como badge no cartão do professor.</span>
                </div>
                <div className="form-group">
                  <label className="label">Bio curta (landing page)</label>
                  <textarea className="input textarea" rows={3} value={editData.landingBio} onChange={e => setEditData({ ...editData, landingBio: e.target.value })} placeholder="Deixa em branco para usar a bio principal." />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Bio mais curta para o cartão público. Se vazio, usa a bio principal.</span>
                </div>
                <div className="form-group">
                  <label className="label">Destaques (landing page)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      value={highlightInput}
                      onChange={e => setHighlightInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && highlightInput.trim()) {
                          e.preventDefault();
                          setEditData({ ...editData, landingHighlights: [...(editData.landingHighlights || []), highlightInput.trim()] });
                          setHighlightInput('');
                        }
                      }}
                      placeholder="Ex: RYT-200 Yoga Alliance"
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => {
                      if (highlightInput.trim()) {
                        setEditData({ ...editData, landingHighlights: [...(editData.landingHighlights || []), highlightInput.trim()] });
                        setHighlightInput('');
                      }
                    }}>+ Adicionar</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {(editData.landingHighlights || []).map((h: string, i: number) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'var(--beige)', border: '1px solid var(--sand)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.625rem', fontSize: '0.8125rem' }}>
                        {h}
                        <button type="button" onClick={() => setEditData({ ...editData, landingHighlights: editData.landingHighlights.filter((_: string, j: number) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.375rem', display: 'block' }}>Prima Enter ou clica "+ Adicionar" para cada destaque.</span>
                </div>
              </div>
            )}
          </div>

          {/* Portal Access */}
          {editing !== 'new' && (
            <div style={{ borderTop: '1px solid var(--sand)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Mail size={16} color="var(--primary)" />
                <strong style={{ fontSize: '0.9375rem' }}>Acesso ao Portal</strong>
              </div>
              {editData.linkedUserId ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(124,154,114,0.08)', border: '1.5px solid rgba(124,154,114,0.3)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                    <ShieldCheck size={18} color="var(--primary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary-dark)' }}>Conta ativa</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{editData.linkedEmail}</div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={handleUnlinkUser} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Unlink size={13} /> Desligar
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleGenerateLink(false)} disabled={generatingLink} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {generatingLink ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />} Gerar link de acesso
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleGenerateLink(true)} disabled={generatingLink} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Send size={13} /> Reenviar email de convite
                    </button>
                  </div>
                  {linkError && (
                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem', color: linkError.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>{linkError}</div>
                  )}
                  {portalLink && (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--sand)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{portalLink}</span>
                      <button className="btn btn-sm btn-secondary" onClick={copyLink} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {copiedLink ? <><Check size={13} color="var(--success)" /> Copiado</> : <><Copy size={13} /> Copiar</>}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Cria uma conta para este professor. Ele receberá um email com um link para <strong>definir a sua própria password</strong> e aceder ao portal em <code>/professor</code>.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="input" style={{ flex: 1 }} value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="email@professor.pt" type="email" />
                    <button className="btn btn-primary" onClick={handleCreateAccount} disabled={linking || !linkEmail.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                      {linking ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={14} /> Criar e Convidar</>}
                    </button>
                  </div>
                  {linkError && <div style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.375rem' }}>{linkError}</div>}
                </div>
              )}
            </div>
          )}

          {/* Permissions */}
          <div style={{ borderTop: '1px solid var(--sand)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <ShieldCheck size={16} color="var(--primary)" />
              <strong style={{ fontSize: '0.9375rem' }}>Permissões do Portal</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {PERMISSION_LABELS.map(({ key, label, description }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.625rem 0.875rem', background: editData.permissions?.[key] ? 'rgba(124,154,114,0.07)' : 'var(--beige)', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1.5px solid', borderColor: editData.permissions?.[key] ? 'rgba(124,154,114,0.3)' : 'transparent', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={!!editData.permissions?.[key]} onChange={() => togglePermission(key)} style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', color: editData.permissions?.[key] ? 'var(--primary-dark)' : 'var(--text-secondary)' }}>{label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {professors.length > 0 && !editing && (
        <div className="month-summary-section">
          <div className="month-nav">
            <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(summaryMonth); d.setMonth(d.getMonth() - 1); setSummaryMonth(d); }}>←</button>
            <span className="month-label">{summaryMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(summaryMonth); d.setMonth(d.getMonth() + 1); setSummaryMonth(d); }}>→</button>
          </div>
        </div>
      )}

      {professors.length === 0 && !editing ? (
        <div className="empty-state"><p>Sem professores. Adiciona o primeiro!</p></div>
      ) : (
        <div className="list">
          {professors.map(p => {
            const summary = getProfessorSummary(p);
            return (
            <div key={p.id} className={`list-row ${!p.isActive ? 'inactive' : ''}`}>
              {p.photoUrl ? <img src={p.photoUrl} alt={p.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={20} /></div>}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{p.name}</strong>
                  <span className="badge badge-secondary" style={{ fontSize: '0.625rem' }}>
                    {p.paymentModel === 'per_student' ? 'Por aluno' : 'Por hora'}
                  </span>
                  {!p.isActive && <span className="badge badge-warning">Inativo</span>}
                  {p.linkedUserId && <span style={{ fontSize: '0.7rem', background: 'rgba(124,154,114,0.12)', color: 'var(--primary-dark)', padding: '0.1rem 0.4rem', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><ShieldCheck size={10} /> Portal</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.style}{p.age ? ` · ${p.age} anos` : ''}{p.linkedEmail ? ` · ${p.linkedEmail}` : ''}</div>
              </div>
              {summary.totalSessions > 0 && (
                <div className="prof-summary">
                  <div className="prof-stat">
                    <Calendar size={12} />
                    <span>{summary.completedSessions}/{summary.totalSessions} aulas</span>
                  </div>
                  <div className="prof-stat earned">
                    <DollarSign size={12} />
                    <span>{summary.earned.toFixed(0)}€</span>
                    <small>ganho</small>
                  </div>
                  {summary.upcomingSessions > 0 && (
                    <div className="prof-stat projected">
                      <TrendingUp size={12} />
                      <span>{summary.projected.toFixed(0)}€</span>
                      <small>previsto</small>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {summary.totalSessions > 0 && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => { setEarningsModal(p); setExpandedSessionRows(new Set()); }}
                    disabled={!!editing}
                    title="Ver ganhos detalhados"
                  >
                    <Eye size={14} />
                  </button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(p)} disabled={!!editing}><Edit2 size={14} /></button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)} disabled={!!editing}><Trash2 size={14} /></button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; }
        .list { display: flex; flex-direction: column; gap: 0.5rem; }
        .list-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .list-row.inactive { opacity: 0.6; }
        .list-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        .payment-option { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem 1.25rem; border: 2px solid var(--sand); border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast); flex: 1; text-align: center; }
        .payment-option input[type="radio"] { display: none; }
        .payment-option small { font-size: 0.6875rem; color: var(--text-muted); }
        .payment-option:hover { border-color: var(--primary); }
        .payment-option.active { border-color: var(--primary); background: rgba(124,154,114,0.08); }

        .info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: var(--radius-lg); padding: 0.75rem 1rem; font-size: 0.8125rem; color: #0369a1; }
        .info-box strong { font-size: 0.8125rem; }
        .info-box li { margin-bottom: 0.25rem; color: #0c4a6e; }

        .month-summary-section { margin-bottom: 1rem; }
        .month-nav { display: flex; align-items: center; gap: 0.75rem; justify-content: center; }
        .month-label { font-weight: 600; font-size: 0.9375rem; min-width: 160px; text-align: center; text-transform: capitalize; }

        .prof-summary { display: flex; gap: 0.75rem; align-items: center; }
        .prof-stat { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; }
        .prof-stat.earned { color: var(--success); font-weight: 600; }
        .prof-stat.projected { color: var(--primary); }
        .prof-stat small { font-size: 0.625rem; color: var(--text-muted); }

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .list-row { flex-wrap: wrap; }
          .prof-summary { width: 100%; justify-content: flex-start; margin-top: 0.25rem; }
        }
      `}</style>

      {/* Earnings Detail Modal */}
      {earningsModal && (() => {
        const summary = getProfessorSummary(earningsModal);
        const detailed = summary.detailedSessions
          .slice()
          .sort((a, b) => a.session.date.getTime() - b.session.date.getTime());
        const now = new Date();
        const completed = detailed.filter(d => d.session.status === 'completed' || (d.session.status === 'scheduled' && d.session.date < now));
        const upcoming = detailed.filter(d => d.session.status === 'scheduled' && d.session.date >= now);
        const totalGross = completed.reduce((acc, r) => acc + r.gross, 0);
        const totalSpace = completed.reduce((acc, r) => acc + r.spaceCost, 0);
        const totalNet = completed.reduce((acc, r) => acc + r.net, 0);
        const totalStudents = completed.reduce((acc, r) => acc + r.attendedStudents.length, 0);
        const renderRow = (r: SessionEarning) => {
          const isExpanded = expandedSessionRows.has(r.session.id);
          const noStudents = r.attendedStudents.length === 0;
          return (
            <React.Fragment key={r.session.id}>
              <tr style={{ cursor: noStudents ? 'default' : 'pointer', opacity: noStudents ? 0.5 : 1 }}
                  onClick={() => {
                    if (noStudents) return;
                    setExpandedSessionRows(prev => {
                      const next = new Set(prev);
                      if (next.has(r.session.id)) next.delete(r.session.id);
                      else next.add(r.session.id);
                      return next;
                    });
                  }}>
                <td>{!noStudents && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}</td>
                <td>{r.session.date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td>{r.session.startTime}</td>
                <td>{r.session.locationName}</td>
                <td>{r.attendedStudents.length}</td>
                <td className="ape-amount">{r.gross.toFixed(2)}€</td>
                {totalSpace > 0 && <td className="ape-amount-neg">{r.spaceCost > 0 ? `-${r.spaceCost.toFixed(2)}€` : '—'}</td>}
                <td className="ape-amount ape-net">{r.net.toFixed(2)}€</td>
              </tr>
              {isExpanded && r.attendedStudents.length > 0 && (
                <tr className="ape-detail-row">
                  <td></td>
                  <td colSpan={6 + (totalSpace > 0 ? 1 : 0)} style={{ padding: 0 }}>
                    <div className="ape-detail-content">
                      <table className="ape-inner-table">
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
                              <td><span className={`ape-source ape-source-${s.source}`}>{s.source === 'dropin' ? 'Aula avulsa' : s.source === 'subscription' ? 'Plano' : s.source === 'cash' ? 'Em mão' : 'Sem registo'}</span></td>
                              <td className="ape-justify">{s.justification}</td>
                              <td className="ape-amount-sm">{s.amount.toFixed(2)}€</td>
                            </tr>
                          ))}
                          <tr className="ape-inner-total">
                            <td colSpan={3} style={{ textAlign: 'right' }}>Subtotal alunos:</td>
                            <td className="ape-amount-sm">{r.gross.toFixed(2)}€</td>
                          </tr>
                          {r.spaceCost > 0 && (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Custo espaço:</td>
                              <td className="ape-amount-neg-sm">−{r.spaceCost.toFixed(2)}€</td>
                            </tr>
                          )}
                          <tr className="ape-inner-net">
                            <td colSpan={3} style={{ textAlign: 'right' }}><strong>Recebe:</strong></td>
                            <td className="ape-amount ape-net"><strong>{r.net.toFixed(2)}€</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        };
        return (
          <div className="modal-overlay" onClick={() => setEarningsModal(null)}>
            <div className="modal-box" style={{ maxWidth: 980, width: '95%' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={18} color="var(--accent)" /> Ganhos · {earningsModal.name}
                </h3>
                <button className="modal-close" onClick={() => setEarningsModal(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {summaryMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} · Recebe o que cada aluno presente pagou pela aula{earningsModal.deductSpaceCost ? ', menos o custo do espaço.' : '.'}
                </p>

                <div className="ape-summary">
                  <div className="ape-card"><Calendar size={16} color="var(--primary)" /><div className="ape-card-value">{completed.length}</div><div className="ape-card-label">Aulas dadas</div></div>
                  <div className="ape-card"><Users size={16} color="var(--accent)" /><div className="ape-card-value">{totalStudents}</div><div className="ape-card-label">Presenças</div></div>
                  <div className="ape-card"><Euro size={16} color="#059669" /><div className="ape-card-value" style={{ color: '#059669' }}>{totalGross.toFixed(2)}€</div><div className="ape-card-label">Bruto</div></div>
                  {totalSpace > 0 && <div className="ape-card"><DollarSign size={16} color="#dc2626" /><div className="ape-card-value" style={{ color: '#dc2626' }}>−{totalSpace.toFixed(2)}€</div><div className="ape-card-label">Custo espaços</div></div>}
                  <div className="ape-card ape-card-accent"><TrendingUp size={16} color="#1d4ed8" /><div className="ape-card-value" style={{ color: '#1d4ed8' }}>{totalNet.toFixed(2)}€</div><div className="ape-card-label">Líquido</div></div>
                </div>

                {(() => {
                  const monthRange = getMonthRange(summaryMonth);
                  const monthPayments = professorPayments
                    .filter(p => p.professorId === earningsModal.id && p.periodFrom >= monthRange.start && p.periodFrom <= monthRange.end)
                    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
                  const totalPaid = monthPayments.reduce((acc, p) => acc + p.amount, 0);
                  const outstanding = totalNet - totalPaid;
                  return (
                    <div className="ape-payments">
                      <div className="ape-payments-header">
                        <div>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <CreditCard size={14} /> Pagamentos ao professor
                          </strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Pago: <strong style={{ color: '#059669' }}>{totalPaid.toFixed(2)}€</strong> · Em falta: <strong style={{ color: outstanding > 0.005 ? '#dc2626' : 'var(--text-secondary)' }}>{outstanding.toFixed(2)}€</strong>
                          </div>
                        </div>
                        {!showPayForm && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setPayForm({
                                amount: outstanding > 0 ? outstanding.toFixed(2) : totalNet.toFixed(2),
                                method: 'transfer',
                                notes: '',
                                paidAt: new Date().toISOString().slice(0, 10),
                              });
                              setShowPayForm(true);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                          >
                            <Plus size={14} /> Registar pagamento
                          </button>
                        )}
                      </div>

                      {showPayForm && (
                        <div className="ape-pay-form">
                          <div className="ape-pay-grid">
                            <label>
                              <span>Valor (€)</span>
                              <input className="input" type="number" step="0.01" min="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                            </label>
                            <label>
                              <span>Data</span>
                              <input className="input" type="date" value={payForm.paidAt} onChange={e => setPayForm({ ...payForm, paidAt: e.target.value })} />
                            </label>
                            <label>
                              <span>Método</span>
                              <select className="input" value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value as ProfessorPaymentMethod })}>
                                <option value="transfer">Transferência</option>
                                <option value="mbway">MB Way</option>
                                <option value="cash">Numerário</option>
                                <option value="other">Outro</option>
                              </select>
                            </label>
                          </div>
                          <label style={{ display: 'block', marginTop: '0.5rem' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Notas (opcional)</span>
                            <input className="input" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Referência da transferência, observações..." />
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleRegisterPayment(earningsModal, totalNet, monthRange.start, monthRange.end)}
                              disabled={savingPay || !payForm.amount}
                            >
                              {savingPay ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={14} /> Confirmar</>}
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowPayForm(false)}>Cancelar</button>
                          </div>
                        </div>
                      )}

                      {monthPayments.length > 0 && (
                        <table className="ape-pay-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Método</th>
                              <th>Notas</th>
                              <th>Estado</th>
                              <th style={{ textAlign: 'right' }}>Valor</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthPayments.map(p => (
                              <tr key={p.id}>
                                <td>{p.paidAt.toLocaleDateString('pt-PT')}</td>
                                <td>{p.paymentMethod === 'transfer' ? 'Transferência' : p.paymentMethod === 'mbway' ? 'MB Way' : p.paymentMethod === 'cash' ? 'Numerário' : 'Outro'}</td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{p.notes || '—'}</td>
                                <td>
                                  {p.status === 'confirmed' ? (
                                    <span className="ape-pay-badge ape-pay-confirmed"><Check size={11} /> Confirmado</span>
                                  ) : (
                                    <span className="ape-pay-badge ape-pay-pending"><AlertCircle size={11} /> Por confirmar</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.amount.toFixed(2)}€</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button className="btn-icon" onClick={() => handleDeletePayment(p.id)} title="Apagar"><Trash2 size={12} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })()}

                {detailed.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sem aulas neste mês.</div>
                ) : (
                  <div className="ape-table-wrap">
                    <table className="ape-table">
                      <thead>
                        <tr>
                          <th style={{ width: 32 }}></th>
                          <th>Data</th>
                          <th>Hora</th>
                          <th>Local</th>
                          <th>Presentes</th>
                          <th>Bruto</th>
                          {totalSpace > 0 && <th>Espaço</th>}
                          <th>Líquido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completed.length > 0 && (
                          <>
                            <tr className="ape-section-row"><td colSpan={6 + (totalSpace > 0 ? 2 : 1)}>Aulas dadas</td></tr>
                            {completed.map(renderRow)}
                          </>
                        )}
                        {upcoming.length > 0 && (
                          <>
                            <tr className="ape-section-row"><td colSpan={6 + (totalSpace > 0 ? 2 : 1)}>Próximas (previsão)</td></tr>
                            {upcoming.map(renderRow)}
                          </>
                        )}
                      </tbody>
                      {completed.length > 0 && (
                        <tfoot>
                          <tr>
                            <td></td>
                            <td colSpan={4} className="ape-total-label">Total mês</td>
                            <td className="ape-amount">{totalGross.toFixed(2)}€</td>
                            {totalSpace > 0 && <td className="ape-amount-neg">−{totalSpace.toFixed(2)}€</td>}
                            <td className="ape-amount ape-net">{totalNet.toFixed(2)}€</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setEarningsModal(null)}>Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        .ape-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
        .ape-card { background: white; border: 1px solid var(--sand); border-radius: var(--radius-lg); padding: 0.75rem; text-align: center; }
        .ape-card-accent { background: #eff6ff; border-color: #bfdbfe; }
        .ape-card-value { font-size: 1.125rem; font-weight: 700; font-family: var(--font-heading); margin: 0.25rem 0 0.125rem; }
        .ape-card-label { font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

        .ape-table-wrap { background: white; border: 1px solid var(--sand); border-radius: var(--radius-lg); overflow: hidden; }
        .ape-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .ape-table th { text-align: left; padding: 0.625rem 0.75rem; background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--sand); white-space: nowrap; }
        .ape-table td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--beige); vertical-align: middle; }
        .ape-table tbody tr:hover:not(.ape-detail-row):not(.ape-section-row) td { background: var(--bg-secondary); }
        .ape-section-row td { background: var(--beige) !important; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); padding: 0.5rem 0.75rem !important; }
        .ape-table tfoot td { padding: 0.75rem; font-weight: 700; font-size: 0.875rem; background: var(--bg-secondary); border-top: 2px solid var(--sand); }
        .ape-total-label { color: var(--text-secondary); }
        .ape-amount { font-weight: 600; color: #059669; white-space: nowrap; }
        .ape-amount-neg { font-weight: 600; color: #dc2626; white-space: nowrap; }
        .ape-net { color: #1d4ed8 !important; }

        .ape-detail-row td { padding: 0; background: var(--bg-secondary); border-bottom: 1px solid var(--beige); }
        .ape-detail-content { padding: 0.625rem 0.875rem; }
        .ape-inner-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; background: white; border-radius: var(--radius-md); overflow: hidden; }
        .ape-inner-table th { background: var(--beige); padding: 0.4rem 0.625rem; font-size: 0.6875rem; text-align: left; }
        .ape-inner-table td { padding: 0.4rem 0.625rem; border-bottom: 1px solid var(--beige); }
        .ape-inner-table tr:last-child td { border-bottom: none; }
        .ape-inner-total td { font-weight: 600; background: var(--bg-secondary); }
        .ape-inner-net td { background: #eff6ff; }

        .ape-justify { font-size: 0.7rem; color: var(--text-secondary); font-family: monospace; }
        .ape-amount-sm { font-weight: 600; color: #059669; white-space: nowrap; text-align: right; }
        .ape-amount-neg-sm { font-weight: 600; color: #dc2626; white-space: nowrap; text-align: right; }

        .ape-source { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 999px; font-size: 0.625rem; font-weight: 600; }
        .ape-source-dropin { background: #fef3c7; color: #92400e; }
        .ape-source-subscription { background: #dbeafe; color: #1e40af; }
        .ape-source-cash { background: #d1fae5; color: #065f46; }
        .ape-source-unknown { background: #f3f4f6; color: #6b7280; }

        .ape-payments { background: white; border: 1px solid var(--sand); border-radius: var(--radius-lg); padding: 1rem; margin-bottom: 1.25rem; }
        .ape-payments-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem; }
        .ape-pay-form { background: var(--bg-secondary); border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 0.75rem; }
        .ape-pay-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .ape-pay-grid label, .ape-pay-form > label { display: flex; flex-direction: column; gap: 0.25rem; }
        .ape-pay-grid label span, .ape-pay-form > label > span { font-size: 0.75rem; color: var(--text-muted); }
        .ape-pay-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin-top: 0.5rem; }
        .ape-pay-table th { text-align: left; padding: 0.5rem 0.625rem; background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--sand); }
        .ape-pay-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid var(--beige); }
        .ape-pay-table tr:last-child td { border-bottom: none; }
        .ape-pay-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
        .ape-pay-confirmed { background: #d1fae5; color: #065f46; }
        .ape-pay-pending { background: #fef3c7; color: #92400e; }
        @media (max-width: 600px) { .ape-pay-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Reset Link Modal */}
      {resetLink && (
        <div className="modal-overlay" onClick={() => setResetLink(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Conta criada com sucesso</h3>
              <button className="modal-close" onClick={() => setResetLink(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                A conta foi criada para <strong>{resetLink.email}</strong>.
              </p>
              <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92400e', marginBottom: '0.5rem' }}>
                  ⚠️ Se o professor não recebeu o email, partilha este link diretamente:
                </p>
                <div style={{ background: 'white', border: '1px solid var(--sand)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {resetLink.link}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => { navigator.clipboard.writeText(resetLink.link); }}
                >
                  Copiar Link
                </button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Este link expira em 24 horas. O professor define a sua própria password ao clicar nele.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setResetLink(null)}>OK, entendido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
