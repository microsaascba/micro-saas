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
  try { return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : fallback; } 
  catch { return fallback; }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('saas:data-updated', { detail: { key } }));
}

function currency(value) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function percent(value, decimals = 1) { return Number(value || 0).toFixed(decimals) + '%'; }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthKey(dateStr) { return (dateStr || '').slice(0, 7); }
function formatDate(value) {
  if (!value) return '-'; const d = new Date(value); if (isNaN(d)) return value;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}
function nowReadable() { return new Date().toLocaleString('es-AR'); }
function uid(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function saleTotal(sale) {
  if (typeof sale.total  === 'number') return sale.total;
  if (Array.isArray(sale.items)) { return sale.items.reduce((a, i) => a + (toNum(i.subtotal) || toNum(i.quantity) * toNum(i.price)), 0); }
  return 0;
}

(function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.includes(path)) a.classList.add('active');
  });
})();

function exportarAExcel(dataArray, nombreArchivo) {
  if (!dataArray || !dataArray.length) { alert("No hay datos para exportar."); return; }
  const headers = Object.keys(dataArray[0]);
  const rows = dataArray.map(row => {
    return headers.map(header => {
      let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      cell = cell.replace(/"/g, '""'); return `"${cell}"`; 
    }).join(';'); 
  });
  const csvContent = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${nombreArchivo}_${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── Control de Sesión, Roles y Seguridad ────────────────
(function checkSessionAndSecurity() {
  const isLogged = localStorage.getItem('saas_logged_in') === 'true';
  const role = localStorage.getItem('saas_role') || 'pos'; 
  const path = location.pathname.toLowerCase();
  const isLoginPage = path.includes('login');
  
  if (!isLogged && !isLoginPage) { window.location.href = 'login.html'; return; }

  if (isLogged && !isLoginPage) {
    
    // RESTRICCIONES DURAS DE SEGURIDAD (Redirecciones forzadas si intentan entrar por URL)
    
    // 1. Cajero (POS): Bloqueado de todo menos Ventas y Catálogo
    if (role === 'pos' && (path.includes('dashboard') || path.includes('contable') || path.includes('stock') || path.includes('usuarios'))) {
      window.location.href = 'ventas.html'; return;
    }
    
    // 2. Encargado: Bloqueado de Finanzas (Dashboard y Contable) y Gestión de Usuarios
    if (role === 'encargado' && (path.includes('dashboard') || path.includes('contable') || path.includes('usuarios'))) {
      window.location.href = 'ventas.html'; return;
    }

    document.addEventListener('DOMContentLoaded', () => {
      const brandText = document.querySelector('.brand-text strong');
      if (brandText) brandText.textContent = 'Usuario: ' + localStorage.getItem('saas_username');

      // Inyectar botón de Usuarios (Si no existe y es admin)
      const nav = document.querySelector('.nav');
      if (nav && role === 'admin' && !document.querySelector('a[href="usuarios.html"]')) {
         const usersLink = document.createElement('a');
         usersLink.href = 'usuarios.html';
         if (path.includes('usuarios')) usersLink.classList.add('active');
         usersLink.innerHTML = '<span class="nav-icon">👥</span> Usuarios';
         nav.appendChild(usersLink);
      }

      // Inyectar botón de Cerrar Sesión
      if (nav && !document.getElementById('btnLogout')) {
        const logoutBtn = document.createElement('a');
        logoutBtn.id = 'btnLogout'; logoutBtn.href = '#';
        logoutBtn.innerHTML = '<span class="nav-icon">🚪</span> Cerrar sesión';
        logoutBtn.style.color = '#fca5a5'; logoutBtn.style.marginTop = '15px'; logoutBtn.style.borderTop = '1px solid rgba(255,255,255,0.1)'; logoutBtn.style.paddingTop = '15px';
        logoutBtn.onclick = (e) => { e.preventDefault(); logout(); };
        nav.appendChild(logoutBtn);
      }

      // --- RESTRICCIONES VISUALES DE MENÚ ---
      
      // Ocultar Menú Usuarios a todos menos al Admin
      if (role !== 'admin') {
        document.querySelectorAll('.nav a').forEach(link => { if (link.getAttribute('href')?.includes('usuarios')) link.style.display = 'none'; });
      }

      // Ocultar Finanzas (Dashboard y Contable) a Encargados y Cajeros
      if (role === 'encargado' || role === 'pos') {
        document.querySelectorAll('.nav a').forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('dashboard') || href.includes('contable')) { link.style.display = 'none'; }
        });
      }

      // Ocultar Stock solo al Cajero (El encargado sí puede ver y cargar stock)
      if (role === 'pos') {
        document.querySelectorAll('.nav a').forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('stock')) { link.style.display = 'none'; }
        });
      }

      // --- RESTRICCIONES DE BOTONES Y EDICIÓN (SOLO PARA CAJERO) ---
      if (role === 'pos') {
        const botonesProhibidos = ['#newProductBtn', '#importBtn', '#exportBtn', '#openAdjustBtn', '#btnOpenExpense', '#btnOpenSupplier'];
        botonesProhibidos.forEach(id => { const btn = document.querySelector(id); if (btn) btn.style.display = 'none'; });
        const css = document.createElement('style');
        css.innerHTML = `th:last-child, td:last-child .row-actions, td:last-child .mini-btn { display: none !important; } .card-pad h2 { font-size: 16px; }`;
        document.head.appendChild(css);
        const formAlta = document.getElementById('productForm');
        if (formAlta) formAlta.closest('article').style.display = 'none';
        const twoCol = document.querySelector('.two-col');
        if (twoCol) twoCol.style.gridTemplateColumns = '1fr';
      }
    });
  }
})();

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}
