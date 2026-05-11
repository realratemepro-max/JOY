import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Runs daily at 09:00 Lisbon time (08:00 UTC in winter / 07:00 UTC in summer).
 * Finds all clients and professors with a birthday today and sends them a personalised email.
 */
export const sendBirthdayEmails = functions
  .region('europe-west1')
  .pubsub.schedule('0 8 * * *')   // 08:00 UTC ≈ 09:00 Lisbon (winter)
  .timeZone('Europe/Lisbon')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const todayMM = String(now.getMonth() + 1).padStart(2, '0');
    const todayDD = String(now.getDate()).padStart(2, '0');
    const todayMD = `${todayMM}-${todayDD}`; // e.g. "04-22"

    // Load email config
    const configSnap = await db.collection('siteConfig').doc('main').get();
    const config = configSnap.data();
    if (!config?.emailEnabled) {
      console.log('Email not enabled, skipping birthday emails.');
      return null;
    }

    const siteName: string = config.siteName || 'JOY';
    const siteEmail: string = config.email || '';

    // Helper: check if dateOfBirth matches today (ignores year)
    const isBirthdayToday = (dob?: string): boolean => {
      if (!dob) return false;
      const parts = dob.split('-'); // YYYY-MM-DD
      if (parts.length !== 3) return false;
      return `${parts[1]}-${parts[2]}` === todayMD;
    };

    // Collect birthday people
    const birthdayPeople: { name: string; email: string; type: 'client' | 'professor' }[] = [];

    // Check clients
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      if (data.status === 'active' && data.email && isBirthdayToday(data.dateOfBirth)) {
        birthdayPeople.push({ name: data.name || 'Amigo', email: data.email, type: 'client' });
      }
    }

    // Check professors
    const profsSnap = await db.collection('professors').get();
    for (const profDoc of profsSnap.docs) {
      const data = profDoc.data();
      if (data.isActive && data.linkedEmail && isBirthdayToday(data.dateOfBirth)) {
        birthdayPeople.push({ name: data.name || 'Professor', email: data.linkedEmail, type: 'professor' });
      }
    }

    if (birthdayPeople.length === 0) {
      console.log(`No birthdays today (${todayMD}).`);
      return null;
    }

    console.log(`Sending birthday emails to ${birthdayPeople.length} people:`, birthdayPeople.map(p => p.email));

    // Send emails
    for (const person of birthdayPeople) {
      try {
        await sendBirthdayEmail(person, config, siteName, siteEmail);
        // Log the birthday email
        await db.collection('notificationLogs').add({
          type: 'birthday',
          recipient: person.email,
          name: person.name,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(`Failed to send birthday email to ${person.email}:`, err);
      }
    }

    return null;
  });

async function sendBirthdayEmail(
  person: { name: string; email: string; type: 'client' | 'professor' },
  config: any,
  siteName: string,
  siteEmail: string
) {
  const firstName = person.name.split(' ')[0];

  const clientHtml = `
    <div style="font-family: 'Georgia', serif; max-width: 520px; margin: 0 auto; background: #faf8f5; padding: 0; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #7c9a72, #5a7a52); padding: 3rem 2rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎂</div>
        <h1 style="color: white; font-family: Georgia, serif; font-weight: 400; font-size: 2rem; margin: 0 0 0.5rem;">Feliz Aniversário, ${firstName}!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 1.0625rem;">De toda a equipa ${siteName}</p>
      </div>
      <div style="padding: 2.5rem 2rem; background: white;">
        <p style="color: #4a5568; font-size: 1.0625rem; line-height: 1.7; margin: 0 0 1.5rem;">
          Que este novo ano da tua vida seja cheio de momentos de paz, equilíbrio e bem-estar.
          É uma honra acompanhar a tua jornada de yoga e crescimento pessoal.
        </p>
        <p style="color: #4a5568; font-size: 1.0625rem; line-height: 1.7; margin: 0 0 2rem;">
          No teu dia especial, desejamos que encontres espaço para respirar fundo, estar presente e celebrar quem és.
        </p>
        <div style="background: #f5f0ea; border-radius: 12px; padding: 1.5rem; text-align: center; margin-bottom: 2rem; border-left: 4px solid #7c9a72;">
          <p style="color: #7c9a72; font-style: italic; font-size: 1.125rem; margin: 0; line-height: 1.6;">
            "Yoga é a jornada do eu, através do eu, para o eu."
          </p>
          <p style="color: #a0aec0; font-size: 0.875rem; margin: 0.5rem 0 0;">— Bhagavad Gita</p>
        </div>
        <div style="text-align: center;">
          <a href="https://joaquimyoga.pt/app/sessions" style="display: inline-block; background: #7c9a72; color: white; padding: 0.875rem 2rem; border-radius: 8px; text-decoration: none; font-family: sans-serif; font-weight: 600; font-size: 1rem;">
            Reserva a tua aula de aniversário 🧘
          </a>
        </div>
      </div>
      <div style="padding: 1.5rem; text-align: center; background: #f5f0ea;">
        <p style="color: #a0aec0; font-size: 0.8125rem; margin: 0; font-family: sans-serif;">
          Com carinho,<br/>
          <strong style="color: #7c9a72;">${siteName}</strong><br/>
          ${siteEmail}
        </p>
      </div>
    </div>
  `;

  const professorHtml = `
    <div style="font-family: 'Georgia', serif; max-width: 520px; margin: 0 auto; background: #faf8f5; padding: 0; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #c17f59, #a0603a); padding: 3rem 2rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
        <h1 style="color: white; font-family: Georgia, serif; font-weight: 400; font-size: 2rem; margin: 0 0 0.5rem;">Feliz Aniversário, ${firstName}!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 1.0625rem;">Com estima de toda a equipa ${siteName}</p>
      </div>
      <div style="padding: 2.5rem 2rem; background: white;">
        <p style="color: #4a5568; font-size: 1.0625rem; line-height: 1.7; margin: 0 0 1.5rem;">
          Hoje celebramos não só o teu aniversário, mas também tudo o que trazes às aulas — a tua energia, dedicação e o impacto que tens na vida dos alunos.
        </p>
        <p style="color: #4a5568; font-size: 1.0625rem; line-height: 1.7; margin: 0 0 1.5rem;">
          Que este novo ciclo seja repleto de crescimento, inspiração e momentos de pura alegria — dentro e fora do tapete.
        </p>
        <div style="background: #fff8f5; border-radius: 12px; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem; border-left: 4px solid #c17f59;">
          <p style="color: #c17f59; font-style: italic; font-size: 1.125rem; margin: 0; line-height: 1.6;">
            "Ensinar yoga é partilhar a arte de viver."
          </p>
        </div>
      </div>
      <div style="padding: 1.5rem; text-align: center; background: #f5f0ea;">
        <p style="color: #a0aec0; font-size: 0.8125rem; margin: 0; font-family: sans-serif;">
          Com carinho,<br/>
          <strong style="color: #c17f59;">${siteName}</strong><br/>
          ${siteEmail}
        </p>
      </div>
    </div>
  `;

  const html = person.type === 'professor' ? professorHtml : clientHtml;
  const subject = `🎂 Feliz Aniversário, ${firstName}! — ${siteName}`;

  if (config.resendApiKey) {
    const fetch = require('node-fetch');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.resendFromEmail || `noreply@joaquimyoga.pt`,
        to: person.email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }
  } else if (config.emailProvider === 'gmail' && config.gmailAppPassword) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.emailFrom, pass: config.gmailAppPassword },
    });
    await transporter.sendMail({ from: `"${siteName}" <${config.emailFrom}>`, to: person.email, subject, html });
  } else {
    throw new Error('No email provider configured');
  }
}
