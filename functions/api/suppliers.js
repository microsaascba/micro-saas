export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM suppliers ORDER BY name ASC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO suppliers (id, name, cuit, phone, email, address, ivaCondition, contactPerson, notes, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT(id) DO UPDATE SET 
      name=excluded.name, cuit=excluded.cuit, phone=excluded.phone, email=excluded.email, 
      address=excluded.address, ivaCondition=excluded.ivaCondition, contactPerson=excluded.contactPerson, notes=excluded.notes
    `).bind(
      data.id, data.name, data.cuit || '', data.phone || '', data.email || '', 
      data.address || '', data.ivaCondition || 'Consumidor Final', data.contactPerson || '', 
      data.notes || '', data.createdAt || new Date().toISOString()
    ).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
