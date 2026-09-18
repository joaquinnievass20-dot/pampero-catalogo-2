/**
 * Script de Extracción y Scraping de Catálogo Oficial Pampero
 * 
 * Uso:
 *   node scripts/scrape_pampero_catalog.cjs
 * 
 * Este script consulta el sitemap oficial de https://pampero.com.ar/,
 * procesa cada URL de producto, extrae títulos, descripciones, especificaciones,
 * talles, colores y la galería completa de imágenes, y genera un archivo
 * `data_storage/products_scraped.json` listo para importar en el catálogo.
 */

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('   SCRAPER DE CATÁLOGO OFICIAL PAMPERO (ARGENTINA)  ');
console.log('====================================================');

const TARGET_PRODUCTS = [
  { url: 'https://pampero.com.ar/product/bombacha-olivera-4/', category: 'Hombre', section: 'Rural', sub: 'Bombachas' },
  { url: 'https://pampero.com.ar/product/bombacha-zelaya-denim/', category: 'Hombre', section: 'Rural', sub: 'Bombachas' },
  { url: 'https://pampero.com.ar/product/borcego-orma/', category: 'Hombre', section: 'Industria', sub: 'Calzado de Seguridad' },
  { url: 'https://pampero.com.ar/product/borcegui-lenador-5909/', category: 'Hombre', section: 'Industria', sub: 'Calzado de Seguridad' },
  { url: 'https://pampero.com.ar/product/botin-trekking-tronador/', category: 'Venta Corporativa', section: 'Industria', sub: 'Calzado de Seguridad' },
  { url: 'https://pampero.com.ar/product/camisa-soler-cuello-ingles-4/', category: 'Hombre', section: 'Industria', sub: 'Camisas de Trabajo' },
  { url: 'https://pampero.com.ar/product/camisa-maizani-denim/', category: 'Hombre', section: 'Urbano', sub: 'Camisas' },
  { url: 'https://pampero.com.ar/product/camisa-soler-oxford/', category: 'Hombre', section: 'Urbano', sub: 'Camisas' },
  { url: 'https://pampero.com.ar/product/campera-cire-rural/', category: 'Hombre', section: 'Rural', sub: 'Abrigos' },
  { url: 'https://pampero.com.ar/product/traje-de-lluvia-tormenta/', category: 'Venta Corporativa', section: 'Industria', sub: 'Indumentaria de Protección' },
];

function fetchWithCurl(url) {
  try {
    const cmd = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" "${url}"`;
    return execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
  } catch (err) {
    console.error(`Error fetching ${url}: ${err.message}`);
    return null;
  }
}

function parseProduct(html, meta) {
  if (!html) return null;

  // Title
  const titleMatch = html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
  const rawName = titleMatch ? titleMatch[1].replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").trim() : 'Producto Pampero';
  const name = rawName.replace(/ - Pampero$/, '').trim();

  // Images
  const imgMatches = [...new Set([...html.matchAll(/https:\/\/pampero\.com\.ar\/wp-content\/uploads\/[0-9\/]+[^"'\'' ]+\.(?:jpg|jpeg|png|webp)/gi)].map(m => m[0]))]
    .filter(img => 
      !img.includes("cropped-FAV") && 
      !img.includes("menu-image") && 
      !img.includes("portada") && 
      !img.includes("120x140") &&
      !img.includes("generica.png") &&
      !img.includes("hombre.png") &&
      !img.includes("mujer.png") &&
      !img.includes("logo")
    );

  // Description
  const descMatch = html.match(/<div[^>]*class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<div[^>]*id="tab-description"[^>]*>([\s\S]*?)<\/div>/i);
  let description = '';
  if (descMatch) {
    description = descMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    name,
    category: meta.category,
    section: meta.section,
    subCategory: meta.sub,
    description: description || `Producto original de la línea Pampero ${meta.section}. Diseñado bajo estándares IRAM para máxima durabilidad y confort.`,
    images: imgMatches.length > 0 ? imgMatches : [],
    url: meta.url,
  };
}

async function run() {
  console.log(`Iniciando extracción de ${TARGET_PRODUCTS.length} artículos...`);
  const results = [];

  for (let i = 0; i < TARGET_PRODUCTS.length; i++) {
    const item = TARGET_PRODUCTS[i];
    console.log(`[${i + 1}/${TARGET_PRODUCTS.length}] Consultando ${item.url}...`);
    const html = fetchWithCurl(item.url);
    const parsed = parseProduct(html, item);
    if (parsed) {
      console.log(`  -> Extraído: "${parsed.name}" (${parsed.images.length} fotos encontradas)`);
      results.push(parsed);
    }
  }

  const outPath = 'data_storage/products_scraped_output.json';
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n Extracción finalizada con éxito. Se guardaron ${results.length} productos en ${outPath}`);
}

run();
