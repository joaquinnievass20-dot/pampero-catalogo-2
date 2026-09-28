import React, { useState } from 'react';
import { Seller, BranchLocation } from '../../types';
import { Users, Plus, Trash2, Edit3, Check, X, Phone, Building2, UserCheck, Shield } from 'lucide-react';

interface AdminSellersTabProps {
  branches: BranchLocation[];
  triggerSaveNotice: () => void;
}

export const INITIAL_SELLERS: Seller[] = [
  { id: 'sel-1', name: 'Itatí', branch: 'Maipú', phone: '261 527-6713', active: true },
  { id: 'sel-2', name: 'Guada', branch: 'Ciudad', phone: '261 423-1122', active: true },
  { id: 'sel-3', name: 'Carolina', branch: 'Luján', phone: '261 498-5544', active: true },
  { id: 'sel-4', name: 'Gustavo', branch: 'Maipú', phone: '261 527-6713', active: true },
];

export const AdminSellersTab: React.FC<AdminSellersTabProps> = ({ branches, triggerSaveNotice }) => {
  const [sellers, setSellers] = useState<Seller[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_sellers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SELLERS;
  });

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState(branches[0]?.name || 'Maipú');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const saveToStorage = (newList: Seller[]) => {
    setSellers(newList);
    try {
      localStorage.setItem('pampero_sellers', JSON.stringify(newList));
    } catch {}
    triggerSaveNotice();
  };

  const handleOpenCreate = () => {
    setIsEditing(null);
    setName('');
    setBranch(branches[0]?.name || 'Maipú');
    setPhone('');
    setEmail('');
    setShowModal(true);
  };

  const handleOpenEdit = (seller: Seller) => {
    setIsEditing(seller.id);
    setName(seller.name);
    setBranch(seller.branch || branches[0]?.name || 'Maipú');
    setPhone(seller.phone || '');
    setEmail(seller.email || '');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing) {
      const updated = sellers.map((s) =>
        s.id === isEditing
          ? { ...s, name: name.trim(), branch, phone: phone.trim(), email: email.trim() }
          : s
      );
      saveToStorage(updated);
    } else {
      const newSeller: Seller = {
        id: `seller-${Date.now()}`,
        name: name.trim(),
        branch,
        phone: phone.trim(),
        email: email.trim(),
        active: true,
      };
      saveToStorage([...sellers, newSeller]);
    }
    setShowModal(false);
  };

  const handleToggleActive = (id: string) => {
    const updated = sellers.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    saveToStorage(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseás eliminar este vendedor de la lista?')) {
      const updated = sellers.filter((s) => s.id !== id);
      saveToStorage(updated);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCD4C9]">
        <div>
          <h3 className="font-display text-base sm:text-lg uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B9522F]" />
            <span>Vendedores & Asignación de Locales ({sellers.length})</span>
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Definí la nómina oficial de vendedores por sucursal. Estos nombres se asignan a pedidos en el CRM y permiten restringir la vista a cada cuenta.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Nuevo Vendedor</span>
        </button>
      </div>

      {/* Sellers List Table */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#18231C] text-[#F5F2EC] uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Nombre Vendedor</th>
              <th className="p-3">Sucursal / Local Asignado</th>
              <th className="p-3">Teléfono / WhatsApp</th>
              <th className="p-3">Email</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCD4C9]">
            {sellers.map((s) => (
              <tr key={s.id} className="hover:bg-[#FAF8F5]">
                <td className="p-3 font-bold text-[#18231C] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{s.name}</span>
                </td>
                <td className="p-3 text-[#18231C]">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9]">
                    <Building2 className="w-3 h-3 text-[#B9522F]" />
                    {s.branch || 'Sin sucursal'}
                  </span>
                </td>
                <td className="p-3 font-mono text-[#6F6860]">{s.phone || '—'}</td>
                <td className="p-3 text-[#6F6860]">{s.email || '—'}</td>
                <td className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(s.id)}
                    className={`px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                      s.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-300'
                    }`}
                  >
                    {s.active ? '● Activo' : '○ Inactivo'}
                  </button>
                </td>
                <td className="p-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(s)}
                      className="p-1 text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                      title="Editar vendedor"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="p-1 text-[#6F6860] hover:text-red-600 cursor-pointer"
                      title="Eliminar vendedor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal / Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#18231C] p-4 text-white flex items-center justify-between">
              <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                {isEditing ? 'Editar Vendedor' : 'Registrar Nuevo Vendedor'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                  Nombre Completo / Apodo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Itatí / Gustavo / Carolina"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                  Sucursal Asignada *
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs outline-none bg-white cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.city || 'Mendoza'})
                    </option>
                  ))}
                  <option value="Todas">Todas las sucursales (Supervisor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                  Teléfono / WhatsApp Directo
                </label>
                <input
                  type="text"
                  placeholder="ej: 261 527-6713"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                  Correo Electrónico (opcional)
                </label>
                <input
                  type="email"
                  placeholder="vendedor@pamperomaipu.com.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-[#DCD4C9] text-xs font-semibold rounded-xs hover:bg-neutral-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18231C] text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-black"
                >
                  {isEditing ? 'Guardar Cambios' : 'Registrar Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
