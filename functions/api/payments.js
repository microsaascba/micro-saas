export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM payments ORDER BY date DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`INSERT INTO payments (id, clientId, date, amount, method, notes, period) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(data.id, data.clientId, data.date, data.amount, data.method, data.notes, data.period).run();
    await context.env.DB.prepare(`UPDATE clients SET dueDate = ?1 WHERE id = ?2`).bind(data.newDueDate, data.clientId).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare("UPDATE payments SET date=?1, amount=?2, method=?3, notes=?4, period=?5 WHERE id=?6")
      .bind(data.date, data.amount, data.method, data.notes, data.period, data.id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const id = new URL(context.request.url).searchParams.get('id');
    await context.env.DB.prepare("DELETE FROM payments WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
