import React, { useState, useEffect } from 'react';
import { ProductMetric } from '../../types';
import { getLocalFunnelMetrics, FunnelMetrics } from '../../utils/analytics';
import { 
  BarChart3, 
  Search, 
  MousePointerClick, 
  TrendingUp, 
  RotateCcw, 
  Download, 
  Clock, 
  Eye,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Activity
} from 'lucide-react';

interface SearchMetric {
  term: string;
  count: number;
  lastSearched: string;
}

export const AdminAnalyticsTab: React.FC = () => {
  const [searchMetrics, setSearchMetrics] = useState<SearchMetric[]>([]);
  const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
  const [funnel, setFunnel] = useState<FunnelMetrics>({
    productClicks: 0,
    cartAdditions: 0,
    whatsappQuotes: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [filterType, setFilterType] = useState<'all' | 'searches' | 'clicks'>('all');

  const loadMetrics = () => {
    if (typeof window === 'undefined') return;
    
    setFunnel(getLocalFunnelMetrics());

    try {
      // 1. Load real search analytics from local storage without fake data
      const rawSearch = localStorage.getItem('pampero_search_analytics');
      if (rawSearch) {
        const parsed = JSON.parse(rawSearch);
        const list: SearchMetric[] = Object.entries(parsed).map(([term, data]: [string, any]) => ({
          term,
          count: typeof data === 'number' ? data : data.count || 1,
          lastSearched: typeof data === 'object' && data.lastSearched ? data.lastSearched : new Date().toISOString(),
        }));
        list.sort((a, b) => b.count - a.count);
        setSearchMetrics(list);
      } else {
        setSearchMetrics([]);
      }

      // 2. Load real product click/interaction metrics without fake data
      const rawProduct = localStorage.getItem('pampero_product_metrics');
      if (rawProduct) {
        const parsed = JSON.parse(rawProduct);
        const list: ProductMetric[] = Object.values(parsed);
        list.sort((a, b) => b.clickCount - a.clickCount);
        setProductMetrics(list);
      } else {
        setProductMetrics([]);
      }
    } catch (e) {
      console.error('Error loading analytics:', e);
      setSearchMetrics([]);
      setProductMetrics([]);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleClearMetrics = () => {
    if (confirm('¿Estás seguro de reiniciar todas las métricas de búsquedas y clics a cero?')) {
      localStorage.removeItem('pampero_search_analytics');
      localStorage.removeItem('pampero_product_metrics');
      localStorage.removeItem('pampero_funnel_analytics');
      setSearchMetrics([]);
      setProductMetrics([]);
      setFunnel({
        productClicks: 0,
        cartAdditions: 0,
        whatsappQuotes: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
  };

  const totalSearches = searchMetrics.reduce((acc, curr) => acc + curr.count, 0);
  const totalClicks = productMetrics.reduce((acc, curr) => acc + curr.clickCount, 0);

  const handleExportCSV = () => {
    let csv = 'Tipo,Identificador,Nombre,Cantidad,Fecha\n';
    searchMetrics.forEach((s) => {
      csv += `Busqueda,"${s.term}","-",${s.count},"${s.lastSearched}"\n`;
    });
    productMetrics.forEach((p) => {
      csv += `ClicArticulo,"${p.productCode}","${p.productName}",${p.clickCount},"${p.lastInteracted}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pampero_metricas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCD4C9] pb-4">
        <div>
          <h3 className="text-base font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#B9522F]" />
            Panel de Métricas & Búsquedas Más Frecuentes
          </h3>
          <p className="text-xs text-[#6F6860] mt-1">
            Estadísticas en tiempo real de los términos más buscados en la barra de navegación y las fichas de producto más visitadas por los clientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-white border border-[#DCD4C9] hover:border-neutral-800 text-neutral-800 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#B9522F]" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handleClearMetrics}
            className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] hover:bg-red-50 text-neutral-600 hover:text-red-700 text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
            title="Reiniciar contadores"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860] tracking-wider block">
            Búsquedas Totales
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-display font-bold text-[#18231C]">
              {totalSearches}
            </span>
            <Search className="w-4 h-4 text-[#B9522F]" />
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {searchMetrics.length} términos únicos registrados
          </p>
        </div>

        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860] tracking-wider block">
            Clics en Fichas de Producto
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-display font-bold text-[#18231C]">
              {totalClicks}
            </span>
            <MousePointerClick className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {productMetrics.length} productos con interacciones
          </p>
        </div>

        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860] tracking-wider block">
            Término Más Popular
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-[#B9522F] uppercase truncate">
              {searchMetrics[0]?.term || 'Sin registros'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {searchMetrics[0] ? `${searchMetrics[0].count} búsquedas registradas` : 'Inicie búsquedas'}
          </p>
        </div>
      </div>

      {/* Vercel Analytics Funnel Banner */}
      <div className="bg-[#18231C] text-[#F5F2EC] p-4 sm:p-5 rounded-xs border border-[#18231C] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2C382F] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Embudo de Conversión & Rendimiento
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-xs font-mono">
              Vercel Analytics Activo
            </span>
          </div>
          <span className="text-[11px] text-[#A59F95]">
            Métricas de intención de compra y conversión comercial
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Paso 1 */}
          <div className="bg-[#212E25] p-3.5 rounded-xs border border-[#2F4135]">
            <span className="text-[10px] uppercase font-bold text-[#A59F95] block">
              Paso 1 · Clics en Productos
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-display text-white">
                {funnel.productClicks}
              </span>
              <Eye className="w-4 h-4 text-neutral-400" />
            </div>
            <span className="text-[10px] text-[#A59F95] mt-1 block">
              Prendas exploradas en el catálogo
            </span>
          </div>

          {/* Paso 2 */}
          <div className="bg-[#212E25] p-3.5 rounded-xs border border-[#2F4135]">
            <span className="text-[10px] uppercase font-bold text-[#A59F95] block">
              Paso 2 · Agregados al Carrito
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-display text-amber-400">
                {funnel.cartAdditions}
              </span>
              <ShoppingBag className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-[10px] text-amber-300/80 mt-1 block">
              {funnel.productClicks > 0 
                ? `${Math.round((funnel.cartAdditions / funnel.productClicks) * 100)}% de interés desde vistas`
                : 'Tasa inicial'}
            </span>
          </div>

          {/* Paso 3 */}
          <div className="bg-[#212E25] p-3.5 rounded-xs border border-[#2F4135]">
            <span className="text-[10px] uppercase font-bold text-[#A59F95] block">
              Paso 3 · Cotización WhatsApp
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-display text-emerald-400">
                {funnel.whatsappQuotes}
              </span>
              <MessageSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[10px] text-emerald-300/80 mt-1 block">
              {funnel.cartAdditions > 0
                ? `${Math.round((funnel.whatsappQuotes / funnel.cartAdditions) * 100)}% concretadas a WhatsApp`
                : 'Concretadas'}
            </span>
          </div>
        </div>

        {/* Abandonment Rate metric */}
        {funnel.cartAdditions > 0 && (
          <div className="text-[11px] text-[#DCD4C9] bg-[#141C16] p-2.5 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 border border-[#222E26]">
            <span>
              Tasa de carritos que aún no solicitaron WhatsApp:{' '}
              <strong className="text-rose-400">
                {Math.max(0, Math.round(((funnel.cartAdditions - funnel.whatsappQuotes) / funnel.cartAdditions) * 100))}%
              </strong>
            </span>
            <span className="text-[10px] text-[#8C827A]">
              Último registro: {new Date(funnel.lastUpdated).toLocaleTimeString('es-AR')}
            </span>
          </div>
        )}
      </div>

      {/* Main Tables: Most Searched Terms & Most Clicked Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Table 1: Lo más buscado */}
        <div className="bg-white rounded-xs border border-[#DCD4C9] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
              <Search className="w-4 h-4 text-[#B9522F]" />
              Palabras y Términos Más Buscados
            </h4>
            <span className="text-[10px] text-neutral-500 font-mono">
              Top {searchMetrics.length}
            </span>
          </div>

          {searchMetrics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-neutral-700 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Posición</th>
                    <th className="py-2 px-3">Término de Búsqueda</th>
                    <th className="py-2 px-3 text-right">Frecuencia</th>
                    <th className="py-2 px-3 text-right">Proporción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCD4C9]/60">
                  {searchMetrics.map((item, index) => {
                    const pct = totalSearches > 0 ? Math.round((item.count / totalSearches) * 100) : 0;
                    return (
                      <tr key={item.term} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-mono text-neutral-500 font-bold">
                          #{index + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-neutral-900 capitalize">
                          {item.term}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#B9522F]">
                          {item.count}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] font-mono text-neutral-500">{pct}%</span>
                            <div className="w-12 bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[#B9522F] h-full"
                                style={{ width: `${Math.min(pct * 2, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500">
              No hay términos buscados todavía. Las búsquedas realizadas en el buscador aparecerán aquí.
            </div>
          )}
        </div>

        {/* Table 2: Productos Más Clickeados / Vistos */}
        <div className="bg-white rounded-xs border border-[#DCD4C9] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
              <MousePointerClick className="w-4 h-4 text-emerald-600" />
              Prendas & Artículos Más Clickeados
            </h4>
            <span className="text-[10px] text-neutral-500 font-mono">
              Top {productMetrics.length}
            </span>
          </div>

          {productMetrics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-neutral-700 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Artículo</th>
                    <th className="py-2 px-3 text-right">Clics</th>
                    <th className="py-2 px-3 text-right">Interés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCD4C9]/60">
                  {productMetrics.map((item) => {
                    const pct = totalClicks > 0 ? Math.round((item.clickCount / totalClicks) * 100) : 0;
                    return (
                      <tr key={item.productId} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 font-bold">
                          {item.productCode}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-neutral-900 truncate max-w-[180px]">
                            {item.productName}
                          </p>
                          <span className="text-[10px] text-neutral-500">{item.category}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {item.clickCount}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] font-mono text-neutral-500">{pct}%</span>
                            <div className="w-12 bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full"
                                style={{ width: `${Math.min(pct * 2, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500">
              No hay interacción registrada aún. Al hacer clic en las prendas del catálogo se listarán aquí.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
