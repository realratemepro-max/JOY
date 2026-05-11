import {
  collection, doc, getDoc, getDocs, query, where, orderBy, addDoc,
  setDoc, updateDoc, serverTimestamp, increment, arrayUnion,
  onSnapshot, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import {
  ChatMember, ChatMessage, Conversation, ConversationType, ChatAttachment, ChatSenderRole,
} from '../types';

const COMMUNITY_DOC_ID = 'community_joy';
const PROFESSORS_GROUP_DOC_ID = 'group_professors';

/* ---------------- READ ---------------- */

/**
 * Live subscription to all conversations the user is part of.
 * Includes legacy admin↔client conversations (where user is admin or clientId matches).
 */
export function subscribeUserConversations(
  userId: string,
  isAdmin: boolean,
  cb: (convs: Conversation[]) => void
): () => void {
  // Query 1: new-style conversations where memberIds includes the user
  const newQ = query(collection(db, 'conversations'), where('memberIds', 'array-contains', userId));
  // Query 2 (admin only): legacy conversations not yet migrated (have clientId)
  // Admin sees all; client sees only their own (legacy)
  const seen = new Map<string, Conversation>();

  const emit = () => {
    const list = Array.from(seen.values()).sort((a, b) => {
      const ta = a.lastMessageAt?.getTime?.() || 0;
      const tb = b.lastMessageAt?.getTime?.() || 0;
      return tb - ta;
    });
    cb(list);
  };

  const unsubs: Array<() => void> = [];

  unsubs.push(onSnapshot(newQ, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'removed') seen.delete(change.doc.id);
      else seen.set(change.doc.id, deserializeConversation(change.doc.id, change.doc.data()));
    });
    emit();
  }));

  // Legacy admin↔client (admin sees all, client sees own)
  if (isAdmin) {
    const legacyQ = query(collection(db, 'conversations'));
    unsubs.push(onSnapshot(legacyQ, snap => {
      snap.docChanges().forEach(change => {
        const data = change.doc.data() as any;
        // Only legacy ones (no memberIds)
        if (!data.memberIds && data.clientId) {
          if (change.type === 'removed') seen.delete(change.doc.id);
          else seen.set(change.doc.id, deserializeConversation(change.doc.id, data));
        }
      });
      emit();
    }));
  } else {
    const legacyQ = query(collection(db, 'conversations'), where('clientId', '==', userId));
    unsubs.push(onSnapshot(legacyQ, snap => {
      snap.docChanges().forEach(change => {
        const data = change.doc.data() as any;
        if (!data.memberIds) {
          if (change.type === 'removed') seen.delete(change.doc.id);
          else seen.set(change.doc.id, deserializeConversation(change.doc.id, data));
        }
      });
      emit();
    }));
  }

  return () => unsubs.forEach(u => u());
}

export function subscribeMessages(conversationId: string, cb: (msgs: ChatMessage[]) => void): () => void {
  const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        senderId: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole,
        text: data.text,
        attachment: data.attachment,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        readAt: data.readAt?.toDate?.(),
        editedAt: data.editedAt?.toDate?.(),
        deletedAt: data.deletedAt?.toDate?.(),
      } as ChatMessage;
    }));
  });
}

/* ---------------- WRITE ---------------- */

/** Get or create a 1-on-1 conversation between two users. */
export async function getOrCreateDirect(a: ChatMember, b: ChatMember): Promise<string> {
  // Deterministic ID for direct chats: sorted user IDs joined
  const id = `direct_${[a.userId, b.userId].sort().join('_')}`;
  const ref = doc(db, 'conversations', id);
  const snap = await getDoc(ref);
  if (snap.exists()) return id;

  const members: ChatMember[] = [a, b];
  await setDoc(ref, {
    type: 'direct',
    members,
    memberIds: members.map(m => m.userId),
    unreadByUser: { [a.userId]: 0, [b.userId]: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

/** Ensure or create a "Estúdio" conversation for a client (multi-admin recipient). */
export async function getOrCreateStudio(client: ChatMember, admins: ChatMember[]): Promise<string> {
  const id = `studio_${client.userId}`;
  const ref = doc(db, 'conversations', id);
  const snap = await getDoc(ref);
  const allAdminIds = admins.map(a => a.userId);
  if (snap.exists()) {
    // Sync new admins added since the conversation was created
    const data = snap.data() as any;
    const currentIds: string[] = data.memberIds || [];
    const missing = allAdminIds.filter(id => !currentIds.includes(id));
    if (missing.length > 0) {
      const newMembers = admins.filter(a => missing.includes(a.userId));
      const updates: any = {
        members: [...(data.members || []), ...newMembers],
        memberIds: arrayUnion(...missing),
        updatedAt: serverTimestamp(),
      };
      missing.forEach(uid => updates[`unreadByUser.${uid}`] = 0);
      await updateDoc(ref, updates);
    }
    return id;
  }

  const memberIds = [client.userId, ...allAdminIds];
  const unreadByUser: Record<string, number> = {};
  memberIds.forEach(uid => unreadByUser[uid] = 0);
  await setDoc(ref, {
    type: 'direct',
    name: 'Estúdio',
    iconUrl: null,
    members: [client, ...admins],
    memberIds,
    clientId: client.userId, // legacy compat — admin sees it via legacy query too
    clientName: client.name,
    clientEmail: client.email || '',
    isStudio: true,
    unreadByUser,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

/** Ensure the Comunidade JOY conversation exists; clients/professors auto-join on first open. */
export async function ensureCommunityConversation(): Promise<string> {
  const ref = doc(db, 'conversations', COMMUNITY_DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return COMMUNITY_DOC_ID;
  await setDoc(ref, {
    type: 'community',
    name: 'Comunidade JOY',
    description: 'Espaço onde toda a comunidade JOY conversa.',
    isOpenToAll: true,
    members: [],
    memberIds: [],
    unreadByUser: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return COMMUNITY_DOC_ID;
}

/** Ensure the professor-only group exists. */
export async function ensureProfessorsGroup(): Promise<string> {
  const ref = doc(db, 'conversations', PROFESSORS_GROUP_DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return PROFESSORS_GROUP_DOC_ID;
  await setDoc(ref, {
    type: 'group',
    name: 'Professores',
    description: 'Espaço privado dos professores e admin.',
    members: [],
    memberIds: [],
    unreadByUser: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return PROFESSORS_GROUP_DOC_ID;
}

/** Add a user to a conversation's members + memberIds (idempotent). */
export async function joinConversation(conversationId: string, member: ChatMember): Promise<void> {
  const ref = doc(db, 'conversations', conversationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as any;
  const existing: ChatMember[] = data.members || [];
  if (existing.some(m => m.userId === member.userId)) return;
  await updateDoc(ref, {
    members: [...existing, member],
    memberIds: arrayUnion(member.userId),
    [`unreadByUser.${member.userId}`]: 0,
    updatedAt: serverTimestamp(),
  });
}

/** Send a text/attachment message. Updates conversation last-message + unread counts. */
export async function sendMessage(
  conversationId: string,
  sender: { userId: string; name: string; role: ChatSenderRole },
  text: string | undefined,
  attachment?: ChatAttachment
): Promise<void> {
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) throw new Error('Conversation not found');
  const conv = convSnap.data() as any;

  const messagePayload: any = {
    senderId: sender.userId,
    senderName: sender.name,
    senderRole: sender.role,
    createdAt: serverTimestamp(),
  };
  if (text && text.trim()) messagePayload.text = text.trim();
  if (attachment) messagePayload.attachment = attachment;

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), messagePayload);

  // Update last message preview + unread counts for everyone except sender
  const update: any = {
    lastMessage: text?.trim() || (attachment?.type === 'image' ? '📷 Imagem' : `📎 ${attachment?.name || 'Ficheiro'}`),
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: sender.userId,
    updatedAt: serverTimestamp(),
  };

  // For new-style conversations: increment unreadByUser per member
  if (Array.isArray(conv.memberIds)) {
    for (const uid of conv.memberIds) {
      if (uid !== sender.userId) {
        update[`unreadByUser.${uid}`] = increment(1);
      }
    }
  } else {
    // Legacy admin↔client
    if (sender.role === 'admin') update.unreadClient = increment(1);
    else if (sender.role === 'client') update.unreadAdmin = increment(1);
  }

  await updateDoc(convRef, update);
}

/** Mark a conversation as read for a user (clears unread count). */
export async function markRead(conversationId: string, userId: string, isLegacyAdmin?: boolean): Promise<void> {
  const ref = doc(db, 'conversations', conversationId);
  const update: any = { updatedAt: serverTimestamp() };
  if (isLegacyAdmin === true) update.unreadAdmin = 0;
  else if (isLegacyAdmin === false) update.unreadClient = 0;
  update[`unreadByUser.${userId}`] = 0;
  try { await updateDoc(ref, update); } catch (e) { /* legacy doc without field */ }
}

/** Toggle mute for a user on a conversation. */
export async function toggleMute(conversationId: string, userId: string, mute: boolean): Promise<void> {
  const ref = doc(db, 'conversations', conversationId);
  await updateDoc(ref, {
    [`mutedBy.${userId}`]: mute ? Date.now() : false,
    updatedAt: serverTimestamp(),
  });
}

/** Upload an image or file for a chat message. Returns the public URL. */
export async function uploadChatAttachment(
  conversationId: string,
  userId: string,
  file: File
): Promise<ChatAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const path = `chat-attachments/${conversationId}/${Date.now()}_${userId}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return {
    type: file.type.startsWith('image/') ? 'image' : 'file',
    url,
    name: file.name,
    size: file.size,
    contentType: file.type,
  };
}

/* ---------------- HELPERS ---------------- */

function deserializeConversation(id: string, data: any): Conversation {
  return {
    id,
    type: data.type,
    members: data.members,
    memberIds: data.memberIds,
    name: data.name,
    description: data.description,
    iconUrl: data.iconUrl,
    isOpenToAll: data.isOpenToAll,
    mutedBy: data.mutedBy,
    clientId: data.clientId,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    professorId: data.professorId,
    lastMessage: data.lastMessage,
    lastMessageAt: data.lastMessageAt?.toDate?.() || null,
    lastMessageSenderId: data.lastMessageSenderId,
    unreadAdmin: data.unreadAdmin,
    unreadClient: data.unreadClient,
    unreadByUser: data.unreadByUser,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
}

/** Compute display name for a conversation based on viewer. */
export function getConversationDisplayName(conv: Conversation, viewerId: string): string {
  if (conv.type === 'community' || conv.type === 'group') return conv.name || 'Grupo';
  // Studio conversations have an explicit name
  if ((conv as any).isStudio || conv.id?.startsWith('studio_')) {
    // Viewer is the client → show "Estúdio"; viewer is admin → show client's name
    if (conv.clientId && conv.clientId === viewerId) return 'Estúdio';
    if (conv.clientName) return conv.clientName;
    return conv.name || 'Estúdio';
  }
  if (conv.type === 'direct' && conv.members) {
    const other = conv.members.find(m => m.userId !== viewerId);
    return other?.name || 'Conversa';
  }
  // Legacy
  return conv.clientName || 'Conversa';
}

/** Compute unread count for a viewer. */
export function getUnreadCount(conv: Conversation, viewerId: string, isAdmin: boolean): number {
  if (conv.unreadByUser && typeof conv.unreadByUser[viewerId] === 'number') return conv.unreadByUser[viewerId];
  if (isAdmin && conv.unreadAdmin) return conv.unreadAdmin;
  if (!isAdmin && conv.unreadClient && conv.clientId === viewerId) return conv.unreadClient;
  return 0;
}

/** Is conversation muted for a user. */
export function isMuted(conv: Conversation, userId: string): boolean {
  if (!conv.mutedBy) return false;
  const v = conv.mutedBy[userId];
  return v === true || (typeof v === 'number' && v > 0);
}

export const CHAT_DOC_IDS = {
  community: COMMUNITY_DOC_ID,
  professorsGroup: PROFESSORS_GROUP_DOC_ID,
};
