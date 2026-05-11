import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const REGION = 'europe-west1';

export const userCalendar = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(200).send(''); return; }

    const { uid, token } = req.query as { uid?: string; token?: string };
    if (!uid || !token) { res.status(400).send('Missing uid or token'); return; }

    const db = admin.firestore();

    // Verify token against user document
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) { res.status(404).send('Not found'); return; }
    const userData = userDoc.data()!;
    if (!userData.calendarToken || userData.calendarToken !== token) {
      res.status(403).send('Invalid token');
      return;
    }

    // Check if professor
    let professorId: string | undefined;
    if (userData.role === 'professor') {
      const profSnap = await db.collection('professors').where('linkedUserId', '==', uid).limit(1).get();
      if (!profSnap.empty) professorId = profSnap.docs[0].id;
    }

    // Load site config
    const configSnap = await db.collection('siteConfig').doc('main').get();
    const cfg = configSnap.data() || {};
    const siteName: string = cfg.siteName || 'JOY';

    // Load sessions (last 3 months + future)
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const sessionsSnap = await db.collection('sessions')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(cutoff))
      .orderBy('date', 'asc')
      .get();

    const allSessions = sessionsSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        date: data.date?.toDate() as Date | undefined,
        updatedAt: data.updatedAt?.toDate() as Date | undefined,
      } as any;
    });

    // Filter relevant sessions
    const mySessions = allSessions.filter(s => {
      if (professorId) {
        return s.professorId === professorId || s.replacementProfessorId === professorId;
      }
      return (s.enrolledStudents || []).some(
        (st: any) => st.userId === uid && st.status !== 'cancelled'
      );
    });

    // Load personal sessions for professors (last 3 months + future)
    let personalSessions: any[] = [];
    if (professorId) {
      const personalSnap = await db
        .collection('professors').doc(professorId)
        .collection('personalSessions')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(cutoff))
        .orderBy('date', 'asc')
        .get();
      personalSessions = personalSnap.docs.map(d => {
        const data = d.data();
        return { id: `personal-${d.id}`, ...data, date: data.date?.toDate(), updatedAt: data.updatedAt?.toDate(), _isPersonal: true };
      });
    }

    // Build iCal
    const fmtDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + (d.toISOString().endsWith('Z') ? '' : 'Z');
    const esc = (s: string) => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const fold = (line: string): string => {
      if (line.length <= 75) return line;
      const chunks: string[] = [];
      let i = 0;
      chunks.push(line.slice(i, i + 75)); i += 75;
      while (i < line.length) { chunks.push(' ' + line.slice(i, i + 74)); i += 74; }
      return chunks.join('\r\n');
    };

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${esc(siteName)}//Calendar//PT`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      fold(`X-WR-CALNAME:${esc(siteName)} — Aulas`),
      'X-WR-TIMEZONE:Europe/Lisbon',
    ];

    for (const s of [...mySessions, ...personalSessions]) {
      if (!s.date) continue;

      const parseTime = (t: string, base: Date): Date => {
        const [h, m] = (t || '09:00').split(':').map(Number);
        const d = new Date(base);
        d.setUTCHours(h - 1, m, 0, 0); // Portugal = UTC+1 (winter), rough approx
        return d;
      };

      const dtStart = parseTime(s.startTime as string, s.date);
      const dtEnd = parseTime(s.endTime as string, s.date);
      const isCancelled = s.status === 'cancelled' || s.status === 'canceled';
      const title = s._isPersonal
        ? (s.name || 'Aula Pessoal')
        : (s.name ? `${s.name} — ${siteName}` : `Aula — ${siteName}`);
      const desc = [
        s.professorName ? `Professor: ${s.professorName}` : '',
        `Espaço: ${s.locationName || ''}`,
        s.notes ? `Notas: ${s.notes}` : '',
      ].filter(Boolean).join('\n');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:session-${s.id}@joy`);
      lines.push(fold(`DTSTART:${fmtDate(dtStart)}`));
      lines.push(fold(`DTEND:${fmtDate(dtEnd)}`));
      lines.push(fold(`SUMMARY:${esc(isCancelled ? `[CANCELADA] ${title}` : title)}`));
      if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
      if (s.locationName) lines.push(fold(`LOCATION:${esc(s.locationName as string)}`));
      lines.push(`STATUS:${isCancelled ? 'CANCELLED' : 'CONFIRMED'}`);
      lines.push(`LAST-MODIFIED:${fmtDate(s.updatedAt || new Date())}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const body = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${siteName}-aulas.ics"`);
    res.send(body);
  });
