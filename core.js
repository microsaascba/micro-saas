document.addEventListener("DOMContentLoaded", () => {
  // Obtenemos el nombre del archivo actual (ej: "facturacion")
  const path = window.location.pathname;
  const currentPage = path.split('/').pop().replace('.html', '') || 'dashboard';

  // Si estamos en la página de login, no aplicamos restricciones
  if (currentPage === 'login') return;

  // Leer datos de la memoria
  const activeUser = localStorage.getItem('activeUser');
  const allowedModules = JSON.parse(localStorage.getItem('allowedModules') || '[]');

  // 1. REGLA DE HIERRO: Si no hay usuario activo, patada al login
  if (!activeUser) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Personalizar el menú con el nombre del usuario real
  const userNameEl = document.getElementById('sidebarUserName');
  if (userNameEl) {
    userNameEl.textContent = `Usuario: ${activeUser.charAt(0).toUpperCase() + activeUser.slice(1)}`;
  }

  // 3. FILTRAR EL MENÚ LATERAL: Ocultar módulos no permitidos
  const navLinks = document.querySelectorAll('.sidebar .nav a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if(href) {
      const moduleName = href.split('.html')[0]; 
      // Si el módulo no está en la lista de permitidos, lo ocultamos
      if (!allowedModules.includes(moduleName)) {
        link.style.display = 'none';
      }
    }
  });

  // 4. GUARDAESPALDAS DE URL: Evitar ingresos directos tipeando la URL
  if (!allowedModules.includes(currentPage)) {
    document.body.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif; background: #f8fafc; color: #334155;">
        <h1 style="font-size: 80px; margin: 0;">🛑</h1>
        <h2 style="font-size: 24px; margin: 10px 0;">Acceso Denegado</h2>
        <p style="margin-bottom: 20px;">Tu usuario (${activeUser}) no tiene permisos para ver este módulo.</p>
        <button onclick="window.location.href='dashboard.html'" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Volver al Inicio</button>
      </div>
    `;
  }
});

// Función de utilidad para cerrar sesión (podés agregar un botón en tu UI que llame a esta función)
function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}
