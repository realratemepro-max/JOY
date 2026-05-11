/**
 * Professor earnings calculation — based on what each attended student actually paid
 * for the class. Each student's contribution is derived from their purchase:
 *   - drop-in plan → pricePerSession
 *   - subscription plan → priceMonthly / sessionsTotal
 *   - cash payment recorded on session → cashPayment.amount
 *   - no purchase → 0 (manually added student without payment trail)
 *
 * Space cost (location's costPerSession or session.spaceCost override) is subtracted
 * from the gross when professor.deductSpaceCost === true.
 */
import { Session, Location, Professor, LocationMonthlyCost } from '../types';

export interface PurchaseLite {
  id: string;
  billingType?: 'subscription' | 'dropin';
  pricePerSession?: number;
  priceMonthly?: number;
  sessionsTotal?: number;
  planName?: string;
}

export interface StudentEarning {
  userId: string;
  userName: string;
  status: 'attended' | 'absent' | 'enrolled' | 'cancelled' | string;
  /** Source for the amount: how this student paid for this class. */
  source: 'dropin' | 'subscription' | 'cash' | 'unknown';
  /** Plan/purchase name shown in justification. */
  planName: string;
  /** Total purchase price (e.g. 28€ for the 8-class pack). */
  purchaseTotal: number;
  /** Total sessions covered (for subscriptions) — 1 for drop-in. */
  sessionsTotal: number;
  /** Amount the professor receives for this student in this class. */
  amount: number;
  /** Human-readable justification (e.g. "Plano Consistência: 28€ ÷ 8 aulas = 3,50€"). */
  justification: string;
}

export interface SessionEarning {
  session: Session;
  attendedStudents: StudentEarning[];
  gross: number;        // sum of student.amount for attended
  spaceCost: number;    // location.costPerSession or override
  net: number;          // gross - spaceCost
}

/** Compute earning data for a single attended student. */
export function computeStudentEarning(
  student: any,
  purchase: PurchaseLite | undefined
): StudentEarning {
  const userName = student.userName || '?';
  const userId = student.userId;
  const status = student.status || 'enrolled';

  // 1) Cash payment recorded directly on this session
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

  // 2) Drop-in (single class)
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

  // 3) Subscription plan
  if (purchase?.billingType === 'subscription' || (purchase && (purchase.sessionsTotal || 0) > 0)) {
    const total = Number(purchase.priceMonthly || 0);
    const sessions = Number(purchase.sessionsTotal || 1);
    const perSession = sessions > 0 ? total / sessions : 0;
    return {
      userId, userName, status,
      source: 'subscription',
      planName: purchase.planName || 'Plano',
      purchaseTotal: total,
      sessionsTotal: sessions,
      amount: perSession,
      justification: `${purchase.planName || 'Plano'}: ${total.toFixed(2)}€ ÷ ${sessions} aulas = ${perSession.toFixed(2)}€`,
    };
  }

  // 4) Unknown / manually added without purchase
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

/** Resolve {base, vatPercent} for a location/year/month — per-month override beats location default. */
export function getMonthlyRentForMonth(
  loc: Location | undefined,
  year: number,
  month: number, // 1-12
  monthlyOverrides?: Map<string, LocationMonthlyCost>
): { base: number; vatPercent: number } {
  if (!loc) return { base: 0, vatPercent: 0 };
  const key = `${loc.id}_${year}-${String(month).padStart(2, '0')}`;
  const ov = monthlyOverrides?.get(key);
  if (ov) return { base: Number(ov.base || 0), vatPercent: Number(ov.vatPercent || 0) };
  return {
    base: Number(loc.costMonthlyBase || 0),
    vatPercent: Number(loc.costMonthlyVatPercent || 0),
  };
}

/**
 * Effective space cost for a single session.
 * Priority:
 *   1. Per-session override (session.spaceCost) — wins.
 *   2. Monthly rent ÷ non-cancelled classes in same calendar month at same location.
 *   3. Legacy fixed location.costPerSession.
 */
export function getSessionSpaceCost(
  session: Session,
  locations: Location[],
  allSessions?: Session[],
  monthlyOverrides?: Map<string, LocationMonthlyCost>
): number {
  const override = (session as any).spaceCost;
  if (typeof override === 'number') return override;
  const loc = locations.find(l => l.id === session.locationId);
  if (!loc) return 0;

  const y = session.date.getFullYear();
  const m = session.date.getMonth() + 1;
  const { base, vatPercent } = getMonthlyRentForMonth(loc, y, m, monthlyOverrides);
  const monthly = base * (1 + vatPercent / 100);

  if (monthly > 0 && allSessions) {
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
}

/** Compute the earnings for a single session. */
export function computeSessionEarning(
  session: Session,
  professor: Professor | any,
  locations: Location[],
  purchasesById: Map<string, PurchaseLite>,
  allSessions?: Session[],
  monthlyOverrides?: Map<string, LocationMonthlyCost>
): SessionEarning {
  const enrolled = (session.enrolledStudents || []) as any[];
  const attended = enrolled.filter(s => s.status === 'attended');

  const studentEarnings: StudentEarning[] = attended.map(s => {
    const purchase = s.purchaseId ? purchasesById.get(s.purchaseId) : undefined;
    return computeStudentEarning(s, purchase);
  });

  const gross = studentEarnings.reduce((acc, s) => acc + s.amount, 0);
  const spaceCost = professor?.deductSpaceCost
    ? getSessionSpaceCost(session, locations, allSessions, monthlyOverrides)
    : 0;
  const net = gross - spaceCost;

  return { session, attendedStudents: studentEarnings, gross, spaceCost, net };
}
