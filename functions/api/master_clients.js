export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT * FROM clients ORDER BY createdAt DESC
    `).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const c = await context.request.json();

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
        logo
      )
      VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
        ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21
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
        logo = excluded.logo
    `).bind(
      c.id,
      c.name || '',
      c.contact || '',
      c.phone || '',
      c.email || '',
      c.cuil || '',
      c.address || '',
      Number(c.fee || 0),
      c.dueDate || '',
      c.active ? 1 : 0,
      c.adminUser || '',
      c.adminPass || '',
      c.type || 'client',
      c.createdAt || new Date().toISOString(),
      c.ivaCondition || '',
      c.status || 'Activo',
      JSON.stringify(c.allowedModules || []),
      c.city || '',
      c.province || '',
      c.country || 'Argentina',
      c.logo || ''
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
      DELETE FROM clients WHERE id = ?1
    `).bind(id).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
