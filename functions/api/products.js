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
      SELECT * FROM products 
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

    // 🔥 NUEVO: VERIFICACIÓN DE ADMINISTRADOR PARA AJUSTES MANUALES
    if (data.isAdjustment) {
      if (!data.adminPass) {
        return Response.json({ error: 'Autorización denegada: Falta contraseña de administrador.' }, { status: 401 });
      }
      
      // Chequeamos que la clave coincida exactamente con la del dueño de la empresa
      const adminCheck = await context.env.DB.prepare(`
        SELECT id FROM clients WHERE id = ? AND adminPass = ?
      `).bind(companyId, data.adminPass).first();

      if (!adminCheck) {
        return Response.json({ error: 'Autorización denegada: Contraseña de administrador incorrecta.' }, { status: 401 });
      }
    }

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

    // 🔥 LÓGICA DE SUCURSAL BASE (AUTO-CREACIÓN)
    let defaultBranchName = 'Central';
    try {
      const { results: branches } = await context.env.DB.prepare(`
        SELECT name FROM branches 
        WHERE company_id = ? AND status = 'Activo'
      `).bind(companyId).all();

      if (branches.length > 0) {
        defaultBranchName = branches[0].name; // Usamos la primera que exista
      } else {
        // No hay sucursales: Creamos "Central" automáticamente
        const newBranchId = 'br_central_' + Date.now();
        await context.env.DB.prepare(`
          INSERT INTO branches (id, company_id, name, address, manager, phone, createdAt, status) 
          VALUES (?, ?, 'Central', '', '', '', datetime('now'), 'Activo')
        `).bind(newBranchId, companyId).run();
      }
    } catch (e) {
      console.warn("Error verificando sucursales, usando 'Central' por defecto.");
    }

    // 🔥 CONSTRUCCIÓN DEL STOCK (CORREGIDA)
    const existingProd = await context.env.DB.prepare(`
      SELECT stock, stock_branches 
      FROM products 
      WHERE id = ? AND company_id = ?
    `).bind(id, companyId).first();

    let finalStockBranches = {};
    let finalStockTotal = 0;

    if (existingProd) {
      // ES EDICIÓN: 
      // Si el frontend (ej: stock.html) nos manda stock actualizado, CONFIAMOS EN EL FRONTEND.
      // Si no manda nada, mantenemos el que ya estaba en la DB.
      if (data.stock_branches !== undefined) {
        try {
          finalStockBranches = typeof data.stock_branches === 'string' ? JSON.parse(data.stock_branches) : data.stock_branches;
        } catch {
          finalStockBranches = {};
        }
        finalStockTotal = safeNumber(data.stock);
      } else {
        try { finalStockBranches = JSON.parse(existingProd.stock_branches); } catch { finalStockBranches = {}; }
        if (!finalStockBranches || Object.keys(finalStockBranches).length === 0) {
          finalStockBranches = { [defaultBranchName]: safeNumber(existingProd.stock) };
        }
        finalStockTotal = Object.values(finalStockBranches).reduce((a, b) => a + safeNumber(b), 0);
      }
    } else {
      // ES ALTA NUEVA
      const branchToUse = safeString(data.initialBranch) || defaultBranchName;
      const initialStock = safeNumber(data.initialStock);
      
      finalStockBranches = { [branchToUse]: initialStock };
      finalStockTotal = initialStock;
    }

    // 🔥 GUARDAR EN BASE DE DATOS
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
      finalStockTotal,
      data.status || 'Activo',
      safeString(data.promoType),
      safeNumber(data.promoValue),
      safeString(data.promoLinked),
      data.createdAt || new Date().toISOString(),
      safeJSON(finalStockBranches)
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
