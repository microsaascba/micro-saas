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

  const headers = Object.keys(dataArray[0]);
  
  const rows = dataArray.map(row => {
    return headers.map(header => {
      let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      cell = cell.replace(/"/g, '""'); 
      return `"${cell}"`; 
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
  
  if (!isLogged && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  if (isLogged && !isLoginPage) {
    
    // RESTRICCIÓN DURA: Bloqueo de Dashboard, Contable y ahora también STOCK
    if (role === 'pos' && (path.includes('dashboard') || path.includes('contable') || path.includes('stock'))) {
      window.location.href = 'ventas.html';
      return;
    }

    document.addEventListener('DOMContentLoaded', () => {
      // Nombre de usuario en el menú
      const brandText = document.querySelector('.brand-text strong');
      if (brandText) brandText.textContent = 'Usuario: ' + localStorage.getItem('saas_username');

      // Botón Cerrar Sesión
      const nav = document.querySelector('.nav');
      if (nav && !document.getElementById('btnLogout')) {
        const logoutBtn = document.createElement('a');
        logoutBtn.id = 'btnLogout';
        logoutBtn.href = '#';
        logoutBtn.innerHTML = '<span class="nav-icon">🚪</span> Cerrar sesión';
        logoutBtn.style.color = '#fca5a5'; 
        logoutBtn.style.marginTop = '15px';
        logoutBtn.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        logoutBtn.style.paddingTop = '15px';
        
        logoutBtn.onclick = (e) => {
          e.preventDefault(); 
          logout(); 
        };
        nav.appendChild(logoutBtn);
      }

      // RESTRICCIONES VISUALES PARA ROL 'POS'
      if (role === 'pos') {
        // Ocultar links del menú lateral (Dashboard, Contable y Stock)
        document.querySelectorAll('.nav a').forEach(link => {
          const href = link.getAttribute('href');
          if (href.includes('dashboard') || href.includes('contable') || href.includes('stock')) {
            link.style.display = 'none';
          }
        });

        // Ocultar botones de crear/editar/borrar/importar
        const botonesProhibidos = [
          '#newProductBtn', '#importBtn', '#exportBtn', '#openAdjustBtn', 
          '#btnOpenExpense', '#btnOpenSupplier'
        ];
        botonesProhibidos.forEach(id => {
          const btn = document.querySelector(id);
          if (btn) btn.style.display = 'none';
        });

        // Ocultar acciones de las tablas 
        const css = document.createElement('style');
        css.innerHTML = `
          th:last-child, td:last-child .row-actions, td:last-child .mini-btn { display: none !important; }
          .card-pad h2 { font-size: 16px; } 
        `;
        document.head.appendChild(css);
        
        // Ocultar formulario de alta de productos
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
