function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseItems(raw) {
  try {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return JSON.parse(raw || '[]');
    return [];
  } catch {
    return [];
  }
}

function normalizeItem(item) {
  return {
    id: item.id || item.productId || '',
    productId: item.productId || item.id || '',
    code: item.code || '',
    name: item.name || 'Producto',
    qty: safeNumber(item.qty || item.quantity || 0),
    quantity: safeNumber(item.quantity || item.qty || 0),
    price: safeNumber(item.price),
    cost: safeNumber(item.cost),
    subtotal: safeNumber(item.subtotal || safeNumber(item.qty || item.quantity || 0) * safeNumber(item.price))
  };
}

function parseBranches(stock_branches, stock) {
  try {
    const parsed = typeof stock_branches === 'string'
      ? JSON.parse(stock_branches || '{}')
      : (stock_branches || {});

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}

  return { Central: safeNumber(stock) };
}

function calcTotalStock(branches) {
  return Object.values(branches).reduce((acc, v) => acc + safeNumber(v), 0);
}

async function moveStock(context, companyId, items, branch, direction) {
  for (const rawItem of items) {
    const item = normalizeItem(rawItem);
    const productId = item.id || item.productId;
    const qty = safeNumber(item.qty || item.quantity);

    if (!productId || qty <= 0) continue;

    const prod = await context.env.DB.prepare(`
      SELECT id, stock, stock_branches
      FROM products
      WHERE id = ?1 AND company_id = ?2
      LIMIT 1
    `).bind(productId, companyId).first();

    if (!prod) continue;

    const branches = parseBranches(prod.stock_branches, prod.stock);
    const targetBranch = branch || 'Central';

    if (branches[targetBranch] === undefined) branches[targetBranch] = 0;

    const currentBranchStock = safeNumber(branches[targetBranch]);
    const delta = direction === 'add' ? qty : -qty;
    const newBranchStock = currentBranchStock + delta;

    if (direction === 'subtract' && newBranchStock < 0) {
      throw new Error(`Stock insuficiente para "${item.name}" en sucursal "${targetBranch}". Disponible: ${currentBranchStock}`);
    }

    branches[targetBranch] = newBranchStock;

    await context.env.DB.prepare(`
      UPDATE products
      SET stock = ?1, stock_branches = ?2
      WHERE id = ?3 AND company_id = ?4
    `).bind(
      calcTotalStock(branches),
      JSON.stringify(branches),
      productId,
      companyId
    ).run();
  }
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'Todos';

    let query = `SELECT * FROM sales WHERE company_id = ?1`;
    const binds = [companyId];

    if (status !== 'Todos') {
      query += ` AND COALESCE(status, 'Activa') = ?2`;
      binds.push(status);
    }

    query += ` ORDER BY createdAt DESC`;
    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    const ventasFormateadas = results.map(venta => ({
      ...venta,
      subtotal: safeNumber(venta.subtotal),
      promoDiscount: safeNumber(venta.promoDiscount),
      total: safeNumber(venta.total),
      isB2B: Number(venta.isB2B) === 1,
      items: parseItems(venta.itemsJSON).map(normalizeItem),
      client: venta.clientId || 'Consumidor Final',
      status: venta.status || 'Activa'
    }));

    return Response.json(ventasFormateadas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const data = await context.request.json();
    const saleId = data.id || `vta_${Date.now()}`;
    const items = parseItems(data.items).map(normalizeItem);
    const isB2BNum = data.isB2B ? 1 : 0;
    const clientId = data.clientId || data.client || 'Consumidor Final';
    const seller = data.seller || 'Admin';
    const branch = data.branch || 'Central';
    const status = data.status || 'Activa';

    const existingSale = await context.env.DB.prepare(`
      SELECT * FROM sales WHERE id = ?1 AND company_id = ?2 LIMIT 1
    `).bind(saleId, companyId).first();

    // Caso 1: alta nueva
    if (!existingSale) {
      if (status !== 'Anulada') {
        await moveStock(context, companyId, items, branch, 'subtract');
      }

      await context.env.DB.prepare(`
        INSERT INTO sales (
          id, company_id, date, clientId, method, cupon, subtotal,
          promoDiscount, total, isB2B, itemsJSON, createdAt, seller, branch, status
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
      `).bind(
        saleId, companyId, data.date || new Date().toISOString().split('T')[0], clientId,
        data.method || '', data.cupon || '', safeNumber(data.subtotal), safeNumber(data.promoDiscount),
        safeNumber(data.total), isB2BNum, JSON.stringify(items), data.createdAt || new Date().toISOString(),
        seller, branch, status
      ).run();

      return Response.json({ success: true, mode: 'inserted' });
    }

    // Caso 2: edición / anulación
    const existingStatus = existingSale.status || 'Activa';
    const existingItems = parseItems(existingSale.itemsJSON).map(normalizeItem);
    const existingBranch = existingSale.branch || 'Central';

    // 🔥 SEGURIDAD: Si pasa de activa a anulada => exige PIN y repone stock
    if (existingStatus !== 'Anulada' && status === 'Anulada') {
      if (!data.adminPass) {
        return Response.json({ error: 'Falta contraseña de administrador.' }, { status: 401 });
      }
      const adminCheck = await context.env.DB.prepare(`
        SELECT id FROM clients WHERE id = ? AND adminPass = ?
      `).bind(companyId, data.adminPass).first();

      if (!adminCheck) {
        return Response.json({ error: 'Autorización denegada: PIN de administrador incorrecto.' }, { status: 401 });
      }

      // Si el PIN es correcto, devolvemos el stock
      await moveStock(context, companyId, existingItems, existingBranch, 'add');
    }

    // Actualizamos la venta en la DB
    await context.env.DB.prepare(`
      UPDATE sales
      SET date = ?1, clientId = ?2, method = ?3, cupon = ?4, subtotal = ?5, promoDiscount = ?6,
          total = ?7, isB2B = ?8, itemsJSON = ?9, seller = ?10, branch = ?11, status = ?12
      WHERE id = ?13 AND company_id = ?14
    `).bind(
      data.date || existingSale.date || new Date().toISOString().split('T')[0], clientId, data.method || '',
      data.cupon || '', safeNumber(data.subtotal), safeNumber(data.promoDiscount), safeNumber(data.total),
      isB2BNum, JSON.stringify(items), seller, branch, status, saleId, companyId
    ).run();

    return Response.json({ success: true, mode: 'updated' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
