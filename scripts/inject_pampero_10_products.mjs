// scripts/inject_pampero_10_products.mjs
import fs from 'fs';

const REAL_PAMPERO_PRODUCTS = [
  {
    id: "pam-bom-001",
    code: "PAM-BOM-001",
    name: "Bombacha de Campo Pampero Tradicional Olivera",
    category: "Hombre",
    section: "Rural",
    subCategory: "Bombachas",
    description: "La auténtica bombacha de campo Pampero confeccionada bajo estrictas normas de resistencia rural. Gabardina pesada 100% algodón de sarga reforzada, tiro alto tradicional con botones en botamanga para regular ajuste sobre la bota.",
    features: [
      "Tejido 100% algodón sarga pesada 8 oz de máxima durabilidad",
      "Triple costura de cadeneta en laterales y entrepiernas",
      "Botamanga clásica regulable con botones reforzados",
      "Pasacintos anchos aptos para cinto criollo o rastra",
      "Bolsillo relojero frontal y dos bolsillos ojal traseros con botón"
    ],
    price: 48500,
    corporatePrice: 41225,
    discountPercentage: 15,
    promotionTag: "Línea Campo Tradición",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Beige", "Verde Oliva", "Azul Marino", "Negro"],
    availableSizes: ["38", "40", "42", "44", "46", "48", "50", "52", "54"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: true
  },
  {
    id: "pam-bom-002",
    code: "PAM-BOM-002",
    name: "Bombacha Pampero Zelaya Denim Reforzada",
    category: "Hombre",
    section: "Rural",
    subCategory: "Bombachas",
    description: "Versión moderna en denim de alta tenacidad que fusiona la comodidad del jean con el corte campero tradicional. Desarrollada para resistir jornadas intensas en bodega, campo y talleres mecánicos.",
    features: [
      "Denim 100% algodón 12 oz prelavado con proceso sanforizado",
      "Remaches de latón oxidado en esquinas de bolsillos",
      "Cintura anatómica forrada para evitar rozaduras",
      "Costuras a contratono con hilado de alta resistencia al desgarro"
    ],
    price: 52900,
    corporatePrice: 44965,
    discountPercentage: 15,
    promotionTag: "Lanzamiento 2026",
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582552938357-32b906df40cb?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Azul Índigo", "Azul Oscuro", "Negro Lavado"],
    availableSizes: ["38", "40", "42", "44", "46", "48", "50", "52"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: true
  },
  {
    id: "pam-cal-001",
    code: "PAM-CAL-001",
    name: "Botín de Seguridad Pampero Tronador Puntera Acero",
    category: "Venta Corporativa",
    section: "Industria",
    subCategory: "Calzado de Seguridad",
    description: "Botín de seguridad para faena pesada e industria. Fabricado con cuero vacuno flor seleccionado, puntera de acero certificada IRAM 3610 y suela de poliuretano bidensidad inyectada directamente al corte.",
    features: [
      "Puntera de acero templado resistente a impactos de 200 Joules",
      "Cuero flor de primera calidad con tratamiento hidrófugo repelente de aceites",
      "Suela de poliuretano bidensidad antideslizante con estrías autolimpiantes",
      "Plantilla anatómica antimicótica con arco de descanso",
      "Certificación IRAM 3610 / Sello S Seguridad Argentina"
    ],
    price: 89900,
    corporatePrice: 76415,
    discountPercentage: 15,
    promotionTag: "Norma IRAM 3610",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Negro", "Marrón Petróleo"],
    availableSizes: ["38", "39", "40", "41", "42", "43", "44", "45", "46"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: true
  },
  {
    id: "pam-cal-002",
    code: "PAM-CAL-002",
    name: "Borceguí Pampero Leñador 5909 Cuero Engrasado",
    category: "Hombre",
    section: "Industria",
    subCategory: "Calzado de Seguridad",
    description: "Borceguí de caña alta diseñado para trabajos en forestación, viñedos de montaña y terrenos irregulares. Confeccionado en cuero vacuno engrasado de 2.2 mm de espesor y cuello acolchado.",
    features: [
      "Cuero engrasado de alta absorción de choque mecánico",
      "Cuello y fuelle acolchados en vaqueta para ajuste suave al tobillo",
      "Ganchos pasacordón de bronce fundido pavonado antioxidante",
      "Suela cosida 360° de caucho nitrilo de alta resistencia a la tracción"
    ],
    price: 98500,
    corporatePrice: 83725,
    discountPercentage: 15,
    promotionTag: "Uso Extremo",
    image: "https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Marrón Chocolate", "Suela Tostado", "Negro"],
    availableSizes: ["39", "40", "41", "42", "43", "44", "45"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: true
  },
  {
    id: "pam-cal-003",
    code: "PAM-CAL-003",
    name: "Borceguí Pampero Orma Trabajo Pesado",
    category: "Hombre",
    section: "Industria",
    subCategory: "Calzado de Seguridad",
    description: "Calzado robusto de diseño ergonómico para uso continuo en logística, minería y metalúrgica. Brinda soporte óptimo en el arco plantar y protección contra impactos mecánicos.",
    features: [
      "Forro interno textil termorregulador transpirable",
      "Talón reforzado con cámara de aire para absorción de impacto anti-fatiga",
      "Tratamiento hidrorrepelente para tareas en ambientes húmedos",
      "Cordones trenzados de alta tenacidad con alma de poliamida"
    ],
    price: 94000,
    corporatePrice: 79900,
    discountPercentage: 15,
    promotionTag: "Línea Operativa",
    image: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Negro", "Gris Plomo"],
    availableSizes: ["39", "40", "41", "42", "43", "44", "45", "46"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: false
  },
  {
    id: "pam-cal-004",
    code: "PAM-CAL-004",
    name: "Zapato Pampero Clásico 1609 Suela Dieléctrica",
    category: "Hombre",
    section: "Industria",
    subCategory: "Calzado de Seguridad",
    description: "Zapato de trabajo de caña baja con propiedades dieléctricas para electricistas, operarios de subestaciones y mantenimiento industrial.",
    features: [
      "Suela dieléctrica sin componentes metálicos expuestos",
      "Resistencia certificada de aislación eléctrica hasta 1000V",
      "Horma amplia anatómica para jornadas completas de pie",
      "Plantilla interior extraíble lavable"
    ],
    price: 78500,
    corporatePrice: 66725,
    discountPercentage: 15,
    promotionTag: "Dieléctrico",
    image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Negro"],
    availableSizes: ["38", "39", "40", "41", "42", "43", "44", "45"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: false
  },
  {
    id: "pam-cam-001",
    code: "PAM-CAM-001",
    name: "Camisa de Trabajo Pampero Soler Gabardina",
    category: "Hombre",
    section: "Industria",
    subCategory: "Camisas de Trabajo",
    description: "La camisa de trabajo insigne de Pampero. Gabardina 100% algodón sarga pesada 6 oz mercerizada. Confeccionada con costura doble en todas las uniones y cartera con división portabirome.",
    features: [
      "Sarga de gabardina 100% algodón mercerizado 6 oz",
      "Dos bolsillos delanteros con cartera y botón de seguridad",
      "Bolsillo izquierdo con ranura especial portabirome/herramienta",
      "Canesú con fuelle trasero para amplitud de movimiento de brazos",
      "Botones termosellados irrompibles con hilo al tono"
    ],
    price: 41200,
    corporatePrice: 35020,
    discountPercentage: 15,
    promotionTag: "Clásico Pampero",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Azul Marino", "Verde Oliva", "Beige Arena", "Gris Topo", "Naranja"],
    availableSizes: ["38", "40", "42", "44", "46", "48", "50", "52"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: true
  },
  {
    id: "pam-cam-002",
    code: "PAM-CAM-002",
    name: "Camisa Pampero Maizani Denim Trabajo",
    category: "Hombre",
    section: "Urbano",
    subCategory: "Camisas",
    description: "Camisa confeccionada en tela denim liviana de 6.5 oz con lavado stone wash suave. Diseñada para personal de campo, atención comercial técnica y uniforme corporativo moderno.",
    features: [
      "Denim 100% algodón 6.5 oz suavizado al tacto",
      "Broches metálicos a presión tipo perla resistentes",
      "Canesú delantero y trasero estilo campero tradicional",
      "Puños regulables con doble botón a presión"
    ],
    price: 45800,
    corporatePrice: 38930,
    discountPercentage: 15,
    promotionTag: "Línea Denim",
    image: "https://images.unsplash.com/photo-1578932750294-f5075e85f44a?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1578932750294-f5075e85f44a?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1589310243389-96a5483213a8?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Azul Índigo Lavado", "Azul Oscuro"],
    availableSizes: ["S", "M", "L", "XL", "XXL", "XXXL"],
    sizeType: "letters",
    inStock: true,
    isFeatured: false
  },
  {
    id: "pam-cam-003",
    code: "PAM-CAM-003",
    name: "Camisa Pampero Soler Oxford Cuello Inglés",
    category: "Hombre",
    section: "Urbano",
    subCategory: "Camisas",
    description: "Camisa formal para líneas de supervisión, directivos de planta y oficinas técnicas. Confección Oxford de hilado fino peinado con tratamiento anti-arrugas para fácil planchado.",
    features: [
      "Tela Oxford peinada 70% algodón / 30% poliéster",
      "Cuello estructurado resistente al quiebre",
      "Bolsillo plaqué frontal discreto en el pecho",
      "Corte regular fit ergonómico de máxima elegancia"
    ],
    price: 39500,
    corporatePrice: 33575,
    discountPercentage: 15,
    promotionTag: "Corporativo",
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Celeste Oxford", "Blanco Puro", "Azul Francia"],
    availableSizes: ["38", "40", "42", "44", "46", "48", "50"],
    sizeType: "numbers",
    inStock: true,
    isFeatured: false
  },
  {
    id: "pam-abr-001",
    code: "PAM-ABR-001",
    name: "Campera Pampero Ciré Rural Térmica Acolchada",
    category: "Hombre",
    section: "Rural",
    subCategory: "Abrigos",
    description: "Campera ultraliviana térmica para bajas temperaturas en viñedos y campo abierto. Tejido ciré microporoso impermeable y relleno de fibra siliconada térmica de alto rendimiento.",
    features: [
      "Exterior ciré repelente al viento y rocío matutino",
      "Acolchado térmico siliconado de 150 gramos por metro cuadrado",
      "Cierre frontal diente de perro reforzado con tirador ergonómico",
      "Bolsillos laterales con cremallera y dos bolsillos internos para celular o libreta",
      "Puños y cintura elásticos para retención de calor corporal"
    ],
    price: 84000,
    corporatePrice: 71400,
    discountPercentage: 15,
    promotionTag: "Térmica Ultraliviana",
    image: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=1000&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=1000&auto=format&fit=crop"
    ],
    availableColors: ["Negro", "Azul Marino", "Verde Militar", "Bordeaux"],
    availableSizes: ["S", "M", "L", "XL", "XXL", "XXXL"],
    sizeType: "letters",
    inStock: true,
    isFeatured: true
  }
];

// 1. Update data_storage/products.json
const productsPath = 'data_storage/products.json';
let existing = [];
try {
  if (fs.existsSync(productsPath)) {
    existing = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  }
} catch (e) {
  console.error('Error reading products.json:', e);
}

// Remove duplicates of these codes if any
const newCodes = new Set(REAL_PAMPERO_PRODUCTS.map(p => p.code));
const filteredExisting = existing.filter(p => !newCodes.has(p.code));

// Put the 10 real Pampero items at the very top of catalog
const mergedProducts = [...REAL_PAMPERO_PRODUCTS, ...filteredExisting];
fs.writeFileSync(productsPath, JSON.stringify(mergedProducts, null, 2), 'utf-8');
console.log(`Successfully written ${mergedProducts.length} products to ${productsPath}`);
