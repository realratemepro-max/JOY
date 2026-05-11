import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeUserConversations, subscribeMessages, sendMessage,
  markRead, toggleMute, uploadChatAttachment,
  ensureCommunityConversation, ensureProfessorsGroup, joinConversation,
  getOrCreateDirect, getOrCreateStudio, getConversationDisplayName, getUnreadCount, isMuted, CHAT_DOC_IDS,
} from '../services/chatService';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Conversation, ChatMessage, ChatMember, ChatSenderRole } from '../types';
import { useToast } from './ToastProvider';
import {
  MessageCircle, Send, Search, ArrowLeft, Smile, Image as ImageIcon, Paperclip,
  BellOff, Bell, Loader, Plus, Users, Hash, X,
} from 'lucide-react';

const COMMON_EMOJIS = ['🙏', '🧘‍♀️', '🧘‍♂️', '✨', '❤️', '🌱', '🌸', '☀️', '🌙', '🪷', '🌿', '😊', '😍', '🥰', '😎', '🎉', '👏', '💪', '🔥', '👍', '🙌', '😅', '😢', '🥺', '💭'];

interface NewChatTarget {
  userId: string;
  name: string;
  email?: string;
  role: ChatSenderRole;
  photoUrl?: string;
}

interface ChatHubProps {
  /** When true, the user is admin (sees all conversations including legacy). */
  asAdmin?: boolean;
  /** Optional pre-selected conversation ID. */
  initialConversationId?: string;
}

export function ChatHub({ asAdmin = false }: ChatHubProps) {
  const toast = useToast();
  const { user, appUser, professorData, userRole } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatTargets, setNewChatTargets] = useState<NewChatTarget[]>([]);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const unsubMessages = useRef<(() => void) | null>(null);

  const myRole: ChatSenderRole = userRole === 'admin' ? 'admin' : userRole === 'professor' ? 'professor' : 'client';
  const myName = appUser?.name || user?.displayName || user?.email || 'Eu';
  const myMember: ChatMember | null = user ? {
    userId: user.uid,
    role: myRole,
    name: myName,
    email: user.email || '',
    photoUrl: appUser?.photoUrl || (professorData as any)?.photoUrl,
  } : null;

  // Subscribe to conversations
  useEffect(() => {
    if (!user) return;
    setLoadingConvs(true);
    const unsub = subscribeUserConversations(user.uid, asAdmin, list => {
      setConvs(list);
      setLoadingConvs(false);
    });

    // Auto-join community + ensure groups
    (async () => {
      try {
        if (myMember) {
          // Comunidade JOY (open to all clients + professors + admin)
          const communityId = await ensureCommunityConversation();
          await joinConversation(communityId, myMember);
          // Professors group (only for professors + admin)
          if (myRole === 'professor' || myRole === 'admin') {
            const profGroupId = await ensureProfessorsGroup();
            await joinConversation(profGroupId, myMember);
          }
        }
      } catch (e) { /* non-blocking */ }
    })();

    return unsub;
  }, [user, asAdmin]);

  // Subscribe to messages of active conversation
  useEffect(() => {
    if (unsubMessages.current) { unsubMessages.current(); unsubMessages.current = null; }
    if (!active || !user) { setMessages([]); return; }
    unsubMessages.current = subscribeMessages(active.id, msgs => {
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    });
    // Mark as read
    const isLegacyAdmin = active.clientId && !active.memberIds ? asAdmin : undefined;
    markRead(active.id, user.uid, isLegacyAdmin).catch(() => {});
    return () => { if (unsubMessages.current) unsubMessages.current(); };
  }, [active?.id]);

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter(c => {
      const name = (getConversationDisplayName(c, user!.uid) || '').toLowerCase();
      const last = (c.lastMessage || '').toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [convs, search, user]);

  const loadNewChatTargets = async () => {
    if (!user) return;
    setNewChatLoading(true);
    setNewChatTargets([]);
    try {
      const targets: NewChatTarget[] = [];
      // Admin can chat with anyone
      // Professor can chat with admin + other professors + their students
      // Client can chat with admin + their professor

      if (asAdmin) {
        // Load all clients (users with role 'client') and professors
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(d => {
          const data = d.data() as any;
          if (d.id !== user.uid) {
            targets.push({
              userId: d.id,
              name: data.name || data.email || '?',
              email: data.email,
              role: data.role || 'client',
              photoUrl: data.photoUrl,
            });
          }
        });
      } else if (myRole === 'professor') {
        // 1. Estúdio (one virtual target → group conversation with all admins)
        targets.push({ userId: '__studio__', name: 'Estúdio', role: 'admin' });
        // 2. Other professors (from public professors collection)
        const profsSnap = await getDocs(query(collection(db, 'professors'), where('isActive', '==', true)));
        profsSnap.forEach(d => {
          const data = d.data() as any;
          if (data.linkedUserId && data.linkedUserId !== user.uid) {
            targets.push({
              userId: data.linkedUserId,
              name: data.name || '?',
              email: data.linkedEmail,
              role: 'professor',
              photoUrl: data.photoUrl,
            });
          }
        });
        // 3. Students of this professor — use enrolledStudents data directly (no user doc fetch needed)
        if (professorData?.id) {
          const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('professorId', '==', professorData.id)));
          const studentMap = new Map<string, NewChatTarget>();
          sessionsSnap.forEach(d => {
            const enrolled = (d.data() as any).enrolledStudents || [];
            for (const e of enrolled) {
              if (e.userId && e.userId !== user.uid && !studentMap.has(e.userId)) {
                studentMap.set(e.userId, {
                  userId: e.userId,
                  name: e.userName || 'Aluno',
                  role: 'client',
                });
              }
            }
          });
          studentMap.forEach(t => targets.push(t));
        }
      } else {
        // 1. Estúdio (virtual — opens group conv with all admins)
        targets.push({ userId: '__studio__', name: 'Estúdio', role: 'admin' });
        // 2. Professors from sessions the client is enrolled in (public professors collection)
        const sessSnap = await getDocs(collection(db, 'sessions'));
        const profIds = new Set<string>();
        sessSnap.forEach(d => {
          const data = d.data() as any;
          const enrolled = data.enrolledStudents || [];
          if (enrolled.some((e: any) => e.userId === user.uid) && data.professorId) {
            profIds.add(data.professorId);
          }
        });
        for (const pid of profIds) {
          const pdoc = await getDoc(doc(db, 'professors', pid));
          if (pdoc.exists()) {
            const data = pdoc.data() as any;
            if (data.linkedUserId && data.linkedUserId !== user.uid) {
              targets.push({
                userId: data.linkedUserId,
                name: data.name,
                email: data.linkedEmail,
                role: 'professor',
                photoUrl: data.photoUrl,
              });
            }
          }
        }
        // If no enrolled sessions yet → still show all active professors so client can ask questions
        if (profIds.size === 0) {
          const allProfs = await getDocs(query(collection(db, 'professors'), where('isActive', '==', true)));
          allProfs.forEach(d => {
            const data = d.data() as any;
            if (data.linkedUserId && data.linkedUserId !== user.uid) {
              targets.push({
                userId: data.linkedUserId,
                name: data.name,
                email: data.linkedEmail,
                role: 'professor',
                photoUrl: data.photoUrl,
              });
            }
          });
        }
      }

      // Dedupe
      const uniqMap = new Map<string, NewChatTarget>();
      targets.forEach(t => uniqMap.set(t.userId, t));
      setNewChatTargets(Array.from(uniqMap.values()));
    } catch (e) {
      console.error('Failed to load new chat targets', e);
    } finally {
      setNewChatLoading(false);
    }
  };

  const startDirectWith = async (target: NewChatTarget) => {
    if (!myMember || !user) return;
    try {
      let id: string;
      if (target.userId === '__studio__') {
        // Build admin members list from /admins (now readable by any authenticated user)
        const adminsSnap = await getDocs(collection(db, 'admins'));
        const adminMembers: ChatMember[] = adminsSnap.docs
          .filter(d => d.id !== user.uid)
          .map(d => ({ userId: d.id, role: 'admin' as const, name: 'Administração' }));
        if (adminMembers.length === 0) {
          toast.error('Sem administradores configurados.');
          return;
        }
        id = await getOrCreateStudio(myMember, adminMembers);
      } else {
        const targetMember: ChatMember = { userId: target.userId, role: target.role, name: target.name, email: target.email, photoUrl: target.photoUrl };
        id = await getOrCreateDirect(myMember, targetMember);
      }
      // Fetch the conversation document directly so we don't depend on the live snapshot timing
      const convSnap = await getDoc(doc(db, 'conversations', id));
      if (!convSnap.exists()) {
        toast.error('Não foi possível abrir a conversa.');
        return;
      }
      const data = convSnap.data() as any;
      const conv: Conversation = {
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
      setShowNewChat(false);
      setActive(conv);
    } catch (e: any) {
      console.error('startDirectWith failed', e);
      toast.error(e?.message || 'Erro ao iniciar conversa');
    }
  };

  const handleSend = async () => {
    if (!active || !user || (!text.trim() && !uploading)) return;
    const t = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage(active.id, { userId: user.uid, name: myName, role: myRole }, t);
    } catch (e) {
      console.error(e);
    } finally { setSending(false); }
  };

  const handleAttachment = async (file: File) => {
    if (!active || !user) return;
    setUploading(true);
    try {
      const att = await uploadChatAttachment(active.id, user.uid, file);
      await sendMessage(active.id, { userId: user.uid, name: myName, role: myRole }, undefined, att);
    } catch (e: any) {
      console.error('Upload failed', e);
      alert(e?.message || 'Falha ao enviar anexo');
    } finally {
      setUploading(false);
    }
  };

  const onPickEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    setShowEmojis(false);
  };

  const muteCurrent = async () => {
    if (!active || !user) return;
    await toggleMute(active.id, user.uid, !isMuted(active, user.uid));
  };

  const renderConversationIcon = (c: Conversation) => {
    if (c.id === CHAT_DOC_IDS.community) return <Users size={18} />;
    if (c.id === CHAT_DOC_IDS.professorsGroup) return <Hash size={18} />;
    if (c.type === 'group' || c.type === 'community') return <Users size={18} />;
    return <MessageCircle size={18} />;
  };

  if (!user) return null;

  return (
    <div className="chathub">
      <aside className={`chathub-list ${active ? 'has-active' : ''}`}>
        <div className="chathub-list-head">
          <h2>Mensagens</h2>
          <button className="chathub-new-btn" onClick={() => { setShowNewChat(true); loadNewChatTargets(); }} title="Nova conversa">
            <Plus size={18} />
          </button>
        </div>
        <div className="chathub-search">
          <Search size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." />
        </div>
        {loadingConvs ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : filteredConvs.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Sem conversas ainda. Carrega <Plus size={12} /> para iniciar.
          </div>
        ) : (
          <ul className="chathub-conv-list">
            {filteredConvs.map(c => {
              const name = getConversationDisplayName(c, user.uid);
              const unread = getUnreadCount(c, user.uid, asAdmin);
              const muted = isMuted(c, user.uid);
              const isPinned = c.id === CHAT_DOC_IDS.community || c.id === CHAT_DOC_IDS.professorsGroup;
              return (
                <li key={c.id}>
                  <button
                    className={`chathub-conv-item ${active?.id === c.id ? 'active' : ''} ${unread > 0 ? 'has-unread' : ''}`}
                    onClick={() => setActive(c)}
                  >
                    <div className="chathub-conv-icon">{renderConversationIcon(c)}</div>
                    <div className="chathub-conv-body">
                      <div className="chathub-conv-name-row">
                        <span className="chathub-conv-name">{name}{isPinned && <span className="pin-tag">📌</span>}</span>
                        {muted && <BellOff size={12} className="muted-icon" />}
                      </div>
                      <span className="chathub-conv-preview">{c.lastMessage || '—'}</span>
                    </div>
                    {unread > 0 && <span className="chathub-unread">{unread > 99 ? '99+' : unread}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <main className={`chathub-panel ${active ? 'has-active' : ''}`}>
        {!active ? (
          <div className="chathub-empty">
            <MessageCircle size={48} />
            <p>Seleciona uma conversa</p>
          </div>
        ) : (
          <>
            <header className="chathub-panel-head">
              <button className="chathub-back" onClick={() => setActive(null)} title="Voltar"><ArrowLeft size={18} /></button>
              <div className="chathub-panel-title">
                <strong>{getConversationDisplayName(active, user.uid)}</strong>
                {(active.type === 'group' || active.type === 'community') && (
                  <span className="chathub-panel-meta">{(active.memberIds?.length || 0)} membros</span>
                )}
              </div>
              <button className="chathub-mute-btn" onClick={muteCurrent} title={isMuted(active, user.uid) ? 'Desmutar' : 'Mutar'}>
                {isMuted(active, user.uid) ? <BellOff size={16} /> : <Bell size={16} />}
              </button>
            </header>

            <div className="chathub-messages">
              {messages.map(m => {
                const mine = m.senderId === user.uid;
                return (
                  <div key={m.id} className={`msg ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && (active?.type === 'group' || active?.type === 'community') && (
                      <div className="msg-sender">{m.senderName} {m.senderRole !== 'client' && <span className="msg-role">{m.senderRole === 'admin' ? '· admin' : '· professor'}</span>}</div>
                    )}
                    {m.attachment && (
                      <div className="msg-attachment">
                        {m.attachment.type === 'image' ? (
                          <a href={m.attachment.url} target="_blank" rel="noopener noreferrer"><img src={m.attachment.url} alt={m.attachment.name || 'imagem'} /></a>
                        ) : (
                          <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="msg-file">
                            <Paperclip size={14} /> {m.attachment.name || 'Ficheiro'}
                          </a>
                        )}
                      </div>
                    )}
                    {m.text && <div className="msg-text">{m.text}</div>}
                    <div className="msg-time">{m.createdAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="chathub-compose">
              {showEmojis && (
                <div className="chathub-emojis">
                  {COMMON_EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => onPickEmoji(e)}>{e}</button>
                  ))}
                </div>
              )}
              <button type="button" className="chathub-icon-btn" onClick={() => setShowEmojis(s => !s)} title="Emoji"><Smile size={18} /></button>
              <button type="button" className="chathub-icon-btn" onClick={() => imageInputRef.current?.click()} title="Imagem" disabled={uploading}>
                {uploading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ImageIcon size={18} />}
              </button>
              <button type="button" className="chathub-icon-btn" onClick={() => fileInputRef.current?.click()} title="Ficheiro" disabled={uploading}>
                <Paperclip size={18} />
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachment(f); e.target.value = ''; }} />
              <input ref={fileInputRef} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachment(f); e.target.value = ''; }} />
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Escreve uma mensagem..."
                rows={1}
              />
              <button type="button" className="chathub-send-btn" onClick={handleSend} disabled={sending || !text.trim()}>
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </main>

      {/* New chat modal */}
      {showNewChat && (
        <div className="chathub-modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="chathub-modal" onClick={e => e.stopPropagation()}>
            <div className="chathub-modal-head">
              <h3>Nova conversa</h3>
              <button onClick={() => setShowNewChat(false)}><X size={16} /></button>
            </div>
            <div className="chathub-modal-search">
              <Search size={14} />
              <input autoFocus value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} placeholder="Pesquisar pessoa..." />
            </div>
            <div className="chathub-modal-list">
              {newChatLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
              ) : (
                newChatTargets
                  .filter(t => !newChatSearch.trim() || t.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (t.email || '').toLowerCase().includes(newChatSearch.toLowerCase()))
                  .map(t => (
                    <button key={t.userId} className="chathub-target" onClick={() => startDirectWith(t)}>
                      <div className="chathub-target-avatar" style={{ background: t.role === 'admin' ? '#7c9a72' : t.role === 'professor' ? '#3498db' : '#9ca3af' }}>
                        {t.photoUrl ? <img src={t.photoUrl} alt={t.name} /> : t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="chathub-target-body">
                        <strong>{t.name}</strong>
                        <span>{t.role === 'admin' ? 'Administração' : t.role === 'professor' ? 'Professor' : 'Aluno'}</span>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .chathub { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 120px); background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); overflow: hidden; }
        .chathub-list { border-right: 1px solid var(--beige); display: flex; flex-direction: column; min-height: 0; }
        .chathub-list-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--beige); }
        .chathub-list-head h2 { margin: 0; font-family: var(--font-body); font-size: 1.0625rem; font-weight: 600; }
        .chathub-new-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--primary); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .chathub-new-btn:hover { background: var(--primary-dark); }
        .chathub-search { padding: 0.625rem 1rem; border-bottom: 1px solid var(--beige); display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); }
        .chathub-search input { flex: 1; border: none; outline: none; font-size: 0.875rem; background: transparent; }
        .chathub-conv-list { flex: 1; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
        .chathub-conv-item { width: 100%; padding: 0.75rem 1rem; background: white; border: none; border-bottom: 1px solid var(--beige); cursor: pointer; display: flex; align-items: center; gap: 0.75rem; text-align: left; transition: background var(--transition-fast); }
        .chathub-conv-item:hover { background: var(--bg-secondary); }
        .chathub-conv-item.active { background: var(--bg-secondary); border-left: 3px solid var(--primary); padding-left: calc(1rem - 3px); }
        .chathub-conv-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .chathub-conv-body { flex: 1; min-width: 0; }
        .chathub-conv-name-row { display: flex; align-items: center; gap: 0.4rem; }
        .chathub-conv-name { font-weight: 600; font-size: 0.9375rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .pin-tag { font-size: 0.6875rem; }
        .muted-icon { color: var(--text-muted); }
        .chathub-conv-preview { display: block; font-size: 0.8125rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.125rem; }
        .chathub-conv-item.has-unread .chathub-conv-name { color: var(--text-heading); }
        .chathub-conv-item.has-unread .chathub-conv-preview { color: var(--text-primary); font-weight: 500; }
        .chathub-unread { flex-shrink: 0; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--primary); color: white; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

        .chathub-panel { display: flex; flex-direction: column; min-height: 0; }
        .chathub-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; color: var(--text-muted); gap: 0.5rem; }
        .chathub-panel-head { display: flex; align-items: center; gap: 0.625rem; padding: 0.875rem 1rem; border-bottom: 1px solid var(--beige); }
        .chathub-back { background: none; border: none; cursor: pointer; padding: 0.4rem; color: var(--text-muted); display: none; }
        .chathub-panel-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .chathub-panel-title strong { font-size: 1rem; font-weight: 600; }
        .chathub-panel-meta { font-size: 0.75rem; color: var(--text-muted); }
        .chathub-mute-btn { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.4rem 0.625rem; cursor: pointer; color: var(--text-secondary); }
        .chathub-mute-btn:hover { background: var(--bg-secondary); }

        .chathub-messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-secondary); }
        .msg { max-width: 70%; padding: 0.625rem 0.875rem; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .msg.mine { align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 4px; }
        .msg.theirs { align-self: flex-start; background: white; color: var(--text-primary); border-bottom-left-radius: 4px; }
        .msg-sender { font-size: 0.75rem; font-weight: 700; color: var(--primary-dark); margin-bottom: 0.2rem; }
        .msg-role { font-weight: 500; opacity: 0.7; font-size: 0.6875rem; }
        .msg-text { font-size: 0.9375rem; line-height: 1.4; word-break: break-word; white-space: pre-wrap; }
        .msg-time { font-size: 0.6875rem; opacity: 0.7; margin-top: 0.25rem; text-align: right; }
        .msg-attachment img { max-width: 280px; max-height: 240px; border-radius: 8px; cursor: zoom-in; }
        .msg-file { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.625rem; background: rgba(0,0,0,0.05); border-radius: 8px; color: inherit; text-decoration: none; font-size: 0.8125rem; }
        .msg.mine .msg-file { background: rgba(255,255,255,0.18); }

        .chathub-compose { position: relative; display: flex; align-items: flex-end; gap: 0.4rem; padding: 0.625rem 0.875rem; border-top: 1px solid var(--beige); background: white; }
        .chathub-icon-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.5rem; border-radius: var(--radius-md); display: flex; }
        .chathub-icon-btn:hover { background: var(--bg-secondary); color: var(--primary); }
        .chathub-compose textarea { flex: 1; resize: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-family: var(--font-body); font-size: 0.9375rem; outline: none; max-height: 120px; }
        .chathub-compose textarea:focus { border-color: var(--primary); }
        .chathub-send-btn { background: var(--primary); color: white; border: none; border-radius: 50%; width: 38px; height: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .chathub-send-btn:disabled { background: var(--text-muted); cursor: not-allowed; }
        .chathub-emojis { position: absolute; bottom: 60px; left: 0; background: white; border: 1px solid var(--sand); border-radius: var(--radius-lg); padding: 0.5rem; display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.25rem; box-shadow: var(--shadow-md); }
        .chathub-emojis button { background: none; border: none; cursor: pointer; font-size: 1.25rem; padding: 0.25rem; border-radius: var(--radius-sm); }
        .chathub-emojis button:hover { background: var(--bg-secondary); }

        .chathub-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
        .chathub-modal { background: white; border-radius: var(--radius-xl); width: 100%; max-width: 460px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 16px 50px rgba(0,0,0,0.2); overflow: hidden; }
        .chathub-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--beige); }
        .chathub-modal-head h3 { margin: 0; font-family: var(--font-body); font-size: 1.0625rem; }
        .chathub-modal-head button { background: none; border: none; cursor: pointer; padding: 0.25rem; color: var(--text-muted); display: flex; }
        .chathub-modal-search { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.25rem; border-bottom: 1px solid var(--beige); color: var(--text-muted); }
        .chathub-modal-search input { flex: 1; border: none; outline: none; font-size: 0.875rem; }
        .chathub-modal-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
        .chathub-target { display: flex; gap: 0.75rem; align-items: center; padding: 0.625rem 0.75rem; width: 100%; background: white; border: none; cursor: pointer; border-radius: var(--radius-md); text-align: left; }
        .chathub-target:hover { background: var(--bg-secondary); }
        .chathub-target-avatar { width: 38px; height: 38px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; overflow: hidden; }
        .chathub-target-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chathub-target-body { flex: 1; min-width: 0; }
        .chathub-target-body strong { display: block; font-size: 0.9375rem; }
        .chathub-target-body span { font-size: 0.75rem; color: var(--text-muted); }

        @media (max-width: 768px) {
          .chathub { grid-template-columns: 1fr; height: calc(100vh - 60px); }
          .chathub-list { display: ${active ? 'none' : 'flex'}; }
          .chathub-panel { display: ${active ? 'flex' : 'none'}; }
          .chathub-back { display: flex; }
          .chathub-list.has-active { display: none; }
        }
      `}</style>
    </div>
  );
}
