function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

// ─────────────────────────────────────────────
// NORMALIZADORES
// ─────────────────────────────────────────────
function safeNumber(n) {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

function safeString(s) {
  return String(s || '').trim();
}

function safeJSON(obj, fallback = {}) {
  try {
    if (typeof obj === 'string') return obj;
    return JSON.stringify(obj || fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

// ─────────────────────────────────────────────
// GET → listar productos
// ─────────────────────────────────────────────
export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'Activo';

    let query = `
      SELECT * 
      FROM products 
      WHERE company_id = ?
    `;
    const binds = [companyId];

    if (status !== 'Todos') {
      query += " AND (status = ? OR status IS NULL)";
      binds.push(status);
    }

    query += " ORDER BY name ASC";

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST → crear / actualizar producto
// ─────────────────────────────────────────────
export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const data = await context.request.json();

    const id = data.id || 'prod_' + Date.now();
    const name = safeString(data.name);
    const code = safeString(data.code);

    if (!name) {
      return Response.json({ error: 'Nombre obligatorio.' }, { status: 400 });
    }

    // 🔥 CONTROL DUPLICADO CODE
    if (code) {
      const existing = await context.env.DB.prepare(`
        SELECT id FROM products 
        WHERE code = ?1 AND company_id = ?2 AND id != ?3
      `).bind(code, companyId, id).first();

      if (existing) {
        return Response.json({ error: 'Código ya existe.' }, { status: 400 });
      }
    }

    // STOCK POR SUCURSAL
    let stockBranches = {};
    try {
      stockBranches = typeof data.stock_branches === 'string'
        ? JSON.parse(data.stock_branches)
        : (data.stock_branches || {});
    } catch {
      stockBranches = { Central: 0 };
    }

    // fallback mínimo
    if (Object.keys(stockBranches).length === 0) {
      stockBranches = { Central: safeNumber(data.stock) };
    }

    const totalStock = Object.values(stockBranches).reduce((a, b) => a + safeNumber(b), 0);

    await context.env.DB.prepare(`
      INSERT INTO products (
        id,
        company_id,
        name,
        code,
        category,
        cost,
        price,
        stock,
        status,
        promoType,
        promoValue,
        promoLinked,
        createdAt,
        stock_branches
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
      id,
      companyId,
      name,
      code,
      safeString(data.category),
      safeNumber(data.cost),
      safeNumber(data.price),
      totalStock,
      data.status || 'Activo',
      safeString(data.promoType),
      safeNumber(data.promoValue),
      safeString(data.promoLinked),
      data.createdAt || new Date().toISOString(),
      safeJSON(stockBranches, { Central: 0 })
    ).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE → baja lógica
// ─────────────────────────────────────────────
export async function onRequestDelete(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id) return Response.json({ error: 'Falta id.' }, { status: 400 });

    await context.env.DB.prepare(`
      UPDATE products 
      SET status = 'Inactivo' 
      WHERE id = ?1 AND company_id = ?2
    `).bind(id, companyId).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
