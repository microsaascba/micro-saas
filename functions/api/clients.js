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
      INSERT INTO clients (id, name, contact, phone, email, cuil, address, fee, dueDate, active, adminUser, adminPass, type, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    `).bind(
      data.id, data.name, data.contact, data.phone, data.email, 
      data.cuil || null, data.address || null, data.fee, data.dueDate, 
      1, data.adminUser || null, data.adminPass || null, data.type || 'client', 
      new Date().toISOString()
    ).run();

    // Solo creamos usuario en el sistema si se mandan credenciales (Los prospectos no mandan credenciales)
    if (data.adminUser && data.adminPass) {
      const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
      await context.env.DB.prepare(`INSERT INTO users (id, username, password, role, active, createdAt) VALUES (?1, ?2, ?3, 'admin', 1, ?4)`).bind(userId, data.adminUser, data.adminPass, new Date().toISOString()).run();
    }
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`
      UPDATE clients SET name=?1, contact=?2, phone=?3, email=?4, cuil=?5, address=?6, fee=?7, dueDate=?8, active=?9, adminUser=?10, adminPass=?11, type=?12 WHERE id=?13
    `).bind(
      data.name, data.contact, data.phone, data.email, data.cuil || null, data.address || null, 
      data.fee, data.dueDate, data.active ? 1 : 0, data.adminUser || null, data.adminPass || null, 
      data.type || 'client', data.id
    ).run();
    
    // Lógica para actualizar o crear el usuario del sistema al convertir un prospecto a cliente
    if (data.adminUser && data.adminPass) {
      if (data.oldAdminUser && data.oldAdminUser.trim() !== '') {
        await context.env.DB.prepare(`UPDATE users SET username=?1, password=?2 WHERE username=?3`).bind(data.adminUser, data.adminPass, data.oldAdminUser).run();
      } else {
        const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
        await context.env.DB.prepare(`INSERT INTO users (id, username, password, role, active, createdAt) VALUES (?1, ?2, ?3, 'admin', 1, ?4)`).bind(userId, data.adminUser, data.adminPass, new Date().toISOString()).run();
      }
    }
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const revoke = url.searchParams.get('revoke');
    const user = url.searchParams.get('user');

    if (revoke === 'true') {
      await context.env.DB.prepare("DELETE FROM users WHERE username = ?1").bind(user).run();
      await context.env.DB.prepare("UPDATE clients SET active = 0, adminPass = 'REVOCADO' WHERE id = ?1").bind(id).run();
      return Response.json({ success: true });
    }

    await context.env.DB.prepare("DELETE FROM clients WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
