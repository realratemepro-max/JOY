import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

async function getZoomCredentials() {
  const doc = await admin.firestore().collection('siteConfig').doc('main').get();
  const data = doc.data();
  const accountId = data?.zoomAccountId;
  const clientId = data?.zoomClientId;
  const clientSecret = data?.zoomClientSecret;
  if (!accountId || !clientId || !clientSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Zoom credentials not configured. Please set them in Admin → Site / Conteúdo.');
  }
  return { accountId, clientId, clientSecret };
}

async function getZoomAccessToken(): Promise<string> {
  const { accountId, clientId, clientSecret } = await getZoomCredentials();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    null,
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

export const createZoomMeeting = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { sessionId, topic, startTime, durationMinutes = 60 } = data;
    if (!sessionId || !topic || !startTime) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
      const token = await getZoomAccessToken();

      const meetingResponse = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic,
          type: 2,
          start_time: startTime,
          duration: durationMinutes,
          timezone: 'Europe/Lisbon',
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            waiting_room: true,
            auto_recording: 'none',
          },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const { id: meetingId, join_url: joinUrl, password } = meetingResponse.data;

      await admin.firestore().collection('sessions').doc(sessionId).update({
        zoomMeetingId: String(meetingId),
        zoomLink: joinUrl,
        zoomPassword: password || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, meetingId: String(meetingId), joinUrl, password };
    } catch (error: any) {
      console.error('Zoom API error:', error?.response?.data || error.message);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error?.response?.data?.message || 'Erro ao criar reunião Zoom');
    }
  });

export const deleteZoomMeeting = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { meetingId } = data;
    if (!meetingId) throw new functions.https.HttpsError('invalid-argument', 'Missing meetingId');

    try {
      const token = await getZoomAccessToken();
      await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true };
    } catch (error: any) {
      console.error('Zoom delete error:', error?.response?.data || error.message);
      return { success: false };
    }
  });
