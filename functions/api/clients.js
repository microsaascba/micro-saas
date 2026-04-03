export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM clients ORDER BY createdAt DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO clients (id, name, contact, phone, email, cuil, address, fee, dueDate, active, adminUser, adminPass, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    `).bind(data.id, data.name, data.contact, data.phone, data.email, data.cuil, data.address, data.fee, data.dueDate, 1, data.adminUser, data.adminPass, new Date().toISOString()).run();

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
    
    // 1. Actualizamos los datos y credenciales en la tabla del Master
    await context.env.DB.prepare(`
      UPDATE clients 
      SET name=?1, contact=?2, phone=?3, email=?4, cuil=?5, address=?6, fee=?7, dueDate=?8, active=?9, adminUser=?10, adminPass=?11 
      WHERE id=?12
    `).bind(data.name, data.contact, data.phone, data.email, data.cuil, data.address, data.fee, data.dueDate, data.active ? 1 : 0, data.adminUser, data.adminPass, data.id).run();
    
    // 2. Si cambiaron el usuario/contraseña, actualizamos también la tabla de usuarios del sistema
    if (data.oldAdminUser && data.adminUser) {
      await context.env.DB.prepare(`
        UPDATE users SET username=?1, password=?2 WHERE username=?3
      `).bind(data.adminUser, data.adminPass, data.oldAdminUser).run();
    }

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
