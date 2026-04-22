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

    // 1. Buscar primero en la tabla de empleados / sub-usuarios (users)
    let user = await context.env.DB.prepare(`
      SELECT
        id,
        username,
        role,
        active,
        allowedModules,
        company_id,
        password
      FROM users
      WHERE username = ?1 AND password = ?2
      LIMIT 1
    `).bind(username, password).first();

    // 2. Si no se encontró, buscar si es el Administrador Principal (Dueño de la empresa) en la tabla clients
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
        user = clientAdmin; // Si coincide, lo tratamos como un usuario con rol 'admin'
      }
    }

    // 3. Si no existe en ninguna de las dos tablas, rechazamos el login
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

    if (!user.company_id) {
      return Response.json(
        { success: false, error: "El usuario no tiene empresa asignada." },
        { status: 403 }
      );
    }

    const company = await context.env.DB.prepare(`
      SELECT
        id,
        name,
        contact,
        phone,
        email,
        cuil,
        address,
        fee,
        dueDate,
        active,
        adminUser,
        type,
        ivaCondition,
        status,
        allowedModules,
        city,
        province,
        country,
        logo,
        max_users,
        allow_user_management,
        max_branches,
        allow_branch_management
      FROM clients
      WHERE id = ?1
      LIMIT 1
    `).bind(user.company_id).first();

    if (!company) {
      return Response.json(
        { success: false, error: "La empresa asociada al usuario no existe." },
        { status: 403 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = company.dueDate ? startOfDay(company.dueDate) : null;
    let daysToDue = null;
    let daysPastDue = null;
    let loginWarning = null;

    if (dueDate) {
      daysToDue = diffDays(today, dueDate);
      daysPastDue = daysToDue < 0 ? Math.abs(daysToDue) : 0;

      if (daysToDue <= -4) {
        await context.env.DB.prepare(`
          UPDATE clients
          SET active = 0
          WHERE id = ?1
        `).bind(company.id).run();

        await context.env.DB.prepare(`
          UPDATE users
          SET active = 0
          WHERE company_id = ?1
        `).bind(company.id).run();

        return Response.json(
          {
            success: false,
            error: "Licencia vencida. La cuenta fue suspendida automáticamente por superar los 3 días de gracia.",
            code: "LICENSE_SUSPENDED",
            company: {
              id: company.id,
              name: company.name,
              dueDate: company.dueDate,
              daysPastDue
            }
          },
          { status: 403 }
        );
      }

      if (Number(company.active) !== 1) {
        return Response.json(
          { success: false, error: "La empresa está desactivada. Contactá al administrador." },
          { status: 403 }
        );
      }

      if (daysToDue >= 0 && daysToDue <= 5) {
        loginWarning = {
          type: "upcoming_due",
          message: `Tu licencia vence en ${daysToDue} día${daysToDue === 1 ? '' : 's'}.`,
          daysToDue
        };
      }

      if (daysToDue < 0 && daysToDue >= -3) {
        loginWarning = {
          type: "grace_period",
          message: `Tu licencia está vencida hace ${daysPastDue} día${daysPastDue === 1 ? '' : 's'}. Tenés hasta 3 días de gracia.`,
          daysPastDue
        };
      }
    } else {
      if (Number(company.active) !== 1) {
        return Response.json(
          { success: false, error: "La empresa está desactivada. Contactá al administrador." },
          { status: 403 }
        );
      }
    }

    let userModules = [];
    let companyModules = [];

    try {
      userModules = JSON.parse(user.allowedModules || "[]");
    } catch {
      userModules = [];
    }

    try {
      companyModules = JSON.parse(company.allowedModules || "[]");
    } catch {
      companyModules = [];
    }

    // Si es el admin principal (desde clients), userModules será igual a companyModules.
    const finalModules =
      Array.isArray(userModules) && userModules.length > 0
        ? userModules
        : companyModules;

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
        contact: company.contact || '',
        phone: company.phone || '',
        email: company.email || '',
        cuil: company.cuil || '',
        address: company.address || '',
        fee: Number(company.fee || 0),
        dueDate: company.dueDate || '',
        active: Number(company.active) === 1,
        type: company.type || 'client',
        ivaCondition: company.ivaCondition || '',
        status: company.status || 'Activo',
        allowedModules: companyModules,
        city: company.city || '',
        province: company.province || '',
        country: company.country || 'Argentina',
        logo: company.logo || '',
        max_users: Number(company.max_users || 1),
        allow_user_management: Number(company.allow_user_management || 0),
        max_branches: Number(company.max_branches || 1),
        allow_branch_management: Number(company.allow_branch_management || 0)
      },
      license: {
        dueDate: company.dueDate || '',
        daysToDue,
        daysPastDue
      },
      warning: loginWarning
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message || "Error interno." },
      { status: 500 }
    );
  }
}
