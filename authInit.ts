import { RegisteredUser } from '../types';

export const MASTER_ADMIN_EMAIL = 'admin@pamperogm.com.ar';
export const MASTER_ADMIN_PASSWORD = 'Pampero2026';
export const MASTER_ADMIN_ROLE = 'admin' as const;

export const MASTER_ADMIN_USER: RegisteredUser = {
  id: 'admin-master',
  type: 'admin',
  name: 'Administrador General Pampero',
  repName: 'Administración Pampero Gran Mendoza',
  email: 'admin@pamperogm.com.ar',
  phone: '2614980000',
  cuitOrDni: '30-11223344-9',
  address: 'Av. San Martín 1234',
  city: 'Gran Mendoza',
  createdAt: '2026-01-01',
  status: 'active',
  pricingTier: 'Corporativo / Mayorista',
  notes: 'Cuenta administradora maestra del sistema Pampero Gran Mendoza.',
};

/**
 * Ensures the Master Admin credentials and account are ALWAYS present
 * in localStorage and user lists on startup, even on fresh deployments (e.g. Vercel).
 */
export function ensureMasterAdminInitialized(): RegisteredUser[] {
  // 1. Ensure master admin credentials in localStorage
  try {
    const credsStr = localStorage.getItem('pampero_admin_credentials');
    let needsUpdate = false;
    let creds: any = {};
    if (credsStr) {
      try {
        creds = JSON.parse(credsStr);
      } catch {
        creds = {};
      }
    }
    
    // Always update if missing or if still set to the legacy admin email
    if (
      !creds || 
      !creds.email || 
      !creds.password || 
      creds.email.toLowerCase().trim() === 'admin@pampero.com' ||
      creds.email.toLowerCase().trim() === 'admin@pampero.com.ar'
    ) {
      needsUpdate = true;
    }
    
    if (needsUpdate || !credsStr) {
      localStorage.setItem(
        'pampero_admin_credentials',
        JSON.stringify({
          email: MASTER_ADMIN_EMAIL,
          password: MASTER_ADMIN_PASSWORD,
          role: MASTER_ADMIN_ROLE,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  } catch (e) {
    console.warn('[AUTH INIT] Could not write pampero_admin_credentials:', e);
  }

  // 2. Ensure pampero_registered_users contains the Master Admin
  let users: RegisteredUser[] = [];
  try {
    const stored = localStorage.getItem('pampero_registered_users');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        users = parsed;
      }
    }
  } catch (e) {
    users = [];
  }

  // Filter out any legacy admin@pampero.com entries
  users = users.filter(
    (u) => u.email?.toLowerCase().trim() !== 'admin@pampero.com' && u.email?.toLowerCase().trim() !== 'admin@pampero.com.ar'
  );

  // Check if master admin exists
  const hasMasterAdmin = users.some(
    (u) => u.email?.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase()
  );

  if (!hasMasterAdmin) {
    users = [MASTER_ADMIN_USER, ...users];
  } else {
    // Ensure it is set as admin
    users = users.map((u) => {
      if (u.email?.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase()) {
        return {
          ...u,
          type: 'admin',
          status: 'active',
        };
      }
      return u;
    });
  }

  try {
    localStorage.setItem('pampero_registered_users', JSON.stringify(users));
  } catch {}

  return users;
}
