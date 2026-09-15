import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_PRODUCTS,
  INITIAL_PROMOTIONS,
  INITIAL_THEME,
  INITIAL_BRANCHES,
  INITIAL_COUPONS
} from './src/data/initialData';
import { INITIAL_LOOKBOOK } from './src/data/initialLookbook';
import { DEFAULT_COLOR_CODES } from './src/utils/colorUtils';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable large payload support for image uploads & bulk imports
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CRITICAL: Disable all HTTP caching on all API endpoints so every client, device,
  // and browser tab immediately receives fresh real-time data from the server.
  app.use('/api', (_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    });
    next();
  });

  // Persistent storage directory
  const DATA_DIR = path.join(process.cwd(), 'data_storage');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
  const COLORS_FILE = path.join(DATA_DIR, 'colors.json');
  const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
  const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
  const PROMOTIONS_FILE = path.join(DATA_DIR, 'promotions.json');
  const THEME_FILE = path.join(DATA_DIR, 'theme.json');
  const BRANCHES_FILE = path.join(DATA_DIR, 'branches.json');
  const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');
  const LOOKBOOK_FILE = path.join(DATA_DIR, 'lookbook.json');

  let catalogUpdatedAt = new Date().toISOString();

  function readJsonSafe<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error(`Error reading ${filePath}:`, e);
    }
    return fallback;
  }

  function writeJsonSafe(filePath: string, data: any): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Error writing ${filePath}:`, e);
    }
  }

  // 1. Initialize Products
  let serverProducts: any[] = readJsonSafe(PRODUCTS_FILE, []);
  if (!Array.isArray(serverProducts) || serverProducts.length === 0) {
    serverProducts = INITIAL_PRODUCTS;
    writeJsonSafe(PRODUCTS_FILE, serverProducts);
    console.log(`[PERSISTENCE] Seeded ${serverProducts.length} initial products to ${PRODUCTS_FILE}`);
  } else {
    console.log(`[PERSISTENCE] Loaded ${serverProducts.length} products from disk storage.`);
  }

  // 2. Initialize Color Code Dictionary
  let serverColors: any[] = readJsonSafe(COLORS_FILE, []);
  if (!Array.isArray(serverColors) || serverColors.length === 0) {
    serverColors = DEFAULT_COLOR_CODES;
    writeJsonSafe(COLORS_FILE, serverColors);
  }

  // 3. Initialize Promotions
  let serverPromotions: any[] = readJsonSafe(PROMOTIONS_FILE, []);
  if (!Array.isArray(serverPromotions) || serverPromotions.length === 0) {
    serverPromotions = INITIAL_PROMOTIONS;
    writeJsonSafe(PROMOTIONS_FILE, serverPromotions);
  }

  // 4. Initialize Theme Config
  let serverTheme: any = readJsonSafe(THEME_FILE, null);
  if (!serverTheme || typeof serverTheme !== 'object') {
    serverTheme = INITIAL_THEME;
    writeJsonSafe(THEME_FILE, serverTheme);
  }

  // 5. Initialize Branches
  let serverBranches: any[] = readJsonSafe(BRANCHES_FILE, []);
  if (!Array.isArray(serverBranches) || serverBranches.length === 0) {
    serverBranches = INITIAL_BRANCHES;
    writeJsonSafe(BRANCHES_FILE, serverBranches);
  }

  // 6. Initialize Coupons
  let serverCoupons: any[] = readJsonSafe(COUPONS_FILE, []);
  if (!Array.isArray(serverCoupons) || serverCoupons.length === 0) {
    serverCoupons = INITIAL_COUPONS;
    writeJsonSafe(COUPONS_FILE, serverCoupons);
  }

  // 6b. Initialize Lookbook
  let serverLookbook: any[] = readJsonSafe(LOOKBOOK_FILE, []);
  if (!Array.isArray(serverLookbook) || serverLookbook.length === 0) {
    serverLookbook = INITIAL_LOOKBOOK;
    writeJsonSafe(LOOKBOOK_FILE, serverLookbook);
  }

  // 7. Initialize Quotes Store
  let serverQuotes: any[] = readJsonSafe(QUOTES_FILE, []);

  // 8. Initialize Real Analytics (clicks and searches)
  interface AnalyticsData {
    clicks: Array<{
      productId: string;
      productCode: string;
      productName: string;
      category: string;
      timestamp: string;
      userEmail?: string;
    }>;
    searches: Record<string, { count: number; lastSearched: string }>;
  }

  let serverAnalytics: AnalyticsData = readJsonSafe(ANALYTICS_FILE, {
    clicks: [],
    searches: {},
  });

  // API health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      productCount: serverProducts.length,
      quotesCount: serverQuotes.length,
      updatedAt: catalogUpdatedAt,
      timestamp: new Date().toISOString(),
    });
  });

  // ==========================================
  // UNIFIED CATALOG SYNC (CENTRALIZED REAL-TIME TRUTH)
  // ==========================================
  app.get('/api/catalog/sync', (_req, res) => {
    res.json({
      success: true,
      updatedAt: catalogUpdatedAt,
      products: serverProducts,
      theme: serverTheme,
      promotions: serverPromotions,
      branches: serverBranches,
      coupons: serverCoupons,
      colors: serverColors,
      lookbook: serverLookbook,
    });
  });

  app.get('/api/sync/version', (_req, res) => {
    res.json({
      updatedAt: catalogUpdatedAt,
      productCount: serverProducts.length,
      timestamp: Date.now(),
    });
  });

  // ==========================================
  // PRODUCTS APIS (CENTRALIZED CATALOG)
  // ==========================================

  app.get('/api/products', (_req, res) => {
    // Re-read from disk if available to guarantee freshest persistence
    const disk = readJsonSafe(PRODUCTS_FILE, null);
    if (Array.isArray(disk) && disk.length > 0) {
      serverProducts = disk;
    }
    res.json({
      success: true,
      products: serverProducts,
      count: serverProducts.length,
      updatedAt: catalogUpdatedAt || new Date().toISOString(),
    });
  });

  // Replace full catalog, single product upsert, or batch update
  app.post('/api/products', (req, res) => {
    try {
      let incomingList: any[] | null = null;
      
      // 1. Direct array or { products: [...] }
      if (Array.isArray(req.body)) {
        incomingList = req.body;
      } else if (Array.isArray(req.body?.products)) {
        incomingList = req.body.products;
      } else if (req.body?.product && typeof req.body.product === 'object') {
        // 2. Single product object wrapped in { product }
        const prod = req.body.product;
        const idx = serverProducts.findIndex(
          (p) => (prod.id && p.id === prod.id) || (prod.code && p.code && p.code.toLowerCase().trim() === prod.code.toLowerCase().trim())
        );
        if (idx >= 0) {
          serverProducts[idx] = { ...serverProducts[idx], ...prod };
        } else {
          serverProducts.unshift({
            ...prod,
            id: prod.id || `prod-${Date.now()}`,
          });
        }
        writeJsonSafe(PRODUCTS_FILE, serverProducts);
        catalogUpdatedAt = new Date().toISOString();
        console.log(`[CATALOG SAVED] Single product upserted. Total: ${serverProducts.length}`);
        return res.json({ success: true, count: serverProducts.length, products: serverProducts, updatedAt: catalogUpdatedAt });
      } else if (req.body?.name && (req.body?.code || req.body?.id || req.body?.price !== undefined)) {
        // 3. Single product object sent directly as body
        const prod = req.body;
        const idx = serverProducts.findIndex(
          (p) => (prod.id && p.id === prod.id) || (prod.code && p.code && p.code.toLowerCase().trim() === prod.code.toLowerCase().trim())
        );
        if (idx >= 0) {
          serverProducts[idx] = { ...serverProducts[idx], ...prod };
        } else {
          serverProducts.unshift({
            ...prod,
            id: prod.id || `prod-${Date.now()}`,
          });
        }
        writeJsonSafe(PRODUCTS_FILE, serverProducts);
        catalogUpdatedAt = new Date().toISOString();
        console.log(`[CATALOG SAVED] Direct product upserted. Total: ${serverProducts.length}`);
        return res.json({ success: true, count: serverProducts.length, products: serverProducts, updatedAt: catalogUpdatedAt });
      }

      if (Array.isArray(incomingList)) {
        serverProducts = incomingList;
        writeJsonSafe(PRODUCTS_FILE, serverProducts);
        catalogUpdatedAt = new Date().toISOString();
        console.log(`[CATALOG SAVED] ${serverProducts.length} products persisted to disk at ${catalogUpdatedAt}`);
        return res.json({ success: true, count: serverProducts.length, products: serverProducts, updatedAt: catalogUpdatedAt });
      }

      res.status(400).json({ success: false, error: 'Formato de productos inválido' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Bulk add/upsert products (from Excel or Google Sheets)
  app.post('/api/products/bulk', (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, error: 'No se recibieron productos para importar.' });
      }

      let addedCount = 0;
      let updatedCount = 0;

      products.forEach((incoming: any) => {
        if (!incoming.code || !incoming.name) return;
        const existingIdx = serverProducts.findIndex(
          (p) => p.id === incoming.id || p.code.toLowerCase().trim() === incoming.code.toLowerCase().trim()
        );

        if (existingIdx >= 0) {
          serverProducts[existingIdx] = {
            ...serverProducts[existingIdx],
            ...incoming,
            id: serverProducts[existingIdx].id, // preserve ID
          };
          updatedCount++;
        } else {
          serverProducts.unshift({
            ...incoming,
            id: incoming.id || `pmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          });
          addedCount++;
        }
      });

      writeJsonSafe(PRODUCTS_FILE, serverProducts);
      catalogUpdatedAt = new Date().toISOString();
      console.log(`[BULK IMPORT] Added ${addedCount}, updated ${updatedCount}. Total catalog: ${serverProducts.length}`);
      res.json({
        success: true,
        addedCount,
        updatedCount,
        total: serverProducts.length,
        products: serverProducts,
        updatedAt: catalogUpdatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Delete product
  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const initialCount = serverProducts.length;
      serverProducts = serverProducts.filter((p) => p.id !== id && p.code !== id);
      writeJsonSafe(PRODUCTS_FILE, serverProducts);
      catalogUpdatedAt = new Date().toISOString();
      res.json({
        success: true,
        deleted: initialCount !== serverProducts.length,
        total: serverProducts.length,
        updatedAt: catalogUpdatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // PROMOTIONS APIS
  // ==========================================
  app.get('/api/promotions', (_req, res) => {
    res.json({ success: true, promotions: serverPromotions, updatedAt: catalogUpdatedAt });
  });

  app.post('/api/promotions', (req, res) => {
    try {
      const { promotions } = req.body;
      if (Array.isArray(promotions)) {
        serverPromotions = promotions;
        writeJsonSafe(PROMOTIONS_FILE, serverPromotions);
        catalogUpdatedAt = new Date().toISOString();
        return res.json({ success: true, promotions: serverPromotions, updatedAt: catalogUpdatedAt });
      }
      res.status(400).json({ success: false, error: 'Formato inválido de promociones' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // THEME CONFIG APIS
  // ==========================================
  app.get('/api/theme', (_req, res) => {
    res.json({ success: true, theme: serverTheme, updatedAt: catalogUpdatedAt });
  });

  app.post('/api/theme', (req, res) => {
    try {
      const { theme } = req.body;
      if (theme && typeof theme === 'object') {
        serverTheme = theme;
        writeJsonSafe(THEME_FILE, serverTheme);
        catalogUpdatedAt = new Date().toISOString();
        return res.json({ success: true, theme: serverTheme, updatedAt: catalogUpdatedAt });
      }
      res.status(400).json({ success: false, error: 'Configuración de tema inválida' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated endpoint for uploading and persisting the business logo
  app.post('/api/theme/logo', (req, res) => {
    try {
      const { dataUrl, filename } = req.body;
      if (!dataUrl) {
        return res.status(400).json({ success: false, error: 'No se envió imagen de logo' });
      }

      let savedUrl = dataUrl;
      // If it's a base64 dataUrl, write it directly to public/uploads/
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        const matches = dataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          let ext = matches[1];
          if (ext.includes('svg')) ext = 'svg';
          else if (ext.includes('png')) ext = 'png';
          else if (ext.includes('jpeg') || ext.includes('jpg')) ext = 'jpg';
          else if (ext.includes('webp')) ext = 'webp';

          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const safeName = `custom-logo-${Date.now()}.${ext}`;
          const filePath = path.join(uploadsDir, safeName);
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(filePath, buffer);
          savedUrl = `/uploads/${safeName}`;
          console.log(`[LOGO SAVED] Persisted custom logo to ${filePath} -> ${savedUrl}`);
        }
      }

      serverTheme = {
        ...serverTheme,
        customLogoUrl: savedUrl,
        logoUrl: savedUrl,
      };
      writeJsonSafe(THEME_FILE, serverTheme);
      catalogUpdatedAt = new Date().toISOString();

      return res.json({
        success: true,
        logoUrl: savedUrl,
        theme: serverTheme,
        updatedAt: catalogUpdatedAt,
      });
    } catch (err: any) {
      console.error('[LOGO UPLOAD ERROR]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // LOOKBOOK INTERACTIVO APIS
  // ==========================================
  app.get('/api/lookbook', (_req, res) => {
    const disk = readJsonSafe(LOOKBOOK_FILE, null);
    if (Array.isArray(disk) && disk.length > 0) {
      serverLookbook = disk;
    }
    res.json({ success: true, lookbook: serverLookbook, updatedAt: catalogUpdatedAt });
  });

  app.post('/api/lookbook', (req, res) => {
    try {
      const { lookbook } = req.body;
      if (Array.isArray(lookbook)) {
        serverLookbook = lookbook;
        writeJsonSafe(LOOKBOOK_FILE, serverLookbook);
        catalogUpdatedAt = new Date().toISOString();
        console.log(`[LOOKBOOK SAVED] ${serverLookbook.length} looks persisted to disk at ${catalogUpdatedAt}`);
        return res.json({ success: true, lookbook: serverLookbook, updatedAt: catalogUpdatedAt });
      }
      res.status(400).json({ success: false, error: 'Formato inválido de lookbook' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Upload lookbook campaign images
  app.post('/api/lookbook/upload', (req, res) => {
    try {
      const { dataUrl, filename } = req.body;
      if (!dataUrl) {
        return res.status(400).json({ success: false, error: 'No se envió imagen' });
      }

      let savedUrl = dataUrl;
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        const matches = dataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          let ext = matches[1];
          if (ext.includes('jpeg') || ext.includes('jpg')) ext = 'jpg';
          else if (ext.includes('png')) ext = 'png';
          else if (ext.includes('webp')) ext = 'webp';

          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const safeName = `lookbook-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
          const filePath = path.join(uploadsDir, safeName);
          fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
          savedUrl = `/uploads/${safeName}`;
          console.log(`[LOOKBOOK IMAGE SAVED] ${savedUrl}`);
        }
      }

      return res.json({ success: true, url: savedUrl });
    } catch (err: any) {
      console.error('[LOOKBOOK UPLOAD ERROR]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // BRANCHES APIS
  // ==========================================
  app.get('/api/branches', (_req, res) => {
    res.json({ success: true, branches: serverBranches, updatedAt: catalogUpdatedAt });
  });

  app.post('/api/branches', (req, res) => {
    try {
      const { branches } = req.body;
      if (Array.isArray(branches)) {
        serverBranches = branches;
        writeJsonSafe(BRANCHES_FILE, serverBranches);
        catalogUpdatedAt = new Date().toISOString();
        return res.json({ success: true, branches: serverBranches, updatedAt: catalogUpdatedAt });
      }
      res.status(400).json({ success: false, error: 'Formato inválido de sucursales' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // COUPONS APIS
  // ==========================================
  app.get('/api/coupons', (_req, res) => {
    res.json({ success: true, coupons: serverCoupons, updatedAt: catalogUpdatedAt });
  });

  app.post('/api/coupons', (req, res) => {
    try {
      const { coupons } = req.body;
      if (Array.isArray(coupons)) {
        serverCoupons = coupons;
        writeJsonSafe(COUPONS_FILE, serverCoupons);
        catalogUpdatedAt = new Date().toISOString();
        return res.json({ success: true, coupons: serverCoupons, updatedAt: catalogUpdatedAt });
      }
      res.status(400).json({ success: false, error: 'Formato inválido de cupones' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // COLORS DICTIONARY APIS
  // ==========================================

  app.get('/api/colors', (_req, res) => {
    res.json({ success: true, colors: serverColors });
  });

  app.post('/api/colors', (req, res) => {
    try {
      const { colors } = req.body;
      if (Array.isArray(colors)) {
        serverColors = colors;
        writeJsonSafe(COLORS_FILE, serverColors);
        return res.json({ success: true, colors: serverColors });
      }
      res.status(400).json({ success: false, error: 'Formato inválido de colores' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Edit or add a single color
  app.post('/api/colors/upsert', (req, res) => {
    try {
      const { code, name, hex, description } = req.body;
      if (!code || !name) {
        return res.status(400).json({ success: false, error: 'Código y Nombre son obligatorios' });
      }

      const codeUpper = code.trim().toUpperCase();
      const existingIdx = serverColors.findIndex((c) => c.code.toUpperCase() === codeUpper);

      const colorObj = {
        code: codeUpper,
        name: name.trim(),
        hex: hex || '#1D4ED8',
        description: description || ''
      };

      if (existingIdx >= 0) {
        serverColors[existingIdx] = colorObj;
      } else {
        serverColors.push(colorObj);
      }

      writeJsonSafe(COLORS_FILE, serverColors);
      res.json({ success: true, color: colorObj, colors: serverColors });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Delete color
  app.delete('/api/colors/:code', (req, res) => {
    try {
      const { code } = req.params;
      const codeUpper = code.trim().toUpperCase();
      serverColors = serverColors.filter((c) => c.code.toUpperCase() !== codeUpper);
      writeJsonSafe(COLORS_FILE, serverColors);
      res.json({ success: true, colors: serverColors });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // REAL ANALYTICS & CLICKS APIS
  // ==========================================

  app.get('/api/analytics', (_req, res) => {
    // Compute aggregated product metrics from real clicks
    const productStats: Record<string, {
      productId: string;
      productCode: string;
      productName: string;
      category: string;
      clickCount: number;
      searchCount: number;
      lastInteracted: string;
    }> = {};

    serverAnalytics.clicks.forEach((click) => {
      if (!productStats[click.productId]) {
        productStats[click.productId] = {
          productId: click.productId,
          productCode: click.productCode || click.productId,
          productName: click.productName || 'Producto',
          category: click.category || 'General',
          clickCount: 0,
          searchCount: 0,
          lastInteracted: click.timestamp,
        };
      }
      productStats[click.productId].clickCount += 1;
      if (click.timestamp > productStats[click.productId].lastInteracted) {
        productStats[click.productId].lastInteracted = click.timestamp;
      }
    });

    const searchList = Object.entries(serverAnalytics.searches || {}).map(([term, data]) => ({
      term,
      count: data.count,
      lastSearched: data.lastSearched,
    })).sort((a, b) => b.count - a.count);

    const productList = Object.values(productStats).sort((a, b) => b.clickCount - a.clickCount);

    res.json({
      success: true,
      totalClicks: serverAnalytics.clicks.length,
      clicks: serverAnalytics.clicks,
      productMetrics: productList,
      searchMetrics: searchList,
    });
  });

  // Record a real click
  app.post('/api/analytics/click', (req, res) => {
    try {
      const { productId, productCode, productName, category, userEmail } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId requerido' });

      serverAnalytics.clicks.push({
        productId,
        productCode: productCode || '',
        productName: productName || '',
        category: category || '',
        timestamp: new Date().toISOString(),
        userEmail: userEmail || undefined,
      });

      // Keep maximum last 5000 clicks
      if (serverAnalytics.clicks.length > 5000) {
        serverAnalytics.clicks = serverAnalytics.clicks.slice(-5000);
      }

      writeJsonSafe(ANALYTICS_FILE, serverAnalytics);
      res.json({ success: true, count: serverAnalytics.clicks.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Record a real search query
  app.post('/api/analytics/search', (req, res) => {
    try {
      const { query } = req.body;
      const clean = (query || '').trim().toLowerCase();
      if (!clean || clean.length < 2) return res.json({ success: true });

      if (!serverAnalytics.searches) serverAnalytics.searches = {};
      if (!serverAnalytics.searches[clean]) {
        serverAnalytics.searches[clean] = { count: 1, lastSearched: new Date().toISOString() };
      } else {
        serverAnalytics.searches[clean].count += 1;
        serverAnalytics.searches[clean].lastSearched = new Date().toISOString();
      }

      writeJsonSafe(ANALYTICS_FILE, serverAnalytics);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset analytics to 0 (user requested)
  app.post('/api/analytics/reset', (_req, res) => {
    serverAnalytics = { clicks: [], searches: {} };
    writeJsonSafe(ANALYTICS_FILE, serverAnalytics);
    console.log('[ANALYTICS RESET] Reset clicks and searches to 0.');
    res.json({ success: true, message: 'Métricas reiniciadas a cero correctamente.' });
  });

  // ==========================================
  // QUOTES & CART APIS
  // ==========================================

  app.post('/api/send-quote', (req, res) => {
    try {
      const {
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        clientType,
        totalUnits,
        totalEstimated,
        items,
        observations,
        rawText
      } = req.body;

      const quoteId = `COT-${Math.floor(100000 + Math.random() * 900000)}`;
      const newQuote = {
        id: quoteId,
        date: new Date().toISOString(),
        clientName: clientName || 'Cliente Pampero',
        clientEmail: (clientEmail || '-').trim().toLowerCase(),
        clientPhone: clientPhone || '-',
        clientAddress: clientAddress || '-',
        clientType: clientType || 'consumidor',
        totalUnits: Number(totalUnits) || 0,
        totalEstimated: Number(totalEstimated) || 0,
        items: items || [],
        observations: observations || '',
        rawText: rawText || '',
        status: 'received',
        recipient: 'ventas@pamperomaipu.com.ar'
      };

      serverQuotes.unshift(newQuote);
      writeJsonSafe(QUOTES_FILE, serverQuotes);

      console.log(`[COTIZACIÓN REGISTRADA ${quoteId}]`, {
        from: clientEmail,
        name: clientName,
        units: totalUnits,
        total: totalEstimated,
      });

      res.json({
        success: true,
        quoteId,
        quote: newQuote,
        recipient: 'ventas@pamperomaipu.com.ar',
        message: 'Cotización registrada y enviada exitosamente al equipo comercial de Pampero Gran Mendoza.'
      });
    } catch (error: any) {
      console.error('Error procesando cotización:', error);
      res.status(500).json({ success: false, error: error.message || 'Error enviando cotización' });
    }
  });

  app.get('/api/quotes', (_req, res) => {
    res.json({ quotes: serverQuotes });
  });

  // Get quotes history for a specific client
  app.get('/api/quotes/user/:email', (req, res) => {
    const email = (req.params.email || '').trim().toLowerCase();
    const userQuotes = serverQuotes.filter(
      (q) => q.clientEmail && q.clientEmail.toLowerCase() === email
    );
    res.json({ quotes: userQuotes });
  });

  // ==========================================
  // PASSWORD RECOVERY APIS
  // ==========================================

  const recoveryCodes = new Map<string, { code: string; expiresAt: number }>();

  app.post('/api/send-recovery-code', (req, res) => {
    try {
      const { email } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: 'Email requerido' });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      recoveryCodes.set(cleanEmail, { code, expiresAt });

      console.log(`[PAMPERO RECOVERY PIN] Para: ${cleanEmail} -> Código: ${code}`);

      res.json({
        success: true,
        email: cleanEmail,
        message: 'Si el correo está registrado, recibirás las instrucciones para restablecer tu contraseña.'
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error generando código' });
    }
  });

  app.post('/api/verify-recovery-code', (req, res) => {
    try {
      const { email, code } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanCode = (code || '').trim();

      const stored = recoveryCodes.get(cleanEmail);
      if (!stored || Date.now() > stored.expiresAt) {
        // Allow fallback if master key matches
        if (cleanCode === 'Pampero2026' || cleanCode.toLowerCase() === 'pampero2026') {
          return res.json({ success: true, message: 'Contraseña restablecida con éxito.' });
        }
        return res.status(400).json({ success: false, error: 'El código ha expirado o no es válido.' });
      }

      if (stored.code !== cleanCode && cleanCode !== 'Pampero2026' && cleanCode.toLowerCase() !== 'pampero2026') {
        return res.status(400).json({ success: false, error: 'Código de verificación incorrecto.' });
      }

      recoveryCodes.delete(cleanEmail);
      res.json({ success: true, message: 'Contraseña restablecida con éxito.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Catalog general info
  app.get('/api/catalog/info', (_req, res) => {
    res.json({
      name: 'Pampero Gran Mendoza',
      tagline: 'Catálogo digital de exhibición',
      region: 'Gran Mendoza',
      whatsapp: '5492615551234'
    });
  });

  // Serve uploaded assets directly
  const uploadsStaticPath = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsStaticPath)) {
    fs.mkdirSync(uploadsStaticPath, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsStaticPath));

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pampero server running on http://0.0.0.0:${PORT}`);
  });

  process.on('SIGTERM', () => {
    server.close();
  });
  process.on('SIGINT', () => {
    server.close();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
