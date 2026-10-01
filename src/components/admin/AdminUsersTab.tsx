import React, { useState, useEffect } from 'react';
import { RegisteredUser, BranchLocation, UserSession } from '../../types';
import { MASTER_ADMIN_USER, ensureMasterAdminInitialized } from '../../utils/authInit';
import { AdminSellersTab } from './AdminSellersTab';
import {
  subscribeToFirestoreUsers,
  saveFirestoreUser,
  deleteFirestoreUser,
  seedInitialFirestoreUsersIfEmpty,
  isFirebaseReady,
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
  Calendar, 
  ShieldCheck, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Filter,
  RefreshCw,
  UserCheck
} from 'lucide-react';

interface AdminUsersTabProps {
  triggerSaveNotice: () => void;
  branches?: BranchLocation[];
  userSession?: UserSession | null;
}

export const INITIAL_REGISTERED_USERS: RegisteredUser[] = [
  MASTER_ADMIN_USER,
  {
    id: 'user-edemsa',
    type: 'empresa',
    name: 'EDEMSA S.A. (Empresa Distribuidora de Electricidad de Mendoza)',
    repName: 'Ing. Martín Carrizo',
    email: 'compras.operativas@edemsa.com.ar',
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
    name: 'YPF Refinería Luján de Cuyo',
    repName: 'Lic. Pablo Godoy',
    email: 'licitaciones.pampero@ypf.com',
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
    name: 'Bodegas & Viñedos Catena Zapata',
    repName: 'Arq. Florencia Morán',
    email: 'abastecimiento.cosecha@catenazapata.com',
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
    name: 'Construcciones Cuyo S.R.L.',
    repName: 'Carlos Benítez',
    email: 'administracion@construccionescuyo.com.ar',
    phone: '2615112233',
    cuitOrDni: '30-71234567-8',
    address: 'Rodríguez Peña 1420',
    city: 'Godoy Cruz',
    createdAt: '2026-03-01',
    status: 'active',
    pricingTier: 'Corporativo / Mayorista',
  },
  {
    id: 'user-rossi',
    type: 'consumidor',
    name: 'Juan Manuel Rossi',
    email: 'jmrossi.mza@gmail.com',
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
    name: 'María Laura Morales',
    email: 'laura.morales@hotmail.com',
    phone: '2615438899',
    cuitOrDni: '36.452.190',
    address: 'Bandera de los Andes 1840',
    city: 'Guaymallén',
    createdAt: '2026-03-05',
    status: 'active',
    pricingTier: 'Consumidor Final',
  },
];

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ triggerSaveNotice, branches, userSession }) => {
  const [mainSubTab, setMainSubTab] = useState<'sellers' | 'clients'>('sellers');

  // Real-time Firestore driven users list
  const [users, setUsers] = useState<RegisteredUser[]>(() => {
    try {
      const stored = localStorage.getItem('pampero_registered_users');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_REGISTERED_USERS;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to Cloud Firestore collection 'usuarios' in real time
  useEffect(() => {
    // 1. Ensure master admin and seed users exist in Firestore if collection is empty
    seedInitialFirestoreUsersIfEmpty(INITIAL_REGISTERED_USERS).catch((err) => {
      console.warn('[FIREBASE] Error sembrando usuarios iniciales:', err);
    });

    // 2. Real-time Firebase SDK listener (onSnapshot)
    const unsubscribe = subscribeToFirestoreUsers((remoteUsers) => {
      if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        setUsers(remoteUsers);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'empresa' | 'consumidor' | 'admin'>('all');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);

  // Real-time Save to Cloud Firestore
  const saveUsers = async (newUsers: RegisteredUser[]) => {
    for (const u of newUsers) {
      await saveFirestoreUser(u);
    }
    triggerSaveNotice();
  };

  // Real-time Delete from Cloud Firestore
  const handleDeleteUser = async (id: string, name: string) => {
    if (id === 'admin-master' || id === MASTER_ADMIN_USER.id) {
      alert('La cuenta administradora maestra (admin@pampero.com) está protegida por seguridad y no puede ser eliminada.');
      return;
    }
    if (confirm(`¿Estás seguro de eliminar la cuenta de "${name}"?`)) {
      await deleteFirestoreUser(id);
      triggerSaveNotice();
      if (selectedUser?.id === id) setSelectedUser(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Tipo', 'Nombre / Razón Social', 'Representante', 'Email', 'Teléfono', 'CUIT / DNI', 'Dirección', 'Ciudad', 'Tarifa', 'Fecha Registro'];
    const rows = users.map((u) => [
      u.id,
      u.type.toUpperCase(),
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.repName || '').replace(/"/g, '""')}"`,
      u.email,
      u.phone,
      u.cuitOrDni || '',
      `"${(u.address || '').replace(/"/g, '""')}"`,
      u.city || 'Gran Mendoza',
      u.pricingTier || '',
      u.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clientes_pampero_gran_mendoza_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredUsers = users.filter((u) => {
    if (filterType !== 'all' && u.type !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.repName && u.repName.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.cuitOrDni && u.cuitOrDni.includes(q))
    );
  });

  const totalEmpresas = users.filter((u) => u.type === 'empresa').length;
  const totalConsumidores = users.filter((u) => u.type === 'consumidor').length;
  const totalAdmins = users.filter((u) => u.type === 'admin').length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Subtab Switcher: Empleados y Cuentas Creadas */}
      <div className="flex border-b border-[#DCD4C9] bg-white px-4 pt-3 gap-2 rounded-t-xs">
        <button
          type="button"
          onClick={() => setMainSubTab('sellers')}
          className={`py-2 px-4 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            mainSubTab === 'sellers'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Empleados & Equipo Comercial</span>
        </button>

        <button
          type="button"
          onClick={() => setMainSubTab('clients')}
          className={`py-2 px-4 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            mainSubTab === 'clients'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Cuentas Creadas & Clientes Corporativos ({users.length})</span>
        </button>
      </div>

      {mainSubTab === 'sellers' ? (
        <AdminSellersTab
          branches={branches || []}
          triggerSaveNotice={triggerSaveNotice}
          userSession={userSession}
        />
      ) : (
        <>
          {/* Top Banner */}
          <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCD4C9] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
              <Users className="w-6 h-6 text-[#B9522F]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                  Cuentas Creadas & Clientes Registrados
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sincronizado Firestore SDK
                </span>
              </div>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Padrón oficial en tiempo real de empresas, industrias y consumidores finales en Cloud Firestore.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Descargar Planilla Excel / CSV
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6F6860]">Total Cuentas</span>
              <div className="text-xl font-bold font-display text-[#18231C]">{users.length}</div>
            </div>
            <Users className="w-5 h-5 text-[#B9522F]" />
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6F6860]">Empresas / Corporativos</span>
              <div className="text-xl font-bold font-display text-[#18231C]">{totalEmpresas}</div>
            </div>
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6F6860]">Consumidores Finales</span>
              <div className="text-xl font-bold font-display text-[#18231C]">{totalConsumidores}</div>
            </div>
            <User className="w-5 h-5 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, CUIT, teléfono..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F]"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F6860] mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtrar:
          </span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs font-bold uppercase rounded-xs transition-colors ${
              filterType === 'all' ? 'bg-[#18231C] text-[#F5F2EC]' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setFilterType('empresa')}
            className={`px-3 py-1 text-xs font-bold uppercase rounded-xs transition-colors ${
              filterType === 'empresa' ? 'bg-[#18231C] text-[#F5F2EC]' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
            }`}
          >
            Empresas ({totalEmpresas})
          </button>
          <button
            onClick={() => setFilterType('consumidor')}
            className={`px-3 py-1 text-xs font-bold uppercase rounded-xs transition-colors ${
              filterType === 'consumidor' ? 'bg-[#18231C] text-[#F5F2EC]' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
            }`}
          >
            Consumidores ({totalConsumidores})
          </button>
          <button
            onClick={() => setFilterType('admin')}
            className={`px-3 py-1 text-xs font-bold uppercase rounded-xs transition-colors ${
              filterType === 'admin' ? 'bg-[#18231C] text-[#FDB813]' : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-[#ECE5DC]'
            }`}
          >
            Admin ({totalAdmins})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18231C] text-[#F5F2EC] uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Tipo & Cliente</th>
                <th className="py-3 px-4">Contacto Directo</th>
                <th className="py-3 px-4">CUIT / DNI</th>
                <th className="py-3 px-4">Ubicación</th>
                <th className="py-3 px-4">Tarifa Asignada</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6F6860]">
                    No se encontraron cuentas con el criterio de búsqueda "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isEmpresa = u.type === 'empresa';
                  const isAdmin = u.type === 'admin';
                  const isMasterAdmin = u.id === 'admin-master' || u.email?.toLowerCase().trim() === 'admin@pampero.com';

                  return (
                    <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`p-2 rounded-xs shrink-0 ${
                              isAdmin
                                ? 'bg-[#18231C] text-[#FDB813]'
                                : isEmpresa
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isAdmin ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : isEmpresa ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#18231C] text-xs leading-snug">{u.name}</span>
                              {isAdmin && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-[#18231C] text-[#FDB813] text-[9px] font-mono font-bold uppercase tracking-wider">
                                  ADMIN MAESTRO
                                </span>
                              )}
                            </div>
                            {u.repName && (
                              <div className="text-[10px] text-[#6F6860]">
                                Representante: <span className="font-semibold text-[#18231C]">{u.repName}</span>
                              </div>
                            )}
                            <div className="text-[9px] text-[#6F6860]/80">Alta: {u.createdAt}</div>
                          </div>
                        </div>
                      </td>

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

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#18231C] bg-[#FAF8F5] px-2 py-0.5 rounded-xs border border-[#DCD4C9]">
                          {u.cuitOrDni || 'Sin registrar'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#4A453F]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#B9522F] shrink-0" />
                          <span className="truncate max-w-[180px]">{u.address || 'Gran Mendoza'}</span>
                        </div>
                        {u.city && <div className="text-[10px] text-[#6F6860] pl-4">{u.city}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider ${
                            isAdmin
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                              : isEmpresa
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-neutral-100 text-[#18231C] border border-[#DCD4C9]'
                          }`}
                        >
                          {isAdmin ? 'Acceso Total / Admin' : u.pricingTier || (isEmpresa ? 'Corporativo / Mayorista' : 'Consumidor Final')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp button */}
                          {u.phone && (
                            <a
                              href={`https://wa.me/549${u.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(
                                u.name
                              )},%20te%20escribimos%20desde%20Pampero%20Gran%20Mendoza.`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-xs transition-colors"
                              title="Enviar WhatsApp directo"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {/* Delete or Protected Master Badge */}
                          {isMasterAdmin ? (
                            <span 
                              className="p-1.5 text-amber-600 bg-amber-50 rounded-xs inline-flex items-center text-[10px] font-bold cursor-default"
                              title="Cuenta Maestra Protegida"
                            >
                              Protegido
                            </span>
                          ) : (
                            <button
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
    </>
    )}
  </div>
  );
};
