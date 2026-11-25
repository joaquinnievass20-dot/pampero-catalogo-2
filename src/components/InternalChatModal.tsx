import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChatParticipantInfo,
  ChatParticipantRole,
  EmployeeAccount,
  InternalChatMessage,
  InternalChatThread,
  RegisteredUser,
  ThemeConfig,
  UserSession,
} from '../types';
import {
  ensureDirectChatThread,
  getChatParticipantInfoFromSession,
  getChatParticipantKey,
  markChatThreadRead,
  sendInternalChatMessage,
  subscribeToChatMessages,
  subscribeToFirestoreEmployees,
  subscribeToFirestoreUsers,
} from '../services/firebase';
import { fixUtf8Encoding } from '../utils/encodingUtils';
import {
  Building2,
  CheckCheck,
  ChevronLeft,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';

interface InternalChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession | null;
  threads: InternalChatThread[];
  initialThreadId?: string | null;
  theme?: ThemeConfig;
}

const ROLE_META: Record<
  ChatParticipantRole,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  admin: {
    label: 'Administrador',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: ShieldCheck,
  },
  employee: {
    label: 'Empleado',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: Users,
  },
  client: {
    label: 'Cliente',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: Building2,
  },
};

function formatTimeShort(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return timeStr;
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${timeStr}`;
}

export const InternalChatModal: React.FC<InternalChatModalProps> = ({
  isOpen,
  onClose,
  userSession,
  threads,
  initialThreadId = null,
  theme,
}) => {
  const me = useMemo(() => getChatParticipantInfoFromSession(userSession), [userSession]);
  const myKey = me.id;
  const st = theme?.siteTexts;

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [leftTab, setLeftTab] = useState<'chats' | 'directory'>('chats');
  const [roleFilter, setRoleFilter] = useState<'all' | ChatParticipantRole>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);
  const [localThreadDraft, setLocalThreadDraft] = useState<InternalChatThread | null>(null);
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubUsers = subscribeToFirestoreUsers((list) => {
      setRegisteredUsers(Array.isArray(list) ? list : []);
    });
    const unsubEmps = subscribeToFirestoreEmployees((list) => {
      setEmployees(Array.isArray(list) ? list : []);
    });
    return () => {
      unsubUsers();
      unsubEmps();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialThreadId) {
      setActiveThreadId(initialThreadId);
      setLeftTab('chats');
    } else if (isOpen && !activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [isOpen, initialThreadId, threads, activeThreadId]);

  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return (
      threads.find((t) => t.id === activeThreadId) ||
      (localThreadDraft?.id === activeThreadId ? localThreadDraft : null)
    );
  }, [activeThreadId, threads, localThreadDraft]);

  useEffect(() => {
    if (!isOpen || !activeThreadId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToChatMessages(activeThreadId, (list) => {
      setMessages(list);
    });
    markChatThreadRead(activeThreadId, myKey);
    return () => unsub();
  }, [isOpen, activeThreadId, myKey]);

  useEffect(() => {
    if (isOpen && activeThread && Number(activeThread.unreadCounts?.[myKey] || 0) > 0) {
      markChatThreadRead(activeThread.id, myKey);
    }
  }, [isOpen, activeThread, myKey, messages.length]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length, activeThreadId]);

  // Unified contacts directory grouped by Administradores, Empleados, Clientes
  const directoryContacts: ChatParticipantInfo[] = useMemo(() => {
    const map = new Map<string, ChatParticipantInfo>();

    const upsert = (item: ChatParticipantInfo) => {
      const k = getChatParticipantKey(item);
      if (!k || k === myKey) return;
      const existing = map.get(k);
      if (!existing || existing.role === 'client') {
        map.set(k, { ...item, id: k });
      }
    };

    // Master Admin always reachable
    upsert({
      id: 'joaquinnievass20@gmail.com',
      name: 'Administrador Maestro Joaquín Nievas',
      email: 'joaquinnievass20@gmail.com',
      role: 'admin',
      subLabel: 'Administrador General',
    });

    employees.forEach((emp) => {
      if (emp.active === false) return;
      const isEmpAdmin = emp.sellerRole === 'admin';
      upsert({
        id: getChatParticipantKey(emp),
        name: fixUtf8Encoding(emp.sellerName || emp.name || emp.email?.split('@')[0] || 'Empleado'),
        email: emp.email,
        role: isEmpAdmin ? 'admin' : 'employee',
        subLabel: `${emp.sellerRole === 'encargado' ? 'Encargado' : isEmpAdmin ? 'Administrador' : 'Empleado'}${emp.branch ? ` · ${fixUtf8Encoding(emp.branch)}` : ''}`,
      });
    });

    registeredUsers.forEach((u) => {
      if (u.status === 'suspended') return;
      const uRole: ChatParticipantRole =
        u.role === 'admin' || u.type === 'admin'
          ? 'admin'
          : u.role === 'employee' || u.type === 'empleado' || u.type === 'vendedor'
          ? 'employee'
          : 'client';
      const displayName =
        u.type === 'empresa' && u.name
          ? u.name
          : u.name || u.repName || u.email?.split('@')[0] || 'Usuario';
      const sub =
        uRole === 'admin'
          ? 'Administrador'
          : uRole === 'employee'
          ? `${u.sellerRole === 'encargado' ? 'Encargado' : 'Empleado'}${u.branch ? ` · ${fixUtf8Encoding(u.branch)}` : ''}`
          : u.type === 'empresa'
          ? `Empresa${u.repName ? ` · ${fixUtf8Encoding(u.repName)}` : ''}`
          : 'Cliente Consumidor Final';

      upsert({
        id: getChatParticipantKey(u),
        name: fixUtf8Encoding(displayName),
        email: u.email,
        role: uRole,
        subLabel: sub,
      });
    });

    const roleOrder: Record<ChatParticipantRole, number> = { admin: 0, employee: 1, client: 2 };
    return Array.from(map.values()).sort((a, b) => {
      const ro = roleOrder[a.role] - roleOrder[b.role];
      if (ro !== 0) return ro;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [employees, registeredUsers, myKey]);

  const filteredDirectory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return directoryContacts.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !(c.email || '').toLowerCase().includes(q) &&
        !(c.subLabel || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [directoryContacts, roleFilter, searchQuery]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return threads.filter((t) => {
      const other = t.participants.find((p) => p.id !== myKey) || t.participants[0];
      if (!other) return false;
      if (
        q &&
        !other.name.toLowerCase().includes(q) &&
        !(other.email || '').toLowerCase().includes(q) &&
        !(t.lastMessageText || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [threads, myKey, searchQuery]);

  const totalUnread = useMemo(
    () => threads.reduce((acc, t) => acc + (Number(t.unreadCounts?.[myKey]) || 0), 0),
    [threads, myKey]
  );

  if (!isOpen || !userSession) return null;

  const getOtherParticipant = (thread: InternalChatThread): ChatParticipantInfo => {
    return (
      thread.participants.find((p) => p.id !== myKey) ||
      thread.participants[0] || { id: 'unknown', name: 'Conversación', role: 'employee' }
    );
  };

  const handleStartConversation = async (contact: ChatParticipantInfo) => {
    const thread = await ensureDirectChatThread(me, contact);
    setLocalThreadDraft(thread);
    setActiveThreadId(thread.id);
    setLeftTab('chats');
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeThread || !messageText.trim() || isSending) return;
    const textToSend = messageText.trim();
    setMessageText('');
    setIsSending(true);
    try {
      await sendInternalChatMessage(activeThread, me, textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const activeOther = activeThread ? getOtherParticipant(activeThread) : null;
  const activeOtherMeta = activeOther ? ROLE_META[activeOther.role] : null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xs border border-[#DCD4C9] w-full max-w-5xl h-[88vh] max-h-[760px] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Header */}
        <div
          style={{ backgroundColor: theme?.primaryColor || '#18231C' }}
          className="px-4 sm:px-5 py-3.5 flex items-center justify-between text-white shrink-0 border-b border-black/30"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xs bg-white/10 text-[#FDB813] shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold text-sm sm:text-base uppercase tracking-wider truncate">
                  {st?.chatTitle || 'Chat Interno Pampero'}
                </h3>
                {totalUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-mono font-black tabular-nums">
                    {totalUnread} sin leer
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#DCD4C9]/80 truncate">
                {st?.chatSubtitle ||
                  'Mensajería en tiempo real entre Administradores, Empleados y Clientes registrados'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/75 hover:text-white p-1.5 rounded-xs hover:bg-white/10 cursor-pointer transition-colors"
            aria-label="Cerrar chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Pane Chat Body */}
        <div className="flex-1 flex min-h-0 bg-[#FAF8F5]">
          {/* LEFT PANE: Conversations & Recipient Directory */}
          <div
            className={`${
              activeThread ? 'hidden md:flex' : 'flex'
            } w-full md:w-80 lg:w-96 flex-col border-r border-[#DCD4C9] bg-white shrink-0 min-h-0`}
          >
            {/* Mode Switcher */}
            <div className="p-3 border-b border-[#DCD4C9] space-y-2.5 bg-[#FAF8F5]">
              <div className="grid grid-cols-2 gap-1.5 bg-[#ECE5DC]/60 p-1 rounded-xs border border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => setLeftTab('chats')}
                  className={`py-1.5 px-2 rounded-xs text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    leftTab === 'chats'
                      ? 'bg-[#18231C] text-[#FDB813] shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  <span>Conversaciones</span>
                  {totalUnread > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-mono tabular-nums">
                      {totalUnread}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('directory')}
                  className={`py-1.5 px-2 rounded-xs text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    leftTab === 'directory'
                      ? 'bg-[#18231C] text-[#FDB813] shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Elegir Contacto</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    leftTab === 'chats' ? 'Buscar conversación...' : 'Buscar admin, empleado o cliente...'
                  }
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C]"
                />
              </div>

              {/* Role Filter inside Directory */}
              {leftTab === 'directory' && (
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'admin', label: 'Administradores' },
                      { id: 'employee', label: 'Empleados' },
                      { id: 'client', label: 'Clientes' },
                    ] as const
                  ).map((rf) => {
                    const count =
                      rf.id === 'all'
                        ? directoryContacts.length
                        : directoryContacts.filter((c) => c.role === rf.id).length;
                    const active = roleFilter === rf.id;
                    return (
                      <button
                        key={rf.id}
                        type="button"
                        onClick={() => setRoleFilter(rf.id)}
                        className={`px-2 py-1 rounded-xs text-[10px] font-bold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#18231C] text-white border-[#18231C]'
                            : 'bg-white text-[#4A453F] border-[#DCD4C9] hover:bg-[#FAF8F5]'
                        }`}
                      >
                        {rf.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#ECE5DC]">
              {leftTab === 'chats' ? (
                filteredThreads.length === 0 ? (
                  <div className="p-6 text-center space-y-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#DCD4C9] text-[#8C827A] flex items-center justify-center mx-auto">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-[#18231C]">Todavía no hay conversaciones</p>
                    <p className="text-[11px] text-[#6F6860]">
                      Elegí un administrador, empleado o cliente para iniciar un chat en tiempo real.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLeftTab('directory')}
                      className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-[#FDB813] text-[11px] font-bold uppercase tracking-wider rounded-xs cursor-pointer"
                    >
                      + Nueva Conversación
                    </button>
                  </div>
                ) : (
                  filteredThreads.map((thread) => {
                    const other = getOtherParticipant(thread);
                    const meta = ROLE_META[other.role] || ROLE_META.employee;
                    const unread = Number(thread.unreadCounts?.[myKey] || 0);
                    const isSelected = activeThreadId === thread.id;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setActiveThreadId(thread.id)}
                        className={`w-full p-3 text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-amber-50/80 border-l-4 border-l-[#FDB813]'
                            : 'hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-[#18231C] text-[#FDB813] font-black text-xs flex items-center justify-center shrink-0">
                          {other.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-[#18231C] truncate">
                              {fixUtf8Encoding(other.name)}
                            </span>
                            <span className="text-[10px] text-[#8C827A] font-mono shrink-0">
                              {formatTimeShort(thread.lastMessageAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[11px] text-[#6F6860] truncate">
                              {thread.lastMessageText
                                ? `${thread.lastSenderId === myKey ? 'Vos: ' : ''}${fixUtf8Encoding(thread.lastMessageText)}`
                                : other.subLabel || meta.label}
                            </p>
                            {unread > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-mono font-black shrink-0 tabular-nums">
                                {unread}
                              </span>
                            )}
                          </div>
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.2 rounded-xs text-[9px] font-bold uppercase border ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )
              ) : filteredDirectory.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6F6860]">
                  No se encontraron usuarios con ese criterio.
                </div>
              ) : (
                filteredDirectory.map((contact) => {
                  const meta = ROLE_META[contact.role];
                  const RoleIcon = meta.icon;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleStartConversation(contact)}
                      className="w-full p-3 text-left hover:bg-[#FAF8F5] transition-colors cursor-pointer flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#ECE5DC] text-[#18231C] font-bold text-xs flex items-center justify-center shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#18231C] truncate">
                            {contact.name}
                          </p>
                          <p className="text-[10px] text-[#6F6860] truncate">
                            {contact.subLabel || contact.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded-xs text-[9px] font-bold uppercase border inline-flex items-center gap-1 shrink-0 ${meta.badgeClass}`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: Active Conversation */}
          <div
            className={`${
              activeThread ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-w-0 min-h-0 bg-[#FAF8F5]`}
          >
            {activeThread && activeOther ? (
              <>
                {/* Thread Header */}
                <div className="px-4 py-3 bg-white border-b border-[#DCD4C9] flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setActiveThreadId(null)}
                      className="md:hidden p-1.5 rounded-xs hover:bg-[#FAF8F5] text-[#18231C] cursor-pointer"
                      aria-label="Volver a conversaciones"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-[#18231C] text-[#FDB813] font-black text-xs flex items-center justify-center shrink-0">
                      {activeOther.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-[#18231C] truncate">
                          {fixUtf8Encoding(activeOther.name)}
                        </h4>
                        {activeOtherMeta && (
                          <span
                            className={`px-1.5 py-0.2 rounded-xs text-[9px] font-bold uppercase border ${activeOtherMeta.badgeClass}`}
                          >
                            {activeOtherMeta.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6F6860] truncate">
                        {activeOther.subLabel || activeOther.email || 'Chat directo en tiempo real'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6F6860] space-y-2">
                      <User className="w-8 h-8 text-[#DCD4C9]" />
                      <p className="text-xs font-bold text-[#18231C]">
                        Iniciá la conversación con {fixUtf8Encoding(activeOther.name)}
                      </p>
                      <p className="text-[11px]">
                        Los mensajes se sincronizan al instante y generan notificación si la otra persona no está conectada.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.senderId === myKey;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[82%] sm:max-w-[70%] rounded-xs px-3.5 py-2.5 shadow-2xs text-xs space-y-1 ${
                              isMine
                                ? 'bg-[#18231C] text-white border border-[#18231C]'
                                : 'bg-white text-[#18231C] border border-[#DCD4C9]'
                            }`}
                          >
                            {!isMine && (
                              <span className="text-[10px] font-bold text-[#B9522F] block">
                                {fixUtf8Encoding(msg.senderName)}
                              </span>
                            )}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {fixUtf8Encoding(msg.text)}
                            </p>
                            <div
                              className={`flex items-center justify-end gap-1 text-[9px] font-mono ${
                                isMine ? 'text-[#DCD4C9]/75' : 'text-[#8C827A]'
                              }`}
                            >
                              <span>{formatTimeShort(msg.createdAt)}</span>
                              {isMine && <CheckCheck className="w-3 h-3 text-[#FDB813]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <form
                  onSubmit={handleSend}
                  className="p-3 bg-white border-t border-[#DCD4C9] flex items-end gap-2 shrink-0"
                >
                  <textarea
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={
                      st?.chatInputPlaceholder || 'Escribí tu mensaje... (Enter para enviar)'
                    }
                    className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C] resize-none max-h-28"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || isSending}
                    className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{st?.chatSendBtnText || 'Enviar'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-white border border-[#DCD4C9] text-[#18231C] flex items-center justify-center shadow-2xs">
                  <MessageSquare className="w-7 h-7 text-[#B9522F]" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-wider text-[#18231C]">
                  Seleccioná una conversación o contacto
                </h4>
                <p className="text-xs text-[#6F6860] max-w-sm">
                  Podés chatear de forma directa con Administradores, Empleados del equipo o Clientes registrados en la plataforma.
                </p>
                <button
                  type="button"
                  onClick={() => setLeftTab('directory')}
                  className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer"
                >
                  Elegir Destinatario
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
