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
    const withBalance = url.searchParams.get('withBalance') === '1';

    let query = `
      SELECT 
        c.*,
        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(cc.type, '')) IN ('debit', 'debe', 'cargo') THEN COALESCE(cc.amount, 0)
            WHEN LOWER(COALESCE(cc.type, '')) IN ('credit', 'haber', 'pago') THEN -COALESCE(cc.amount, 0)
            ELSE 0
          END
        ), 0) AS balance
      FROM clients c
      LEFT JOIN cc_movements cc
        ON cc.clientId = c.id
       AND cc.company_id = c.company_id
      WHERE c.company_id = ?
    `;

    const binds = [companyId];

    if (status !== 'Todos') {
      query += ` AND c.status = ?`;
      binds.push(status);
    }

    query += `
      GROUP BY c.id
      ORDER BY c.name ASC
    `;

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    // Mapeamos los datos de la base de datos al formato que espera el frontend
    const clientesMapeados = results.map(row => ({
      ...row,
      type: row.contact || 'B2C', // Usamos la columna contact para guardar si es B2B o B2C
      ivaCondition: row.iva_condition || 'Consumidor Final',
      createdAt: row.created_at || '',
      balance: Number(row.balance || 0)
    }));

    if (!withBalance) {
      return Response.json(clientesMapeados.map(({ balance, ...rest }) => rest));
    }

    return Response.json(clientesMapeados);
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

    // Guardamos en la tabla correcta: 'clients'
    await context.env.DB.prepare(`
      INSERT INTO clients (
        id, company_id, name, contact, phone, email, cuil, address, iva_condition, status, created_at
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
      data.type || 'B2C', // Guardamos el tipo (B2B/B2C) en 'contact'
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
      "UPDATE clients SET status = 'Inactivo' WHERE id = ?1 AND company_id = ?2"
    ).bind(id, companyId).run();

    return Response.json({ success: true, message: 'Cliente desactivado correctamente.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
