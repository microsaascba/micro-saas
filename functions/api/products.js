export async function onRequestGet(context) {
  try {
    // Pedimos todos los registros a tu base de datos D1
    const { results } = await context.env.DB.prepare("SELECT * FROM products ORDER BY createdAt DESC").all();
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    // Recibimos los datos nuevos que manda tu web
    const data = await context.request.json();
    
    // Insertamos la nueva fila en la tabla de D1
    await context.env.DB.prepare(`
      INSERT INTO products (id, name, category, status, cost, extraCosts, price, targetMargin, stock, stockMin, sku, image, active, createdAt, updatedAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
    `).bind(
      data.id, data.name, data.category, data.status, 
      data.cost, data.extraCosts, data.price, data.targetMargin, 
      data.stock, data.stockMin, data.sku, data.image, 
      data.active, data.createdAt, data.updatedAt
    ).run();

    return Response.json({ success: true, message: "Producto guardado" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
