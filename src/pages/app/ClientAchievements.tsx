import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { LoyaltyConfig } from '../../types';
import { DEFAULT_LOYALTY, normaliseLoyaltyConfig } from '../../services/loyaltyPresets';
import { LoyaltyJourneyView } from '../../components/LoyaltyJourneyView';
import { ArrowLeft } from 'lucide-react';

export function ClientAchievements() {
  const { user } = useAuth();
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>(DEFAULT_LOYALTY);
  const [totalAttended, setTotalAttended] = useState(0);
  const [lastAttendanceAt, setLastAttendanceAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    try {
      const [mainCfg, userDoc] = await Promise.all([
        getDoc(doc(db, 'siteConfig', 'main')),
        getDoc(doc(db, 'users', user!.uid)),
      ]);
      if (mainCfg.exists() && mainCfg.data().loyalty) {
        setLoyalty(normaliseLoyaltyConfig(mainCfg.data().loyalty as LoyaltyConfig));
      }
      if (userDoc.exists()) {
        const data = userDoc.data();
        setTotalAttended(data?.totalAttendances || 0);
        const ts = data?.lastAttendanceAt;
        if (ts) setLastAttendanceAt(ts.toDate ? ts.toDate() : new Date(ts));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <Link to="/app" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1.25rem' }}>
        <ArrowLeft size={16} /> Dashboard
      </Link>
      <LoyaltyJourneyView
        totalAttended={totalAttended}
        lastAttendanceAt={lastAttendanceAt}
        loyalty={loyalty}
      />
    </div>
  );
}
