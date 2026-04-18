import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Professor, Session, Location, Plan, Subscription } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, User, DollarSign, Calendar, TrendingUp, Users } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profsSnap, sessSnap, locsSnap, plansSnap, subsSnap] = await Promise.all([
        getDocs(query(collection(db, 'professors'), orderBy('name'))),
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc'))),
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
        getDocs(query(collection(db, 'plans'), orderBy('order'))),
        getDocs(collection(db, 'subscriptions')),
      ]);
      setProfessors(profsSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Professor)));
      setSessions(sessSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Session;
      }));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
      setSubscriptions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadProfessors = loadData;

  const startNew = () => { setEditing('new'); setEditData({ name: '', style: '', age: '', bio: '', photoUrl: '', isActive: true, paymentModel: 'per_hour', rates: { group: '', private: '', event: '' }, pricePerStudent: '', deductSpaceCost: true }); };
  const startEdit = (p: Professor) => { setEditing(p.id); setEditData({ ...p, rates: p.rates || { group: '', private: '', event: '' }, paymentModel: p.paymentModel || 'per_hour', pricePerStudent: p.pricePerStudent || '', deductSpaceCost: p.deductSpaceCost !== false }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

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
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'professors', id), data);
      await loadData();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // Monthly earnings calculation per professor
  const getProfessorSummary = (prof: Professor) => {
    const { start, end } = getMonthRange(summaryMonth);
    const now = new Date();
    const profSessions = sessions.filter(s => s.professorId === prof.id && s.date >= start && s.date <= end);
    const completed = profSessions.filter(s => s.status === 'completed' || (s.status === 'scheduled' && s.date < now));
    const upcoming = profSessions.filter(s => s.status === 'scheduled' && s.date >= now);

    // Get what a student pays per session based on their plan
    const getStudentSessionValue = (student: { subscriptionId?: string }, session: Session): number => {
      if (student.subscriptionId) {
        // Has a subscription → priceMonthly ÷ (sessionsPerWeek × weeks in month)
        const sub = subscriptions.find(s => s.id === student.subscriptionId);
        if (sub && sub.priceMonthly && sub.sessionsPerWeek) {
          const weeksInMonth = countDayInMonth(session.date, session.date.getDay());
          return sub.priceMonthly / (sub.sessionsPerWeek * weeksInMonth);
        }
      }
      // No subscription → drop-in, find the dropin plan for this location
      const dropinPlan = plans.find(p => p.billingType === 'dropin' && p.locationId === session.locationId && p.isActive);
      if (dropinPlan?.pricePerSession) return dropinPlan.pricePerSession;
      // Fallback: use fixed pricePerStudent if set
      return prof.pricePerStudent || 0;
    };

    const calcEarnings = (sessionList: Session[]) => {
      let total = 0;
      for (const s of sessionList) {
        if (prof.paymentModel === 'per_student') {
          const activeStudents = s.enrolledStudents.filter(st => st.status !== 'cancelled');
          let gross = 0;
          for (const student of activeStudents) {
            gross += getStudentSessionValue(student, s);
          }
          const loc = locations.find(l => l.id === s.locationId);
          const weeksThisDay = countDayInMonth(s.date, s.date.getDay());
          const spaceCost = prof.deductSpaceCost && loc ? (loc.costMonthlyPerSlot || loc.costPerSession || 0) / weeksThisDay : 0;
          total += gross - spaceCost;
        } else {
          const durationHours = (s.duration || 60) / 60;
          const rate = s.classType === 'private' ? (prof.rates?.private || 0) : (prof.rates?.group || 0);
          total += durationHours * rate;
        }
      }
      return total;
    };

    return {
      totalSessions: profSessions.length,
      completedSessions: completed.length,
      upcomingSessions: upcoming.length,
      earned: calcEarnings(completed),
      projected: calcEarnings(completed) + calcEarnings(upcoming),
    };
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este professor?')) return;
    await deleteDoc(doc(db, 'professors', id));
    await loadProfessors();
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
            <div className="form-group"><label className="label">Idade</label><input className="input" type="number" value={editData.age || ''} onChange={e => setEditData({ ...editData, age: e.target.value })} style={{ width: 100 }} /></div>
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
                <input className="input" type="number" step="0.5" value={editData.rates?.group || ''} onChange={e => setEditData({ ...editData, rates: { ...editData.rates, group: e.target.value } })} placeholder="15" />
              </div>
              <div className="form-group">
                <label className="label">€/h Privada</label>
                <input className="input" type="number" step="0.5" value={editData.rates?.private || ''} onChange={e => setEditData({ ...editData, rates: { ...editData.rates, private: e.target.value } })} placeholder="25" />
              </div>
              <div className="form-group">
                <label className="label">€/h Evento</label>
                <input className="input" type="number" step="0.5" value={editData.rates?.event || ''} onChange={e => setEditData({ ...editData, rates: { ...editData.rates, event: e.target.value } })} placeholder="20" />
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
                  <input className="input" type="number" step="0.5" value={editData.pricePerStudent || ''} onChange={e => setEditData({ ...editData, pricePerStudent: e.target.value })} placeholder="Só se não houver plano" />
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} /> Ativo
          </label>
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
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.style}{p.age ? ` · ${p.age} anos` : ''}</div>
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
    </div>
  );
}
