import React, { useState, useEffect } from 'react';
import { Seller, BranchLocation, UserSession } from '../../types';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Phone, 
  Building2, 
  UserCheck, 
  Shield, 
  Search, 
  Lock, 
  Mail, 
  ShieldCheck, 
  AlertCircle,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { db, getFirebaseDb } from '../../services/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface AdminSellersTabProps {
  branches: BranchLocation[];
  triggerSaveNotice: () => void;
  userSession?: UserSession | null;
}

export type StaffRole = 'admin' | 'local' | 'vendedor';

export interface SellerRecord extends Seller {
  role?: StaffRole;
  password?: string;
  notes?: string;
}

export const INITIAL_SELLERS_DATA: SellerRecord[] = [
  { id: 'sel-1', name: 'Itatí', branch: 'Maipú', phone: '261 527-6713', email: 'itati@pamperomaipu.com.ar', role: 'local', active: true },
  { id: 'sel-2', name: 'Guada', branch: 'Ciudad', phone: '261 423-1122', email: 'guada@pampero.com.ar', role: 'local', active: true },
  { id: 'sel-3', name: 'Carolina', branch: 'Luján', phone: '261 498-5544', email: 'carolina@pampero.com.ar', role: 'local', active: true },
  { id: 'sel-4', name: 'Gustavo', branch: 'Maipú', phone: '261 527-6713', email: 'gustavo@pampero.com.ar', role: 'vendedor', active: true },
  { id: 'sel-5', name: 'Martín', branch: 'Ciudad', phone: '261 423-1122', email: 'martin@pampero.com.ar', role: 'vendedor', active: true },
];

export const AdminSellersTab: React.FC<AdminSellersTabProps> = ({ branches, triggerSaveNotice, userSession }) => {
  const [sellers, setSellers] = useState<SellerRecord[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_sellers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SELLERS_DATA;
  });

  // Effective Role determination
  const userBaseRole: StaffRole = (() => {
    if (userSession?.role === 'admin') return 'admin';
    const email = userSession?.email?.toLowerCase() || '';
    const match = sellers.find((s) => s.email?.toLowerCase() === email);
    if (match?.role) return match.role;
    if (userSession?.role === 'employee') return 'local';
    return 'admin';
  })();

  // Testing role simulator for admin preview
  const [simulatedRole, setSimulatedRole] = useState<StaffRole>(userBaseRole);
  const activeRole: StaffRole = userSession?.role === 'admin' ? simulatedRole : userBaseRole;

  // Active branch context for local role
  const userAssignedBranch: string = (() => {
    const email = userSession?.email?.toLowerCase() || '';
    const match = sellers.find((s) => s.email?.toLowerCase() === email);
    if (match?.branch) return match.branch;
    return (userSession as any)?.branch || branches[0]?.name || 'Maipú';
  })();

  const [simulatedBranch, setSimulatedBranch] = useState<string>(userAssignedBranch);
  const currentBranchContext = userSession?.role === 'admin' && activeRole === 'local' ? simulatedBranch : userAssignedBranch;

  // Search and modal states
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('todas');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [branch, setBranch] = useState(branches[0]?.name || 'Maipú');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sellerRole, setSellerRole] = useState<StaffRole>('vendedor');

  // Real-time Firestore sync
  useEffect(() => {
    const firestoreDb = db || getFirebaseDb();
    if (!firestoreDb) return;

    try {
      const unsub = onSnapshot(collection(firestoreDb, 'vendedores'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteList: SellerRecord[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setSellers(remoteList);
          try {
            localStorage.setItem('pampero_sellers', JSON.stringify(remoteList));
          } catch {}
        }
      }, (err) => {
        console.warn('[FIRESTORE] Vendedores offline sync:', err.message);
      });

      return () => unsub();
    } catch {}
  }, []);

  const saveToFirestoreAndStorage = async (newList: SellerRecord[]) => {
    setSellers(newList);
    try {
      localStorage.setItem('pampero_sellers', JSON.stringify(newList));
    } catch {}

    const firestoreDb = db || getFirebaseDb();
    if (firestoreDb) {
      try {
        for (const s of newList) {
          await setDoc(doc(firestoreDb, 'vendedores', s.id), s, { merge: true });
        }
      } catch (err) {
        console.warn('[FIRESTORE] Error guardando vendedores:', err);
      }
    }
    triggerSaveNotice();
  };

  const handleOpenCreate = () => {
    setIsEditing(null);
    setName('');
    // If role is local, branch is strictly locked to their local
    setBranch(activeRole === 'local' ? currentBranchContext : (branches[0]?.name || 'Maipú'));
    setPhone('');
    setEmail('');
    setSellerRole('vendedor');
    setShowModal(true);
  };

  const handleOpenEdit = (seller: SellerRecord) => {
    // RBAC: vendedor can only edit themselves
    if (activeRole === 'vendedor') {
      const email = userSession?.email?.toLowerCase();
      if (seller.email?.toLowerCase() !== email && seller.name !== userSession?.clientData?.fullName) {
        alert('Solo tenés permisos para ver y editar tu propia información de vendedor.');
        return;
      }
    }

    // RBAC: local can only edit sellers of their local
    if (activeRole === 'local' && seller.branch !== currentBranchContext) {
      alert('Solo podés gestionar a los vendedores de tu mismo local.');
      return;
    }

    setIsEditing(seller.id);
    setName(seller.name);
    setBranch(seller.branch || currentBranchContext);
    setPhone(seller.phone || '');
    setEmail(seller.email || '');
    setSellerRole(seller.role || 'vendedor');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // RBAC validation: local cannot assign other branch
    const finalBranch = activeRole === 'local' ? currentBranchContext : branch;

    if (isEditing) {
      const updated = sellers.map((s) => {
        if (s.id === isEditing) {
          return {
            ...s,
            name: name.trim(),
            branch: finalBranch,
            phone: phone.trim(),
            email: email.trim(),
            role: activeRole === 'admin' ? sellerRole : (s.role || 'vendedor'),
          };
        }
        return s;
      });
      await saveToFirestoreAndStorage(updated);
    } else {
      const newRecord: SellerRecord = {
        id: `sel-${Date.now()}`,
        name: name.trim(),
        branch: finalBranch,
        phone: phone.trim(),
        email: email.trim(),
        role: activeRole === 'admin' ? sellerRole : 'vendedor',
        active: true,
      };
      await saveToFirestoreAndStorage([...sellers, newRecord]);
    }
    setShowModal(false);
  };

  const handleToggleActive = async (id: string) => {
    if (activeRole === 'vendedor') {
      alert('Los vendedores no pueden alterar el estado de las cuentas.');
      return;
    }
    const target = sellers.find((s) => s.id === id);
    if (activeRole === 'local' && target?.branch !== currentBranchContext) {
      alert('Solo podés modificar vendedores de tu mismo local.');
      return;
    }

    const updated = sellers.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    await saveToFirestoreAndStorage(updated);
  };

  const handleDelete = async (id: string) => {
    if (activeRole === 'vendedor') {
      alert('Los vendedores no tienen permisos para eliminar registros.');
      return;
    }
    const target = sellers.find((s) => s.id === id);
    if (activeRole === 'local' && target?.branch !== currentBranchContext) {
      alert('Solo podés eliminar vendedores de tu mismo local.');
      return;
    }

    if (confirm(`¿Estás seguro de que deseás dar de baja al vendedor "${target?.name}"?`)) {
      const updated = sellers.filter((s) => s.id !== id);
      setSellers(updated);
      try {
        localStorage.setItem('pampero_sellers', JSON.stringify(updated));
      } catch {}

      const firestoreDb = db || getFirebaseDb();
      if (firestoreDb) {
        await deleteDoc(doc(firestoreDb, 'vendedores', id)).catch(console.warn);
      }
      triggerSaveNotice();
    }
  };

  // RBAC Filtering:
  // 1. Admin: Sees all or filtered by branch
  // 2. Local: Strictly sees sellers of their branch
  // 3. Vendedor: Strictly sees only their own profile
  const visibleSellers = sellers.filter((s) => {
    if (activeRole === 'vendedor') {
      const userEmail = userSession?.email?.toLowerCase() || '';
      const userName = (userSession?.clientData?.fullName || '').toLowerCase();
      const matchEmail = s.email && s.email.toLowerCase() === userEmail;
      const matchName = s.name && userName && s.name.toLowerCase().includes(userName);
      return matchEmail || matchName || s.id === (userSession as any)?.sellerId;
    }

    if (activeRole === 'local') {
      return (s.branch || '').toLowerCase() === currentBranchContext.toLowerCase();
    }

    // Admin sees all, respect search and branch filter
    if (selectedBranchFilter !== 'todas') {
      if ((s.branch || '').toLowerCase() !== selectedBranchFilter.toLowerCase()) return false;
    }

    return true;
  }).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.phone || '').includes(q);
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Banner with Strict RBAC Status */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#18231C] text-[#F5F2EC] rounded-xs">
              <Users className="w-5 h-5 text-[#FDB813]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                  Vendedores y Locales
                </h3>
                <span className="px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[10px] font-black uppercase tracking-wider">
                  RBAC Oficial
                </span>
              </div>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Control de acceso por roles para locales de Gran Mendoza (Maipú, Ciudad, Luján de Cuyo).
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Disabled for vendedor */}
        {activeRole !== 'vendedor' && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Vendedor {activeRole === 'local' ? `(${currentBranchContext})` : ''}</span>
          </button>
        )}
      </div>

      {/* RBAC Active Role Indicator Banner */}
      <div className={`p-4 rounded-xs border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
        activeRole === 'admin'
          ? 'bg-purple-50 border-purple-200 text-purple-950'
          : activeRole === 'local'
          ? 'bg-blue-50 border-blue-200 text-blue-950'
          : 'bg-emerald-50 border-emerald-200 text-emerald-950'
      }`}>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 shrink-0 text-current" />
          <div>
            <span className="font-bold uppercase tracking-wider block">
              {activeRole === 'admin' && 'Modo Administrador General (Acceso Total a Todos los Locales y Vendedores)'}
              {activeRole === 'local' && `Modo Encargado de Sucursal · Local: ${currentBranchContext} (Solo puede ver y gestionar vendedores de su sucursal)`}
              {activeRole === 'vendedor' && 'Modo Vendedor (Solo podés ver y gestionar tu propio perfil de vendedor)'}
            </span>
            <span className="text-[11px] opacity-80">
              {activeRole === 'admin' && 'Podés crear, editar, reasignar locales y gestionar la totalidad de las sucursales.'}
              {activeRole === 'local' && `Tenés acceso exclusivo a los operadores y vendedores asignados a ${currentBranchContext}.`}
              {activeRole === 'vendedor' && 'Tus permisos están restringidos a tu información de contacto y ventas asignadas.'}
            </span>
          </div>
        </div>

        {/* Admin RBAC Role Simulator for testing */}
        {userSession?.role === 'admin' && (
          <div className="flex items-center gap-2 shrink-0 bg-white/80 p-2 rounded-xs border border-current/20">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-600" />
            <span className="text-[10px] font-bold uppercase text-neutral-700">Simular Rol:</span>
            <select
              value={simulatedRole}
              onChange={(e) => setSimulatedRole(e.target.value as StaffRole)}
              className="text-xs bg-white border border-neutral-300 rounded-xs px-2 py-1 font-bold outline-none cursor-pointer"
            >
              <option value="admin">Admin (Total)</option>
              <option value="local">Encargado Local</option>
              <option value="vendedor">Vendedor</option>
            </select>

            {simulatedRole === 'local' && (
              <select
                value={simulatedBranch}
                onChange={(e) => setSimulatedBranch(e.target.value)}
                className="text-xs bg-white border border-neutral-300 rounded-xs px-2 py-1 font-bold outline-none cursor-pointer"
              >
                <option value="Maipú">Local Maipú</option>
                <option value="Ciudad">Local Ciudad</option>
                <option value="Luján">Local Luján</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Filters (Only for Admin; Local and Vendedor have locked scope) */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xs border border-[#DCD4C9]">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
          />
        </div>

        {activeRole === 'admin' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-600 font-medium">Filtrar Local:</span>
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white outline-none font-bold text-[#18231C]"
            >
              <option value="todas">Todos los Locales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Sellers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleSellers.length === 0 ? (
          <div className="col-span-full bg-white p-8 text-center rounded-xs border border-dashed border-[#DCD4C9] text-neutral-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-neutral-700" />
            <p className="font-bold text-sm text-neutral-800">No se encontraron vendedores en esta vista.</p>
            <p className="text-xs text-neutral-500 mt-1">
              {activeRole === 'vendedor'
                ? 'No tenés una ficha de vendedor vinculada a tu usuario actual.'
                : 'Podés agregar nuevos vendedores con el botón superior.'}
            </p>
          </div>
        ) : (
          visibleSellers.map((s) => (
            <div
              key={s.id}
              className={`bg-white rounded-xs p-4 border transition-all flex flex-col justify-between ${
                s.active ? 'border-[#DCD4C9] hover:border-[#18231C] shadow-2xs' : 'border-neutral-200 opacity-60 bg-neutral-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-sm text-[#18231C] block">{s.name}</span>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs mt-0.5 bg-neutral-100 text-neutral-800 border border-neutral-200">
                      Rol: {s.role === 'admin' ? 'Super Admin' : s.role === 'local' ? 'Encargado de Sucursal' : 'Vendedor'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-950 border border-amber-300">
                    Local {s.branch}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600 mt-3 pt-2 border-t border-neutral-100">
                  {s.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </p>
                  )}
                  {s.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{s.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons with strict RBAC */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between mt-4">
                {activeRole !== 'vendedor' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleActive(s.id)}
                    className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                  >
                    {s.active ? 'Desactivar' : 'Activar'}
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Ficha Activa
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(s)}
                    className="p-1.5 rounded-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer"
                    title="Editar datos"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {activeRole !== 'vendedor' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-xs bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Crear / Editar Vendedor */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm uppercase text-[#18231C]">
                {isEditing ? 'Editar Datos de Vendedor' : 'Alta de Nuevo Vendedor'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Carolina"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Local / Sucursal Asignada</label>
                {activeRole === 'local' ? (
                  <input
                    type="text"
                    disabled
                    value={`Sucursal ${currentBranchContext} (Bloqueada por tu rol de encargado)`}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-neutral-100 text-neutral-700 font-bold"
                  />
                ) : (
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Teléfono / WhatsApp de Ventas</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="261 498-5544"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              {activeRole === 'admin' && (
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Rol / Jerarquía RBAC</label>
                  <select
                    value={sellerRole}
                    onChange={(e) => setSellerRole(e.target.value as StaffRole)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold"
                  >
                    <option value="vendedor">Vendedor (Solo ve y edita su propio perfil)</option>
                    <option value="local">Encargado de Sucursal (Ve y gestiona todo su local)</option>
                    <option value="admin">Administrador (Control total de todos los locales)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 text-neutral-600 hover:text-black"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase rounded-xs"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
