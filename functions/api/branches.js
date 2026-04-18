export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM branches ORDER BY name ASC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO branches (id, name, address, manager, phone, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(id) DO UPDATE SET 
      name=excluded.name, address=excluded.address, manager=excluded.manager, phone=excluded.phone
    `).bind(
      data.id, data.name, data.address || '', data.manager || '', data.phone || '', data.createdAt || new Date().toISOString()
    ).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    await context.env.DB.prepare("DELETE FROM branches WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
