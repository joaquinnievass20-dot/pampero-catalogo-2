import React, { useState, useEffect, useMemo } from 'react';
import {
  BranchLocation,
  RRHHCheckInRecord,
  RRHHEmployeeRecord,
  RRHHModuleConfig,
  ThemeConfig,
  UserSession,
} from '../../types';
import {
  DEFAULT_RRHH_CONFIG,
  saveRRHHCheckIn,
  saveRRHHLegajo,
  subscribeToRRHHCheckIns,
  subscribeToRRHHConfig,
  subscribeToRRHHLegajos,
} from '../../services/firebase';
import { canManageRRHH, hasAdminPanelAccess } from '../../utils/permissions';
import { PamperoLogo } from '../PamperoLogo';
import { isColorDark } from '../../context/ThemeContext';
import {
  getBranchColor,
  resolveDayScheduleEntry,
  RRHHScheduleCalendar,
} from './RRHHScheduleCalendar';
import {
  findConfiguredBranch,
  getConfiguredBranchList,
  parseBranchOpeningHours,
  resolveConfiguredBranchName,
} from '../../utils/rrhhBranches';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Menu,
  Navigation,
  Palmtree,
  Save,
  Settings,
  ShieldAlert,
  AlertTriangle,
  Crosshair,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface RRHHViewProps {
  userSession: UserSession;
  theme?: ThemeConfig;
  branches?: BranchLocation[];
  onClose: () => void;
  onOpenAdminPanel?: () => void;
}

function parseHHMMToMinutes(hhmm?: string): number | null {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

type GeoPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';

export const RRHHView: React.FC<RRHHViewProps> = ({
  userSession,
  theme,
  branches = [],
  onClose,
  onOpenAdminPanel,
}) => {
  const isAdmin = userSession.role === 'admin';
  const isEmployee = userSession.role === 'employee';
  const canUsePersonalRRHH = isAdmin || isEmployee;
  const canOpenAdminRRHH =
    canManageRRHH(userSession) && hasAdminPanelAccess(userSession) && Boolean(onOpenAdminPanel);

  const [activeSection, setActiveSection] = useState<'checkin' | 'my_legajo'>('checkin');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const [legajos, setLegajos] = useState<RRHHEmployeeRecord[]>([]);
  const [checkIns, setCheckIns] = useState<RRHHCheckInRecord[]>([]);
  const [rrhhConfig, setRrhhConfig] = useState<RRHHModuleConfig>(DEFAULT_RRHH_CONFIG);

  // Live clock
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNowDate(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS diagnostic & permission state
  const [geoPermission, setGeoPermission] = useState<GeoPermissionState>('unknown');
  const [testingGps, setTestingGps] = useState(false);
  const [gpsPreview, setGpsPreview] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [gpsErrorDetail, setGpsErrorDetail] = useState<string | null>(null);

  const isInIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoPermission('unsupported');
      return;
    }
    let mounted = true;
    let statusObj: PermissionStatus | null = null;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (!mounted) return;
          statusObj = status;
          setGeoPermission(status.state as GeoPermissionState);
          status.onchange = () => {
            if (mounted) setGeoPermission(status.state as GeoPermissionState);
          };
        })
        .catch(() => {
          if (mounted) setGeoPermission('prompt');
        });
    } else {
      setGeoPermission('prompt');
    }
    return () => {
      mounted = false;
      if (statusObj) statusObj.onchange = null;
    };
  }, []);

  const configuredBranches = useMemo(() => getConfiguredBranchList(branches), [branches]);
  const branchOptions = useMemo(
    () => configuredBranches.map((b) => b.name),
    [configuredBranches]
  );

  const [selectedBranch, setSelectedBranch] = useState<string>(() =>
    resolveConfiguredBranchName(userSession.branch, configuredBranches, false)
  );
  const [note, setNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<RRHHCheckInRecord | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);

  // Self-editable legajo draft state
  const [legajoDraftValues, setLegajoDraftValues] = useState<Record<string, string>>({});
  const [savingMyLegajo, setSavingMyLegajo] = useState(false);
  const [legajoSaveMsg, setLegajoSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubLeg = subscribeToRRHHLegajos((list) => setLegajos(list));
    const unsubChk = subscribeToRRHHCheckIns((list) => setCheckIns(list));
    const unsubCfg = subscribeToRRHHConfig((cfg) => setRrhhConfig(cfg));
    return () => {
      unsubLeg();
      unsubChk();
      unsubCfg();
    };
  }, []);

  const cleanEmail = (userSession.email || '').toLowerCase().trim();
  const displayName =
    userSession.clientData?.fullName ||
    userSession.email?.split('@')[0] ||
    'Colaborador Pampero';

  const myLegajo = useMemo(() => {
    return legajos.find(
      (l) =>
        (userSession.id && l.employeeId === userSession.id) ||
        (cleanEmail && (l.email || '').toLowerCase().trim() === cleanEmail)
    );
  }, [legajos, userSession.id, cleanEmail]);

  const effectiveLegajo: RRHHEmployeeRecord = useMemo(() => {
    if (myLegajo) {
      return {
        ...myLegajo,
        assignedBranch: resolveConfiguredBranchName(
          myLegajo.assignedBranch,
          configuredBranches,
          true
        ),
      };
    }
    const defaultB = resolveConfiguredBranchName(userSession.branch, configuredBranches, true);
    const bObj = findConfiguredBranch(defaultB, configuredBranches);
    const parsed = bObj ? parseBranchOpeningHours(bObj) : null;
    return {
      id: `legajo-${userSession.id || cleanEmail || 'staff'}`,
      employeeId: userSession.id,
      fullName: displayName,
      email: userSession.email,
      assignedBranch: defaultB,
      scheduledStart: parsed?.fullShift.start || '08:30',
      scheduledEnd: parsed?.fullShift.end || '17:30',
      workDays: parsed?.openDays || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      customFieldValues: {},
      weeklySchedule: {},
      dateSchedules: {},
      vacations: [],
    };
  }, [myLegajo, userSession.id, userSession.email, userSession.branch, displayName, cleanEmail, configuredBranches]);

  // Sync draft values when myLegajo loads/updates
  useEffect(() => {
    const initial: Record<string, string> = {
      ...(effectiveLegajo.customFieldValues || {}),
    };
    if (!initial.cuil_dni && effectiveLegajo.dniOrCuil) {
      initial.cuil_dni = effectiveLegajo.dniOrCuil;
    }
    if (!initial.telefono_personal && effectiveLegajo.phone) {
      initial.telefono_personal = effectiveLegajo.phone;
    }
    if (!initial.contacto_emergencia && effectiveLegajo.emergencyContact) {
      initial.contacto_emergencia = effectiveLegajo.emergencyContact;
    }
    setLegajoDraftValues(initial);
  }, [effectiveLegajo]);

  const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(
    nowDate.getDate()
  ).padStart(2, '0')}`;

  const todaySchedule = useMemo(
    () => resolveDayScheduleEntry(effectiveLegajo, todayStr, configuredBranches),
    [effectiveLegajo, todayStr, configuredBranches]
  );

  // Auto-select today's scheduled branch if valid
  useEffect(() => {
    const scheduledBranch = todaySchedule.entry.branch;
    if (
      scheduledBranch &&
      scheduledBranch !== 'Todas' &&
      scheduledBranch !== 'Franco' &&
      scheduledBranch !== 'Vacaciones'
    ) {
      setSelectedBranch(resolveConfiguredBranchName(scheduledBranch, configuredBranches, false));
    } else if (effectiveLegajo.assignedBranch && effectiveLegajo.assignedBranch !== 'Todas') {
      setSelectedBranch(
        resolveConfiguredBranchName(effectiveLegajo.assignedBranch, configuredBranches, false)
      );
    } else if (branchOptions.length > 0 && !branchOptions.includes(selectedBranch)) {
      setSelectedBranch(branchOptions[0]);
    }
  }, [todaySchedule.entry.branch, effectiveLegajo.assignedBranch, configuredBranches, branchOptions, selectedBranch]);

  const myCheckIns = useMemo(() => {
    return checkIns.filter(
      (c) =>
        (userSession.id && c.employeeId === userSession.id) ||
        (cleanEmail && (c.employeeEmail || '').toLowerCase().trim() === cleanEmail)
    );
  }, [checkIns, userSession.id, cleanEmail]);

  const todayCheckIn = myCheckIns.find((c) => c.dateStr === todayStr);

  const hubBg =
    theme?.hubBgColor &&
    theme.hubBgColor !== '#FAF8F5' &&
    theme.hubBgColor !== '#FFFFFF' &&
    theme.hubBgColor !== '#F5F2EC'
      ? theme.hubBgColor
      : '#18231C';
  const isHubDark = isColorDark(hubBg);

  const activeFields = useMemo(
    () => rrhhConfig.customFields.filter((f) => f.active),
    [rrhhConfig.customFields]
  );

  const legajoCompletion = useMemo(() => {
    if (activeFields.length === 0) return { filled: 0, total: 0, pct: 100 };
    const filled = activeFields.filter(
      (f) => (legajoDraftValues[f.key] || '').trim().length > 0
    ).length;
    return {
      filled,
      total: activeFields.length,
      pct: Math.round((filled / activeFields.length) * 100),
    };
  }, [activeFields, legajoDraftValues]);

  const capturePosition = (): Promise<{
    location?: RRHHCheckInRecord['location'];
    locationError?: string;
    isDenied?: boolean;
  }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGeoPermission('unsupported');
        resolve({ locationError: 'El navegador no soporta geolocalización' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setGeoPermission('granted');
          setGpsPreview({ lat, lng, accuracy: pos.coords.accuracy });
          setGpsErrorDetail(null);
          resolve({
            location: {
              lat,
              lng,
              accuracyMeters: pos.coords.accuracy,
              mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
            },
          });
        },
        (err) => {
          if (err.code === 1) {
            setGeoPermission('denied');
            const detail = err.message?.toLowerCase().includes('permissions policy')
              ? 'Bloqueado por política del contenedor embebido (iframe) o permiso del navegador.'
              : 'Permiso de ubicación denegado en el navegador.';
            setGpsErrorDetail(detail);
            resolve({ locationError: 'Permiso de ubicación denegado', isDenied: true });
          } else if (err.code === 2) {
            setGpsErrorDetail('No se pudo obtener señal GPS del dispositivo.');
            resolve({ locationError: 'Ubicación GPS no disponible' });
          } else {
            setGpsErrorDetail('Tiempo de espera agotado al buscar satélites/ubicación.');
            resolve({ locationError: 'Tiempo de espera GPS agotado' });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleTestGps = async () => {
    if (testingGps) return;
    setTestingGps(true);
    setGpsErrorDetail(null);
    try {
      await capturePosition();
    } finally {
      setTestingGps(false);
    }
  };

  const handleRegisterArrival = async () => {
    if (isRecording || !canUsePersonalRRHH) return;
    setIsRecording(true);
    setGpsStatusMsg('Obteniendo ubicación GPS exacta...');

    try {
      const geo = await capturePosition();
      const now = new Date();
      const iso = now.toISOString();
      const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const daySched = resolveDayScheduleEntry(
        effectiveLegajo,
        currentDateStr,
        configuredBranches
      );
      const expectedBranch =
        daySched.entry.branch &&
        daySched.entry.branch !== 'Franco' &&
        daySched.entry.branch !== 'Vacaciones'
          ? daySched.entry.branch
          : effectiveLegajo.assignedBranch || userSession.branch || selectedBranch;
      const expectedStart = daySched.entry.startTime || effectiveLegajo.scheduledStart || '08:30';

      const expectedMins = parseHHMMToMinutes(expectedStart);
      const actualMins = now.getHours() * 60 + now.getMinutes();
      const diffMins = expectedMins !== null ? actualMins - expectedMins : 0;
      const tolerance = rrhhConfig.lateToleranceMinutes ?? 10;

      let status: RRHHCheckInRecord['status'] = 'on_time';
      if (
        expectedBranch &&
        expectedBranch !== 'Todas' &&
        expectedBranch.toLowerCase() !== selectedBranch.toLowerCase()
      ) {
        status = 'wrong_branch';
      } else if (diffMins > tolerance) {
        status = 'late';
      }

      const record: RRHHCheckInRecord = {
        id: `chk-${Date.now()}`,
        employeeId: userSession.id || cleanEmail || 'staff',
        employeeName: effectiveLegajo.fullName || displayName,
        employeeEmail: userSession.email,
        branch: selectedBranch,
        expectedBranch,
        expectedStart,
        timestamp: iso,
        dateStr: currentDateStr,
        timeStr,
        status,
        lateMinutes: diffMins > 0 ? diffMins : 0,
        location: geo.location,
        locationError: geo.locationError,
        note: note.trim() || undefined,
      };

      await saveRRHHCheckIn(record);
      setLastReceipt(record);
      setNote('');
      setGpsStatusMsg(
        geo.location
          ? 'Llegada registrada con horario y ubicación GPS exacta.'
          : `Llegada registrada con horario exacto (${geo.locationError || 'sin GPS'}).`
      );
    } finally {
      setIsRecording(false);
    }
  };

  const handleSaveMyLegajo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rrhhConfig.allowEmployeeSelfEditLegajo) return;
    setSavingMyLegajo(true);
    setLegajoSaveMsg(null);
    try {
      const mergedCustom = { ...(effectiveLegajo.customFieldValues || {}) };
      activeFields.forEach((f) => {
        if (f.employeeEditable) {
          mergedCustom[f.key] = (legajoDraftValues[f.key] || '').trim();
        }
      });

      const updated: RRHHEmployeeRecord = {
        ...effectiveLegajo,
        employeeId: effectiveLegajo.employeeId || userSession.id,
        fullName: effectiveLegajo.fullName || displayName,
        email: effectiveLegajo.email || userSession.email,
        dniOrCuil: mergedCustom.cuil_dni ?? effectiveLegajo.dniOrCuil,
        phone: mergedCustom.telefono_personal ?? effectiveLegajo.phone,
        emergencyContact: mergedCustom.contacto_emergencia ?? effectiveLegajo.emergencyContact,
        customFieldValues: mergedCustom,
        updatedBy: userSession.email,
      };

      await saveRRHHLegajo(updated);
      setLegajoSaveMsg('Tus datos del legajo se guardaron correctamente.');
      setTimeout(() => setLegajoSaveMsg(null), 3500);
    } finally {
      setSavingMyLegajo(false);
    }
  };

  const activeVacation = (effectiveLegajo.vacations || []).find(
    (v) => v.status !== 'finalizada' && v.startDate <= todayStr && v.endDate >= todayStr
  );

  const liveTimeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(
    nowDate.getMinutes()
  ).padStart(2, '0')}:${String(nowDate.getSeconds()).padStart(2, '0')}`;

  const st = theme?.siteTexts;
  const rrhhSections: Array<{ key: 'checkin' | 'my_legajo'; label: string; category: string; icon: any }> = [
    { key: 'checkin', label: st?.rrhhFichajeTabText || 'Fichaje de Llegada', category: 'Asistencia & GPS', icon: Navigation },
    { key: 'my_legajo', label: st?.rrhhLegajoTabText || 'Mi Legajo, Calendario y Vacaciones', category: 'Legajo Personal', icon: FileText },
  ];
  const activeSectionMeta = rrhhSections.find((s) => s.key === activeSection) || rrhhSections[0];
  const ActiveSectionIcon = activeSectionMeta.icon;
  void hubBg;
  void isHubDark;

  const sidebarBg = theme?.sidebarBgColor || theme?.primaryColor || '#18231C';
  const isSidebarDark = isColorDark(sidebarBg);
  const sidebarText = theme?.sidebarTextColor || (isSidebarDark ? '#DCD4C9' : '#18231C');
  const sidebarActiveBg = theme?.sidebarActiveBgColor || (isSidebarDark ? '#2B3B30' : '#ECE5DC');
  const sidebarAccent = theme?.sidebarAccentColor || theme?.accentColor || '#FDB813';
  const sidebarMutedText = isSidebarDark ? '#A69E94' : '#6F6860';
  const sidebarBorderClass = isSidebarDark ? 'border-white/10' : 'border-black/10';

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#FAF8F5] text-[#18231C] w-screen h-screen overflow-hidden animate-fadeIn font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-2xs"
        />
      )}

      {/* SIDEBAR NAVIGATION (Unified & Collapsible) */}
      <aside
        style={{ backgroundColor: sidebarBg, color: isSidebarDark ? '#FFFFFF' : '#18231C' }}
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col h-full transition-all duration-200 ease-in-out shrink-0 ${
          isMobileSidebarOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full md:translate-x-0'
        } ${
          isDesktopSidebarCollapsed
            ? 'md:w-0 md:overflow-hidden md:border-r-0'
            : 'md:w-72 border-r border-black/30'
        }`}
      >
        <div className={`p-3.5 border-b ${sidebarBorderClass} flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <PamperoLogo
              customUrl={theme?.customLogoUrl || theme?.logoUrl}
              height={theme?.logoHeight ? Math.min(theme.logoHeight, 34) : 30}
              size="sm"
              onDarkBackground={isSidebarDark}
              variant={isSidebarDark ? 'light' : 'dark'}
              navBgColor={sidebarBg}
            />
            <div className="min-w-0 flex-1">
              <h2
                style={{ color: sidebarAccent }}
                className="font-display font-bold text-[13px] uppercase tracking-wide whitespace-normal leading-tight"
              >
                {st?.rrhhTitle || 'RRHH & Personal'}
              </h2>
              <span
                style={{ color: sidebarText }}
                className="text-[10px] opacity-80 block whitespace-normal leading-tight mt-0.5"
              >
                {st?.rrhhSubtitle || effectiveLegajo.assignedBranch || userSession.branch || 'Gran Mendoza'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDesktopSidebarCollapsed(true)}
            style={{ color: sidebarText }}
            className="hidden md:inline-flex p-1.5 hover:bg-black/15 rounded-xs cursor-pointer shrink-0 transition-colors"
            title="Ocultar barra lateral"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            style={{ color: sidebarText }}
            className="md:hidden p-1.5 hover:bg-black/15 rounded-xs cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          <div className="space-y-1.5">
            <span
              style={{ color: sidebarMutedText }}
              className="px-3 text-[10px] font-black uppercase tracking-[0.18em] block"
            >
              Mi Espacio RRHH
            </span>
            <div className="space-y-0.5">
              {canUsePersonalRRHH &&
                rrhhSections.map((sec) => {
                  const isSelected = activeSection === sec.key;
                  const SecIcon = sec.icon;
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => {
                        setActiveSection(sec.key);
                        setIsMobileSidebarOpen(false);
                      }}
                      style={
                        isSelected
                          ? { backgroundColor: sidebarActiveBg, color: sidebarAccent }
                          : { color: sidebarText }
                      }
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xs text-xs font-bold transition-all cursor-pointer group text-left ${
                        isSelected ? 'shadow-xs' : 'hover:bg-black/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SecIcon
                          style={{ color: isSelected ? sidebarAccent : sidebarMutedText }}
                          className="w-4 h-4 shrink-0 transition-colors"
                        />
                        <span className="truncate">{sec.label}</span>
                      </div>
                      {isSelected && (
                        <span
                          style={{ backgroundColor: sidebarAccent }}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <div className={`p-3 border-t ${sidebarBorderClass} space-y-2 bg-black/15`}>
          <div className={`px-2.5 py-2 rounded-xs bg-white/5 border ${sidebarBorderClass}`}>
            <span
              style={{ color: sidebarMutedText }}
              className="text-[9px] font-bold uppercase tracking-wider block"
            >
              Colaborador Activo
            </span>
            <span
              style={{ color: isSidebarDark ? '#FFFFFF' : '#18231C' }}
              className="text-xs font-bold truncate block mt-0.5"
            >
              {displayName}
            </span>
          </div>

          {canOpenAdminRRHH && (
            <button
              type="button"
              onClick={onOpenAdminPanel}
              style={{ backgroundColor: sidebarAccent, color: isColorDark(sidebarAccent) ? '#FFFFFF' : '#18231C' }}
              className="w-full py-2 px-3 hover:opacity-90 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{st?.rrhhAdminBtnText || 'Administrar RRHH'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: sidebarActiveBg, color: isSidebarDark ? '#FAF8F5' : '#18231C' }}
            className="w-full py-2 px-3 hover:opacity-90 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{st?.rrhhBackBtnText || 'Volver al Hub'}</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FAF8F5]">
        <header className="bg-white border-b border-[#DCD4C9] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 text-[#18231C] hover:bg-[#FAF8F5] rounded-xs cursor-pointer"
              title="Abrir menú lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            {isDesktopSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopSidebarCollapsed(false)}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-bold cursor-pointer transition-colors shrink-0"
                title="Mostrar barra lateral"
              >
                <PanelLeftOpen className="w-4 h-4" />
                <span>Menú</span>
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[#6F6860] uppercase font-bold tracking-wider">
                <span>{st?.rrhhTitle || 'RRHH'}</span>
                <ChevronRight className="w-3 h-3 text-[#A69E94]" />
                <span className="text-[#18231C]">{activeSectionMeta.category}</span>
              </div>
              <h1 className="font-display font-bold text-lg sm:text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2 mt-0.5 leading-none truncate">
                <ActiveSectionIcon className="w-5 h-5 text-[#18231C] shrink-0" />
                <span className="truncate">{activeSectionMeta.label}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canOpenAdminRRHH && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="px-3 py-1.5 rounded-xs bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                title="Administrar legajos, turnos, colores y fichajes desde el Panel de Control"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{st?.rrhhAdminBtnText || 'Configurar en Panel'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] border border-[#DCD4C9] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{st?.rrhhBackBtnText || 'Volver al Hub'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-scroll min-w-0">
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
        {activeSection === 'checkin' && canUsePersonalRRHH && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Check-in Action Card */}
            <div className="lg:col-span-5 bg-white border border-[#DCD4C9] rounded-sm shadow-2xs p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F6860] block">
                    {st?.rrhhFichajeCardSubtitle || 'Asistencia Diaria con GPS'}
                  </span>
                  <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wide mt-0.5">
                    {st?.rrhhFichajeCardTitle || 'Registrar Llegada'}
                  </h2>
                </div>
                <div className="text-right bg-[#18231C] text-[#FDB813] px-3 py-1.5 rounded-xs">
                  <div className="font-mono font-black text-base tabular-nums leading-none">
                    {liveTimeStr}
                  </div>
                  <div className="font-mono text-[10px] text-[#DCD4C9] mt-1">{todayStr}</div>
                </div>
              </div>

              {/* Today's Turn Preview from Calendar */}
              {(() => {
                const bName =
                  todaySchedule.source === 'vacation'
                    ? 'Vacaciones'
                    : todaySchedule.entry.branch || effectiveLegajo.assignedBranch || branchOptions[0] || '';
                const bColor =
                  todaySchedule.source === 'vacation'
                    ? '#059669'
                    : getBranchColor(bName, rrhhConfig.branchColors, configuredBranches);
                return (
                  <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#6F6860] font-semibold">Turno asignado hoy:</span>
                      <span className="font-bold flex items-center gap-1.5 text-[#18231C]">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: bColor }}
                        />
                        <span>{bName}</span>
                      </span>
                    </div>
                    {todaySchedule.source !== 'vacation' && !todaySchedule.entry.isOffDay && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#6F6860]">Horario previsto:</span>
                        <strong className="font-mono tabular-nums text-[#18231C]">
                          {todaySchedule.entry.startTime || effectiveLegajo.scheduledStart || '08:30'} -{' '}
                          {todaySchedule.entry.endTime || effectiveLegajo.scheduledEnd || '17:30'} hs
                        </strong>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[#6F6860]">Tolerancia llegada:</span>
                      <span className="font-mono text-[#18231C]">
                        {rrhhConfig.lateToleranceMinutes} min
                      </span>
                    </div>
                  </div>
                );
              })()}

              {activeVacation && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xs text-xs text-amber-950 flex items-start gap-2">
                  <Palmtree className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">Tenés vacaciones activas</strong>
                    <span>
                      Del {activeVacation.startDate} al {activeVacation.endDate}.
                    </span>
                  </div>
                </div>
              )}

              {/* GPS Diagnostic & Quick Authorization Card */}
              <div
                className={`p-3 rounded-xs border text-xs space-y-2 ${
                  geoPermission === 'granted' && gpsPreview
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : geoPermission === 'denied' || gpsErrorDetail
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-[#FAF8F5] border-[#DCD4C9] text-[#18231C]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Crosshair className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      GPS:{' '}
                      {geoPermission === 'granted'
                        ? 'Autorizado'
                        : geoPermission === 'denied'
                          ? 'No autorizado / Bloqueado'
                          : geoPermission === 'unsupported'
                            ? 'No soportado'
                            : 'Pendiente de permiso'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={testingGps}
                    onClick={handleTestGps}
                    className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[11px] font-bold text-[#18231C] cursor-pointer shrink-0"
                  >
                    {testingGps ? 'Probando...' : 'Probar / Autorizar GPS'}
                  </button>
                </div>

                {gpsPreview && (
                  <div className="font-mono text-[11px] text-emerald-800 tabular-nums">
                    Señal activa: {gpsPreview.lat.toFixed(5)}, {gpsPreview.lng.toFixed(5)}
                    {gpsPreview.accuracy ? ` (±${Math.round(gpsPreview.accuracy)}m)` : ''}
                  </div>
                )}

                {(geoPermission === 'denied' || gpsErrorDetail) && (
                  <div className="text-[11px] space-y-1.5 pt-1 border-t border-amber-200">
                    <div className="font-semibold flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        {gpsErrorDetail ||
                          'El navegador bloqueó el acceso a la ubicación.'}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Para autorizarlo: tocá el ícono de candado/ajustes junto a la URL del navegador →{' '}
                      <strong>Ubicación → Permitir</strong> y recargá la página.
                      {isInIframe &&
                        ' Si estás viendo el sistema dentro de una vista previa embebida, abrilo en una pestaña propia:'}
                    </p>
                    {isInIframe && (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#18231C] text-[#FDB813] rounded-xs text-[11px] font-bold"
                      >
                        <span>Abrir en pestaña nueva para autorizar GPS</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Select Branch */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1.5">
                  ¿A qué local llegaste?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {branchOptions.map((b) => {
                    const active = selectedBranch === b;
                    const bColor = getBranchColor(b, rrhhConfig.branchColors, configuredBranches);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBranch(b)}
                        className={`px-3 py-2.5 rounded-xs border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center leading-tight ${
                          active
                            ? 'bg-[#18231C] border-[#18231C] text-[#FDB813]'
                            : 'bg-[#FAF8F5] border-[#DCD4C9] text-[#18231C] hover:bg-neutral-100'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-xs inline-block shrink-0"
                          style={{ backgroundColor: bColor }}
                        />
                        <span>{b}</span>
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const selObj = findConfiguredBranch(selectedBranch, configuredBranches);
                  const hoursStr = selObj?.openingHours?.trim() || selObj?.hours?.trim();
                  if (!hoursStr) return null;
                  return (
                    <p className="mt-1.5 text-[11px] text-[#6F6860]">
                      <strong className="text-[#18231C]">Horario de apertura ({selObj?.name}):</strong>{' '}
                      {hoursStr}
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Observación opcional (ej: apertura de caja, trámite)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota breve del ingreso..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                />
              </div>

              <button
                type="button"
                disabled={isRecording}
                onClick={handleRegisterArrival}
                className="w-full py-3.5 px-4 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-black uppercase tracking-widest rounded-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
              >
                {isRecording ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando GPS y Horario...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>{st?.rrhhFichajeBtnText || `Marcar Llegada a ${selectedBranch}`}</span>
                  </>
                )}
              </button>

              {gpsStatusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{gpsStatusMsg}</span>
                </div>
              )}

              {(lastReceipt || todayCheckIn) && (() => {
                const receipt = lastReceipt || todayCheckIn!;
                return (
                  <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[#18231C]">
                        Último Fichaje de Hoy
                      </span>
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        {receipt.timeStr} hs
                      </span>
                    </div>
                    <div className="text-[#4A453F]">
                      Local: <strong>{receipt.branch}</strong> · Fecha:{' '}
                      <span className="font-mono">{receipt.dateStr}</span>
                    </div>
                    {receipt.location ? (
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-mono text-[11px] text-[#6F6860] tabular-nums">
                          GPS: {receipt.location.lat.toFixed(5)}, {receipt.location.lng.toFixed(5)}
                        </span>
                        <a
                          href={receipt.location.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-[#B9522F] hover:underline flex items-center gap-1"
                        >
                          <span>Ver ubicación</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{receipt.locationError || 'Sin señal GPS'}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Personal Check-in History */}
            <div className="lg:col-span-7 bg-white border border-[#DCD4C9] rounded-xs overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">
                    Mi Historial de Fichajes
                  </h3>
                  <p className="text-[11px] text-[#6F6860]">
                    Registro verificado de tus últimos fichajes de ingreso por sucursal.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold tabular-nums">
                  {myCheckIns.length}
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                    <tr>
                      <th className="py-2.5 px-4">Fecha & Hora</th>
                      <th className="py-2.5 px-3">Local</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-4 text-right">Ubicación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4C9]">
                    {myCheckIns.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-[#6F6860]">
                          Todavía no registraste llegadas. Marcá tu llegada desde el panel izquierdo.
                        </td>
                      </tr>
                    ) : (
                      myCheckIns.slice(0, 30).map((chk) => {
                        const bColor = getBranchColor(
                          chk.branch,
                          rrhhConfig.branchColors,
                          configuredBranches
                        );
                        return (
                          <tr key={chk.id} className="hover:bg-[#FAF8F5]/70">
                            <td className="py-2.5 px-4 font-mono tabular-nums">
                              <span className="font-bold text-[#18231C]">{chk.dateStr}</span>{' '}
                              <span className="text-[#B9522F] font-bold">{chk.timeStr} hs</span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#18231C]">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-xs inline-block"
                                  style={{ backgroundColor: bColor }}
                                />
                                {chk.branch}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border ${
                                  chk.status === 'on_time'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                    : chk.status === 'late'
                                      ? 'bg-red-50 border-red-300 text-red-800'
                                      : 'bg-amber-50 border-amber-300 text-amber-800'
                                }`}
                              >
                                {chk.status === 'on_time'
                                  ? 'En horario'
                                  : chk.status === 'late'
                                    ? `Tarde (+${chk.lateMinutes || 0}m)`
                                    : 'Otro local'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {chk.location ? (
                                <a
                                  href={chk.location.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#18231C] hover:text-[#B9522F]"
                                >
                                  <MapPin className="w-3 h-3 text-[#B9522F]" />
                                  <span className="font-mono">
                                    {chk.location.lat.toFixed(4)}, {chk.location.lng.toFixed(4)}
                                  </span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-[11px] text-[#6F6860]">Sin GPS</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'my_legajo' && canUsePersonalRRHH && (
          <div className="space-y-6">
            {/* Color-Coded Monthly Work Schedule & Branch Calendar */}
            <RRHHScheduleCalendar
              legajo={effectiveLegajo}
              config={rrhhConfig}
              branches={configuredBranches}
              editable={false}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Self-Editable Dynamic Legajo Form */}
              <form
                onSubmit={handleSaveMyLegajo}
                className="lg:col-span-7 bg-white border border-[#DCD4C9] rounded-xs p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCD4C9] pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#B9522F]" />
                    <h3 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                      Mi Legajo Personal
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[#6F6860]">Completitud:</span>
                    <div className="w-24 h-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${legajoCompletion.pct}%` }}
                      />
                    </div>
                    <strong className="font-mono tabular-nums text-[#18231C]">
                      {legajoCompletion.filled}/{legajoCompletion.total}
                    </strong>
                  </div>
                </div>

                {/* Fixed Administrative Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6F6860] block">
                      Colaborador
                    </span>
                    <strong className="text-[#18231C]">{effectiveLegajo.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6F6860] block">
                      Email
                    </span>
                    <strong className="font-mono text-[#18231C]">{effectiveLegajo.email}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6F6860] block">
                      Puesto / Cargo
                    </span>
                    <strong className="text-[#18231C]">
                      {effectiveLegajo.position || 'Operador Pampero'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6F6860] block">
                      Local Base & Horario
                    </span>
                    <strong className="text-[#B9522F] font-mono tabular-nums">
                      {effectiveLegajo.assignedBranch || branchOptions[0] || ''} ·{' '}
                      {effectiveLegajo.scheduledStart || '08:30'}-
                      {effectiveLegajo.scheduledEnd || '17:30'}
                    </strong>
                  </div>
                </div>

                {/* Configurable Custom Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {activeFields.map((fld) => {
                    const canEditField =
                      rrhhConfig.allowEmployeeSelfEditLegajo && fld.employeeEditable;
                    const value = legajoDraftValues[fld.key] || '';

                    return (
                      <div
                        key={fld.id}
                        className={fld.type === 'textarea' ? 'sm:col-span-2' : ''}
                      >
                        <label className="flex items-center justify-between font-bold text-[#18231C] mb-1">
                          <span>
                            {fld.label}
                            {fld.required && <span className="text-[#B9522F]"> *</span>}
                          </span>
                          {!canEditField && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#6F6860]"
                              title="Solo editable por administración RRHH"
                            >
                              <Lock className="w-3 h-3" />
                              <span>RRHH</span>
                            </span>
                          )}
                        </label>

                        {fld.type === 'select' ? (
                          <select
                            disabled={!canEditField}
                            required={canEditField && fld.required}
                            value={value}
                            onChange={(e) =>
                              setLegajoDraftValues((prev) => ({
                                ...prev,
                                [fld.key]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none disabled:opacity-70 cursor-pointer"
                          >
                            <option value="">Seleccionar...</option>
                            {(fld.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : fld.type === 'textarea' ? (
                          <textarea
                            rows={2}
                            disabled={!canEditField}
                            required={canEditField && fld.required}
                            value={value}
                            onChange={(e) =>
                              setLegajoDraftValues((prev) => ({
                                ...prev,
                                [fld.key]: e.target.value,
                              }))
                            }
                            placeholder={fld.placeholder || ''}
                            className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none disabled:opacity-70"
                          />
                        ) : (
                          <input
                            type={fld.type}
                            disabled={!canEditField}
                            required={canEditField && fld.required}
                            value={value}
                            onChange={(e) =>
                              setLegajoDraftValues((prev) => ({
                                ...prev,
                                [fld.key]: e.target.value,
                              }))
                            }
                            placeholder={fld.placeholder || (canEditField ? 'Completar...' : '—')}
                            className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none disabled:opacity-70"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {rrhhConfig.allowEmployeeSelfEditLegajo && (
                  <div className="pt-2 border-t border-[#DCD4C9] flex flex-wrap items-center justify-between gap-3">
                    {legajoSaveMsg ? (
                      <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{legajoSaveMsg}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#6F6860]">
                        Podés actualizar tus datos personales directamente desde aquí.
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={savingMyLegajo}
                      className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingMyLegajo ? 'Guardando...' : 'Guardar Mis Datos'}</span>
                    </button>
                  </div>
                )}
              </form>

              {/* Vacations Card */}
              <div className="lg:col-span-5 bg-white border border-[#DCD4C9] rounded-sm shadow-2xs p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#DCD4C9] pb-3">
                  <Palmtree className="w-4 h-4 text-[#18231C]" />
                  <h3 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                    Mis Vacaciones Registradas
                  </h3>
                </div>
                {!effectiveLegajo.vacations || effectiveLegajo.vacations.length === 0 ? (
                  <p className="text-xs text-[#6F6860] py-6 text-center">
                    No tenés períodos de vacaciones cargados actualmente.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {effectiveLegajo.vacations.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-[#18231C] tabular-nums">
                            {v.startDate} → {v.endDate}
                          </div>
                          {v.notes && (
                            <div className="text-[11px] text-[#6F6860] mt-0.5">{v.notes}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#18231C] block">
                            {v.daysCount} días
                          </span>
                          <span className="text-[10px] font-bold uppercase text-emerald-700">
                            {v.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};
