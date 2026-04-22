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

    const user = await context.env.DB.prepare(`
      SELECT
        id,
        username,
        role,
        active,
        allowedModules,
        company_id
      FROM users
      WHERE username = ?1 AND password = ?2
      LIMIT 1
    `).bind(username, password).first();

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
        logo
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

    if (Number(company.active) !== 1) {
      return Response.json(
        { success: false, error: "La empresa está desactivada. Contactá al administrador." },
        { status: 403 }
      );
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
        logo: company.logo || ''
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message || "Error interno." },
      { status: 500 }
    );
  }
}
