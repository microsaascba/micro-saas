function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
    const status = url.searchParams.get('status') || 'Todos';
    const branch = url.searchParams.get('branch') || 'Todos';
    const supplierId = url.searchParams.get('supplierId') || '';

    let query = `
      SELECT *
      FROM expenses
      WHERE company_id = ?1
    `;
    const binds = [companyId];
    let bindIndex = 2;

    if (status !== 'Todos') {
      query += ` AND COALESCE(status, 'Pagado') = ?${bindIndex++}`;
      binds.push(status);
    }

    if (branch !== 'Todos') {
      query += ` AND COALESCE(branch, 'Global') = ?${bindIndex++}`;
      binds.push(branch);
    }

    if (supplierId) {
      query += ` AND COALESCE(supplierId, '') = ?${bindIndex++}`;
      binds.push(supplierId);
    }

    query += ` ORDER BY date DESC, createdAt DESC`;

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    const formatted = results.map(row => ({
      ...row,
      amount: safeNumber(row.amount),
      ivaAmount: safeNumber(row.ivaAmount),
      nonTaxedAmount: safeNumber(row.nonTaxedAmount),
      branch: row.branch || 'Global',
      status: row.status || 'Pagado'
    }));

    return Response.json(formatted);
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

    const id = data.id || `gas_${Date.now()}`;
    const createdAt = data.createdAt || new Date().toISOString();

    const stmt = context.env.DB.prepare(`
      INSERT INTO expenses (
        id,
        company_id,
        date,
        amount,
        concept,
        category,
        status,
        method,
        createdAt,
        supplierId,
        invoiceType,
        invoiceNum,
        ivaAmount,
        nonTaxedAmount,
        branch,
        loadedBy,
        canceledBy
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
        ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
      )
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        amount = excluded.amount,
        concept = excluded.concept,
        category = excluded.category,
        status = excluded.status,
        method = excluded.method,
        supplierId = excluded.supplierId,
        invoiceType = excluded.invoiceType,
        invoiceNum = excluded.invoiceNum,
        ivaAmount = excluded.ivaAmount,
        nonTaxedAmount = excluded.nonTaxedAmount,
        branch = excluded.branch,
        loadedBy = excluded.loadedBy,
        canceledBy = excluded.canceledBy
    `);

    await stmt.bind(
      id,
      companyId,
      data.date || new Date().toISOString().split('T')[0],
      safeNumber(data.amount),
      safeString(data.concept),
      safeString(data.category),
      safeString(data.status || 'Pagado'),
      safeString(data.method || 'Efectivo'),
      createdAt,
      safeString(data.supplierId),
      safeString(data.invoiceType),
      safeString(data.invoiceNum),
      safeNumber(data.ivaAmount),
      safeNumber(data.nonTaxedAmount),
      safeString(data.branch || 'Global'),
      safeString(data.loadedBy || 'Admin'),
      safeString(data.canceledBy || '')
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
    const canceledBy = url.searchParams.get('canceledBy') || 'Admin';

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    await context.env.DB.prepare(`
      UPDATE expenses
      SET
        status = 'Anulado',
        canceledBy = ?1
      WHERE id = ?2 AND company_id = ?3
    `).bind(
      canceledBy,
      id,
      companyId
    ).run();

    return Response.json({ success: true, message: 'Gasto anulado correctamente.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
