export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM sales ORDER BY createdAt DESC").all();
    const ventasFormateadas = results.map(venta => ({
      ...venta,
      items: JSON.parse(venta.itemsJSON || '[]'),
      client: venta.clientId 
    }));
    return Response.json(ventasFormateadas);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const itemsString = JSON.stringify(data.items || []);
    const isB2BNum = data.isB2B ? 1 : 0;
    const clientNameOrId = data.clientId || data.client || 'Consumidor Final';
    const vendedor = data.seller || 'Admin';

    await context.env.DB.prepare(`
      INSERT INTO sales (id, date, clientId, method, cupon, subtotal, promoDiscount, total, isB2B, itemsJSON, createdAt, seller) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `).bind(
      data.id, data.date || new Date().toISOString().split('T')[0], clientNameOrId, 
      data.method, data.cupon || '', data.subtotal, data.promoDiscount, data.total, isB2BNum, itemsString, data.createdAt, vendedor
    ).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    await context.env.DB.prepare("DELETE FROM sales WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
