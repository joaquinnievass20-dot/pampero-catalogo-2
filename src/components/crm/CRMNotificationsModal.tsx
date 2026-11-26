import React, { useState, useMemo, useEffect } from 'react';
import { CRMOrder, LeadVisit, ThemeConfig } from '../../types';
import {
  X,
  AlertTriangle,
  Clock,
  MessageCircle,
  MessageSquare,
  CheckCircle2,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  ArrowRight,
  DollarSign,
  Sparkles,
} from 'lucide-react';

export interface CRMNotificationItem {
  id: string;
  category: 'reminder' | 'blocked' | 'delayed' | 'visit' | 'chat' | 'missing_amount' | 'new_quote';
  title: string;
  subtitle: string;
  meta: string;
  badgeText: string;
  badgeClass: string;
  order?: CRMOrder;
  visit?: LeadVisit;
  chatThreadId?: string;
  whatsappPhone?: string;
  whatsappText?: string;
}

interface CRMNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CRMNotificationItem[];
  readIds: string[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSelectOrder?: (order: CRMOrder) => void;
  onGoToVisits?: () => void;
  onOpenChat?: (threadId?: string) => void;
  theme?: ThemeConfig;
}

export const CRMNotificationsModal: React.FC<CRMNotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  readIds,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectOrder,
  onGoToVisits,
  onOpenChat,
  theme,
}) => {
  const st = theme?.siteTexts;
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !readSet.has(n.id)).length,
    [notifications, readSet]
  );

  const [filterMode, setFilterMode] = useState<'unread' | 'all'>('unread');

  useEffect(() => {
    if (isOpen) {
      setFilterMode(unreadCount > 0 ? 'unread' : 'all');
    }
  }, [isOpen, unreadCount]);

  if (!isOpen) return null;

  const visibleItems =
    filterMode === 'unread'
      ? notifications.filter((n) => !readSet.has(n.id))
      : notifications;

  const getIcon = (cat: CRMNotificationItem['category']) => {
    switch (cat) {
      case 'blocked':
        return <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />;
      case 'delayed':
        return <Clock className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'reminder':
        return <Calendar className="w-4 h-4 text-[#B9522F] shrink-0" />;
      case 'visit':
        return <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'missing_amount':
        return <DollarSign className="w-4 h-4 text-emerald-700 shrink-0" />;
      case 'new_quote':
        return <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/45 p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[88vh] mt-10 sm:mt-12"
      >
        {/* Header */}
        <div className="bg-[#18231C] px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 text-[#FDB813] rounded-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {st?.crmNotifTitle || 'Notificaciones del Equipo'}
              </h3>
              <p className="text-[11px] text-[#DCD4C9]/80 tabular-nums">
                {unreadCount > 0
                  ? `${unreadCount} sin leer · ${notifications.length} totales`
                  : 'Todo al día · Sin notificaciones pendientes'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer p-1"
            aria-label="Cerrar notificaciones"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs + Mark All Read */}
        <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#DCD4C9] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`px-3 py-1 rounded-xs text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                filterMode === 'unread'
                  ? 'bg-[#18231C] border-[#18231C] text-white'
                  : 'bg-white border-[#DCD4C9] text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              No leídas ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-xs text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[#18231C] border-[#18231C] text-white'
                  : 'bg-white border-[#DCD4C9] text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              Todas ({notifications.length})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-400 text-emerald-800 rounded-xs text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar todas leídas</span>
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 bg-white">
          {visibleItems.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#18231C] uppercase tracking-wider">
                {filterMode === 'unread'
                  ? 'No tenés notificaciones sin leer'
                  : 'No hay alertas activas en este momento'}
              </p>
              <p className="text-[11px] text-[#6F6860]">
                Cuando ingresen recordatorios, demoras o avisos comerciales aparecerán aquí.
              </p>
              {filterMode === 'unread' && notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="mt-2 px-3 py-1 text-[11px] font-bold text-[#B9522F] hover:underline cursor-pointer"
                >
                  Ver historial ({notifications.length})
                </button>
              )}
            </div>
          ) : (
            visibleItems.map((item) => {
              const isRead = readSet.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xs border transition-colors ${
                    isRead
                      ? 'bg-[#FAF8F5]/60 border-[#DCD4C9] opacity-80'
                      : 'bg-white border-[#18231C]/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">{getIcon(item.category)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded-xs text-[9px] font-black uppercase border ${item.badgeClass}`}
                          >
                            {item.badgeText}
                          </span>
                          <span className="font-bold text-xs text-[#18231C] truncate">
                            {item.title}
                          </span>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#B9522F] shrink-0" title="No leída" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#4A453F] mt-1 leading-snug">
                          {item.subtitle}
                        </p>
                        <p className="text-[10px] text-[#6F6860] mt-1 font-mono">
                          {item.meta}
                        </p>
                      </div>
                    </div>

                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(item.id)}
                        className="p-1.5 bg-[#FAF8F5] hover:bg-emerald-50 border border-[#DCD4C9] hover:border-emerald-400 text-[#6F6860] hover:text-emerald-800 rounded-xs cursor-pointer shrink-0 transition-colors"
                        title="Marcar como leída"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Direct Actions */}
                  <div className="mt-2.5 pt-2 border-t border-[#DCD4C9]/60 flex items-center justify-end gap-2 flex-wrap">
                    {item.chatThreadId && onOpenChat && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isRead) onMarkAsRead(item.id);
                          onClose();
                          onOpenChat(item.chatThreadId);
                        }}
                        className="px-2.5 py-1 bg-[#18231C] hover:bg-black text-[#FDB813] text-[10px] font-bold uppercase tracking-wider rounded-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Abrir Chat</span>
                      </button>
                    )}
                    {item.order && onSelectOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isRead) onMarkAsRead(item.id);
                          onSelectOrder(item.order!);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-[#18231C] hover:bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{item.category === 'missing_amount' ? 'Cargar Monto' : 'Abrir Ficha'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {item.visit && onGoToVisits && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isRead) onMarkAsRead(item.id);
                          onGoToVisits();
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] text-[10px] font-bold uppercase tracking-wider rounded-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ir a Visitas</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {item.whatsappText && (
                      <a
                        href={`https://wa.me/${(item.whatsappPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(item.whatsappText)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (!isRead) onMarkAsRead(item.id);
                        }}
                        className="px-2.5 py-1 bg-[#25D366] hover:bg-[#20ba59] text-white text-[10px] font-bold uppercase tracking-wider rounded-xs inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#FAF8F5] px-5 py-2.5 border-t border-[#DCD4C9] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs hover:bg-black cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
