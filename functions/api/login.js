function startOfDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(fromDate, toDate) {
  return Math.ceil((toDate - fromDate) / 86400000);
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();

    if (!username || !password) {
      return Response.json(
        { success: false, error: "Usuario y contraseña son obligatorios." },
        { status: 400 }
      );
    }

    // 1. Buscamos en la tabla de empleados (users)
    let user = await context.env.DB.prepare(`
      SELECT id, username, role, active, allowedModules, company_id, password
      FROM users
      WHERE username = ?1 AND password = ?2
      LIMIT 1
    `).bind(username, password).first();

    // 2. Si no es empleado, buscamos si es el Dueño/Admin en la tabla (clients)
    if (!user) {
      const clientAdmin = await context.env.DB.prepare(`
        SELECT 
          id as id, 
          adminUser as username, 
          'admin' as role, 
          active, 
          allowedModules, 
          id as company_id, 
          adminPass as password
        FROM clients
        WHERE adminUser = ?1 AND adminPass = ?2
        LIMIT 1
      `).bind(username, password).first();

      if (clientAdmin) {
        user = clientAdmin;
      }
    }

    // 3. Si no existe en ningún lado, rechazamos
    if (!user) {
      return Response.json(
        { success: false, error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    if (Number(user.active) !== 1) {
      return Response.json(
        { success: false, error: "Tu cuenta ha sido bloqueada. Contactá al administrador." },
        { status: 403 }
      );
    }

    // Buscamos la info de la empresa
    const company = await context.env.DB.prepare(`
      SELECT * FROM clients WHERE id = ?1 LIMIT 1
    `).bind(user.company_id).first();

    if (!company) {
      return Response.json(
        { success: false, error: "La empresa asociada al usuario no existe." },
        { status: 403 }
      );
    }

    // Lógica de fechas y vencimientos...
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = company.dueDate ? startOfDay(company.dueDate) : null;
    let daysToDue = null, daysPastDue = null, loginWarning = null;

    if (dueDate) {
      daysToDue = diffDays(today, dueDate);
      daysPastDue = daysToDue < 0 ? Math.abs(daysToDue) : 0;

      if (daysToDue <= -4) {
        await context.env.DB.prepare(`UPDATE clients SET active = 0 WHERE id = ?1`).bind(company.id).run();
        return Response.json({
            success: false,
            error: "Licencia vencida. La cuenta fue suspendida.",
            company: { id: company.id, name: company.name, dueDate: company.dueDate, daysPastDue }
        }, { status: 403 });
      }

      if (Number(company.active) !== 1) return Response.json({ success: false, error: "La empresa está desactivada." }, { status: 403 });

      if (daysToDue >= 0 && daysToDue <= 5) {
        loginWarning = { type: "upcoming_due", message: `Tu licencia vence en ${daysToDue} día(s).`, daysToDue };
      } else if (daysToDue < 0 && daysToDue >= -3) {
        loginWarning = { type: "grace_period", message: `Tu licencia está vencida hace ${daysPastDue} día(s). Tenés hasta 3 días de gracia.`, daysPastDue };
      }
    } else if (Number(company.active) !== 1) {
      return Response.json({ success: false, error: "La empresa está desactivada." }, { status: 403 });
    }

    // Parseo súper seguro de los módulos para evitar errores
    let finalModules = [];
    try {
      finalModules = typeof user.allowedModules === 'string' ? JSON.parse(user.allowedModules) : (user.allowedModules || []);
    } catch {
      finalModules = [];
    }

   return Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        allowedModules: finalModules,
        company_id: user.company_id
      },
      company: {
        id: company.id,
        name: company.name,
        logo: company.logo || '',
        active: Number(company.active) === 1,
        // 👇 AGREGAMOS TODOS LOS DATOS QUE FALTABAN QUE VIAJEN AL FRONTEND 👇
        phone: company.phone || '',
        address: company.address || '',
        city: company.city || '',
        country: company.country || '',
        ivaCondition: company.ivaCondition || '',
        cuil: company.cuil || '',
        cuit: company.cuil || '', // Lo mandamos duplicado por si el front usa cuit o cuil
        iibb: company.iibb || '',
        inicio_actividades: company.inicio_actividades || ''
      },
      warning: loginWarning
    });
