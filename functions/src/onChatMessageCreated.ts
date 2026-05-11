/**
 * FIRESTORE TRIGGER: Send FCM push notification when a new chat message is created.
 *
 * Path: conversations/{convId}/messages/{messageId}
 *
 * Behavior:
 * - Loads conversation
 * - Computes recipients: all members minus the sender
 * - For each recipient: skip if they have muted the conversation
 * - Loads each recipient's fcmTokens from users/{recipientId}
 * - Sends a multicast FCM message with title/body and deep-link
 * - Cleans up invalid tokens (removes from user doc)
 *
 * Backward compatibility: also handles legacy admin↔client conversations
 * where conversation has clientId (instead of memberIds).
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

const SITE_URL = 'https://joaquimyoga.pt';

export const onChatMessageCreated = functions
  .region('europe-west1')
  .firestore.document('conversations/{convId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { convId } = context.params;
    const message = snap.data() as any;

    if (!message?.senderId) {
      console.warn('Chat message missing senderId — skipping push');
      return;
    }

    try {
      // Load conversation
      const convSnap = await db.collection('conversations').doc(convId).get();
      if (!convSnap.exists) return;
      const conv = convSnap.data()!;

      // Compute recipients
      let recipientIds: string[] = [];
      if (Array.isArray(conv.memberIds)) {
        recipientIds = conv.memberIds.filter((uid: string) => uid !== message.senderId);
      } else if (conv.clientId) {
        // Legacy: admin↔client. If sender is the client → notify admins; else if admin/professor → notify the client.
        if (message.senderRole === 'client' || message.senderId === conv.clientId) {
          // notify admins
          const adminsSnap = await db.collection('admins').get();
          recipientIds = adminsSnap.docs.map(d => d.id).filter(id => id !== message.senderId);
        } else {
          recipientIds = [conv.clientId];
        }
      }

      if (recipientIds.length === 0) return;

      // Filter out muted users
      const mutedBy = (conv.mutedBy || {}) as Record<string, any>;
      recipientIds = recipientIds.filter(uid => {
        const m = mutedBy[uid];
        return !(m === true || (typeof m === 'number' && m > 0));
      });

      if (recipientIds.length === 0) return;

      // Conversation display name
      const convName = conv.name || (() => {
        if (Array.isArray(conv.members)) {
          // For direct, find the "other side" relative to sender
          const others = conv.members.filter((m: any) => m.userId !== message.senderId);
          return others[0]?.name || 'Conversa';
        }
        return conv.clientName || 'Conversa';
      })();

      const isGroup = conv.type === 'group' || conv.type === 'community';
      const titlePrefix = isGroup ? `${convName} · ${message.senderName}` : message.senderName;
      const body = message.text
        ? (message.text.length > 120 ? message.text.slice(0, 117) + '...' : message.text)
        : (message.attachment?.type === 'image' ? '📷 Imagem' : `📎 ${message.attachment?.name || 'Ficheiro'}`);

      // Determine deep-link path based on recipient role (client → /app/chat, professor → /professor/chat, admin → /admin/chat)
      // Since recipients can be of mixed roles, build per-role token lists.
      const tokensByRole: Record<'admin' | 'professor' | 'client' | 'unknown', string[]> = {
        admin: [], professor: [], client: [], unknown: [],
      };
      const tokenToUserId: Record<string, string> = {};

      for (const uid of recipientIds) {
        const userSnap = await db.collection('users').doc(uid).get();
        if (!userSnap.exists) continue;
        const u = userSnap.data()!;
        const tokens: string[] = u.fcmTokens || [];
        if (!tokens.length) continue;
        const role = (u.role as 'admin' | 'professor' | 'client') || 'unknown';
        tokens.forEach(t => {
          tokensByRole[role].push(t);
          tokenToUserId[t] = uid;
        });
      }

      const messaging = admin.messaging();
      const linkByRole = {
        admin: `${SITE_URL}/admin/chat`,
        professor: `${SITE_URL}/professor/chat`,
        client: `${SITE_URL}/app/chat`,
        unknown: `${SITE_URL}/app/chat`,
      };

      const failedTokens: string[] = [];

      for (const role of Object.keys(tokensByRole) as Array<keyof typeof tokensByRole>) {
        const tokens = tokensByRole[role];
        if (tokens.length === 0) continue;
        const link = linkByRole[role];
        // sendEachForMulticast handles per-token errors
        const resp = await messaging.sendEachForMulticast({
          tokens,
          notification: { title: titlePrefix, body },
          data: { url: link, convId, tag: `chat_${convId}` },
          webpush: {
            fcmOptions: { link },
            notification: { icon: '/icons/icon-192.svg', tag: `chat_${convId}` },
          },
        });
        resp.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = (r.error as any)?.errorInfo?.code || (r.error as any)?.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument' || code === 'messaging/invalid-registration-token') {
              failedTokens.push(tokens[idx]);
            } else {
              console.warn('FCM error:', code, r.error);
            }
          }
        });
      }

      // Cleanup invalid tokens
      if (failedTokens.length > 0) {
        const byUser: Record<string, string[]> = {};
        failedTokens.forEach(t => {
          const uid = tokenToUserId[t];
          if (!uid) return;
          (byUser[uid] = byUser[uid] || []).push(t);
        });
        for (const [uid, tokens] of Object.entries(byUser)) {
          try {
            await db.collection('users').doc(uid).update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens),
            });
          } catch (e) { /* non-blocking */ }
        }
      }

      console.log(`📨 FCM sent for chat ${convId}: ${recipientIds.length} recipients`);
    } catch (err) {
      console.error('onChatMessageCreated failed:', err);
    }
  });
