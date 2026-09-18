import { track } from '@vercel/analytics';
import { Product } from '../types';

export interface FunnelMetrics {
  productClicks: number;
  cartAdditions: number;
  whatsappQuotes: number;
  lastUpdated: string;
}

const FUNNEL_STORAGE_KEY = 'pampero_funnel_analytics';

export function getLocalFunnelMetrics(): FunnelMetrics {
  if (typeof window === 'undefined') {
    return { productClicks: 0, cartAdditions: 0, whatsappQuotes: 0, lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(FUNNEL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return { productClicks: 0, cartAdditions: 0, whatsappQuotes: 0, lastUpdated: new Date().toISOString() };
}

function incrementFunnelStep(step: 'productClicks' | 'cartAdditions' | 'whatsappQuotes') {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalFunnelMetrics();
    current[step] = (current[step] || 0) + 1;
    current.lastUpdated = new Date().toISOString();
    localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

/**
 * 1. Evento: Clic en producto (para saber cuáles son los más vistos)
 */
export function trackProductClick(product: Partial<Product> & { id: string; name: string }, source: string = 'catalog_grid') {
  const payload = {
    productId: product.id,
    productCode: product.code || 'N/A',
    productName: product.name,
    category: String(product.category || 'General'),
    section: product.section || 'General',
    price: Number(product.price || 0),
    source,
  };

  try {
    track('product_click', payload);
  } catch (err) {
    console.warn('[Vercel Analytics] track product_click fallback:', err);
  }

  incrementFunnelStep('productClicks');

  // Also log event cleanly
  if (process.env.NODE_ENV !== 'production') {
    console.log('📊 [Vercel Analytics Event] product_click:', payload);
  }
}

/**
 * 2. Evento: Clic en "Agregar al Carrito"
 */
export function trackAddToCart(data: {
  product: Partial<Product> & { id: string; name: string; code?: string; price?: number; category?: string };
  quantity: number;
  size?: string;
  color?: string;
  unitPrice?: number;
}) {
  const finalPrice = data.unitPrice ?? data.product.price ?? 0;
  const payload = {
    productId: data.product.id,
    productCode: data.product.code || 'N/A',
    productName: data.product.name,
    category: String(data.product.category || 'General'),
    quantity: data.quantity,
    size: data.size || 'Estándar',
    color: data.color || 'Estándar',
    unitPrice: finalPrice,
    totalPrice: finalPrice * data.quantity,
  };

  try {
    track('add_to_cart', payload);
  } catch (err) {
    console.warn('[Vercel Analytics] track add_to_cart fallback:', err);
  }

  incrementFunnelStep('cartAdditions');

  if (process.env.NODE_ENV !== 'production') {
    console.log('📊 [Vercel Analytics Event] add_to_cart:', payload);
  }
}

/**
 * 3. Evento: Clic en "Solicitar Cotización por WhatsApp"
 */
export function trackWhatsAppQuote(data: {
  totalUnits: number;
  totalEstimated: number;
  itemCount: number;
  clientType?: string;
  clientName?: string;
  hasCoupon?: boolean;
}) {
  const payload = {
    totalUnits: data.totalUnits,
    totalEstimated: data.totalEstimated,
    itemCount: data.itemCount,
    clientType: data.clientType || 'consumidor_final',
    hasCoupon: Boolean(data.hasCoupon),
  };

  try {
    track('whatsapp_quote_request', payload);
  } catch (err) {
    console.warn('[Vercel Analytics] track whatsapp_quote_request fallback:', err);
  }

  incrementFunnelStep('whatsappQuotes');

  if (process.env.NODE_ENV !== 'production') {
    console.log('📊 [Vercel Analytics Event] whatsapp_quote_request:', payload);
  }
}

/**
 * Evento adicional: Búsqueda rápida
 */
export function trackSearchEvent(term: string, resultCount: number) {
  if (!term.trim()) return;
  try {
    track('search_catalog', {
      term: term.trim().toLowerCase(),
      resultCount,
    });
  } catch {}
}

/**
 * Evento adicional: Filtro aplicado
 */
export function trackFilterEvent(filterType: 'category' | 'subcategory' | 'price' | 'sort', value: string) {
  try {
    track('filter_applied', {
      filterType,
      value,
    });
  } catch {}
}
