/**
 * CLOUD FUNCTION: Compute professor earnings for a date range.
 *
 * Caller authorization:
 * - Admin (anyone in /admins) — can fetch any professor's earnings (pass professorId)
 * - Linked professor — can only fetch their own earnings (professorId ignored)
 *
 * Returns the same SessionEarning[] shape used in the client, but computed
 * server-side with admin SDK access (so professors don't need direct read on /purchases).
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface PurchaseLite {
  id: string;
  billingType?: 'subscription' | 'dropin';
  pricePerSession?: number;
  priceMonthly?: number;
  sessionsTotal?: number;
  planName?: string;
}

interface StudentEarning {
  userId: string;
  userName: string;
  status: string;
  source: 'dropin' | 'subscription' | 'cash' | 'unknown';
  planName: string;
  purchaseTotal: number;
  sessionsTotal: number;
  amount: number;
  justification: string;
}

function computeStudentEarning(student: any, purchase: PurchaseLite | undefined): StudentEarning {
  const userName = student.userName || '?';
  const userId = student.userId;
  const status = student.status || 'enrolled';

  if (student.cashPayment && typeof student.cashPayment.amount === 'number') {
    const amt = student.cashPayment.amount;
    return {
      userId, userName, status,
      source: 'cash',
      planName: 'Pagamento em mão',
      purchaseTotal: amt,
      sessionsTotal: 1,
      amount: amt,
      justification: `Pagamento em mão: ${amt.toFixed(2)}€`,
    };
  }

  if (purchase?.billingType === 'dropin') {
    const amt = Number(purchase.pricePerSession || purchase.priceMonthly || 0);
    return {
      userId, userName, status,
      source: 'dropin',
      planName: purchase.planName || 'Aula avulsa',
      purchaseTotal: amt,
      sessionsTotal: 1,
      amount: amt,
      justification: `${purchase.planName || 'Aula avulsa'}: ${amt.toFixed(2)}€`,
    };
  }

  if (purchase?.billingType === 'subscription' || (purchase && (purchase.sessionsTotal || 0) > 0)) {
    const total = Number(purchase!.priceMonthly || 0);
    const sessions = Number(purchase!.sessionsTotal || 1);
    const perSession = sessions > 0 ? total / sessions : 0;
    return {
      userId, userName, status,
      source: 'subscription',
      planName: purchase!.planName || 'Plano',
      purchaseTotal: total,
      sessionsTotal: sessions,
      amount: perSession,
      justification: `${purchase!.planName || 'Plano'}: ${total.toFixed(2)}€ ÷ ${sessions} aulas = ${perSession.toFixed(2)}€`,
    };
  }

  return {
    userId, userName, status,
    source: 'unknown',
    planName: 'Sem plano associado',
    purchaseTotal: 0,
    sessionsTotal: 0,
    amount: 0,
    justification: 'Aluno sem plano/compra associada — sem valor a contar.',
  };
}

export const getProfessorEarnings = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    }
    const callerUid = context.auth.uid;
    const { from, to, professorId: requestedProfessorId } = data || {};

    if (!from || !to) {
      throw new functions.https.HttpsError('invalid-argument', 'from e to são obrigatórios (YYYY-MM-DD)');
    }
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59');

    const isAdmin = (await db.collection('admins').doc(callerUid).get()).exists;

    let professorId: string;
    let professorData: any;

    if (isAdmin && requestedProfessorId) {
      const profDoc = await db.collection('professors').doc(requestedProfessorId).get();
      if (!profDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Professor não encontrado');
      }
      professorId = profDoc.id;
      professorData = profDoc.data();
    } else {
      const profsSnap = await db.collection('professors')
        .where('linkedUserId', '==', callerUid)
        .limit(1)
        .get();
      if (profsSnap.empty) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão');
      }
      professorId = profsSnap.docs[0].id;
      professorData = profsSnap.docs[0].data();
    }

    // Need ALL sessions at affected locations to do monthly division.
    // Fetch professor's own sessions + all locations + all monthly overrides.
    const [profSessionsSnap, allSessionsSnap, locsSnap, purchasesSnap, monthlySnap] = await Promise.all([
      db.collection('sessions').where('professorId', '==', professorId).get(),
      db.collection('sessions').get(),
      db.collection('locations').get(),
      db.collection('purchases').get(),
      db.collection('locationMonthlyCosts').get(),
    ]);

    const locations = locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const purchasesById = new Map<string, PurchaseLite>();
    purchasesSnap.docs.forEach(d => {
      const pd = d.data() as any;
      purchasesById.set(d.id, {
        id: d.id,
        billingType: pd.billingType,
        pricePerSession: pd.pricePerSession,
        priceMonthly: pd.priceMonthly,
        sessionsTotal: pd.sessionsTotal,
        planName: pd.planName,
      });
    });

    const monthlyOverrides = new Map<string, { base: number; vatPercent: number }>();
    monthlySnap.docs.forEach(d => {
      const md = d.data() as any;
      monthlyOverrides.set(d.id, {
        base: Number(md.base || 0),
        vatPercent: Number(md.vatPercent || 0),
      });
    });

    const allSessions = allSessionsSnap.docs.map(d => {
      const sd = d.data() as any;
      return {
        id: d.id,
        locationId: sd.locationId,
        date: sd.date?.toDate ? sd.date.toDate() : new Date(sd.date),
        status: sd.status,
      };
    });

    const computeSpaceCost = (session: any): number => {
      const override = session.spaceCost;
      if (typeof override === 'number') return override;
      const loc = locations.find(l => l.id === session.locationId);
      if (!loc) return 0;
      const y = session.date.getFullYear();
      const m = session.date.getMonth() + 1;
      const key = `${loc.id}_${y}-${String(m).padStart(2, '0')}`;
      const ov = monthlyOverrides.get(key);
      const base = ov?.base ?? Number(loc.costMonthlyBase || 0);
      const vat = ov?.vatPercent ?? Number(loc.costMonthlyVatPercent || 0);
      const monthly = base * (1 + vat / 100);
      if (monthly > 0) {
        const monthStart = new Date(y, m - 1, 1, 0, 0, 0);
        const monthEnd = new Date(y, m, 0, 23, 59, 59);
        const count = allSessions.filter(s =>
          s.locationId === loc.id &&
          s.date >= monthStart && s.date <= monthEnd &&
          s.status !== 'cancelled'
        ).length;
        if (count > 0) return monthly / count;
      }
      return Number(loc.costPerSession || 0);
    };

    const rows = profSessionsSnap.docs
      .map(d => {
        const sd = d.data() as any;
        return {
          id: d.id,
          ...sd,
          date: sd.date?.toDate ? sd.date.toDate() : new Date(sd.date),
        };
      })
      .filter(s => s.date >= fromDate && s.date <= toDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(session => {
        const enrolled = (session.enrolledStudents || []) as any[];
        const attended = enrolled.filter((s: any) => s.status === 'attended');
        const studentEarnings = attended.map((s: any) => {
          const purchase = s.purchaseId ? purchasesById.get(s.purchaseId) : undefined;
          return computeStudentEarning(s, purchase);
        });
        const gross = studentEarnings.reduce((acc, s) => acc + s.amount, 0);
        const sessionSpaceCost = computeSpaceCost(session);
        const spaceCost = professorData?.deductSpaceCost ? sessionSpaceCost : 0;
        const net = gross - spaceCost;

        return {
          session: {
            id: session.id,
            date: session.date.toISOString(),
            startTime: session.startTime,
            locationName: session.locationName,
            locationId: session.locationId,
            status: session.status,
          },
          attendedStudents: studentEarnings,
          gross,
          spaceCost,
          net,
        };
      });

    return { rows };
  });
