import { Product, Promotion } from '../types';

/**
 * Returns the active promotion associated with a product, or null if not linked to any active promotion.
 */
export function getProductActivePromotion(
  product: Product | null | undefined,
  promotions: Promotion[] | null | undefined
): Promotion | null {
  if (!product || !promotions || promotions.length === 0) return null;

  for (const promo of promotions) {
    if (!promo.active) continue;

    // 1. Direct match by associated product codes (authoritative)
    if (Array.isArray(promo.associatedProductCodes) && promo.associatedProductCodes.includes(product.code)) {
      return promo;
    }

    // 2. Match by promotion tag on product IF associatedProductCodes is either empty or includes it
    if (
      product.promotionTag &&
      (product.promotionTag === promo.tagFilter ||
       product.promotionTag === promo.badge ||
       product.promotionTag === promo.title)
    ) {
      if (!promo.associatedProductCodes || promo.associatedProductCodes.length === 0 || promo.associatedProductCodes.includes(product.code)) {
        return promo;
      }
    }
  }

  return null;
}
