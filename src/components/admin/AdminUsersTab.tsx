import React, { useState, useEffect, useMemo } from 'react';
import { RegisteredUser, BranchLocation, UserSession } from '../../types';
import { MASTER_ADMIN_USER } from '../../utils/authInit';
import {
  subscribeToFirestoreUsers,
  saveFirestoreUser,
  deleteFirestoreUser,
  seedInitialFirestoreUsersIfEmpty,
} from '../../services/firebase';
import { 
  Users, 
  Building2, 
  User, 
  Search, 
  Download, 
  Trash2, 
  MessageCircle, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  Filter,
  RefreshCw,
  UserCheck,
  Eye,
  EyeOff,
  Copy,
  Lock,
  X,
  Key,
  Briefcase,
  AlertCircle
} from 'lucide-react';

interface AdminUsersTabProps {
  triggerSaveNotice: () => void;
  branches?: BranchLocation[];
  userSession?: UserSession | null;
}

export const INITIAL_REGISTERED_USERS: RegisteredUser[] = [
  {
    ...MASTER_ADMIN_USER,
    password: 'Jn05022000',
    initialPassword: 'Jn05022000',
  },
  // Vendedores & Equipo Comercial
  {
    id: 'sel-1',
    type: 'empleado',
    role: 'employee',
    sellerRole: 'local',
    name: 'Itatí',
    branch: 'Maipú',
    phone: '261 527-6713',
    email: 'itati@pamperomaipu.com.ar',
    password: 'itati_pampero',
    initialPassword: 'itati_pampero',
    status: 'active',
    createdAt: '2026-02-01',
    notes: 'Encargada de sucursal Maipú.',
  },
  {
    id: 'sel-2',
    type: 'empleado',
    role: 'employee',
    sellerRole: 'local',
    name: 'Guada',
    branch: 'Ciudad',
    phone: '261 423-1122',
    email: 'guada@pampero.com.ar',
    password: 'guada_pampero',
    initialPassword: 'guada_pampero',
    status: 'active',
    createdAt: '2026-02-01',
    notes: 'Encargada de sucursal Ciudad.',
  },
  {
    id: 'sel-3',
    type: 'empleado',
    role: 'employee',
    sellerRole: 'local',
    name: 'Carolina',
    branch: 'Luján',
    phone: '261 498-5544',
    email: 'carolina@pampero.com.ar',
    password: 'carolina_pampero',
    initialPassword: 'carolina_pampero',
    status: 'active',
    createdAt: '2026-02-01',
    notes: 'Encargada de sucursal Luján de Cuyo.',
  },
  {
    id: 'sel-4',
    type: 'empleado',
    role: 'employee',
    sellerRole: 'vendedor',
    name: 'Gustavo',
    branch: 'Maipú',
    phone: '261 527-6713',
    email: 'gustavo@pampero.com.ar',
    password: 'gustavo_pampero',
    initialPassword: 'gustavo_pampero',
    status: 'active',
    createdAt: '2026-02-05',
    notes: 'Vendedor corporativo en calle y visitas técnicas.',
  },
  {
    id: 'sel-5',
    type: 'empleado',
    role: 'employee',
    sellerRole: 'vendedor',
    name: 'Martín',
    branch: 'Ciudad',
    phone: '261 423-1122',
    email: 'martin@pampero.com.ar',
    password: 'martin_pampero',
    initialPassword: 'martin_pampero',
    status: 'active',
    createdAt: '2026-02-05',
    notes: 'Vendedor comercial mostrador y convenios.',
  },
  {
    id: 'emp-ventas',
    type: 'empleado',
    role: 'employee',
    name: 'Ventas Pampero Maipú',
    branch: 'Maipú',
    phone: '261 527-6713',
    email: 'ventas@pamperomaipu.com.ar',
    password: 'ventas_pampero',
    initialPassword: 'ventas_pampero',
    status: 'active',
    createdAt: '2026-02-10',
    notes: 'Acceso general ventas salón y pedidos.',
  },
  // Clientes Empresas
  {
    id: 'user-edemsa',
    type: 'empresa',
    role: 'client',
    name: 'EDEMSA S.A. (Empresa Distribuidora de Electricidad de Mendoza)',
    repName: 'Ing. Martín Carrizo',
    email: 'compras.operativas@edemsa.com.ar',
    password: 'edemsa_pampero',
    initialPassword: 'edemsa_pampero',
    phone: '2614298100',
    cuitOrDni: '30-69278912-4',
    address: 'Av. Belgrano 847',
    city: 'Ciudad de Mendoza',
    createdAt: '2026-02-14',
    status: 'active',
    pricingTier: 'Corporativo / Mayorista',
    notes: 'Cuenta corporativa con cupón especial asignado EDEMSA12026.',
  },
  {
    id: 'user-ypf',
    type: 'empresa',
    role: 'client',
    name: 'YPF Refinería Luján de Cuyo',
    repName: 'Lic. Pablo Godoy',
    email: 'licitaciones.pampero@ypf.com',
    password: 'ypf_pampero',
    initialPassword: 'ypf_pampero',
    phone: '2614980111',
    cuitOrDni: '30-54668997-9',
    address: 'Ruta Provincial 82 Km 27',
    city: 'Luján de Cuyo',
    createdAt: '2026-02-18',
    status: 'active',
    pricingTier: 'Corporativo / Mayorista',
    notes: 'Línea de calzado de seguridad dieléctrico y mamelucos ignífugos.',
  },
  {
    id: 'user-catena',
    type: 'empresa',
    role: 'client',
    name: 'Bodegas & Viñedos Catena Zapata',
    repName: 'Arq. Florencia Morán',
    email: 'abastecimiento.cosecha@catenazapata.com',
    password: 'catena_pampero',
    initialPassword: 'catena_pampero',
    phone: '2614900210',
    cuitOrDni: '30-70891234-1',
    address: 'Cobos s/n, Agrelo',
    city: 'Luján de Cuyo',
    createdAt: '2026-02-25',
    status: 'active',
    pricingTier: 'Corporativo / Mayorista',
    notes: 'Equipamiento temporada Vendimia 2026 para cuadrillas de campo.',
  },
  {
    id: 'user-construcciones-cuyo',
    type: 'empresa',
    role: 'client',
    name: 'Construcciones Cuyo S.R.L.',
    repName: 'Carlos Benítez',
    email: 'administracion@construccionescuyo.com.ar',
    password: 'cuyo_pampero',
    initialPassword: 'cuyo_pampero',
    phone: '2615112233',
    cuitOrDni: '30-71234567-8',
    address: 'Rodríguez Peña 1420',
    city: 'Godoy Cruz',
    createdAt: '2026-03-01',
    status: 'active',
    pricingTier: 'Corporativo / Mayorista',
  },
  // Clientes Consumidores Finales
  {
    id: 'user-rossi',
    type: 'consumidor',
    role: 'client',
    name: 'Juan Manuel Rossi',
    email: 'jmrossi.mza@gmail.com',
    password: 'rossi_pampero',
    initialPassword: 'rossi_pampero',
    phone: '2616890123',
    cuitOrDni: '34.891.220',
    address: 'San Martín 520, 2do B',
    city: 'Godoy Cruz',
    createdAt: '2026-03-03',
    status: 'active',
    pricingTier: 'Consumidor Final',
  },
  {
    id: 'user-morales',
    type: 'consumidor',
    role: 'client',
    name: 'María Laura Morales',
    email: 'laura.morales@hotmail.com',
    password: 'morales_pampero',
    initialPassword: 'morales_pampero',
    phone: '2615438899',
    cuitOrDni: '36.452.190',
    address: 'Bandera de los Andes 1840',
    city: 'Guaymallén',
    createdAt: '2026-03-05',
    status: 'active',
    pricingTier: 'Consumidor Final',
  },
];

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ triggerSaveNotice, branches }) => {
  // Sincronización completa con Firestore y Local Storage
  const [users, setUsers] = useState<RegisteredUser[]>(() => {
    try {
      const stored = localStorage.getItem('pampero_registered_users');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Asegurar que los usuarios iniciales no se pierdan si se cargó un backup parcial
          const ids = new Set(parsed.map((u: any) => u.id || u.email?.toLowerCase()));
          const missing = INITIAL_REGISTERED_USERS.filter(
            (u) => !ids.has(u.id) && !ids.has(u.email.toLowerCase())
          );
          return [...parsed, ...missing];
        }
      }
    } catch {}
    return INITIAL_REGISTERED_USERS;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'empresa' | 'consumidor' | 'empleado' | 'admin'>('all');
  const [filterBranch, setFilterBranch] = useState<string>('todas');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal para Crear Nueva Cuenta con Asignación de Clave
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountType, setNewAccountType] = useState<'empresa' | 'consumidor' | 'empleado' | 'admin'>('empresa');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountRepName, setNewAccountRepName] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');
  const [newAccountCuit, setNewAccountCuit] = useState('');
  const [newAccountAddress, setNewAccountAddress] = useState('');
  const [newAccountCity, setNewAccountCity] = useState('Gran Mendoza');
  const [newAccountBranch, setNewAccountBranch] = useState(branches?.[0]?.name || 'Maipú');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSuccessUser, setCreatedSuccessUser] = useState<RegisteredUser | null>(null);

  // 1. Suscripción OBLIGATORIA a la colección 'usuarios' en Cloud Firestore en tiempo real usando onSnapshot
  useEffect(() => {
    // Sembrar usuarios iniciales a Firestore si está vacío
    seedInitialFirestoreUsersIfEmpty(INITIAL_REGISTERED_USERS).catch(() => {});

    // SDK onSnapshot Listener
    const unsubscribe = subscribeToFirestoreUsers((remoteUsers) => {
      if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        setUsers((prev) => {
          const map = new Map<string, RegisteredUser>();
          // Mantener locales actuales
          prev.forEach((u) => map.set(u.id, u));
          // Sobrescribir con remotos
          remoteUsers.forEach((u) => map.set(u.id, u));
          return Array.from(map.values());
        });
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Generador de clave sugerida inicial
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const cleanPrefix = (newAccountName.split(' ')[0] || 'Pampero').replace(/[^a-zA-Z]/g, '');
    const generated = `${cleanPrefix}2026_${code}`;
    setNewAccountPassword(generated);
  };

  // Toggle visibilidad de clave en la tabla
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Copiar clave al portapapeles
  const handleCopyPassword = (userId: string, pass: string) => {
    if (!pass) return;
    navigator.clipboard.writeText(pass);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copiar mensaje completo con credenciales para enviar por WhatsApp
  const handleCopyCredentialsMessage = (u: RegisteredUser) => {
    const pass = u.initialPassword || u.password || 'Pampero2026';
    const msg = `¡Hola ${u.name}! Ya tenés habilitado tu acceso al Catálogo Oficial Pampero Gran Mendoza.\n\n👤 Usuario / Email: ${u.email}\n🔑 Contraseña inicial: ${pass}\n🔗 Ingresá acá: ${window.location.origin}\n\nAnte cualquier consulta técnica estamos a tu disposición.`;
    navigator.clipboard.writeText(msg);
    setCopiedId(`msg-${u.id}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Real-time Delete from Cloud Firestore
  const handleDeleteUser = async (id: string, name: string) => {
    if (id === 'admin-master' || id === MASTER_ADMIN_USER.id) {
      alert('La cuenta administradora maestra (admin@pampero.com) está protegida por seguridad y no puede ser eliminada.');
      return;
    }
    if (confirm(`¿Estás seguro de eliminar permanentemente la cuenta de "${name}"?`)) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      await deleteFirestoreUser(id);
      triggerSaveNotice();
    }
  };

  // Cambiar estado activo / suspendido
  const handleToggleStatus = async (user: RegisteredUser) => {
    if (user.id === 'admin-master' || user.id === MASTER_ADMIN_USER.id) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const updatedUser: RegisteredUser = {
      ...user,
      status: newStatus,
    };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    await saveFirestoreUser(updatedUser);
    triggerSaveNotice();
  };

  // Cambiar rol de usuario en tiempo real e impactar en Firestore
  const handleUpdateRole = async (user: RegisteredUser, newRoleType: 'admin' | 'empleado' | 'empresa' | 'consumidor') => {
    if (user.id === 'admin-master' || user.id === MASTER_ADMIN_USER.id) return;
    const determinedRole: 'admin' | 'employee' | 'client' = 
      newRoleType === 'admin' ? 'admin' : (newRoleType === 'empleado' ? 'employee' : 'client');
    const updatedUser: RegisteredUser = {
      ...user,
      type: newRoleType,
      role: determinedRole,
      pricingTier: newRoleType === 'admin' ? 'Administrador' : (newRoleType === 'empresa' ? 'Corporativo / Mayorista' : 'Consumidor Final'),
      notes: newRoleType === 'admin' ? 'Cuenta con permisos de Administrador' : user.notes,
    };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    await saveFirestoreUser(updatedUser);
    triggerSaveNotice();
  };

  // Manejar creación de nueva cuenta
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const emailTrimmed = newAccountEmail.trim().toLowerCase();
    const nameTrimmed = newAccountName.trim();
    const passTrimmed = newAccountPassword.trim();

    if (!nameTrimmed) {
      setCreateError('El nombre o razón social es obligatorio.');
      return;
    }
    if (!emailTrimmed) {
      setCreateError('El email o usuario de acceso es obligatorio.');
      return;
    }
    if (!passTrimmed) {
      setCreateError('La contraseña inicial asignada es obligatoria. Asígnale una clave para que el usuario pueda ingresar.');
      return;
    }

    // Verificar si ya existe el email
    const exists = users.some((u) => u.email.toLowerCase().trim() === emailTrimmed);
    if (exists) {
      setCreateError(`Ya existe una cuenta registrada con el email "${emailTrimmed}".`);
      return;
    }

    const userId = `usr-${Date.now()}`;
    const determinedRole: 'admin' | 'employee' | 'client' = 
      newAccountType === 'admin' ? 'admin' : (newAccountType === 'empleado' ? 'employee' : 'client');

    const newUser: RegisteredUser = {
      id: userId,
      type: newAccountType,
      role: determinedRole,
      name: nameTrimmed,
      repName: newAccountType === 'empresa' ? newAccountRepName.trim() : undefined,
      email: emailTrimmed,
      password: passTrimmed,
      initialPassword: passTrimmed,
      phone: newAccountPhone.trim() || '261-0000000',
      cuitOrDni: newAccountCuit.trim() || 'Sin registrar',
      address: newAccountAddress.trim() || 'Gran Mendoza',
      city: newAccountCity.trim() || 'Gran Mendoza',
      branch: newAccountType === 'empleado' ? newAccountBranch : (newAccountType === 'admin' ? 'Administración Central' : undefined),
      sellerRole: newAccountType === 'empleado' ? 'vendedor' : undefined,
      pricingTier: newAccountType === 'empresa' ? 'Corporativo / Mayorista' : (newAccountType === 'admin' ? 'Administrador' : 'Consumidor Final'),
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      notes: newAccountType === 'admin' 
        ? 'Cuenta administradora con acceso y permisos totales' 
        : (newAccountType === 'empleado' ? `Operador en sucursal ${newAccountBranch}` : 'Cuenta creada por administrador'),
    };

    // Actualizar estado local inmediatamente
    setUsers((prev) => [newUser, ...prev]);

    // Guardar en Cloud Firestore y Auth registries
    await saveFirestoreUser(newUser);
    triggerSaveNotice();

    // Mostrar feedback de éxito
    setCreatedSuccessUser(newUser);

    // Limpiar formulario
    setNewAccountName('');
    setNewAccountRepName('');
    setNewAccountEmail('');
    setNewAccountPhone('');
    setNewAccountCuit('');
    setNewAccountAddress('');
    setNewAccountPassword('');
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    const headers = [
      'ID', 
      'Rol / Tipo', 
      'Nombre / Razón Social', 
      'Representante', 
      'Email', 
      'Contraseña Inicial', 
      'Teléfono', 
      'Sucursal', 
      'CUIT / DNI', 
      'Dirección', 
      'Ciudad', 
      'Tarifa', 
      'Estado', 
      'Fecha Registro'
    ];
    const rows = users.map((u) => [
      u.id,
      u.type.toUpperCase(),
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.repName || '').replace(/"/g, '""')}"`,
      u.email,
      `"${(u.initialPassword || u.password || '').replace(/"/g, '""')}"`,
      u.phone,
      u.branch || '-',
      u.cuitOrDni || '',
      `"${(u.address || '').replace(/"/g, '""')}"`,
      u.city || 'Gran Mendoza',
      u.pricingTier || '',
      u.status === 'active' ? 'ACTIVO' : 'SUSPENDIDO',
      u.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `padron_usuarios_pampero_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Filtro de rol
      if (filterRole === 'empresa' && u.type !== 'empresa') return false;
      if (filterRole === 'consumidor' && u.type !== 'consumidor') return false;
      if (filterRole === 'empleado' && (u.type !== 'empleado' && u.type !== 'vendedor' && u.role !== 'employee')) return false;
      if (filterRole === 'admin' && u.type !== 'admin') return false;

      // Filtro de sucursal
      if (filterBranch !== 'todas') {
        if (u.branch && u.branch.toLowerCase() !== filterBranch.toLowerCase()) return false;
      }

      // Filtro de búsqueda
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.repName && u.repName.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        (u.cuitOrDni && u.cuitOrDni.includes(q)) ||
        (u.branch && u.branch.toLowerCase().includes(q)) ||
        (u.initialPassword && u.initialPassword.toLowerCase().includes(q))
      );
    });
  }, [users, filterRole, filterBranch, searchQuery]);

  // Contadores
  const totalEmpresas = users.filter((u) => u.type === 'empresa').length;
  const totalConsumidores = users.filter((u) => u.type === 'consumidor').length;
  const totalStaff = users.filter((u) => u.type === 'empleado' || u.type === 'vendedor' || u.role === 'employee').length;
  const totalAdmins = users.filter((u) => u.type === 'admin').length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Banner & Header Centralizado */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCD4C9] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
              <Users className="w-6 h-6 text-[#B9522F]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                  Padrón General de Cuentas y Vendedores
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sincronizado Firestore onSnapshot
                </span>
              </div>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Tabla unificada en tiempo real de todos los usuarios registrados: Administradores, Vendedores, Empleados y Clientes (Empresas y Particulares).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botón Principal: Crear Nueva Cuenta con Asignación de Clave */}
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setCreatedSuccessUser(null);
                setCreateError(null);
                generateRandomPassword();
              }}
              className="px-3.5 py-2 bg-[#B9522F] hover:bg-[#A04526] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta / Asignar Clave</span>
            </button>

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Descargar padrón completo en Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Quick Stats: Tarjetas de Resumen de Cuentas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <div 
            onClick={() => setFilterRole('all')}
            className={`p-3 border rounded-xs cursor-pointer transition-all ${
              filterRole === 'all' ? 'bg-[#FAF8F5] border-[#B9522F] shadow-xs' : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6F6860]">Total Cuentas</span>
            <div className="text-xl font-bold font-display text-[#18231C]">{users.length}</div>
          </div>

          <div 
            onClick={() => setFilterRole('empresa')}
            className={`p-3 border rounded-xs cursor-pointer transition-all ${
              filterRole === 'empresa' ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Clientes Empresa</span>
              <Building2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl font-bold font-display text-emerald-950">{totalEmpresas}</div>
          </div>

          <div 
            onClick={() => setFilterRole('consumidor')}
            className={`p-3 border rounded-xs cursor-pointer transition-all ${
              filterRole === 'consumidor' ? 'bg-blue-50/50 border-blue-500 shadow-xs' : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-blue-800">Particulares</span>
              <User className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-xl font-bold font-display text-blue-950">{totalConsumidores}</div>
          </div>

          <div 
            onClick={() => setFilterRole('empleado')}
            className={`p-3 border rounded-xs cursor-pointer transition-all ${
              filterRole === 'empleado' ? 'bg-amber-50/50 border-amber-500 shadow-xs' : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Vendedores / Staff</span>
              <UserCheck className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-xl font-bold font-display text-amber-950">{totalStaff}</div>
          </div>

          <div 
            onClick={() => setFilterRole('admin')}
            className={`p-3 border rounded-xs cursor-pointer transition-all ${
              filterRole === 'admin' ? 'bg-neutral-900 border-[#FDB813] text-white shadow-xs' : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-wider font-bold ${filterRole === 'admin' ? 'text-[#FDB813]' : 'text-[#6F6860]'}`}>Admins</span>
              <ShieldCheck className={`w-4 h-4 ${filterRole === 'admin' ? 'text-[#FDB813]' : 'text-neutral-700'}`} />
            </div>
            <div className={`text-xl font-bold font-display ${filterRole === 'admin' ? 'text-white' : 'text-[#18231C]'}`}>{totalAdmins}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] flex flex-col lg:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, CUIT, email, clave, sucursal..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F]"
          />
        </div>

        {/* Role Filters + Branch Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setFilterRole('all')}
              className={`px-2.5 py-1 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                filterRole === 'all' ? 'bg-[#18231C] text-[#F5F2EC]' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
              }`}
            >
              Todos ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterRole('empresa')}
              className={`px-2.5 py-1 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                filterRole === 'empresa' ? 'bg-emerald-700 text-white' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
              }`}
            >
              Empresas ({totalEmpresas})
            </button>
            <button
              type="button"
              onClick={() => setFilterRole('consumidor')}
              className={`px-2.5 py-1 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                filterRole === 'consumidor' ? 'bg-blue-700 text-white' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
              }`}
            >
              Particulares ({totalConsumidores})
            </button>
            <button
              type="button"
              onClick={() => setFilterRole('empleado')}
              className={`px-2.5 py-1 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                filterRole === 'empleado' ? 'bg-amber-600 text-white' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
              }`}
            >
              Vendedores ({totalStaff})
            </button>
          </div>

          {/* Selector de Sucursal */}
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-2.5 py-1 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-semibold text-[#18231C] outline-none cursor-pointer"
          >
            <option value="todas">Todas las sucursales</option>
            <option value="Maipú">Sucursal Maipú</option>
            <option value="Ciudad">Sucursal Ciudad</option>
            <option value="Luján">Sucursal Luján</option>
          </select>
        </div>
      </div>

      {/* Unified Centralized Users Table */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18231C] text-[#F5F2EC] uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Usuario / Razón Social</th>
                <th className="py-3 px-4">Rol & Perfil</th>
                <th className="py-3 px-4">Contacto Directo</th>
                <th className="py-3 px-4">Identificación</th>
                <th className="py-3 px-4 bg-[#233228]">Contraseña Inicial</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#6F6860]">
                    No se encontraron cuentas con el criterio de búsqueda "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isEmpresa = u.type === 'empresa';
                  const isStaff = u.type === 'empleado' || u.type === 'vendedor' || u.role === 'employee';
                  const isAdmin = u.type === 'admin';
                  const isMasterAdmin = u.id === 'admin-master' || u.email?.toLowerCase().trim() === 'admin@pampero.com';
                  const initialPass = u.initialPassword || u.password || 'Pampero2026';
                  const isPassVisible = Boolean(visiblePasswords[u.id]);
                  const isCopied = copiedId === u.id;
                  const isMsgCopied = copiedId === `msg-${u.id}`;

                  return (
                    <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                      {/* Usuario / Nombre */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`p-2 rounded-xs shrink-0 ${
                              isAdmin
                                ? 'bg-[#18231C] text-[#FDB813]'
                                : isEmpresa
                                ? 'bg-emerald-100 text-emerald-800'
                                : isStaff
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isAdmin ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : isEmpresa ? (
                              <Building2 className="w-4 h-4" />
                            ) : isStaff ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#18231C] text-xs leading-snug">{u.name}</span>
                              {isAdmin && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-[#18231C] text-[#FDB813] text-[9px] font-mono font-bold uppercase tracking-wider">
                                  ADMINISTRADOR
                                </span>
                              )}
                            </div>
                            {u.repName && (
                              <div className="text-[10px] text-[#6F6860]">
                                Representante: <span className="font-semibold text-[#18231C]">{u.repName}</span>
                              </div>
                            )}
                            {u.branch && (
                              <div className="text-[10px] text-amber-900 font-semibold flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-amber-700" /> Sucursal: {u.branch}
                              </div>
                            )}
                            {u.notes && (
                              <div className="text-[9px] text-[#6F6860] line-clamp-1 italic max-w-xs">{u.notes}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Rol & Perfil */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider ${
                              isAdmin
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isEmpresa
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isStaff
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {isAdmin
                              ? 'Administrador'
                              : isEmpresa
                              ? 'Cliente Empresa'
                              : isStaff
                              ? `Vendedor (${u.branch || 'Staff'})`
                              : 'Consumidor Final'}
                          </span>

                          {!isMasterAdmin && (
                            <select
                              value={u.type}
                              onChange={(e) => handleUpdateRole(u, e.target.value as any)}
                              className="text-[9px] font-semibold text-[#18231C] bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs px-1 py-0.5 cursor-pointer outline-none hover:bg-white"
                              title="Cambiar rol y permisos en Firebase"
                            >
                              <option value="admin">Cambiar a: Administrador</option>
                              <option value="empleado">Cambiar a: Empleado/Ventas</option>
                              <option value="empresa">Cambiar a: Cliente Empresa</option>
                              <option value="consumidor">Cambiar a: Consumidor Final</option>
                            </select>
                          )}

                          <div className="text-[9px] text-[#6F6860]">
                            Alta: {u.createdAt || 'Registrado'}
                          </div>
                        </div>
                      </td>

                      {/* Contacto Directo */}
                      <td className="py-3 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-[#18231C]">
                          <Mail className="w-3.5 h-3.5 text-[#B9522F]" />
                          <a href={`mailto:${u.email}`} className="hover:underline font-mono text-[11px]">
                            {u.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#18231C]">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono text-[11px]">{u.phone}</span>
                        </div>
                      </td>

                      {/* Identificación & Ubicación */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#18231C] bg-[#FAF8F5] px-2 py-0.5 rounded-xs border border-[#DCD4C9] inline-block">
                          {u.cuitOrDni || 'Sin CUIT/DNI'}
                        </div>
                        {u.address && (
                          <div className="text-[10px] text-[#6F6860] flex items-center gap-1 mt-1 truncate max-w-[150px]">
                            <MapPin className="w-3 h-3 text-[#B9522F] shrink-0" />
                            <span>{u.address}</span>
                          </div>
                        )}
                      </td>

                      {/* CONTRASEÑA INICIAL ASIGNADA (CRUCIAL) */}
                      <td className="py-3 px-4 bg-amber-50/30">
                        <div className="flex items-center gap-1.5">
                          <div className="px-2 py-1 bg-white border border-amber-300 rounded-xs font-mono text-xs font-bold text-[#18231C] flex items-center gap-1 shadow-2xs">
                            <Key className="w-3 h-3 text-[#B9522F] shrink-0" />
                            <span>{isPassVisible ? initialPass : '••••••••'}</span>
                          </div>
                          
                          {/* Toggle Ver / Ocultar */}
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 hover:bg-amber-100 text-[#6F6860] hover:text-[#18231C] rounded-xs transition-colors cursor-pointer"
                            title={isPassVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          {/* Copiar Contraseña */}
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(u.id, initialPass)}
                            className={`p-1 rounded-xs transition-colors cursor-pointer ${
                              isCopied ? 'bg-emerald-600 text-white' : 'hover:bg-amber-100 text-[#6F6860] hover:text-[#18231C]'
                            }`}
                            title="Copiar contraseña para enviar al usuario"
                          >
                            {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Estado: Activo / Suspendido */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={isMasterAdmin}
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            isMasterAdmin
                              ? 'bg-neutral-100 text-neutral-600 cursor-default'
                              : u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800 cursor-pointer'
                              : 'bg-red-100 text-red-800 hover:bg-emerald-100 hover:text-emerald-800 cursor-pointer'
                          }`}
                          title={isMasterAdmin ? 'Cuenta maestra protegida' : 'Click para cambiar estado'}
                        >
                          {u.status === 'active' ? '● Activa' : '✕ Suspendida'}
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Copiar mensaje WhatsApp completo */}
                          <button
                            type="button"
                            onClick={() => handleCopyCredentialsMessage(u)}
                            className={`p-1.5 rounded-xs transition-colors cursor-pointer ${
                              isMsgCopied ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="Copiar mensaje con usuario y contraseña para WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* Botón WhatsApp directo */}
                          {u.phone && (
                            <a
                              href={`https://wa.me/549${u.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `¡Hola ${u.name}! Tu cuenta en Pampero Catálogo está activa. Usuario: ${u.email} | Clave: ${initialPass}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-xs transition-colors"
                              title="Abrir chat de WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Eliminar cuenta */}
                          {isMasterAdmin ? (
                            <span 
                              className="px-2 py-0.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-xs text-[10px] font-bold"
                              title="Cuenta Maestra Protegida"
                            >
                              Maestro
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                              title="Eliminar cuenta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREACIÓN DE CUENTA CON ASIGNACIÓN MANUAL DE CLAVE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl w-full max-w-lg overflow-hidden my-auto animate-fadeIn">
            {/* Header Modal */}
            <div className="bg-[#18231C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#B9522F] rounded-xs text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wider">Crear Nueva Cuenta de Usuario</h4>
                  <p className="text-[10px] text-neutral-300">Asigná el rol, perfil y contraseña inicial para el usuario</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-xs cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Notification if already created */}
            {createdSuccessUser ? (
              <div className="p-6 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                      ¡Cuenta Creada y Sincronizada con Éxito!
                    </h5>
                    <p className="text-xs text-emerald-800 mt-1">
                      El perfil de <strong>{createdSuccessUser.name}</strong> se ha guardado en Cloud Firestore y en el sistema de autenticación.
                    </p>
                  </div>
                </div>

                {/* Resumen de credenciales para entregar al usuario */}
                <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#6F6860] tracking-wider block">
                    Datos de Acceso para Entregar al Usuario:
                  </span>
                  <div className="font-mono text-xs space-y-1 bg-white p-2.5 rounded-xs border border-[#DCD4C9]">
                    <div><strong>Usuario / Email:</strong> {createdSuccessUser.email}</div>
                    <div><strong>Contraseña asignada:</strong> <span className="bg-amber-100 text-amber-950 px-1 rounded-xs font-bold">{createdSuccessUser.initialPassword}</span></div>
                    <div><strong>Rol:</strong> {createdSuccessUser.type.toUpperCase()}</div>
                    {createdSuccessUser.branch && <div><strong>Sucursal:</strong> {createdSuccessUser.branch}</div>}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCredentialsMessage(createdSuccessUser)}
                    className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Copiar Texto para WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedSuccessUser(null);
                      generateRandomPassword();
                    }}
                    className="py-2 px-4 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer"
                  >
                    Crear Otra
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAccountSubmit} className="p-5 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-300 rounded-xs text-xs text-red-900 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* 1. Selector de Rol / Tipo */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1.5">
                    1. Elegir Rol de la Cuenta:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAccountType('empresa')}
                      className={`p-2.5 border rounded-xs flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                        newAccountType === 'empresa'
                          ? 'border-[#B9522F] bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                          : 'border-[#DCD4C9] bg-[#FAF8F5] text-[#6F6860] hover:bg-white'
                      }`}
                    >
                      <Building2 className="w-5 h-5 text-emerald-700" />
                      <span className="text-xs">Cliente Empresa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewAccountType('consumidor')}
                      className={`p-2.5 border rounded-xs flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                        newAccountType === 'consumidor'
                          ? 'border-[#B9522F] bg-blue-50 text-blue-950 font-bold shadow-xs'
                          : 'border-[#DCD4C9] bg-[#FAF8F5] text-[#6F6860] hover:bg-white'
                      }`}
                    >
                      <User className="w-5 h-5 text-blue-700" />
                      <span className="text-xs">Consumidor Final</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewAccountType('empleado')}
                      className={`p-2.5 border rounded-xs flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                        newAccountType === 'empleado'
                          ? 'border-[#B9522F] bg-amber-50 text-amber-950 font-bold shadow-xs'
                          : 'border-[#DCD4C9] bg-[#FAF8F5] text-[#6F6860] hover:bg-white'
                      }`}
                    >
                      <UserCheck className="w-5 h-5 text-amber-700" />
                      <span className="text-xs">Empleado / Ventas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewAccountType('admin')}
                      className={`p-2.5 border rounded-xs flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                        newAccountType === 'admin'
                          ? 'border-[#B9522F] bg-purple-50 text-purple-950 font-bold shadow-xs ring-1 ring-purple-400'
                          : 'border-[#DCD4C9] bg-[#FAF8F5] text-[#6F6860] hover:bg-white'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5 text-purple-700" />
                      <span className="text-xs">Administrador</span>
                    </button>
                  </div>
                </div>

                {/* 2. Datos Generales de la Cuenta */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        {newAccountType === 'empresa' ? 'Razón Social / Empresa *' : 'Nombre Completo *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder={newAccountType === 'empresa' ? 'Razón Social o Empresa' : 'Ingresar nombre completo'}
                        className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] outline-none focus:border-[#B9522F]"
                      />
                    </div>

                    {newAccountType === 'empresa' ? (
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                          Representante / Contacto
                        </label>
                        <input
                          type="text"
                          value={newAccountRepName}
                          onChange={(e) => setNewAccountRepName(e.target.value)}
                          placeholder="Nombre del representante"
                          className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] outline-none focus:border-[#B9522F]"
                        />
                      </div>
                    ) : newAccountType === 'empleado' ? (
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                          Sucursal Asignada *
                        </label>
                        <select
                          value={newAccountBranch}
                          onChange={(e) => setNewAccountBranch(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-semibold text-[#18231C] outline-none focus:border-[#B9522F]"
                        >
                          <option value="Maipú">Sucursal Maipú</option>
                          <option value="Ciudad">Sucursal Ciudad</option>
                          <option value="Luján">Sucursal Luján</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Email / Usuario de Acceso *
                      </label>
                      <input
                        type="email"
                        required
                        value={newAccountEmail}
                        onChange={(e) => setNewAccountEmail(e.target.value)}
                        placeholder="correo@empresa.com"
                        className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] font-mono outline-none focus:border-[#B9522F]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Teléfono / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={newAccountPhone}
                        onChange={(e) => setNewAccountPhone(e.target.value)}
                        placeholder="Ej: 2612345678"
                        className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] outline-none focus:border-[#B9522F]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        {newAccountType === 'empresa' ? 'CUIT *' : 'DNI / CUIT *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={newAccountCuit}
                        onChange={(e) => setNewAccountCuit(e.target.value)}
                        placeholder={newAccountType === 'empresa' ? '30-XXXXXXXX-X' : 'XX.XXX.XXX'}
                        className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] font-mono outline-none focus:border-[#B9522F]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Dirección / Domicilio
                      </label>
                      <input
                        type="text"
                        value={newAccountAddress}
                        onChange={(e) => setNewAccountAddress(e.target.value)}
                        placeholder="Calle y número"
                        className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] outline-none focus:border-[#B9522F]"
                      />
                    </div>
                  </div>

                  {/* 3. CAMPO CRUCIAL: CONTRASEÑA INICIAL ASIGNADA */}
                  <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xs space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-[#B9522F]" />
                        <span>Contraseña Inicial Asignada (Obligatoria) *</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[10px] text-[#B9522F] hover:underline font-bold cursor-pointer"
                      >
                        Generar sugerencia
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showModalPassword ? 'text' : 'password'}
                        required
                        value={newAccountPassword}
                        onChange={(e) => setNewAccountPassword(e.target.value)}
                        placeholder="Ingresar contraseña inicial"
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xs text-xs font-mono font-bold text-[#18231C] pr-10 outline-none focus:border-[#B9522F]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalPassword(!showModalPassword)}
                        className="absolute right-2.5 top-2.5 text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                      >
                        {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <p className="text-[10px] text-neutral-600">
                      Esta contraseña quedará registrada en el sistema de autenticación de Cloud Firestore para que puedas entregársela personalmente al usuario.
                    </p>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCD4C9]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-[#DCD4C9] text-xs font-bold uppercase text-[#6F6860] hover:bg-[#FAF8F5] rounded-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#B9522F] hover:bg-[#A04526] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar y Habilitar Cuenta</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
