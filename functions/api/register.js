export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const clientId = 'lead_' + Math.random().toString(36).substr(2, 9);
    const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Guardar como PROSPECTO en la tabla clients del Master
    await context.env.DB.prepare(`
      INSERT INTO clients (id, name, contact, phone, email, fee, dueDate, active, adminUser, adminPass, type, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, 1, ?7, ?8, 'lead', ?9)
    `).bind(clientId, data.name, data.name, data.phone, data.email, today, data.username, data.password, now).run();

    // 2. Crear usuario en el sistema para que ingrese a la Demo
    await context.env.DB.prepare(`
      INSERT INTO users (id, username, password, role, active, createdAt) 
      VALUES (?1, ?2, ?3, 'admin', 1, ?4)
    `).bind(userId, data.username, data.password, now).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
