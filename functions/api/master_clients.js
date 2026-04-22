export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const row = await context.env.DB.prepare(`
        SELECT *
        FROM clients
        WHERE id = ?1
        LIMIT 1
      `).bind(id).first();

      if (!row) {
        return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
      }

      return Response.json({
        ...row,
        active: Number(row.active) === 1,
        fee: Number(row.fee || 0),
        // CORRECCIÓN: Devolvemos camelCase para que el frontend lo entienda
        maxUsers: Number(row.max_users || 1),
        allowUsers: Number(row.allow_user_management || 0),
        maxBranches: Number(row.max_branches || 1),
        allowBranches: Number(row.allow_branch_management || 0),
        allowedModules: (() => {
          try { return JSON.parse(row.allowedModules || '[]'); } catch { return []; }
        })()
      });
    }

    const { results } = await context.env.DB.prepare(`
      SELECT *
      FROM clients
      ORDER BY createdAt DESC
    `).all();

    const formatted = results.map(c => ({
      ...c,
      active: Number(c.active) === 1,
      fee: Number(c.fee || 0),
      // CORRECCIÓN: Devolvemos camelCase para que el frontend lo entienda
      maxUsers: Number(c.max_users || 1),
      allowUsers: Number(c.allow_user_management || 0),
      maxBranches: Number(c.max_branches || 1),
      allowBranches: Number(c.allow_branch_management || 0),
      allowedModules: (() => {
        try { return JSON.parse(c.allowedModules || '[]'); } catch { return []; }
      })()
    }));

    return Response.json(formatted);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();

    await context.env.DB.prepare(`
      INSERT INTO clients (
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
        adminPass,
        type,
        createdAt,
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
      )
      VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
        ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
        ?21, ?22, ?23, ?24, ?25
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        contact = excluded.contact,
        phone = excluded.phone,
        email = excluded.email,
        cuil = excluded.cuil,
        address = excluded.address,
        fee = excluded.fee,
        dueDate = excluded.dueDate,
        active = excluded.active,
        adminUser = excluded.adminUser,
        adminPass = excluded.adminPass,
        type = excluded.type,
        ivaCondition = excluded.ivaCondition,
        status = excluded.status,
        allowedModules = excluded.allowedModules,
        city = excluded.city,
        province = excluded.province,
        country = excluded.country,
        logo = excluded.logo,
        max_users = excluded.max_users,
        allow_user_management = excluded.allow_user_management,
        max_branches = excluded.max_branches,
        allow_branch_management = excluded.allow_branch_management
    `).bind(
      data.id,
      data.name || '',
      data.contact || '',
      data.phone || '',
      data.email || '',
      data.cuil || '',
      data.address || '',
      Number(data.fee || 0),
      data.dueDate || '',
      data.active ? 1 : 0,
      data.adminUser || '',
      data.adminPass || '',
      data.type || 'client',
      data.createdAt || new Date().toISOString(),
      data.ivaCondition || '',
      data.status || 'Activo',
      JSON.stringify(data.allowedModules || []),
      data.city || '',
      data.province || '',
      data.country || 'Argentina',
      data.logo || '',
      // CORRECCIÓN: Leemos de data.maxUsers (camelCase) como lo manda el HTML
      Number(data.maxUsers || 1),
      data.allowUsers ? 1 : 0,
      Number(data.maxBranches || 1),
      data.allowBranches ? 1 : 0
    ).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const id = new URL(context.request.url).searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    await context.env.DB.prepare(`
      DELETE FROM clients
      WHERE id = ?1
    `).bind(id).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
