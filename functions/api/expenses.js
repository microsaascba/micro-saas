export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();

    // Como esta tabla maneja la contabilidad general, la usamos para registrar los egresos
    await context.env.DB.prepare(`
      INSERT INTO expenses (id, date, amount, concept, category, status, paymentMethod, dueDate, notes) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `).bind(
      data.id, data.date, data.amount, data.concept, 
      data.category, data.status, data.paymentMethod, 
      data.dueDate, data.notes
    ).run();

    return Response.json({ success: true, message: "Movimiento contable registrado" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
