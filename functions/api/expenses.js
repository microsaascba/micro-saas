export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO expenses (id, date, amount, concept, category, status, method, dueDate, notes, createdAt, supplierId, invoiceType, invoiceNum) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      ON CONFLICT(id) DO UPDATE SET 
      date=excluded.date, amount=excluded.amount, concept=excluded.concept, category=excluded.category, status=excluded.status, method=excluded.method, dueDate=excluded.dueDate, notes=excluded.notes, supplierId=excluded.supplierId, invoiceType=excluded.invoiceType, invoiceNum=excluded.invoiceNum
    `).bind(
      data.id, data.date, data.amount, data.concept, data.category, data.status, data.method, 
      data.dueDate || null, data.notes || '', data.createdAt || new Date().toISOString(),
      data.supplierId || '', data.invoiceType || 'Interno', data.invoiceNum || '',
      data.ivaAmount || 0, data.nonTaxedAmount || 0 // <-- NUEVOS CAMPOS
    ).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    await context.env.DB.prepare("DELETE FROM expenses WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
