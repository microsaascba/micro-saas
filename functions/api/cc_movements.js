export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM cc_movements ORDER BY date DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const c = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO cc_movements (id, clientId, date, type, amount, concept) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(id) DO UPDATE SET 
      clientId=excluded.clientId, date=excluded.date, type=excluded.type, amount=excluded.amount, concept=excluded.concept
    `).bind(c.id, c.clientId, c.date, c.type, c.amount, c.concept).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
