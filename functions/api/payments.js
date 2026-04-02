export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM payments ORDER BY date DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // 1. Guardar el registro del pago
    await context.env.DB.prepare(`
      INSERT INTO payments (id, clientId, date, amount, method, notes) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `).bind(data.id, data.clientId, data.date, data.amount, data.method, data.notes).run();

    // 2. Actualizar la fecha de vencimiento del cliente
    await context.env.DB.prepare(`
      UPDATE clients SET dueDate = ?1 WHERE id = ?2
    `).bind(data.newDueDate, data.clientId).run();

    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
