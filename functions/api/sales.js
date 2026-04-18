export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM sales ORDER BY date DESC").all();
    
    // SQLite guarda los productos del ticket como texto, acá los volvemos a convertir a lista
    const ventasFormateadas = results.map(venta => ({
      ...venta,
      items: JSON.parse(venta.itemsJSON || '[]'),
      client: venta.clientId // Para que el frontend lea el nombre/ID
    }));
    
    return Response.json(ventasFormateadas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // Convertimos la lista de productos del ticket a texto para SQLite
    const itemsString = JSON.stringify(data.items || []);
    
    // Transformamos isB2B a número (1 o 0)
    const isB2BNum = data.isB2B ? 1 : 0;
    
    // Determinamos qué guardar en cliente
    const clientNameOrId = data.clientId || data.client || 'Consumidor Final';

    await context.env.DB.prepare(`
      INSERT INTO sales (id, date, clientId, method, subtotal, promoDiscount, total, isB2B, itemsJSON) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `).bind(
      data.id, 
      data.date || new Date().toISOString().split('T')[0], 
      clientNameOrId, 
      data.method, 
      data.subtotal, 
      data.promoDiscount, 
      data.total, 
      isB2BNum, 
      itemsString
    ).run();

    return Response.json({ success: true, message: "Venta procesada con éxito" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    
    await context.env.DB.prepare("DELETE FROM sales WHERE id = ?1").bind(id).run();
    
    return Response.json({ success: true, message: "Venta eliminada" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
