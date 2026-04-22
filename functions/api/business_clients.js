function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'Activo';

    let query = "SELECT * FROM business_clients WHERE company_id = ?";
    const binds = [companyId];

    if (status === 'Todos') {
      query += " ORDER BY name ASC";
    } else {
      query += " AND status = ? ORDER BY name ASC";
      binds.push(status);
    }

    const stmt = context.env.DB.prepare(query).bind(...binds);
    const { results } = await stmt.all();

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

    const id = data.id || 'cli_' + Date.now();
    const name = data.name || 'Sin Nombre';

    await context.env.DB.prepare(`
      INSERT INTO business_clients (
        id,
        company_id,
        name,
        contact,
        phone,
        email,
        cuil,
        address,
        iva_condition,
        status,
        created_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        contact = excluded.contact,
        phone = excluded.phone,
        email = excluded.email,
        cuil = excluded.cuil,
        address = excluded.address,
        iva_condition = excluded.iva_condition,
        status = excluded.status
    `).bind(
      id,
      companyId,
      name,
      data.contact || '',
      data.phone || '',
      data.email || '',
      data.cuil || '',
      data.address || '',
      data.ivaCondition || 'Consumidor Final',
      data.status || 'Activo',
      data.createdAt || new Date().toISOString()
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
      "UPDATE business_clients SET status = 'Inactivo' WHERE id = ?1 AND company_id = ?2"
    ).bind(id, companyId).run();

    return Response.json({ success: true, message: 'Cliente desactivado correctamente.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
