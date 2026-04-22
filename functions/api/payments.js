export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const clientId = url.searchParams.get('clientId');
    const status = url.searchParams.get('status') || 'Activo';

    let query = "SELECT * FROM payments WHERE 1=1";
    const binds = [];

    if (clientId) {
      query += " AND clientId = ?";
      binds.push(clientId);
    }

    if (status !== 'Todos') {
      query += " AND status = ?";
      binds.push(status);
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
    const data = await context.request.json();

    const id = data.id || ('pay_' + Date.now());
    const clientId = data.clientId || '';
    const date = data.date || new Date().toISOString().slice(0, 10);
    const amount = Number(data.amount || 0);
    const method = data.method || '';
    const notes = data.notes || '';
    const period = data.period || '';
    const newDueDate = data.newDueDate || null;
    const status = data.status || 'Activo';
    const referenceType = data.reference_type || 'saas_fee';
    const referenceId = data.reference_id || '';
    const createdAt = data.createdAt || new Date().toISOString();

    await context.env.DB.prepare(`
      INSERT INTO payments (
        id,
        clientId,
        date,
        amount,
        method,
        notes,
        period,
        status,
        reference_type,
        reference_id,
        createdAt
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `).bind(
      id,
      clientId,
      date,
      amount,
      method,
      notes,
      period,
      status,
      referenceType,
      referenceId,
      createdAt
    ).run();

    if (newDueDate && clientId) {
      await context.env.DB.prepare(`
        UPDATE clients
        SET dueDate = ?1
        WHERE id = ?2
      `).bind(newDueDate, clientId).run();
    }

    return Response.json({ success: true, id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();

    await context.env.DB.prepare(`
      UPDATE payments
      SET
        date = ?1,
        amount = ?2,
        method = ?3,
        notes = ?4,
        period = ?5,
        status = ?6,
        reference_type = ?7,
        reference_id = ?8
      WHERE id = ?9
    `).bind(
      data.date || new Date().toISOString().slice(0, 10),
      Number(data.amount || 0),
      data.method || '',
      data.notes || '',
      data.period || '',
      data.status || 'Activo',
      data.reference_type || 'saas_fee',
      data.reference_id || '',
      data.id
    ).run();

    if (data.newDueDate && data.clientId) {
      await context.env.DB.prepare(`
        UPDATE clients
        SET dueDate = ?1
        WHERE id = ?2
      `).bind(data.newDueDate, data.clientId).run();
    }

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const id = new URL(context.request.url).searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    await context.env.DB.prepare(`
      UPDATE payments
      SET status = 'Anulado'
      WHERE id = ?1
    `).bind(id).run();

    return Response.json({ success: true, message: 'Pago anulado correctamente.' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
