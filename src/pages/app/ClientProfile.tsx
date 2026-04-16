import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Save, Loader, CheckCircle } from 'lucide-react';

export function ClientProfile() {
  const { user, appUser, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(appUser?.dateOfBirth || '');
  const [emergencyContact, setEmergencyContact] = useState(appUser?.emergencyContact || '');
  const [goals, setGoals] = useState(appUser?.goals || '');
  const [injuries, setInjuries] = useState(appUser?.injuries || '');
  const [experience, setExperience] = useState(appUser?.experience || '');

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        phone: phone || null,
        dateOfBirth: dateOfBirth || null,
        emergencyContact: emergencyContact || null,
        goals: goals || null,
        injuries: injuries || null,
        experience: experience || null,
        updatedAt: new Date(),
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="profile-card">
        <div className="profile-avatar">
          <span>{name.charAt(0).toUpperCase()}</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', textAlign: 'center', margin: '0.75rem 0 0.25rem' }}>{name}</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 2rem' }}>{appUser?.email}</p>

        <div className="form-section">
          <h3>Dados Pessoais</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Nome</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Telefone</label>
              <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351 912 345 678" />
            </div>
            <div className="form-group">
              <label className="label">Data de Nascimento</label>
              <input className="input" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Contacto de Emergência</label>
              <input className="input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Nome e telefone" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Sobre a Tua Prática</h3>
          <div className="form-group">
            <label className="label">Nível de Experiência</label>
            <select className="input" value={experience} onChange={e => setExperience(e.target.value)}>
              <option value="">Selecionar...</option>
              <option value="beginner">Iniciante</option>
              <option value="intermediate">Intermédio</option>
              <option value="advanced">Avançado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Objetivos</label>
            <textarea className="input textarea" rows={3} value={goals} onChange={e => setGoals(e.target.value)} placeholder="O que pretendes alcançar com a prática de yoga? (ex: flexibilidade, reduzir stress, força...)" />
          </div>
          <div className="form-group">
            <label className="label">Lesões ou Condições Físicas</label>
            <textarea className="input textarea" rows={3} value={injuries} onChange={e => setInjuries(e.target.value)} placeholder="Lesões, limitações ou condições que o instrutor deve saber (ex: hérnia discal, gravidez, cirurgia recente...)" />
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving} style={{ marginTop: '1rem' }}>
          {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <><CheckCircle size={18} /> Guardado!</> : <><Save size={18} /> Guardar Alterações</>}
        </button>
      </div>

      <style>{`
        .profile-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-sm); max-width: 700px; }
        .profile-avatar { width: 80px; height: 80px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 600; font-family: var(--font-heading); margin: 0 auto; }
        .form-section { margin-bottom: 1.5rem; }
        .form-section h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 600; color: var(--primary-dark); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--beige); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

        @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
