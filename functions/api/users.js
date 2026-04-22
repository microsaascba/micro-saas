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
        allowedModules = excluded.allowedModules,
        company_id = excluded.company_id
    `).bind(
      data.id,
      data.username,
      data.password,
      data.role || 'admin',
      data.active ? 1 : 0,
      data.createdAt || new Date().toISOString(),
      allowed,
      data.company_id || ''
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
