export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM sales ORDER BY createdAt DESC").all();
    
    // SQLite guarda los productos del ticket como texto, acá los volvemos a convertir a lista
    const ventasFormateadas = results.map(venta => ({
      ...venta,
      items: JSON.parse(venta.items || '[]')
    }));
    
    return Response.json(ventasFormateadas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // Convertimos la lista de productos del ticket a texto para que SQLite la acepte
    const itemsString = JSON.stringify(data.items || []);

    await context.env.DB.prepare(`
      INSERT INTO sales (id, code, date, createdAt, paymentMethod, voucher, subtotal, globalDiscount, total, items) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `).bind(
      data.id, data.code, data.date, data.createdAt, 
      data.paymentMethod, data.voucher, data.subtotal, 
      data.globalDiscount, data.total, itemsString
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
