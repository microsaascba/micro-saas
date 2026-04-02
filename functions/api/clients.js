export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM clients ORDER BY createdAt DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    // Agregamos email y el parámetro ?9
    await context.env.DB.prepare(`
      INSERT INTO clients (id, name, contact, phone, email, fee, dueDate, active, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `).bind(data.id, data.name, data.contact, data.phone, data.email, data.fee, data.dueDate, 1, new Date().toISOString()).run();

    if (data.adminUser && data.adminPass) {
      const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
      await context.env.DB.prepare(`
        INSERT INTO users (id, username, password, role, active, createdAt) 
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `).bind(userId, data.adminUser, data.adminPass, 'admin', 1, new Date().toISOString()).run();
    }
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare("UPDATE clients SET name=?1, contact=?2, phone=?3, email=?4, fee=?5, dueDate=?6, active=?7 WHERE id=?8")
      .bind(data.name, data.contact, data.phone, data.email, data.fee, data.dueDate, data.active ? 1 : 0, data.id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
