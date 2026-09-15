// scripts/fetch_pampero_real.mjs
import fs from 'fs';

const TARGET_URLS = [
  // Bombachas
  "https://pampero.com.ar/product/bombacha-olivera-4/",
  "https://pampero.com.ar/product/bombacha-zelaya-denim/",
  "https://pampero.com.ar/product/pantalon-llanura/",
  // Botines y Calzado de Seguridad / Trabajo
  "https://pampero.com.ar/product/borcego-orma/",
  "https://pampero.com.ar/product/borcegui-lenador-5909/",
  "https://pampero.com.ar/product/botin-trekking-tronador/",
  "https://pampero.com.ar/product/zapato-1609/",
  // Camisas y Abrigos
  "https://pampero.com.ar/product/camisa-soler-cuello-ingles-4/",
  "https://pampero.com.ar/product/camisa-maizani-denim/",
  "https://pampero.com.ar/product/camisa-soler-oxford/",
  "https://pampero.com.ar/product/campera-cire-rural/",
  // Seguridad y Trabajo Pesado
  "https://pampero.com.ar/product/traje-de-lluvia-tormenta/",
  "https://pampero.com.ar/product/chaleco-reflectivo-clase-1/",
  "https://pampero.com.ar/product/jean-ranger-pampero/"
];

async function scrapeAll() {
  const products = [];
  let idCounter = 1;

  for (const url of TARGET_URLS) {
    try {
      console.log(`Fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!res.ok) {
        console.warn(`Failed to fetch ${url} status ${res.status}`);
        continue;
      }
      const html = await res.text();

      // Title
      const titleMatch = html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
      const name = titleMatch ? titleMatch[1].replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").trim() : 'Producto Pampero';

      // Images
      const allImgs = [...new Set([...html.matchAll(/https:\/\/pampero\.com\.ar\/wp-content\/uploads\/[0-9\/]+[^"'\'' ]+\.(?:jpg|jpeg|png|webp)/gi)].map(m => m[0]))]
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

      console.log(`Scraped ${name}: ${allImgs.length} images`);
      products.push({
        url,
        name,
        description,
        images: allImgs
      });
    } catch (e) {
      console.error(`Error scraping ${url}:`, e.message);
    }
  }

  fs.writeFileSync('scripts/scraped_pampero.json', JSON.stringify(products, null, 2));
  console.log(`Saved ${products.length} products to scripts/scraped_pampero.json`);
}

scrapeAll();
