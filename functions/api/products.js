export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM products ORDER BY name ASC").all();
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const p = await context.request.json();
    
    await context.env.DB.prepare(`
      INSERT INTO products (id, name, code, category, cost, price, stock, status, promoType, promoValue, promoLinked) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ON CONFLICT(id) DO UPDATE SET 
      name=excluded.name, code=excluded.code, category=excluded.category, cost=excluded.cost, price=excluded.price, stock=excluded.stock, status=excluded.status, promoType=excluded.promoType, promoValue=excluded.promoValue, promoLinked=excluded.promoLinked
    `).bind(
      p.id, p.name, p.code || '', p.category || '', 
      p.cost || 0, p.price || 0, p.stock || 0, p.status || 'Activo', 
      p.promoType || 'none', p.promoValue || 0, p.promoLinked || ''
    ).run();
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    await context.env.DB.prepare("DELETE FROM products WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
