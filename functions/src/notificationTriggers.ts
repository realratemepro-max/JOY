/**
 * NOTIFICATION TRIGGERS
 * Cloud Functions that fire notifications on events:
 * - Firestore triggers (purchase created, session booked/cancelled)
 * - Scheduled functions (reminders, expiry warnings)
 * - Mass message processor
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification, processMassMessage } from './notificationService';

const db = admin.firestore();

// ============ PURCHASE CREATED → Welcome notification ============
export const onPurchaseCreated = functions.firestore
  .document('purchases/{purchaseId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    await sendNotification({
      trigger: 'plan_purchased',
      recipientEmail: data.userEmail,
      recipientPhone: data.userPhone || '',
      recipientName: data.userName,
      variables: {
        nome: data.userName || data.userEmail,
        plano: data.planName || '',
        sessoes: String(data.sessionsTotal || 0),
        validade: data.endDate?.toDate().toLocaleDateString('pt-PT') || '',
      },
    });
  });

// ============ SESSION UPDATED → Booking/Cancellation notification ============
export const onSessionUpdated = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    const beforeStudents: any[] = before.enrolledStudents || [];
    const afterStudents: any[] = after.enrolledStudents || [];

    // Find NEW students (in after but not in before)
    const beforeIds = new Set(beforeStudents.map((s: any) => s.userId));
    const newStudents = afterStudents.filter((s: any) => !beforeIds.has(s.userId));

    // Find REMOVED students (in before but not in after)
    const afterIds = new Set(afterStudents.map((s: any) => s.userId));
    const removedStudents = beforeStudents.filter((s: any) => !afterIds.has(s.userId));

    const sessionDate = after.date?.toDate();
    const dateStr = sessionDate ? sessionDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

    // Helper: get professor data for this session
    const getProfessor = async () => {
      if (!after.professorId) return null;
      const profSnap = await db.collection('professors').doc(after.professorId).get();
      return profSnap.exists ? profSnap.data() : null;
    };

    // Get notification config to check notifyProfessor flags
    const configSnap = await db.collection('siteConfig').doc('notifications').get();
    const notifConfig = configSnap.exists ? configSnap.data() : null;
    const getTriggerConfig = (trigger: string) => notifConfig?.triggers?.find((t: any) => t.trigger === trigger);

    // Notify new bookings
    for (const student of newStudents) {
      console.log('📅 New booking:', student.userName, 'for', after.startTime, after.locationName);
      try {
        const userDoc = await db.collection('users').doc(student.userId).get();
        const user = userDoc.exists ? userDoc.data() : null;
        const bookingVars = {
          nome: student.userName,
          aluno: student.userName,
          data: dateStr,
          hora: after.startTime || '',
          horaFim: after.endTime || '',
          espaco: after.locationName || '',
          professor: after.professorName || '',
        };
        if (getTriggerConfig('session_booked')?.notifyStudent !== false) {
          await sendNotification({ trigger: 'session_booked', recipientEmail: user?.email || '', recipientPhone: user?.phone || '', recipientName: student.userName, variables: bookingVars });
        }
        // Notify professor
        const tc = getTriggerConfig('session_booked');
        if (tc?.notifyProfessor !== false) {
          const prof = await getProfessor();
          if (prof?.email) {
            const defaultProfTemplate = 'Olá {{professor}}!\n\n{{aluno}} inscreveu-se na aula de {{data}} às {{hora}} em {{espaco}}.';
            await sendNotification({ trigger: 'session_booked', recipientEmail: prof.email, recipientPhone: prof.phone || '', recipientName: prof.name, variables: { ...bookingVars, nome: prof.name }, templateOverride: tc?.professorTemplate || defaultProfTemplate });
          }
        }
      } catch (e) { console.error('Error notifying booking:', e); }
    }

    // Whole-session cancellation by admin/professor (status changed to 'cancelled')
    if (before.status !== 'cancelled' && after.status === 'cancelled') {
      console.log('🚫 Session cancelled by', after.cancelledBy || 'admin', '- notifying enrolled students');
      // Read grace period from siteConfig.main
      let gracePeriodDays = 7;
      try {
        const mainConfig = await db.collection('siteConfig').doc('main').get();
        if (mainConfig.exists) gracePeriodDays = mainConfig.data()?.cancellationGracePeriodDays ?? 7;
      } catch (_) { /* default 7 */ }

      // Notify each previously-enrolled student
      const enrolledAtCancel = (before.enrolledStudents || []).filter((s: any) => s.status === 'enrolled' || s.status === 'attended');
      for (const student of enrolledAtCancel) {
        try {
          const userDoc = await db.collection('users').doc(student.userId).get();
          const user = userDoc.exists ? userDoc.data() : null;
          // Try to get the new endDate from the refunded purchase
          let novaValidade = '';
          if (student.purchaseId) {
            try {
              const purchaseSnap = await db.collection('purchases').doc(student.purchaseId).get();
              if (purchaseSnap.exists) {
                const newEnd = purchaseSnap.data()?.endDate?.toDate();
                if (newEnd) novaValidade = newEnd.toLocaleDateString('pt-PT');
              }
            } catch (_) { /* ignore */ }
          }
          const reasonLabel = after.cancelReason === 'professor_sick' ? 'professor indisposto'
            : after.cancelReason === 'space_unavailable' ? 'espaço indisponível'
            : after.cancelReason === 'weather' ? 'condições meteorológicas'
            : after.cancelReasonText || 'motivos imprevistos';
          await sendNotification({
            trigger: 'session_cancelled_admin',
            recipientEmail: user?.email || '',
            recipientPhone: user?.phone || '',
            recipientName: student.userName,
            variables: {
              nome: student.userName,
              aluno: student.userName,
              data: dateStr,
              hora: after.startTime || '',
              horaFim: after.endTime || '',
              espaco: after.locationName || '',
              professor: after.professorName || '',
              motivo: reasonLabel,
              diasExtra: String(gracePeriodDays),
              novaValidade,
            },
          });
        } catch (e) { console.error('Error notifying admin cancellation:', e); }
      }
      // Don't process the per-student cancellation logic below for this case
      return;
    }

    // Notify cancellations + promote from waitlist
    for (const student of removedStudents) {
      console.log('❌ Booking cancelled:', student.userName, 'from', after.startTime, after.locationName);
      try {
        const userDoc = await db.collection('users').doc(student.userId).get();
        const user = userDoc.exists ? userDoc.data() : null;
        const cancelVars = {
          nome: student.userName,
          aluno: student.userName,
          data: dateStr,
          hora: after.startTime || '',
          horaFim: after.endTime || '',
          espaco: after.locationName || '',
          professor: after.professorName || '',
          compensacao: 'Podes remarcar a qualquer momento no portal.',
        };
        if (getTriggerConfig('session_cancelled')?.notifyStudent !== false) {
          await sendNotification({ trigger: 'session_cancelled', recipientEmail: user?.email || '', recipientPhone: user?.phone || '', recipientName: student.userName, variables: cancelVars });
        }
        const tc = getTriggerConfig('session_cancelled');
        if (tc?.notifyProfessor !== false) {
          const prof = await getProfessor();
          if (prof?.email) {
            const defaultProfTemplate = 'Olá {{professor}}!\n\n{{aluno}} cancelou a inscrição na aula de {{data}} às {{hora}} em {{espaco}}.';
            await sendNotification({ trigger: 'session_cancelled', recipientEmail: prof.email, recipientPhone: prof.phone || '', recipientName: prof.name, variables: { ...cancelVars, nome: prof.name }, templateOverride: tc?.professorTemplate || defaultProfTemplate });
          }
        }
      } catch (e) { console.error('Error notifying cancellation:', e); }
    }

    // WAITLIST PROMOTION — when someone cancels, promote first on waitlist
    if (removedStudents.length > 0) {
      const waitlist: any[] = after.waitlist || [];
      if (waitlist.length > 0) {
        const promoted = waitlist[0];
        const newWaitlist = waitlist.slice(1).map((e: any, i: number) => ({ ...e, position: i + 1 }));
        const newEnrolled = [...afterStudents, { userId: promoted.userId, userName: promoted.userName, status: 'enrolled' }];
        try {
          await change.after.ref.update({ enrolledStudents: newEnrolled, waitlist: newWaitlist, updatedAt: new Date() });
          // Notify promoted student
          const userDoc = await db.collection('users').doc(promoted.userId).get();
          const user = userDoc.exists ? userDoc.data() : null;
          await sendNotification({
            trigger: 'waitlist_promoted',
            recipientEmail: user?.email || promoted.userEmail || '',
            recipientPhone: user?.phone || '',
            recipientName: promoted.userName,
            variables: { nome: promoted.userName, data: dateStr, hora: after.startTime || '', espaco: after.locationName || '', professor: after.professorName || '' },
          });
          console.log('⬆️ Waitlist promoted:', promoted.userName);
        } catch (e) { console.error('Error promoting from waitlist:', e); }
      }
    }

    // POST-CLASS NOTIFICATION — when student status changes to 'attended'
    const beforeMap = new Map(beforeStudents.map((s: any) => [s.userId, s]));
    const newlyAttended = afterStudents.filter((s: any) => {
      const prev = beforeMap.get(s.userId);
      return s.status === 'attended' && prev?.status !== 'attended' && !s.notifiedAttended;
    });

    for (const student of newlyAttended) {
      try {
        const userDoc = await db.collection('users').doc(student.userId).get();
        const user = userDoc.exists ? userDoc.data() : null;
        // Increment attendance counter on user doc
        const currentTotal = (user?.totalAttendances || 0) + 1;
        await db.collection('users').doc(student.userId).update({ totalAttendances: currentTotal, updatedAt: new Date() });

        await sendNotification({
          trigger: 'class_attended',
          recipientEmail: user?.email || '',
          recipientPhone: user?.phone || '',
          recipientName: student.userName,
          variables: {
            nome: student.userName,
            data: dateStr,
            hora: after.startTime || '',
            professor: after.professorName || '',
            totalPresencas: String(currentTotal),
          },
        });

        // Mark notification sent to avoid duplicate
        const idx = afterStudents.findIndex((s: any) => s.userId === student.userId);
        if (idx >= 0) afterStudents[idx] = { ...afterStudents[idx], notifiedAttended: true };
        console.log('🌟 Attendance notification sent to:', student.userName, `(${currentTotal} total)`);
      } catch (e) { console.error('Error sending attendance notification:', e); }
    }
    if (newlyAttended.length > 0) {
      try { await change.after.ref.update({ enrolledStudents: afterStudents }); } catch (_) {}
    }
  });

// ============ SESSION REMINDERS (scheduled) ============
export const sendSessionReminders = functions.pubsub
  .schedule('every 30 minutes')
  .timeZone('Europe/Lisbon')
  .onRun(async () => {
    // Get notification config for reminder hours
    const configDoc = await db.collection('siteConfig').doc('notifications').get();
    const config = configDoc.exists ? configDoc.data() : { sessionReminderHours: 2 };
    const reminderHours = config?.sessionReminderHours || 2;

    const now = new Date();
    const reminderTime = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
    const windowStart = new Date(reminderTime.getTime() - 15 * 60 * 1000); // 15 min window
    const windowEnd = new Date(reminderTime.getTime() + 15 * 60 * 1000);

    // Find sessions happening in the reminder window
    const sessionsSnap = await db.collection('sessions')
      .where('status', '==', 'scheduled')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(windowStart))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(windowEnd))
      .get();

    console.log(`⏰ Checking reminders: ${sessionsSnap.size} sessions in window`);

    for (const sessionDoc of sessionsSnap.docs) {
      const session = sessionDoc.data();

      // Check if reminder already sent
      if (session.reminderSent) continue;

      // Notify enrolled students
      for (const student of (session.enrolledStudents || [])) {
        if (student.status === 'cancelled') continue;

        // Get user details
        try {
          const userSnap = await db.collection('users').doc(student.userId).get();
          const user = userSnap.exists ? userSnap.data() : null;

          await sendNotification({
            trigger: 'session_reminder',
            recipientEmail: user?.email || '',
            recipientPhone: user?.phone || '',
            recipientName: student.userName,
            variables: {
              nome: student.userName,
              data: session.date?.toDate().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) || '',
              hora: session.startTime || '',
              horaFim: session.endTime || '',
              espaco: session.locationName || '',
              professor: session.professorName || '',
              horas: String(reminderHours),
            },
          });
        } catch (e) {
          console.error('Error sending reminder to student:', student.userId, e);
        }
      }

      // Notify professor (check config flag)
      const reminderTc = config?.triggers?.find((t: any) => t.trigger === 'session_reminder');
      if (session.professorId && reminderTc?.notifyProfessor !== false) {
        try {
          const profSnap = await db.collection('professors').doc(session.professorId).get();
          const prof = profSnap.exists ? profSnap.data() : null;
          if (prof?.email) {
            const numAlunos = (session.enrolledStudents || []).filter((s: any) => s.status !== 'cancelled').length;
            const profVars = {
              nome: prof.name,
              professor: prof.name || '',
              data: session.date?.toDate().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) || '',
              hora: session.startTime || '',
              horaFim: session.endTime || '',
              espaco: session.locationName || '',
              horas: String(reminderHours),
              numAlunos: String(numAlunos),
            };
            const defaultProfTemplate = 'Olá {{professor}}!\n\nLembrete: tens aula em {{horas}}h.\n📅 {{data}}\n🕐 {{hora}} - {{horaFim}}\n📍 {{espaco}}\n👥 Alunos inscritos: {{numAlunos}}';
            await sendNotification({ trigger: 'session_reminder', recipientEmail: prof.email, recipientPhone: prof.phone || '', recipientName: prof.name, variables: profVars, templateOverride: reminderTc?.professorTemplate || defaultProfTemplate });
          }
        } catch (e) {
          console.error('Error sending reminder to professor:', e);
        }
      }

      // Mark reminder as sent
      await sessionDoc.ref.update({ reminderSent: true });
    }
  });

// ============ PLAN EXPIRY WARNINGS (daily at 9am) ============
export const sendExpiryWarnings = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Europe/Lisbon')
  .onRun(async () => {
    const configDoc = await db.collection('siteConfig').doc('notifications').get();
    const config = configDoc.exists ? configDoc.data() : { planExpiryWarningDays: 3 };
    const warningDays = config?.planExpiryWarningDays || 3;

    const now = new Date();
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + warningDays);
    const dayStart = new Date(warningDate.getFullYear(), warningDate.getMonth(), warningDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // Find purchases expiring in X days
    const purchasesSnap = await db.collection('purchases')
      .where('status', '==', 'active')
      .where('endDate', '>=', admin.firestore.Timestamp.fromDate(dayStart))
      .where('endDate', '<', admin.firestore.Timestamp.fromDate(dayEnd))
      .get();

    console.log(`📅 Expiry warnings: ${purchasesSnap.size} purchases expiring in ${warningDays} days`);

    for (const purchaseDoc of purchasesSnap.docs) {
      const purchase = purchaseDoc.data();

      if (purchase.expiryWarningSent) continue;

      await sendNotification({
        trigger: 'plan_expiring',
        recipientEmail: purchase.userEmail,
        recipientPhone: purchase.userPhone || '',
        recipientName: purchase.userName,
        variables: {
          nome: purchase.userName || purchase.userEmail,
          plano: purchase.planName || '',
          sessoes: String(purchase.sessionsRemaining || 0),
          validade: purchase.endDate?.toDate().toLocaleDateString('pt-PT') || '',
          dias: String(warningDays),
        },
      });

      await purchaseDoc.ref.update({ expiryWarningSent: true });
    }
  });

// ============ MASS MESSAGE PROCESSOR ============
export const onMassMessageCreated = functions.firestore
  .document('massMessages/{messageId}')
  .onCreate(async (snap) => {
    await processMassMessage(snap);
  });
