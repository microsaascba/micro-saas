/* ============================================================
   MICRO SAAS — core.js
   Funciones compartidas. Todos los módulos importan este archivo.
   ============================================================ */

// ── CLAVE DE LICENCIA DEL CLIENTE ────────────────────────────
const SAAS_LICENSE_ID = '';

// ── Claves de localStorage ───────────────────────────────────
const KEYS = {
  products: 'saas_products',
  sales: 'saas_sales',
  expenses: 'saas_expenses',
  supplierDebts: 'saas_supplier_debts',
  supplierPayments: 'saas_supplier_payments',
  stockAdjustments: 'saas_stock_adjustments',
  purchases: 'saas_purchases',
  stockMovements: 'saas_stock_movements',
  contableEntries: 'saas_contable_entries',
  dashboard: 'saas_dashboard_summary',
};

// ── Helpers Globales ─────────────────────────────────────────
function getData(key, fallback = []) {
  try {
    return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : fallback;
  } catch {
    return fallback;
  }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('saas:data-updated', { detail: { key } }));
}

function currency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function percent(value, decimals = 1) {
  return Number(value || 0).toFixed(decimals) + '%';
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return value;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function nowReadable() {
  return new Date().toLocaleString('es-AR');
}

function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCompanyId() {
  return localStorage.getItem('company_id') || '';
}

function getActiveUser() {
  return localStorage.getItem('activeUser') || localStorage.getItem('saas_username') || '';
}

function getUserRole() {
  return localStorage.getItem('userRole') || localStorage.getItem('saas_role') || '';
}

function getAllowedModules() {
  try {
    // 1. Buscamos la lista de módulos permitidos
    let modulesStr = localStorage.getItem('allowedModules');
    if (modulesStr) return JSON.parse(modulesStr);

    // 2. Si no está directo, lo buscamos dentro de user (como guarda tu login)
    let userStr = localStorage.getItem('user');
    if (userStr) {
      let userData = JSON.parse(userStr);
      return userData.allowedModules || [];
    }
    return [];
  } catch {
    return [];
  }
}

async function apiFetch(url, options = {}) {
  const companyId = getCompanyId();
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (companyId) headers['x-company-id'] = companyId;

  return fetch(url, {
    ...options,
    headers
  });
}

function saleTotal(sale) {
  if (typeof sale.total === 'number') return sale.total;
  if (Array.isArray(sale.items)) {
    return sale.items.reduce((a, i) => a + (toNum(i.subtotal) || toNum(i.quantity) * toNum(i.price)), 0);
  }
  return 0;
}

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

function logout() {
  localStorage.removeItem('activeUser');
  localStorage.removeItem('userRole');
  localStorage.removeItem('allowedModules');
  localStorage.removeItem('user');
  localStorage.removeItem('company_id');
  localStorage.removeItem('saas_logged_in');
  localStorage.removeItem('saas_username');
  localStorage.removeItem('saas_role');
  window.location.href = 'login.html';
}

// --- LÓGICA DE MENÚ RESPONSIVE ---
window.toggleMenu = function () {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
};

// ── Lógica Principal que se ejecuta al cargar la página ──────
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.toLowerCase();
  const currentPage = path.split('/').pop().replace('.html', '') || 'dashboard';
  const isLoginPage = path.includes('login');
  const companyId = getCompanyId();

  // Marcar menú activo
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.includes(currentPage)) a.classList.add('active');
  });

  // Cerrar menú en móviles al hacer clic
  document.querySelectorAll('.sidebar .nav a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
      }
    });
  });

  if (!companyId && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  // --- VERIFICACIÓN DE LICENCIA SAAS ---
  const masterDB = JSON.parse(localStorage.getItem('saas_db_clientes')) || [];
  const licencia = masterDB.find(c => c.id === SAAS_LICENSE_ID) || masterDB[0];

  if (licencia) {
    if (!licencia.active) {
      document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:#fff; text-align:center; padding:20px; font-family:sans-serif; width: 100vw; margin: 0;">
          <div style="background: #1e293b; padding: 40px; border-radius: 16px; border-top: 5px solid #ef4444; max-width: 500px; width: 100%;">
            <div style="font-size: 50px; margin-bottom: 20px;">🔒</div>
            <h1 style="color:#ef4444; font-size:24px; margin-bottom: 10px;">SERVICIO SUSPENDIDO</h1>
            <p style="font-size:16px; color:#94a3b8; line-height: 1.5; margin-bottom: 25px;">La licencia operativa de este sistema se encuentra temporalmente inactiva por falta de pago o revisión administrativa.</p>
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #f8fafc;">Comercio: <strong>${licencia.name}</strong></p>
            </div>
            <p style="font-size:14px; color:#64748b;">Comunícate con Soporte para regularizar el servicio.</p>
          </div>
        </div>
      `;
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vto = new Date(licencia.dueDate);
    vto.setHours(0, 0, 0, 0);
    const diffDias = Math.ceil((vto - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias <= 5 && !isLoginPage) {
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
    }
  }

  // --- CONTROL DE SESIÓN, PERMISOS Y TERMINAL FÍSICA ---
  const activeUser = getActiveUser();
  const role = getUserRole();
  const isLogged = (activeUser !== null && activeUser !== '') || (localStorage.getItem('saas_logged_in') === 'true');
  const allowedModules = getAllowedModules();
  
  console.log("Rol:", role);
  console.log("Módulos permitidos cargados:", allowedModules);

  const terminalBranch = localStorage.getItem('terminal_assigned_branch');

  if (!isLogged && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  if (isLogged && !isLoginPage) {
    const brandText = document.querySelector('.brand-text strong');
    if (brandText) {
      brandText.textContent = 'Usuario: ' + (activeUser.charAt(0).toUpperCase() + activeUser.slice(1));
    }

    const nav = document.querySelector('.nav');

    if (nav) {
      const branchIndicator = document.createElement('div');
      branchIndicator.style = "padding: 12px; margin-bottom: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #475569; border-left: 4px solid " + (terminalBranch ? "#10b981" : "#ef4444");
      branchIndicator.innerHTML = terminalBranch 
        ? `📍 PC Asignada:<br><strong style="color:#0f172a; font-size:13px;">${escapeHtml(terminalBranch)}</strong>` 
        : `⚠️ Terminal Libre<br><small>No vinculada a sucursal</small>`;
      nav.prepend(branchIndicator);

      if (!document.querySelector('a[href="sucursales.html"]')) {
        const sucLink = document.createElement('a');
        sucLink.href = 'sucursales.html';
        sucLink.setAttribute('data-module', 'sucursales');
        if (currentPage === 'sucursales') sucLink.classList.add('active');
        sucLink.innerHTML = '<span class="nav-icon">🏪</span> Sucursales';
        nav.appendChild(sucLink);
      }

      if (role === 'admin' && !document.querySelector('a[href="usuarios.html"]')) {
        const usersLink = document.createElement('a');
        usersLink.href = 'usuarios.html';
        usersLink.setAttribute('data-module', 'usuarios');
        if (currentPage === 'usuarios') usersLink.classList.add('active');
        usersLink.innerHTML = '<span class="nav-icon">👥</span> Usuarios';
        nav.appendChild(usersLink);
      }

      if (!document.getElementById('btnLogout')) {
        const logoutBtn = document.createElement('a');
        logoutBtn.id = 'btnLogout';
        logoutBtn.href = '#';
        logoutBtn.innerHTML = '<span class="nav-icon">🚪</span> Cerrar sesión';
        logoutBtn.style.color = '#ef4444';
        logoutBtn.style.marginTop = '15px';
        logoutBtn.style.borderTop = '1px solid #e2e8f0';
        logoutBtn.style.paddingTop = '15px';
        logoutBtn.onclick = (e) => {
          e.preventDefault();
          logout();
        };
        nav.appendChild(logoutBtn);
      }
    }

    const sensitiveModules = ['facturacion', 'stock', 'ventas'];
    if (role !== 'admin' && !terminalBranch && sensitiveModules.includes(currentPage)) {
      document.body.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding: 20px;">
          <h1 style="font-size: 60px; margin: 0;">🖥️</h1>
          <h2 style="color: #ef4444;">Terminal No Autorizada</h2>
          <p>Esta computadora no ha sido vinculada a ninguna sucursal todavía.</p>
          <p style="color: #94a3b8; font-size: 14px;">Solicitá al Administrador que configure este dispositivo.</p>
          <button onclick="logout()" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 8px; cursor: pointer;">Cerrar Sesión</button>
        </div>
      `;
      return;
    }

    // --- ELIMINAR MÓDULOS NO CONTRATADOS DEL DOM ---
    if (allowedModules.length > 0) {
      document.querySelectorAll('.nav a[data-module]').forEach(link => {
        const moduleName = link.getAttribute('data-module');
        if (!allowedModules.includes(moduleName)) {
          link.remove(); // Se elimina incluso para el dueño si no pagó por ello
        }
      });
    }

    // --- RESTRICCIONES EXTRA POR ROL DE EMPLEADO ---
    document.querySelectorAll('.sidebar .nav a:not(#btnLogout)').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const moduleName = href.split('.html')[0];
        if (role !== 'admin' && (moduleName === 'usuarios' || moduleName === 'sucursales')) link.style.display = 'none';
        if ((role === 'encargado' || role === 'pos') && (moduleName === 'dashboard' || moduleName === 'contable')) link.style.display = 'none';
        if (role === 'pos' && moduleName === 'stock') link.style.display = 'none';
      }
    });

    // --- REDIRECCIÓN SI INTENTA ENTRAR FORZADO POR URL ---
    const modulosOmitidos = ['dashboard', 'login', 'index']; 
    if (allowedModules.length > 0 && !allowedModules.includes(currentPage) && !modulosOmitidos.includes(currentPage)) {
      
      let homePage = 'dashboard.html';
      if (role === 'administrativo') homePage = 'contable.html';
      if (role === 'cajera' || role === 'vendedora' || role === 'pos') homePage = 'facturacion.html';

      const homeModule = homePage.replace('.html', '');
      if (!allowedModules.includes(homeModule)) {
        homePage = allowedModules.length > 0 ? allowedModules[0] + '.html' : 'login.html';
      }

      document.body.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif; background: #f8fafc; color: #334155;">
          <h1 style="font-size: 80px; margin: 0;">🛑</h1>
          <h2 style="font-size: 24px; margin: 10px 0;">Módulo Bloqueado</h2>
          <p style="margin-bottom: 20px;">No cuentas con acceso a este módulo.</p>
          <button onclick="window.location.href='${homePage}'" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Ir a mi panel principal</button>
        </div>
      `;
      return;
    }

    // --- LÓGICA CAJA / POS ---
    if (role === 'pos' || role === 'cajera') {
      const botonesProhibidos = ['#newProductBtn', '#importBtn', '#exportBtn', '#openAdjustBtn', '#btnOpenExpense', '#btnOpenSupplier'];
      botonesProhibidos.forEach(id => {
        const btn = document.querySelector(id);
        if (btn) btn.style.display = 'none';
      });

      const css = document.createElement('style');
      css.innerHTML = `th:last-child, td:last-child .row-actions, td:last-child .mini-btn { display: none !important; } .card-pad h2 { font-size: 16px; }`;
      document.head.appendChild(css);

      const formAlta = document.getElementById('productForm');
      if (formAlta) formAlta.closest('article').style.display = 'none';

      const twoCol = document.querySelector('.two-col');
      if (twoCol) twoCol.style.gridTemplateColumns = '1fr';
    }
  }

  // --- CSS GLOBAL ---
  const globalCss = document.createElement('style');
  globalCss.innerHTML = `
    html, body { overflow-x: hidden !important; }
    .app { overflow-x: visible !important; align-items: start !important; }

    @media (min-width: 769px) {
      .sidebar {
        height: 100vh !important;
        position: sticky !important;
        top: 0 !important;
        overflow-y: auto !important;
        display: flex !important;
        flex-direction: column !important;
      }
    }

    .sidebar::-webkit-scrollbar { width: 5px; }
    .sidebar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
    .sidebar::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(globalCss);


   // --- ALERTAS DE CASH FLOW (POP-UP SOLO PARA ADMIN AL INICIAR) ---
    if (role === 'admin' && !sessionStorage.getItem('cashFlowAlertShown') && isLogged && !isLoginPage) {
        setTimeout(async () => {
            try {
                const res = await fetch('/api/alerts', { headers: { 'x-company-id': localStorage.getItem('company_id') || '' } });
                if (!res.ok) return;
                const data = await res.json();

                if ((data.payables && data.payables.length > 0) || (data.receivables && data.receivables.length > 0)) {
                    const modalHtml = `
                    <dialog id="modalCashFlow" style="width: 90%; max-width: 450px; padding: 0; border: none; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); background: #fff;">
                        <div style="padding: 24px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                                <h2 style="margin: 0; color: #dc2626; font-size: 18px; display: flex; align-items: center; gap: 8px;"><span>⚠️</span> Alertas de Cash Flow</h2>
                                <button onclick="document.getElementById('modalCashFlow').close()" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #64748b;">✕</button>
                            </div>

                            ${data.payables.length > 0 ? `
                            <div style="margin-bottom: 20px;">
                                <h3 style="font-size: 11px; text-transform: uppercase; color: #b45309; margin: 0 0 10px 0; font-weight: 800;">🔴 Cuentas por Pagar (Por vencer)</h3>
                                <ul style="margin:0; padding:0; list-style:none;">
                                    ${data.payables.map(p => `
                                    <li style="padding: 10px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                                            <strong>${escapeHtml(p.supplierName)}</strong>
                                            <strong style="color: #b45309;">$${p.amount.toLocaleString('es-AR')}</strong>
                                        </div>
                                        <div style="color: #78350f; font-size: 11px;">${escapeHtml(p.concept)} (Vence: ${new Date(p.dueDate).toLocaleDateString('es-AR')})</div>
                                    </li>`).join('')}
                                </ul>
                            </div>` : ''}

                            ${data.receivables.length > 0 ? `
                            <div>
                                <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 10px 0; font-weight: 800;">🔵 Cuentas por Cobrar (> 30 días)</h3>
                                <ul style="margin:0; padding:0; list-style:none;">
                                    ${data.receivables.map(r => `
                                    <li style="padding: 10px; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                                            <strong>${escapeHtml(r.name)}</strong>
                                            <strong style="color: #0369a1;">$${r.balance.toLocaleString('es-AR')}</strong>
                                        </div>
                                        <div style="color: #0c4a6e; font-size: 11px;">Último movimiento: ${new Date(r.last_movement).toLocaleDateString('es-AR')}</div>
                                    </li>`).join('')}
                                </ul>
                            </div>` : ''}

                            <div style="text-align: right; margin-top: 25px;">
                                <button class="btn btn-primary" onclick="document.getElementById('modalCashFlow').close()" style="background: #0f172a; border-color: #0f172a; width: 100%;">Entendido</button>
                            </div>
                        </div>
                    </dialog>`;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    document.getElementById('modalCashFlow').showModal();
                    sessionStorage.setItem('cashFlowAlertShown', 'true'); // Solo se muestra una vez por sesión
                }
            } catch(e) { console.error(e); }
        }, 1500); // 1.5 segundos de delay para que no pise la carga inicial de las pantallas
    }

   
});

