export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM products ORDER BY name ASC").all();
    return Response.json(results);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    // Aseguramos que las sucursales viajen como texto JSON
    const branchesString = typeof data.stock_branches === 'object' ? JSON.stringify(data.stock_branches) : (data.stock_branches || '{"Central":0}');

    await context.env.DB.prepare(`
      INSERT INTO products (id, name, code, category, cost, price, stock, status, promoType, promoValue, promoLinked, createdAt, stock_branches) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      ON CONFLICT(id) DO UPDATE SET 
      name=excluded.name, code=excluded.code, category=excluded.category, cost=excluded.cost, price=excluded.price, stock=excluded.stock, status=excluded.status, promoType=excluded.promoType, promoValue=excluded.promoValue, promoLinked=excluded.promoLinked, stock_branches=excluded.stock_branches
    `).bind(
      data.id, data.name, data.code, data.category, data.cost, data.price, data.stock, data.status, 
      data.promoType, data.promoValue, data.promoLinked || '', data.createdAt || new Date().toISOString(), branchesString
    ).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    await context.env.DB.prepare("DELETE FROM products WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
