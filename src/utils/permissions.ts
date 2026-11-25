import { EmployeeAccount, UserSession } from '../types';

export interface AdminPanelTabDefinition {
  key: string;
  label: string;
  category: string;
  description: string;
}

export const ADMIN_PANEL_TAB_DEFINITIONS: AdminPanelTabDefinition[] = [
  // Catálogo & Productos
  { key: 'products', label: 'Productos & SKU', category: 'Catálogo & Productos', description: 'Crear, editar y eliminar artículos del catálogo' },
  { key: 'variants', label: 'Talles & Especiales', category: 'Catálogo & Productos', description: 'Colores, talles estándar y rangos especiales' },
  { key: 'categories', label: 'Categorías y Árbol', category: 'Catálogo & Productos', description: 'Secciones y subcategorías de tienda' },
  { key: 'mass_images', label: 'Carga Masiva Fotos', category: 'Catálogo & Productos', description: 'Subida y asignación masiva de imágenes' },
  { key: 'lookbook', label: 'Lookbook & Estilos', category: 'Catálogo & Productos', description: 'Campañas interactivas con puntos de compra' },
  { key: 'uniform_simulator', label: 'Simulador Dotación', category: 'Catálogo & Productos', description: 'Configuración del armador de uniformes' },

  // Ventas & Operaciones
  { key: 'promos', label: 'Promociones & Banners', category: 'Ventas & Operaciones', description: 'Banners principales y descuentos promocionales' },
  { key: 'calendar', label: 'Calendario, Feriados & Banners', category: 'Ventas & Operaciones', description: 'Feriados, fechas comerciales y activación central' },
  { key: 'coupons', label: 'Cupones de Descuento', category: 'Ventas & Operaciones', description: 'Códigos promocionales y reglas de uso' },
  { key: 'quotes', label: 'Solicitudes y Cotizaciones', category: 'Ventas & Operaciones', description: 'Bandeja de cotizaciones web recibidas' },
  { key: 'kanban_config', label: 'CRM & Etapas Kanban', category: 'Ventas & Operaciones', description: 'Columnas, plantillas de tareas y etiquetas' },
  { key: 'branches', label: 'Sucursales Mendoza', category: 'Ventas & Operaciones', description: 'Locales, direcciones y horarios de atención' },

  // RRHH & Personal
  { key: 'rrhh_admin', label: 'RRHH, Legajos y Horarios', category: 'RRHH & Personal', description: 'Legajos, horarios por local, vacaciones y fichajes GPS' },

  // Finanzas & Costos
  { key: 'prices', label: 'Precios & Descuentos', category: 'Finanzas & Costos', description: 'Listas de precios, Excel y descuentos por volumen' },
  { key: 'cost_categories', label: 'Categorías de Costo', category: 'Finanzas & Costos', description: 'Rubros de costos fijos y variables' },

  // Configuración del Sitio
  { key: 'theme', label: 'Logo & Estilos Visuales', category: 'Configuración del Sitio', description: 'Colores, tipografía, logo y editor visual' },
  { key: 'site_texts', label: 'Textos de la Interfaz', category: 'Configuración del Sitio', description: 'Edición de títulos, botones y mensajes' },
  { key: 'sizing_portal', label: 'Portal Curva de Talles', category: 'Configuración del Sitio', description: 'Configuración de relevamiento corporativo' },
  { key: 'notifications', label: 'Notificaciones', category: 'Configuración del Sitio', description: 'Reglas de alertas y recordatorios CRM' },

  // Usuarios & Seguridad
  { key: 'users', label: 'Usuarios & Clientes', category: 'Usuarios & Seguridad', description: 'Cuentas registradas, clientes y vendedores' },
  { key: 'permissions', label: 'Permisos & Roles', category: 'Usuarios & Seguridad', description: 'Matriz de acceso a CRM, RRHH y Panel de Control' },
  { key: 'security', label: 'Seguridad & 2FA', category: 'Usuarios & Seguridad', description: 'Configuración de autenticación y claves' },

  // Auditoría & Analítica
  { key: 'audit_logs', label: 'Registro de Auditoría', category: 'Auditoría & Analítica', description: 'Historial completo de acciones del sistema' },
  { key: 'analytics', label: 'Métricas & Estadísticas', category: 'Auditoría & Analítica', description: 'Búsquedas, clics y rendimiento comercial' },
];

export const ADMIN_PANEL_TAB_KEYS = new Set(ADMIN_PANEL_TAB_DEFINITIONS.map((t) => t.key));

export function resolveEmployeeRecord(userSession: UserSession | null | undefined): EmployeeAccount | null {
  if (!userSession || userSession.role !== 'employee') return null;
  try {
    const saved = localStorage.getItem('pampero_employees');
    if (saved) {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) {
        const cleanEmail = (userSession.email || '').toLowerCase().trim();
        const found = list.find(
          (e: any) =>
            (cleanEmail && (e.email || '').toLowerCase().trim() === cleanEmail) ||
            (userSession.id && e.id === userSession.id)
        );
        if (found) return found as EmployeeAccount;
      }
    }
  } catch {}
  return null;
}

export function getEmployeePanelTabs(userSession: UserSession | null | undefined): string[] {
  if (!userSession) return [];
  if (userSession.role === 'admin') {
    return ADMIN_PANEL_TAB_DEFINITIONS.map((t) => t.key);
  }
  if (userSession.role !== 'employee') return [];

  const emp = resolveEmployeeRecord(userSession);
  const isConfigured = Boolean(emp?.panelTabsConfigured || userSession.panelTabsConfigured);
  const rawTabs = emp?.allowedTabs || userSession.allowedTabs;

  // Si aún no fue configurado explícitamente desde Permisos, ningún empleado hereda acceso al Panel de Control por defecto
  if (!isConfigured) {
    return [];
  }

  if (!Array.isArray(rawTabs)) return [];
  return rawTabs.filter((t) => ADMIN_PANEL_TAB_KEYS.has(t));
}

export function hasAdminPanelAccess(userSession: UserSession | null | undefined): boolean {
  if (!userSession) return false;
  if (userSession.role === 'admin') return true;
  if (userSession.role !== 'employee') return false;
  return getEmployeePanelTabs(userSession).length > 0;
}

export function hasCRMAccess(userSession: UserSession | null | undefined): boolean {
  if (!userSession) return false;
  if (userSession.role === 'admin') return true;
  if (userSession.role !== 'employee') return false;
  const emp = resolveEmployeeRecord(userSession);
  if (emp) {
    if (Array.isArray(emp.crmTabs) && emp.crmTabs.length > 0) return true;
    if (Array.isArray(emp.crmTabs) && emp.crmTabs.length === 0 && (emp.crmTasksConfigured || emp.crmCalendarConfigured)) {
      return false;
    }
    if (Array.isArray(emp.allowedTabs)) return emp.allowedTabs.includes('crm');
  }
  if (Array.isArray(userSession.allowedTabs)) {
    return userSession.allowedTabs.includes('crm');
  }
  return true;
}

export function hasRRHHAccess(userSession: UserSession | null | undefined): boolean {
  if (!userSession) return false;
  if (userSession.role === 'admin') return true;
  if (userSession.role !== 'employee') return false;
  const emp = resolveEmployeeRecord(userSession);
  const rawTabs = emp?.allowedTabs || userSession.allowedTabs || [];
  const panelTabs = getEmployeePanelTabs(userSession);
  return Boolean(
    rawTabs.includes('rrhh') ||
      emp?.canManageRRHH ||
      userSession.canManageRRHH ||
      panelTabs.includes('rrhh_admin')
  );
}

export function canManageRRHH(userSession: UserSession | null | undefined): boolean {
  if (!userSession) return false;
  if (userSession.role === 'admin') return true;
  if (userSession.role !== 'employee') return false;
  const emp = resolveEmployeeRecord(userSession);
  if (emp?.canManageRRHH || userSession.canManageRRHH) return true;
  const panelTabs = getEmployeePanelTabs(userSession);
  return panelTabs.includes('rrhh_admin');
}

/**
 * Acceso al Módulo independiente de Costos & Finanzas (Dashboard, Cheques, Caja Chica).
 * Restringido exclusivamente a Administradores o empleados/encargados explícitamente autorizados con 'costs' en allowedTabs.
 */
export function hasCostsAccess(userSession: UserSession | null | undefined): boolean {
  if (!userSession) return false;
  if (userSession.role === 'admin') return true;
  if (userSession.role !== 'employee') return false;
  const emp = resolveEmployeeRecord(userSession);
  const rawTabs = emp?.allowedTabs || userSession.allowedTabs || [];
  return Array.isArray(rawTabs) && rawTabs.includes('costs');
}
