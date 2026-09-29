export interface ParsedImageInfo {
  rawFileName: string;
  productCode: string;
  colorCode?: string;
  gender?: 'Hombre' | 'Mujer';
  position?: number;
}

/**
 * Parsea el nombre del archivo de imagen según la convención oficial Pampero:
 * código#código_color#género#posición
 * Ejemplos válidos:
 *   - "111108004#C1#Femenino#1.jpg"
 *   - "111108004#C1#Masculino#2.png"
 *   - "111108004#Hombre#1.webp"
 *   - "111108004#Mujer.jpg"
 *   - "111108004#1.jpg"
 *   - "111108004.jpg"
 */
export function parseImageFileName(fileName: string): ParsedImageInfo {
  const cleanName = fileName.replace(/\.[^/.]+$/, '').trim(); // Remove extension

  // 1. Split by '#' if present
  if (cleanName.includes('#')) {
    const parts = cleanName.split('#').map((p) => p.trim()).filter(Boolean);
    const productCode = parts[0] || '';
    let colorCode: string | undefined = undefined;
    let gender: 'Hombre' | 'Mujer' | undefined = undefined;
    let position: number | undefined = undefined;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const lower = part.toLowerCase();

      // Check if it's gender
      if (lower === 'femenino' || lower === 'mujer' || lower === 'fem' || lower === 'f') {
        gender = 'Mujer';
      } else if (lower === 'masculino' || lower === 'hombre' || lower === 'masc' || lower === 'h' || lower === 'm') {
        gender = 'Hombre';
      }
      // Check if it's position number
      else if (/^\d+$/.test(part)) {
        position = parseInt(part, 10);
      }
      // Otherwise consider it color code (e.g. C1, C01, AZUL, etc.)
      else if (!colorCode) {
        colorCode = part;
      }
    }

    return {
      rawFileName: fileName,
      productCode,
      colorCode,
      gender,
      position,
    };
  }

  // 2. Fallback: Split by '_' or '-' if standard separator not found
  const altParts = cleanName.split(/[_\-\s]+/).map((p) => p.trim()).filter(Boolean);
  const productCode = altParts[0] || cleanName;
  let gender: 'Hombre' | 'Mujer' | undefined = undefined;
  let position: number | undefined = undefined;

  for (let i = 1; i < altParts.length; i++) {
    const p = altParts[i].toLowerCase();
    if (p.includes('mujer') || p.includes('fem')) gender = 'Mujer';
    else if (p.includes('hombre') || p.includes('masc')) gender = 'Hombre';
    else if (/^\d+$/.test(altParts[i])) position = parseInt(altParts[i], 10);
  }

  return {
    rawFileName: fileName,
    productCode,
    gender,
    position,
  };
}
