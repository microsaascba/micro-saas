export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM clients ORDER BY createdAt DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    // 1. Crear el cliente
    await context.env.DB.prepare(`
      INSERT INTO clients (id, name, contact, phone, email, cuil, address, fee, dueDate, active, adminUser, adminPass, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    `).bind(data.id, data.name, data.contact, data.phone, data.email, data.cuil, data.address, data.fee, data.dueDate, 1, data.adminUser, data.adminPass, new Date().toISOString()).run();

    // 2. Crear su usuario en el sistema
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
    
    // 1. Actualizamos los datos del cliente en el Master
    await context.env.DB.prepare(`
      UPDATE clients 
      SET name=?1, contact=?2, phone=?3, email=?4, cuil=?5, address=?6, fee=?7, dueDate=?8, active=?9, adminUser=?10, adminPass=?11 
      WHERE id=?12
    `).bind(data.name, data.contact, data.phone, data.email, data.cuil, data.address, data.fee, data.dueDate, data.active ? 1 : 0, data.adminUser, data.adminPass, data.id).run();
    
    // 2. Sincronizamos con el Sistema (El Login)
    if (data.adminUser && data.adminPass) {
      if (data.oldAdminUser && data.oldAdminUser.trim() !== '') {
        // A) Si el cliente YA TENÍA un usuario viejo, lo actualizamos.
        await context.env.DB.prepare(`
          UPDATE users SET username=?1, password=?2 WHERE username=?3
        `).bind(data.adminUser, data.adminPass, data.oldAdminUser).run();
      } else {
        // B) Si el cliente es viejo y NO TENÍA usuario (o está vacío), se lo CREAMOS de cero.
        const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
        await context.env.DB.prepare(`
          INSERT INTO users (id, username, password, role, active, createdAt) 
          VALUES (?1, ?2, ?3, 'admin', 1, ?4)
        `).bind(userId, data.adminUser, data.adminPass, new Date().toISOString()).run();
      }
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
