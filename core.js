/* ============================================================
   MICRO SAAS — core.js
   Funciones compartidas. Todos los módulos importan este archivo.
   ============================================================ */

// ── CLAVE DE LICENCIA DEL CLIENTE ────────────────────────────
// Cuando pases a "casas separadas", acá pegarás el ID único del cliente.
// Por ahora, lo dejamos en blanco para que agarre el primer cliente que crees en tu Master.
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

// ── Control de Sesión, Roles y Licencia SaaS ────────────────
(function checkSessionAndSecurity() {
  const isLogged = localStorage.getItem('saas_logged_in') === 'true';
  const role = localStorage.getItem('saas_role') || 'pos'; 
  const path = location.pathname.toLowerCase();
  const isLoginPage = path.includes('login');

  // --- 1. VERIFICACIÓN DE LICENCIA (Ping al Master) ---
  const masterDB = JSON.parse(localStorage.getItem('saas_db_clientes')) || [];
  // Toma el cliente específico o el primero que encuentre para la prueba
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
      return; // CORTAMOS LA EJECUCIÓN DEL CÓDIGO ACÁ. No carga nada más.
    }

    // B) Chequear si está cerca de vencer (5 días o menos) o ya venció
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
        
        // Insertarlo arriba de la estructura .app
        const appDiv = document.querySelector('.app');
        if (appDiv) {
          document.body.insertBefore(alertBar, appDiv);
          appDiv.style.height = 'calc(100vh - 44px)'; // Ajustar para que no rompa el scroll
        }
      });
    }
  }
  // ------------------------------------------------------------
  
  if (!isLogged && !isLoginPage) { window.location.href = 'login.html'; return; }

  if (isLogged && !isLoginPage) {
    
    if (role === 'pos' && (path.includes('dashboard') || path.includes('contable') || path.includes('stock') || path.includes('usuarios'))) {
      window.location.href = 'ventas.html'; return;
    }
    if (role === 'encargado' && (path.includes('dashboard') || path.includes('contable') || path.includes('usuarios'))) {
      window.location.href = 'ventas.html'; return;
    }

    document.addEventListener('DOMContentLoaded', () => {
      const brandText = document.querySelector('.brand-text strong');
      if (brandText) brandText.textContent = 'Usuario: ' + localStorage.getItem('saas_username');

      const nav = document.querySelector('.nav');
      if (nav && role === 'admin' && !document.querySelector('a[href="usuarios.html"]')) {
         const usersLink = document.createElement('a'); usersLink.href = 'usuarios.html';
         if (path.includes('usuarios')) usersLink.classList.add('active');
         usersLink.innerHTML = '<span class="nav-icon">👥</span> Usuarios'; nav.appendChild(usersLink);
      }

      if (nav && !document.getElementById('btnLogout')) {
        const logoutBtn = document.createElement('a'); logoutBtn.id = 'btnLogout'; logoutBtn.href = '#';
        logoutBtn.innerHTML = '<span class="nav-icon">🚪</span> Cerrar sesión';
        logoutBtn.style.color = '#fca5a5'; logoutBtn.style.marginTop = '15px'; logoutBtn.style.borderTop = '1px solid rgba(255,255,255,0.1)'; logoutBtn.style.paddingTop = '15px';
        logoutBtn.onclick = (e) => { e.preventDefault(); logout(); }; nav.appendChild(logoutBtn);
      }

      if (role !== 'admin') document.querySelectorAll('.nav a').forEach(link => { if (link.getAttribute('href')?.includes('usuarios')) link.style.display = 'none'; });
      if (role === 'encargado' || role === 'pos') document.querySelectorAll('.nav a').forEach(link => { const href = link.getAttribute('href') || ''; if (href.includes('dashboard') || href.includes('contable')) { link.style.display = 'none'; } });
      if (role === 'pos') document.querySelectorAll('.nav a').forEach(link => { const href = link.getAttribute('href') || ''; if (href.includes('stock')) { link.style.display = 'none'; } });

      if (role === 'pos') {
        const botonesProhibidos = ['#newProductBtn', '#importBtn', '#exportBtn', '#openAdjustBtn', '#btnOpenExpense', '#btnOpenSupplier'];
        botonesProhibidos.forEach(id => { const btn = document.querySelector(id); if (btn) btn.style.display = 'none'; });
        const css = document.createElement('style'); css.innerHTML = `th:last-child, td:last-child .row-actions, td:last-child .mini-btn { display: none !important; } .card-pad h2 { font-size: 16px; }`; document.head.appendChild(css);
        const formAlta = document.getElementById('productForm'); if (formAlta) formAlta.closest('article').style.display = 'none';
        const twoCol = document.querySelector('.two-col'); if (twoCol) twoCol.style.gridTemplateColumns = '1fr';
      }
    });
  }
})();

function logout() { localStorage.clear(); window.location.href = 'login.html'; }
