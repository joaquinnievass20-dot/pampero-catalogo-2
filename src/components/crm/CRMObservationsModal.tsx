import React, { useState } from 'react';
import { ObservationHistoryEntry } from '../../types';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { X, MessageSquarePlus, Bell, Calendar, Clock, User } from 'lucide-react';

interface CRMObservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityTitle: string;
  trackingCode?: string;
  branch?: string;
  currentObservation?: string;
  currentObservationDate?: string;
  currentReminderDate?: string;
  currentReminderTime?: string;
  currentReminderNote?: string;
  history?: ObservationHistoryEntry[];
  activeStaffUser: string;
  onSaveObservation: (payload: {
    observations: string;
    observationDate: string;
    reminderDate?: string;
    reminderTime?: string;
    reminderNote?: string;
    observationHistory: ObservationHistoryEntry[];
  }) => Promise<void> | void;
}

export const CRMObservationsModal: React.FC<CRMObservationsModalProps> = ({
  isOpen,
  onClose,
  entityTitle,
  trackingCode,
  branch,
  currentObservation = '',
  currentObservationDate,
  currentReminderDate,
  currentReminderTime,
  currentReminderNote,
  history = [],
  activeStaffUser,
  onSaveObservation,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [observationDate, setObservationDate] = useState(currentObservationDate || todayStr);
  const [text, setText] = useState('');
  const [generateReminder, setGenerateReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(currentReminderDate || todayStr);
  const [reminderTime, setReminderTime] = useState(currentReminderTime || '');
  const [reminderNote, setReminderNote] = useState(currentReminderNote || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const normalizedHistory: ObservationHistoryEntry[] = Array.isArray(history) ? history : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText && !generateReminder) return;

    setIsSaving(true);
    try {
      const activeReminderDate = generateReminder && reminderDate.trim() ? reminderDate.trim() : currentReminderDate;
      const activeReminderTime = generateReminder && reminderTime.trim() ? reminderTime.trim() : currentReminderTime;
      const activeReminderNote =
        generateReminder && (reminderNote.trim() || cleanText)
          ? (reminderNote.trim() || cleanText)
          : currentReminderNote;

      const newEntry: ObservationHistoryEntry = sanitizeObjectEncoding({
        id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        observationDate: observationDate || todayStr,
        text: cleanText || activeReminderNote || 'Recordatorio programado',
        reminderDate: generateReminder && reminderDate.trim() ? reminderDate.trim() : undefined,
        reminderTime: generateReminder && reminderTime.trim() ? reminderTime.trim() : undefined,
        author: activeStaffUser || 'Equipo Pampero',
        createdAt: new Date().toISOString(),
      });

      const nextHistory = [newEntry, ...normalizedHistory];

      await onSaveObservation({
        observations: cleanText || currentObservation || newEntry.text,
        observationDate: observationDate || todayStr,
        reminderDate: activeReminderDate,
        reminderTime: activeReminderTime,
        reminderNote: activeReminderNote,
        observationHistory: nextHistory,
      });

      setText('');
      setGenerateReminder(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {trackingCode && (
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-xs bg-[#FDB813] text-[#18231C]">
                  {trackingCode}
                </span>
              )}
              {branch && (
                <span className="text-[10px] uppercase font-bold text-[#DCD4C9]">
                  {fixUtf8Encoding(branch)}
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm uppercase tracking-wider truncate mt-1">
              Observaciones · {fixUtf8Encoding(entityTitle)}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer p-1"
            aria-label="Cerrar observaciones"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Form to Add Observation */}
          <form onSubmit={handleSubmit} className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                <MessageSquarePlus className="w-4 h-4 text-[#18231C]" />
                <span>Nueva Observación</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-[#6F6860]">Fecha:</span>
                <input
                  type="date"
                  value={observationDate}
                  onChange={(e) => setObservationDate(e.target.value)}
                  className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] font-mono outline-none focus:border-[#18231C]"
                />
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required={!generateReminder}
              placeholder="Escribí novedades de entrega, cambios de talle, acuerdos con el cliente o seguimiento..."
              className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none resize-none focus:border-[#18231C]"
            />

            <div className="pt-2 border-t border-[#DCD4C9]/80 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-[#18231C] text-[11px]">
                <input
                  type="checkbox"
                  checked={generateReminder}
                  onChange={(e) => {
                    setGenerateReminder(e.target.checked);
                    if (e.target.checked && !reminderDate) {
                      setReminderDate(todayStr);
                    }
                  }}
                  className="accent-[#18231C] w-3.5 h-3.5 cursor-pointer"
                />
                <Bell className="w-3.5 h-3.5 text-[#18231C]" />
                <span>Generar notificación y evento recordatorio en Calendario</span>
              </label>

              {generateReminder && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                      Fecha Recordatorio *
                    </label>
                    <input
                      type="date"
                      required={generateReminder}
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                      Hora (opcional)
                    </label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                      Nota de Aviso
                    </label>
                    <input
                      type="text"
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                      placeholder="Ej: Llamar para confirmar"
                      className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving || (!text.trim() && !generateReminder)}
                className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-colors"
              >
                {isSaving ? 'Guardando...' : 'Guardar Observación'}
              </button>
            </div>
          </form>

          {/* Chronological Observations History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860]">
                Historial de Observaciones ({normalizedHistory.length > 0 ? normalizedHistory.length : currentObservation ? 1 : 0})
              </span>
              {currentReminderDate && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#FAF8F5] text-[#18231C] border border-[#DCD4C9] rounded-xs flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  <span>Próx. recordatorio: {currentReminderDate}{currentReminderTime ? ` ${currentReminderTime}hs` : ''}</span>
                </span>
              )}
            </div>

            {normalizedHistory.length === 0 && !currentObservation ? (
              <div className="p-6 text-center text-[#6F6860] bg-[#FAF8F5] border border-dashed border-[#DCD4C9] rounded-xs">
                Todavía no hay observaciones cargadas en esta ficha.
              </div>
            ) : normalizedHistory.length === 0 && currentObservation ? (
              <div className="p-3 bg-white border border-[#DCD4C9] rounded-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-[#6F6860]">
                  <span className="font-bold text-[#18231C] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {currentObservationDate || '-'}
                  </span>
                </div>
                <p className="text-xs text-[#18231C] whitespace-pre-wrap">{fixUtf8Encoding(currentObservation)}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {normalizedHistory.map((item) => (
                  <div key={item.id} className="p-3 bg-white border border-[#DCD4C9] rounded-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-[#6F6860]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#18231C] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.observationDate}
                        </span>
                        <span className="flex items-center gap-1 font-semibold">
                          <User className="w-3 h-3" />
                          {fixUtf8Encoding(item.author)}
                        </span>
                      </div>
                      {item.reminderDate && (
                        <span className="px-1.5 py-0.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[#18231C] font-bold flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          Rec: {item.reminderDate}{item.reminderTime ? ` ${item.reminderTime}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#18231C] whitespace-pre-wrap leading-relaxed">
                      {fixUtf8Encoding(item.text)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DCD4C9] bg-white hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
