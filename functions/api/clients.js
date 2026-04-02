export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM clients ORDER BY createdAt DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // 1. Guardar el Cliente en el Master
    await context.env.DB.prepare(`
      INSERT INTO clients (id, name, contact, phone, fee, dueDate, active, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(data.id, data.name, data.contact, data.phone, data.fee, data.dueDate, 1, new Date().toISOString()).run();

    // 2. MÁGIA: Crear el usuario Administrador para este cliente
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
    await context.env.DB.prepare("UPDATE clients SET name=?1, contact=?2, phone=?3, fee=?4, dueDate=?5, active=?6 WHERE id=?7")
      .bind(data.name, data.contact, data.phone, data.fee, data.dueDate, data.active ? 1 : 0, data.id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const id = new URL(context.request.url).searchParams.get('id');
    await context.env.DB.prepare("DELETE FROM clients WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
