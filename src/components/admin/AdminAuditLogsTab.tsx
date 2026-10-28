import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry } from '../../types';
import { subscribeToAuditLogs } from '../../services/firebase';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Calendar, 
  RefreshCw, 
  FileText, 
  Layers, 
  Activity,
  ArrowUpDown,
  Download
} from 'lucide-react';

export const AdminAuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('todos');
  const [selectedAction, setSelectedAction] = useState('todas');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToAuditLogs((fetched) => {
      setLogs(fetched);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const formatDateTime = (isoDate: string) => {
    if (!isoDate) return '-';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
    } catch {
      return isoDate;
    }
  };

  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      // 1. Text Search
      const s = searchTerm.toLowerCase().trim();
      if (s) {
        const inUser = (log.userName || '').toLowerCase().includes(s) || (log.userEmail || '').toLowerCase().includes(s);
        const inDetails = (log.details || '').toLowerCase().includes(s);
        const inModule = (log.module || '').toLowerCase().includes(s);
        const inAction = (log.action || '').toLowerCase().includes(s);
        if (!inUser && !inDetails && !inModule && !inAction) return false;
      }

      // 2. Module Filter
      if (selectedModule !== 'todos' && log.module !== selectedModule) {
        return false;
      }

      // 3. Action Filter
      if (selectedAction !== 'todas' && log.action !== selectedAction) {
        return false;
      }

      // 4. Date Filter
      if (selectedDateFilter !== 'all' && log.timestamp) {
        const logTime = new Date(log.timestamp).getTime();
        if (selectedDateFilter === 'today') {
          const isToday = new Date(log.timestamp).toDateString() === new Date().toDateString();
          if (!isToday) return false;
        } else if (selectedDateFilter === '7days') {
          if (now - logTime > 7 * oneDay) return false;
        } else if (selectedDateFilter === '30days') {
          if (now - logTime > 30 * oneDay) return false;
        }
      }

      return true;
    });
  }, [logs, searchTerm, selectedModule, selectedAction, selectedDateFilter]);

  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => { if (l.module) set.add(l.module); });
    return Array.from(set);
  }, [logs]);

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => { if (l.action) set.add(l.action); });
    return Array.from(set);
  }, [logs]);

  const getActionBadgeStyle = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('crear') || act.includes('nuevo')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    }
    if (act.includes('eliminar') || act.includes('borrar')) {
      return 'bg-red-50 text-red-800 border-red-300';
    }
    if (act.includes('pdf') || act.includes('subir') || act.includes('archivo')) {
      return 'bg-purple-50 text-purple-800 border-purple-300';
    }
    if (act.includes('estado') || act.includes('fase') || act.includes('aprob')) {
      return 'bg-amber-50 text-amber-800 border-amber-300';
    }
    return 'bg-blue-50 text-blue-800 border-blue-300';
  };

  const getModuleBadgeStyle = (mod: string) => {
    const m = (mod || '').toLowerCase();
    if (m.includes('crm') || m.includes('pedido')) return 'bg-amber-100 text-amber-900 border-amber-300';
    if (m.includes('usuario') || m.includes('perfil')) return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    if (m.includes('catálogo') || m.includes('producto')) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    if (m.includes('precio') || m.includes('costo')) return 'bg-cyan-100 text-cyan-900 border-cyan-300';
    return 'bg-neutral-100 text-neutral-800 border-neutral-300';
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['ID', 'Fecha y Hora', 'Usuario', 'Email', 'Rol', 'Módulo', 'Acción', 'Detalle'];
    const rows = filteredLogs.map((l) => [
      l.id,
      formatDateTime(l.timestamp),
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${(l.userEmail || '').replace(/"/g, '""')}"`,
      l.userRole || 'admin',
      `"${(l.module || '').replace(/"/g, '""')}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_pampero_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Registro de Auditoría (Audit Log)
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-xs font-bold uppercase">
                Exclusivo Administrador
              </span>
            </div>
            <p className="text-xs text-[#6F6860] mt-0.5 leading-relaxed">
              Trazabilidad silenciosa y automática de todas las acciones importantes (crear, editar, eliminar, cambio de precios, pedidos y gestión) realizadas en la plataforma.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar registros filtrados a CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#18231C]" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Eventos Registrados</span>
          <div className="text-2xl font-bold font-display text-[#18231C] mt-1">{logs.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Eventos Filtrados</span>
          <div className="text-2xl font-bold font-display text-[#B9522F] mt-1">{filteredLogs.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Módulos Auditados</span>
          <div className="text-2xl font-bold font-display text-indigo-700 mt-1">{uniqueModules.length || 1}</div>
        </div>
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Sincronización</span>
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>En Tiempo Real</span>
          </div>
        </div>
      </div>

      {/* Dynamic Filters & Search */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-[#8C827A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por usuario, acción, detalle o módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none focus:border-[#FDB813] font-medium"
            />
          </div>

          {/* Module Select */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-bold text-[#18231C]"
            >
              <option value="todos">Todos los Módulos</option>
              {uniqueModules.map((m) => (
                <option key={m} value={m}>Módulo: {m}</option>
              ))}
            </select>
          </div>

          {/* Action Select */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-bold text-[#18231C]"
            >
              <option value="todas">Todas las Acciones</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>Acción: {a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter Badges */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#ECE5DC] overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] shrink-0">
            Período:
          </span>
          {[
            { id: 'all' as const, label: 'Todo el historial' },
            { id: 'today' as const, label: 'Hoy' },
            { id: '7days' as const, label: 'Últimos 7 días' },
            { id: '30days' as const, label: 'Últimos 30 días' },
          ].map((df) => (
            <button
              key={df.id}
              type="button"
              onClick={() => setSelectedDateFilter(df.id)}
              className={`px-2.5 py-1 text-xs rounded-xs font-bold transition-colors cursor-pointer ${
                selectedDateFilter === df.id
                  ? 'bg-[#18231C] text-white'
                  : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC] border border-[#DCD4C9]'
              }`}
            >
              {df.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Audit Table */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold tracking-wider border-b border-[#DCD4C9]">
              <tr>
                <th className="p-3 whitespace-nowrap">Fecha y Hora</th>
                <th className="p-3 whitespace-nowrap">Usuario / Rol</th>
                <th className="p-3 whitespace-nowrap">Módulo</th>
                <th className="p-3 whitespace-nowrap">Acción</th>
                <th className="p-3">Detalle del Movimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-[#6F6860]">
                    {isLoading
                      ? 'Cargando registros de auditoría...'
                      : 'No se encontraron eventos registrados con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="p-3 whitespace-nowrap font-mono text-[11px] text-[#4A453F]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[#8C827A]" />
                        <span>{formatDateTime(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-bold text-[#18231C] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#8C827A]" />
                        <span>{log.userName || log.userEmail?.split('@')[0] || 'Usuario'}</span>
                      </div>
                      <div className="text-[10px] text-[#6F6860] flex items-center gap-1 mt-0.5">
                        <span>{log.userEmail || '-'}</span>
                        <span className="px-1 py-0.2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs uppercase text-[9px] font-bold">
                          {log.userRole || 'admin'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-xs border text-[11px] font-bold uppercase ${getModuleBadgeStyle(log.module)}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-xs border text-[11px] font-black uppercase ${getActionBadgeStyle(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-[#18231C] font-medium leading-relaxed">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
