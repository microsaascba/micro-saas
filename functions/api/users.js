export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT * FROM users ORDER BY createdAt DESC
    `).all();

    const usersFormatted = results.map(u => ({
      ...u,
      allowedModules: JSON.parse(u.allowedModules || '[]')
    }));

    return Response.json(usersFormatted);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const companyId = data.company_id;

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    // 🔹 Traer config del cliente
    const client = await context.env.DB.prepare(`
      SELECT max_users, allow_user_management
      FROM clients
      WHERE id = ?1
    `).bind(companyId).first();

    if (!client) {
      return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    // 🔴 Bloqueo total si no tiene permiso
    if (Number(client.allow_user_management) !== 1) {
      return Response.json({
        error: 'Tu plan no permite gestionar usuarios. Contactá al administrador.'
      }, { status: 403 });
    }

    // 🔴 Contar usuarios actuales
    const countResult = await context.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM users
      WHERE company_id = ?1
    `).bind(companyId).first();

    const totalUsers = Number(countResult?.total || 0);
    const maxUsers = Number(client.max_users || 1);

    const isNew = !data.id || !await context.env.DB.prepare(`
      SELECT id FROM users WHERE id = ?1
    `).bind(data.id).first();

    // 🔴 Bloqueo por límite
    if (isNew && totalUsers >= maxUsers) {
      return Response.json({
        error: `Límite de usuarios alcanzado (${maxUsers}). Actualizá tu plan.`
      }, { status: 403 });
    }

    // 🔴 Evitar crear otro admin
    if (data.role === 'admin') {
      const adminExists = await context.env.DB.prepare(`
        SELECT id FROM users
        WHERE company_id = ?1 AND role = 'admin' AND id != ?2
        LIMIT 1
      `).bind(companyId, data.id || '').first();

      if (adminExists) {
        return Response.json({
          error: 'Ya existe un administrador en esta cuenta.'
        }, { status: 403 });
      }
    }

    const allowed = JSON.stringify(data.allowedModules || []);

    await context.env.DB.prepare(`
      INSERT INTO users (
        id, username, password, role, active, createdAt, allowedModules, company_id
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password = excluded.password,
        role = excluded.role,
        active = excluded.active,
        allowedModules = excluded.allowedModules
    `).bind(
      data.id,
      data.username,
      data.password,
      data.role || 'vendedor',
      data.active ? 1 : 0,
      data.createdAt || new Date().toISOString(),
      allowed,
      companyId
    ).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    await context.env.DB.prepare(`
      DELETE FROM users WHERE id = ?1
    `).bind(id).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
