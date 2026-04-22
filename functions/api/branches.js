function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

function safeString(value) {
  return String(value || '').trim();
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'Activo';

    let query = `
      SELECT *
      FROM branches
      WHERE company_id = ?1
    `;
    const binds = [companyId];

    if (status !== 'Todos') {
      query += ` AND COALESCE(status, 'Activo') = ?2`;
      binds.push(status);
    }

    query += ` ORDER BY name ASC`;

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    return Response.json(
      results.map(row => ({
        ...row,
        status: row.status || 'Activo'
      }))
    );
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

    let id = data.id || `suc_${Date.now()}`;
    const name = safeString(data.name);

    if (!name) {
      return Response.json({ error: 'El nombre de la sucursal es obligatorio.' }, { status: 400 });
    }

    // Buscamos si ya existe el nombre
    const existingBranch = await context.env.DB.prepare(`
      SELECT id, status
      FROM branches
      WHERE LOWER(name) = LOWER(?1)
        AND company_id = ?2
        AND id != ?3
      LIMIT 1
    `).bind(name, companyId, id).first();

    if (existingBranch) {
      if (existingBranch.status === 'Inactivo') {
        // Si está inactiva, en lugar de dar error, vamos a "reciclarla"
        // Le asignamos a nuestra variable 'id' el id de la inactiva.
        // Así el INSERT ON CONFLICT la pisará y reactivará.
        id = existingBranch.id;
      } else {
        // Si ya está Activa, entonces sí es un duplicado y bloqueamos
        return Response.json({ error: 'Ya existe una sucursal activa con ese nombre.' }, { status: 400 });
      }
    }

    await context.env.DB.prepare(`
      INSERT INTO branches (
        id,
        company_id,
        name,
        address,
        manager,
        phone,
        createdAt,
        status
      ) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        address = excluded.address,
        manager = excluded.manager,
        phone = excluded.phone,
        status = excluded.status
    `).bind(
      id,
      companyId,
      name,
      safeString(data.address),
      safeString(data.manager),
      safeString(data.phone),
      data.createdAt || new Date().toISOString(),
      safeString(data.status || 'Activo') // Al reactivar, se pondrá en 'Activo'
    ).run();

    return Response.json({ success: true, id });
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

    const branch = await context.env.DB.prepare(`
      SELECT *
      FROM branches
      WHERE id = ?1 AND company_id = ?2
      LIMIT 1
    `).bind(id, companyId).first();

    if (!branch) {
      return Response.json({ error: 'Sucursal no encontrada.' }, { status: 404 });
    }

    const branchName = branch.name || '';

    const saleUsingBranch = await context.env.DB.prepare(`
      SELECT id
      FROM sales
      WHERE company_id = ?1 AND branch = ?2
      LIMIT 1
    `).bind(companyId, branchName).first();

    const expenseUsingBranch = await context.env.DB.prepare(`
      SELECT id
      FROM expenses
      WHERE company_id = ?1 AND branch = ?2
      LIMIT 1
    `).bind(companyId, branchName).first();

    const productUsingBranch = await context.env.DB.prepare(`
      SELECT id
      FROM products
      WHERE company_id = ?1
        AND stock_branches LIKE ?2
      LIMIT 1
    `).bind(companyId, `%${branchName}%`).first();

    if (saleUsingBranch || expenseUsingBranch || productUsingBranch) {
      await context.env.DB.prepare(`
        UPDATE branches
        SET status = 'Inactivo'
        WHERE id = ?1 AND company_id = ?2
      `).bind(id, companyId).run();

      return Response.json({
        success: true,
        logicalDelete: true,
        message: 'La sucursal tenía movimientos o stock asociado. Se desactivó en lugar de eliminarse.'
      });
    }

    await context.env.DB.prepare(`
      DELETE FROM branches
      WHERE id = ?1 AND company_id = ?2
    `).bind(id, companyId).run();

    return Response.json({ success: true, deleted: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
