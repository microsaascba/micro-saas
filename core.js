/* ============================================================
   MICRO SAAS — core.js
   Funciones compartidas. Todos los módulos importan este archivo.
   ============================================================ */

// ── Claves de localStorage ───────────────────────────────────
const KEYS = {
  products:         'saas_products',
  sales:            'saas_sales',
  expenses:         'saas_expenses',
  supplierDebts:    'saas_supplier_debts',
  supplierPayments: 'saas_supplier_payments',
  stockAdjustments: 'saas_stock_adjustments',
  purchases:        'saas_purchases',
  stockMovements:   'saas_stock_movements',
  contableEntries:  'saas_contable_entries',
  dashboard:        'saas_dashboard_summary',
};

// ── localStorage helpers ─────────────────────────────────────
function getData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('saas:data-updated', { detail: { key } }));
}

// ── Formato moneda ARS ───────────────────────────────────────
function currency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

// ── Formato porcentaje ───────────────────────────────────────
function percent(value, decimals = 1) {
  return Number(value || 0).toFixed(decimals) + '%';
}

// ── Número seguro ─────────────────────────────────────────────
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── Fecha de hoy en ISO (YYYY-MM-DD) ─────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Clave mes (YYYY-MM) ───────────────────────────────────────
function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

// ── Fecha legible ─────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return value;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

// ── Ahora legible ─────────────────────────────────────────────
function nowReadable() {
  return new Date().toLocaleString('es-AR');
}

// ── ID único ──────────────────────────────────────────────────
function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}

// ── Escape HTML ───────────────────────────────────────────────
function escapeHtml(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── Total de una venta (normaliza distintos formatos) ─────────
function saleTotal(sale) {
  if (typeof sale.total  === 'number') return sale.total;
  if (typeof sale.amount === 'number') return sale.amount;
  if (typeof sale.income === 'number') return sale.income;
  if (Array.isArray(sale.items)) {
    return sale.items.reduce((a, i) =>
      a + (toNum(i.subtotal) || toNum(i.quantity) * toNum(i.price)), 0);
  }
  return 0;
}

// ── Navegación activa ─────────────────────────────────────────
(function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.includes(path)) a.classList.add('active');
  });
})();


// ── Exportación a Excel (CSV optimizado) ─────────────────────
function exportarAExcel(dataArray, nombreArchivo) {
  if (!dataArray || !dataArray.length) {
    alert("No hay datos para exportar.");
    return;
  }

  // 1. Extraer cabeceras
  const headers = Object.keys(dataArray[0]);
  
  // 2. Formatear filas asegurando que los textos con comas no rompan las columnas
  const rows = dataArray.map(row => {
    return headers.map(header => {
      let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      cell = cell.replace(/"/g, '""'); // Escapar comillas dobles
      return `"${cell}"`; // Envolver en comillas para Excel
    }).join(';'); // Separador de punto y coma para Excel en español
  });

  // 3. Unir cabeceras y filas
  const csvContent = [headers.join(';'), ...rows].join('\n');

  // 4. Crear Blob con BOM para forzar UTF-8 en Excel (evita caracteres rotos)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // 5. Generar descarga
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${nombreArchivo}_${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}