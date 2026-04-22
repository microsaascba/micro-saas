function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

function normalizeMovementType(type) {
  const t = String(type || '').toLowerCase();
  if (['credit', 'haber', 'pago'].includes(t)) return 'credit';
  return 'debit';
}

function signedAmount(type, amount) {
  return normalizeMovementType(type) === 'credit' ? -Number(amount || 0) : Number(amount || 0);
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    const url = new URL(context.request.url);
    const clientId = url.searchParams.get('clientId');
    const includeBalance = url.searchParams.get('withBalance') === '1';

    let query = "SELECT * FROM cc_movements WHERE company_id = ?";
    const binds = [companyId];

    if (clientId) {
      query += " AND clientId = ?";
      binds.push(clientId);
    }

    query += " ORDER BY date ASC, createdAt ASC";

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    let runningBalance = 0;
    const mapped = results.map(row => {
      const normalizedType = normalizeMovementType(row.type);
      const amount = Number(row.amount || 0);
      runningBalance += signedAmount(normalizedType, amount);

      return {
        ...row,
        type: normalizedType,
        amount,
        balance: includeBalance ? runningBalance : undefined
      };
    });

    return Response.json(includeBalance ? mapped : mapped.map(({ balance, ...rest }) => rest));
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
    const normalizedType = normalizeMovementType(c.type);

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
      normalizedType,
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
