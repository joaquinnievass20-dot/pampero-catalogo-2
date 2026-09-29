import { MainCategory } from '../types';

export interface SectionDef {
  name: string;
  subCategories: string[];
}

export interface CategoryStructure {
  name: MainCategory;
  description: string;
  sections: SectionDef[];
}

export const INITIAL_CATEGORY_HIERARCHY: CategoryStructure[] = [
  {
    name: 'Hombre',
    description: 'Línea masculina: resistencia Pampero para el trabajo rudo, el campo y la ciudad.',
    sections: [
      {
        name: 'Urbano',
        subCategories: ['Abrigos', 'Pantalones y bermudas', 'Camisas', 'Remeras', 'Calzado', 'Ver Todo'],
      },
      {
        name: 'Industria',
        subCategories: [
          'Abrigos',
          'Remeras y Camisas',
          'Pantalones y Bermudas',
          'Impermeables',
          'Indumentaria profesional',
          'Elementos de Protección',
          'Calzado',
        ],
      },
      {
        name: 'Accesorios',
        subCategories: [
          'Bolsos y mochilas',
          'Billeteras y Cintos',
          'Complementos de Aventura',
          'Ropa interior y medias',
          'Sombreros gorros y boinas',
          'Hogar',
          'Bolsos Estancos',
        ],
      },
      {
        name: 'Aventura',
        subCategories: ['Complementos', 'Mochilas y Bolsos', 'Indumentaria', 'Calzado'],
      },
      {
        name: 'Rural',
        subCategories: ['Bombachas', 'Partes de arriba', 'Calzado', 'Boinas y Fajas'],
      },
    ],
  },
  {
    name: 'Mujer',
    description: 'Línea femenina: corte ergonómico, durabilidad superior y estilo versátil.',
    sections: [
      {
        name: 'Urbano',
        subCategories: ['Camperas y Sacos', 'Pantalones y Bermudas', 'Sweaters y Buzos', 'Camisas y Blusas', 'Remeras y Calzado'],
      },
      {
        name: 'Industria',
        subCategories: ['Indumentaria y Calzado'],
      },
      {
        name: 'Accesorios',
        subCategories: [
          'Aros, Collares y Pulseras',
          'Bolsos y Carteras',
          'Billeteras y Cintos',
          'Sombreros, Gorros y Boinas',
          'Hogar',
          'Bolsos Estancos',
        ],
      },
      {
        name: 'Aventura',
        subCategories: ['Complementos', 'Bolsos y Mochilas', 'Indumentaria', 'Calzado'],
      },
      {
        name: 'Rural',
        subCategories: ['Bombachas', 'Partes de arriba', 'Calzado', 'Boinas y Fajas'],
      },
    ],
  },
  {
    name: 'Infantil',
    description: 'Línea infantil y escolar: máxima resistencia para niños activos y vuelta al cole.',
    sections: [
      {
        name: 'Línea Niños',
        subCategories: ['Vuelta al cole', 'Colección', 'Calzado'],
      },
    ],
  },
  {
    name: 'Venta Corporativa',
    description: 'Equipamiento corporativo para empresas, petroleras, minería, construcción y servicios.',
    sections: [
      {
        name: 'Empresas & Dotaciones',
        subCategories: ['Camisas', 'Pantalones', 'Calzado', 'Impermeables', 'Abrigos', 'Seguridad'],
      },
      {
        name: 'Industria',
        subCategories: [
          'Abrigos',
          'Remeras y Camisas',
          'Pantalones y Bermudas',
          'Impermeables',
          'Indumentaria profesional',
          'Elementos de Protección',
          'Calzado',
        ],
      },
    ],
  },
];

export const CATEGORY_HIERARCHY: CategoryStructure[] = INITIAL_CATEGORY_HIERARCHY;

export function loadStoredCategoryHierarchy(): CategoryStructure[] {
  if (typeof window === 'undefined') return INITIAL_CATEGORY_HIERARCHY;
  try {
    const raw = localStorage.getItem('pampero_category_hierarchy');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored category hierarchy', e);
  }
  return INITIAL_CATEGORY_HIERARCHY;
}

export function saveStoredCategoryHierarchy(newHierarchy: CategoryStructure[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('pampero_category_hierarchy', JSON.stringify(newHierarchy));
    window.dispatchEvent(new CustomEvent('pampero_categories_updated', { detail: newHierarchy }));
  } catch (e) {
    console.error('Error saving stored category hierarchy', e);
  }
}


export function sanitizeCategory(rawCat: any): MainCategory {
  if (rawCat === undefined || rawCat === null) return '' as MainCategory;
  const str = String(rawCat).trim();
  if (!str) return '' as MainCategory;
  if (str === 'Mujer' || str === '1') return 'Mujer';
  if (str === 'Infantil' || str === '2') return 'Infantil';
  if (str === 'Venta Corporativa' || str === '3') return 'Venta Corporativa';
  if (str === 'Hombre') return 'Hombre';
  const s = str.toLowerCase();
  if (s.includes('mujer')) return 'Mujer';
  if (s.includes('infan') || s.includes('niñ')) return 'Infantil';
  if (s.includes('corp') || s.includes('venta')) return 'Venta Corporativa';
  if (s.includes('hombre')) return 'Hombre';
  return str as MainCategory;
}
