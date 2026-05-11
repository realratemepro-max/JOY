/**
 * TEMPORARY DEBUG FUNCTION: Dump session summaries to JSON for admin debugging.
 * Caller: admin only.
 * To call: admin runs this from the browser console or cURL with auth token.
 *
 * Returns array of { id, date, dayOfWeek, startTime, endTime, professorId, professorName, status, enrolledStudents }
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const debugSessions = functions
  .region('europe-west1')
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    }
    const isAdmin = (await db.collection('admins').doc(context.auth.uid).get()).exists;
    if (!isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas admins');
    }

    const snap = await db.collection('sessions').orderBy('date', 'asc').get();
    const sessions = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        date: data.date?.toDate?.()?.toISOString() || null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        professorId: data.professorId,
        professorName: data.professorName,
        status: data.status,
        recurrence: data.recurrence,
        recurrenceEndDate: data.recurrenceEndDate?.toDate?.()?.toISOString() || null,
        enrolledCount: (data.enrolledStudents || []).length,
        enrolledStudents: (data.enrolledStudents || []).map((s: any) => ({
          userId: s.userId,
          userName: s.userName,
          status: s.status,
        })),
      };
    });

    return { count: sessions.length, sessions };
  });
