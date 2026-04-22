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
    const clientId = url.searchParams.get('clientId');

    let query = "SELECT * FROM cc_movements WHERE company_id = ?";
    const binds = [companyId];

    if (clientId) {
      query += " AND clientId = ?";
      binds.push(clientId);
    }

    query += " ORDER BY date DESC, createdAt DESC";

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();
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

    const c = await context.request.json();

    await context.env.DB.prepare(`
      INSERT INTO cc_movements (
        id,
        company_id,
        clientId,
        date,
        type,
        amount,
        concept,
        reference_type,
        reference_id,
        branch,
        seller,
        notes,
        createdAt
      ) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      ON CONFLICT(id) DO UPDATE SET 
        clientId = excluded.clientId,
        date = excluded.date,
        type = excluded.type,
        amount = excluded.amount,
        concept = excluded.concept,
        reference_type = excluded.reference_type,
        reference_id = excluded.reference_id,
        branch = excluded.branch,
        seller = excluded.seller,
        notes = excluded.notes
    `).bind(
      c.id,
      companyId,
      c.clientId || '',
      c.date || new Date().toISOString().slice(0, 10),
      c.type || 'debit',
      Number(c.amount || 0),
      c.concept || '',
      c.reference_type || 'manual',
      c.reference_id || '',
      c.branch || 'Central',
      c.seller || 'Admin',
      c.notes || '',
      c.createdAt || new Date().toISOString()
    ).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
