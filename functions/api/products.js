function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    const { results } = await context.env.DB.prepare(
      "SELECT * FROM products WHERE company_id = ? ORDER BY name ASC"
    ).bind(companyId).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    const data = await context.request.json();

    const branchesString =
      typeof data.stock_branches === 'object'
        ? JSON.stringify(data.stock_branches)
        : (data.stock_branches || '{"Central":0}');

    await context.env.DB.prepare(`
      INSERT INTO products (
        id, company_id, name, code, category, cost, price, stock, status,
        promoType, promoValue, promoLinked, createdAt, stock_branches
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        code = excluded.code,
        category = excluded.category,
        cost = excluded.cost,
        price = excluded.price,
        stock = excluded.stock,
        status = excluded.status,
        promoType = excluded.promoType,
        promoValue = excluded.promoValue,
        promoLinked = excluded.promoLinked,
        stock_branches = excluded.stock_branches
    `).bind(
      data.id,
      companyId,
      data.name || '',
      data.code || '',
      data.category || '',
      Number(data.cost || 0),
      Number(data.price || 0),
      Number(data.stock || 0),
      data.status || 'Activo',
      data.promoType || '',
      Number(data.promoValue || 0),
      data.promoLinked || '',
      data.createdAt || new Date().toISOString(),
      branchesString
    ).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    await context.env.DB.prepare(
      "DELETE FROM products WHERE id = ?1 AND company_id = ?2"
    ).bind(id, companyId).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
