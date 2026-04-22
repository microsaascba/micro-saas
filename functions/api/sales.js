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
      "SELECT * FROM sales WHERE company_id = ? ORDER BY createdAt DESC"
    ).bind(companyId).all();

    const ventasFormateadas = results.map(venta => ({
      ...venta,
      items: JSON.parse(venta.itemsJSON || '[]'),
      client: venta.clientId
    }));

    return Response.json(ventasFormateadas);
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
    const items = Array.isArray(data.items) ? data.items : [];
    const itemsString = JSON.stringify(items);
    const isB2BNum = data.isB2B ? 1 : 0;
    const clientNameOrId = data.clientId || data.client || 'Consumidor Final';
    const vendedor = data.seller || 'Admin';
    const sucursal = data.branch || 'Central';

    if (items.length > 0) {
      for (const item of items) {
        const productId = item.id || item.productId;
        const qty = Number(item.qty || item.quantity || 0);

        if (!productId || qty <= 0) continue;

        const { results } = await context.env.DB.prepare(
          "SELECT id, stock_branches, stock FROM products WHERE id = ? AND company_id = ?"
        ).bind(productId, companyId).all();

        if (results.length > 0) {
          const prod = results[0];
          let branches = {};

          try {
            branches = JSON.parse(prod.stock_branches || '{}');
          } catch (e) {
            branches = { Central: Number(prod.stock || 0) };
          }

          if (typeof branches !== 'object' || branches === null) {
            branches = { Central: Number(prod.stock || 0) };
          }

          if (branches[sucursal] === undefined) branches[sucursal] = 0;

          branches[sucursal] = Number(branches[sucursal] || 0) - qty;

          let newTotalStock = 0;
          for (const b in branches) {
            newTotalStock += Number(branches[b] || 0);
          }

          await context.env.DB.prepare(
            "UPDATE products SET stock = ?, stock_branches = ? WHERE id = ? AND company_id = ?"
          ).bind(
            newTotalStock,
            JSON.stringify(branches),
            productId,
            companyId
          ).run();
        }
      }
    }

    await context.env.DB.prepare(`
      INSERT INTO sales (
        id, company_id, date, clientId, method, cupon, subtotal,
        promoDiscount, total, isB2B, itemsJSON, createdAt, seller, branch
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    `).bind(
      data.id,
      companyId,
      data.date || new Date().toISOString().split('T')[0],
      clientNameOrId,
      data.method || '',
      data.cupon || '',
      Number(data.subtotal || 0),
      Number(data.promoDiscount || 0),
      Number(data.total || 0),
      isB2BNum,
      itemsString,
      data.createdAt || new Date().toISOString(),
      vendedor,
      sucursal
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
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    await context.env.DB.prepare(
      "DELETE FROM sales WHERE id = ?1 AND company_id = ?2"
    ).bind(id, companyId).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
