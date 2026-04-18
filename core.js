/* ============================================================
   MICRO SAAS — core.js
   Funciones compartidas. Todos los módulos importan este archivo.
   ============================================================ */

// ── CLAVE DE LICENCIA DEL CLIENTE ────────────────────────────
const SAAS_LICENSE_ID = ''; 

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

function getData(key, fallback = []) { try { return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : fallback; } catch { return fallback; } }
function setData(key, value) { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent('saas:data-updated', { detail: { key } })); }
function currency(value) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function percent(value, decimals = 1) { return Number(value || 0).toFixed(decimals) + '%'; }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthKey(dateStr) { return (dateStr || '').slice(0, 7); }
function formatDate(value) { if (!value) return '-'; const d = new Date(value); if (isNaN(d)) return value; return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d); }
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
    return headers.map(header => { let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]); cell = cell.replace(/"/g, '""'); return `"${cell}"`; }).join(';'); 
  });
  const csvContent = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nombreArchivo}_${todayISO()}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ============================================================
// ── Control de Sesión, Licencias, Roles y Permisos D1 ───────
// ============================================================
(function checkSessionAndSecurity() {
  const path = location.pathname.toLowerCase();
  const isLoginPage = path.includes('login');
  const currentPage = path.split('/').pop().replace('.html', '') || 'dashboard';

  // --- 1. VERIFICACIÓN DE LICENCIA SAAS (Ping al Master) ---
  const masterDB = JSON.parse(localStorage.getItem('saas_db_clientes')) || [];
  const licencia = masterDB.find(c => c.id === SAAS_LICENSE_ID) || masterDB[0];

  if (licencia) {
    // A) Chequear si el Master lo bloqueó
    if (!licencia.active) {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:#fff; text-align:center; padding:20px; font-family:sans-serif; width: 100vw; margin: 0;">
            <div style="background: #1e293b; padding: 40px; border-radius: 16px; border-top: 5px solid #ef4444; max-width: 500px; width: 100%;">
              <div style="font-size: 50px; margin-bottom: 20px;">🔒</div>
              <h1 style="color:#ef4444; font-size:24px; margin-bottom: 10px;">SERVICIO SUSPENDIDO</h1>
              <p style="font-size:16px; color:#94a3b8; line-height: 1.5; margin-bottom: 25px;">La licencia operativa de este sistema se encuentra temporalmente inactiva por falta de pago o revisión administrativa.</p>
              <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px; color: #f8fafc;">Comercio: <strong>${licencia.name}</strong></p>
              </div>
              <p style="font-size:14px; color:#64748b;">Comunícate con Viggo Professional para regularizar el servicio.</p>
            </div>
          </div>
        `;
      });
      return; 
    }

    // B) Chequear si está cerca de vencer (5 días o menos)
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const vto = new Date(licencia.dueDate); vto.setHours(0,0,0,0);
    const diffDias = Math.ceil((vto - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias <= 5 && !isLoginPage) {
      document.addEventListener('DOMContentLoaded', () => {
        const alertBar = document.createElement('div');
        const color = diffDias < 0 ? '#ef4444' : '#f59e0b';
        const icono = diffDias < 0 ? '⚠️' : '⏳';
        const text = diffDias < 0 
          ? `<strong>ATENCIÓN:</strong> Tu abono de sistema venció hace ${Math.abs(diffDias)} días. Por favor, registrá el pago para evitar la suspensión del servicio.`
          : `<strong>AVISO DE VENCIMIENTO:</strong> Tu abono mensual del sistema vence en ${diffDias} días (${vto.toLocaleDateString('es-AR')}).`;
        
        alertBar.style = `background: ${color}; color: white; text-align: center; padding: 12px 20px; font-size: 14px; width: 100%; z-index: 99999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);`;
        alertBar.innerHTML = `${icono} ${text}`;
        
        const appDiv = document.querySelector('.app');
        if (appDiv) {
          document.body.insertBefore(alertBar, appDiv);
          appDiv.style.height = 'calc(100vh - 44px)'; 
        }
      });
    }
  }
  // --- FIN VERIFICACIÓN DE LICENCIA ---

  // --- 2. CONTROL DE SESIÓN Y PERMISOS D1 ---
  
  // Variables del nuevo Login (D1) y viejo Login (Local) por retrocompatibilidad
  const activeUser = localStorage.getItem('activeUser') || localStorage.getItem('saas_username');
  const role = localStorage.getItem('userRole') || localStorage.getItem('saas_role');
  const isLogged = (activeUser !== null && activeUser !== undefined) || (localStorage.getItem('saas_logged_in') === 'true');
  const allowedModules = JSON.parse(localStorage.getItem('allowedModules') || '[]');

  // Si no está logueado y no está en la página de login -> Patada al login
  if (!isLogged && !isLoginPage) { 
    window.location.href = 'login.html'; 
    return; 
  }

  // Si está logueado y no está en login -> Aplicar reglas de menú y seguridad
  if (isLogged && !isLoginPage) {
    document.addEventListener('DOMContentLoaded', () => {
      
      // Personalizar el nombre en el menú lateral
      const brandText = document.querySelector('.brand-text strong');
      if (brandText) brandText.textContent = 'Usuario: ' + (activeUser.charAt(0).toUpperCase() + activeUser.slice(1));

      const nav = document.querySelector('.nav');
      
      // Asegurar que el Admin vea "Usuarios" si se borró
      if (nav && role === 'admin' && !document.querySelector('a[href="usuarios.html"]')) {
         const usersLink = document.createElement('a'); usersLink.href = 'usuarios.html';
         if (path.includes('usuarios')) usersLink.classList.add('active');
         usersLink.innerHTML = '<span class="nav-icon">👥</span> Usuarios'; nav.appendChild(usersLink);
      }

      // Botón de Cerrar Sesión universal
      if (nav && !document.getElementById('btnLogout')) {
        const logoutBtn = document.createElement('a'); logoutBtn.id = 'btnLogout'; logoutBtn.href = '#';
        logoutBtn.innerHTML = '<span class="nav-icon">🚪</span> Cerrar sesión';
        logoutBtn.style.color = '#fca5a5'; logoutBtn.style.marginTop = '15px'; logoutBtn.style.borderTop = '1px solid rgba(255,255,255,0.1)'; logoutBtn.style.paddingTop = '15px';
        logoutBtn.onclick = (e) => { e.preventDefault(); logout(); }; nav.appendChild(logoutBtn);
      }

      // ========================================================
      // MOTOR DE PERMISOS: Ocultar links del menú no permitidos
      // ========================================================
      const navLinks = document.querySelectorAll('.sidebar .nav a:not(#btnLogout)');
      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if(href) {
          const moduleName = href.split('.html')[0]; 
          // 1. Ocultar si la nueva matriz D1 no lo permite (y no es el viejo "admin" que pasa libre)
          if (allowedModules.length > 0 && !allowedModules.includes(moduleName) && role !== 'admin') {
            link.style.display = 'none';
          }
          
          // 2. Retrocompatibilidad: Reglas rígidas viejas (por si entran con cuentas legacy)
          if (role !== 'admin' && moduleName === 'usuarios') link.style.display = 'none';
          if ((role === 'encargado' || role === 'pos') && (moduleName === 'dashboard' || moduleName === 'contable')) link.style.display = 'none';
          if (role === 'pos' && moduleName === 'stock') link.style.display = 'none';
        }
      });

      // GUARDAESPALDAS DE URL (Bloqueo si tipean la dirección a mano)
      if (allowedModules.length > 0 && !allowedModules.includes(currentPage) && role !== 'admin') {
        document.body.innerHTML = `
          <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif; background: #f8fafc; color: #334155;">
            <h1 style="font-size: 80px; margin: 0;">🛑</h1>
            <h2 style="font-size: 24px; margin: 10px 0;">Acceso Denegado</h2>
            <p style="margin-bottom: 20px;">Tu usuario no tiene permisos para ver este módulo.</p>
            <button onclick="window.location.href='ventas.html'" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Ir a Ventas</button>
          </div>
        `;
        return; // Detiene la ejecución visual
      }

      // Reglas estrictas legacy para Cajeros/POS en pantallas compartidas (Ej: Productos sin Formulario Alta)
      if (role === 'pos' || role === 'cajera') {
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

// Función para desloguearse (Limpiamos tanto variables nuevas D1 como viejas Legacy)
function logout() {
  localStorage.removeItem('activeUser');
  localStorage.removeItem('userRole');
  localStorage.removeItem('allowedModules');
  localStorage.removeItem('saas_logged_in');
  localStorage.removeItem('saas_username');
  localStorage.removeItem('saas_role');
  window.location.href = 'login.html';
}
