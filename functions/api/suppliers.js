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
      FROM suppliers
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

    const id = data.id || `sup_${Date.now()}`;
    const name = safeString(data.name);
    const cuit = safeString(data.cuit);

    if (!name) {
      return Response.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }

    if (cuit) {
      const existing = await context.env.DB.prepare(`
        SELECT id
        FROM suppliers
        WHERE cuit = ?1 AND company_id = ?2 AND id != ?3
        LIMIT 1
      `).bind(cuit, companyId, id).first();

      if (existing) {
        return Response.json({ error: 'Ya existe un proveedor con ese CUIT.' }, { status: 400 });
      }
    }

    await context.env.DB.prepare(`
      INSERT INTO suppliers (
        id,
        company_id,
        name,
        cuit,
        phone,
        email,
        address,
        ivaCondition,
        contactPerson,
        notes,
        createdAt,
        status
      ) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        cuit = excluded.cuit,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        ivaCondition = excluded.ivaCondition,
        contactPerson = excluded.contactPerson,
        notes = excluded.notes,
        status = excluded.status
    `).bind(
      id,
      companyId,
      name,
      cuit,
      safeString(data.phone),
      safeString(data.email),
      safeString(data.address),
      safeString(data.ivaCondition || 'Consumidor Final'),
      safeString(data.contactPerson),
      safeString(data.notes),
      data.createdAt || new Date().toISOString(),
      safeString(data.status || 'Activo')
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
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    await context.env.DB.prepare(`
      UPDATE suppliers
      SET status = 'Inactivo'
      WHERE id = ?1 AND company_id = ?2
    `).bind(id, companyId).run();

    return Response.json({ success: true, message: 'Proveedor desactivado correctamente.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
