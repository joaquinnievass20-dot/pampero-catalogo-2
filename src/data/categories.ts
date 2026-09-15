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

export const CATEGORY_HIERARCHY: CategoryStructure[] = [
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
    description: 'Equipamiento mayorista para empresas, petroleras, minería, construcción y servicios.',
    sections: [
      {
        name: 'Empresas & Dotaciones',
        subCategories: ['Camisas', 'Pantalones', 'Calzado', 'Impermeables', 'Abrigos', 'Seguridad'],
      },
    ],
  },
];

export function sanitizeCategory(rawCat: any): MainCategory {
  if (rawCat === 'Mujer' || rawCat === '1' || rawCat === 1) return 'Mujer';
  if (rawCat === 'Infantil' || rawCat === '2' || rawCat === 2) return 'Infantil';
  if (rawCat === 'Venta Corporativa' || rawCat === '3' || rawCat === 3) return 'Venta Corporativa';
  const s = String(rawCat || '').toLowerCase();
  if (s.includes('mujer')) return 'Mujer';
  if (s.includes('infan') || s.includes('niñ')) return 'Infantil';
  if (s.includes('corp') || s.includes('venta')) return 'Venta Corporativa';
  return 'Hombre';
}
