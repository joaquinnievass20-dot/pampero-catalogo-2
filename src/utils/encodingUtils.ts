/**
 * Utility functions for UTF-8 encoding repair and sanitization.
 * Fixes Mojibake and corrupt characters (e.g. "REUNIÃ³N" -> "REUNIÓN", "SEÃ±A" -> "SEÑA")
 * across Kanban boards, cards, and CRM cost reports.
 */

export function fixUtf8Encoding(input: any): string {
  if (input === null || input === undefined) return '';
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? '' : input.toISOString().split('T')[0];
  }
  if (typeof input === 'object') {
    if (typeof input.toDate === 'function') {
      try {
        const d = input.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      } catch {
        return '';
      }
    }
    return '';
  }

  let s = typeof input === 'string' ? input : String(input);
  if (!s) return '';

  // Specific common CRM corrupted patterns
  s = s
    .replace(/REUNI[ÃA\u00C3\u00C2]?[³óÓO]N/gi, 'REUNIÓN')
    .replace(/SE[ÃA\u00C3\u00C2]?[±ñÑ]A/gi, 'SEÑA')
    .replace(/Presentaci[ÃA\u00C3\u00C2]?[³óÓO]n/gi, 'Presentación')
    .replace(/Cotizaci[ÃA\u00C3\u00C2]?[³óÓO]n/gi, 'Cotización')
    .replace(/Producci[ÃA\u00C3\u00C2]?[³óÓO]n/gi, 'Producción')
    .replace(/Atenci[ÃA\u00C3\u00C2]?[³óÓO]n/gi, 'Atención')
    .replace(/Maip[ÃA\u00C3\u00C2]?[ºuúÚ]/gi, 'Maipú')
    .replace(/Luj[ÃA\u00C3\u00C2]?[¡aáÁ]n/gi, 'Luján')
    .replace(/Itat[ÃA\u00C3\u00C2]?[­iíÍ]/gi, 'Itatí');

  // Double UTF-8 encoded sequences (Mojibake)
  s = s
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã /g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã /g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Â°/g, '°')
    .replace(/Â¿/g, '¿')
    .replace(/Â¡/g, '¡');

  // Generic double-encoding attempt if any suspicious prefix remains
  if (/[\u00C2\u00C3]/.test(s)) {
    try {
      s = decodeURIComponent(escape(s));
    } catch {}
  }

  return s;
}

export function sanitizeObjectEncoding<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (obj instanceof Date) {
    return (isNaN(obj.getTime()) ? '' : obj.toISOString()) as unknown as T;
  }

  if (typeof (obj as any).toDate === 'function') {
    try {
      const d = (obj as any).toDate();
      return (d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : '') as unknown as T;
    } catch {
      return '' as unknown as T;
    }
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectEncoding(item)) as unknown as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = fixUtf8Encoding(value);
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObjectEncoding(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
