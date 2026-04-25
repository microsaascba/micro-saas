function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

async function ensureTableExists(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS business_clients (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL,
      contact TEXT, phone TEXT, email TEXT, cuil TEXT, address TEXT,
      iva_condition TEXT, status TEXT DEFAULT 'Activo',
      city TEXT DEFAULT '', province TEXT DEFAULT '', country TEXT DEFAULT 'Argentina',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const { results } = await db.prepare("PRAGMA table_info(business_clients)").all();
  const cols = results.map(c => c.name);
  
  const newCols = [
    'city', 'province', 'country', 'od_diam', 'od_esf', 'od_cil', 'od_eje', 'od_add', 'od_di', 'od_alt',
    'oi_diam', 'oi_esf', 'oi_cil', 'oi_eje', 'oi_add', 'oi_di', 'oi_alt', 'dp', 'tratamientos'
  ];

  for (let col of newCols) {
    if (!cols.includes(col)) {
      await db.prepare(`ALTER TABLE business_clients ADD COLUMN ${col} TEXT DEFAULT ''`).run();
    }
  }
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    
    await ensureTableExists(context.env.DB);
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'Activo';
    const withBalance = url.searchParams.get('withBalance') === '1';

    let query = `
      SELECT bc.*, COALESCE(SUM(
          CASE 
            WHEN LOWER(COALESCE(cc.type, '')) IN ('debit', 'debe', 'cargo') THEN COALESCE(cc.amount, 0)
            WHEN LOWER(COALESCE(cc.type, '')) IN ('credit', 'haber', 'pago') THEN -COALESCE(cc.amount, 0)
            ELSE 0
          END
        ), 0) AS balance
      FROM business_clients bc
      LEFT JOIN cc_movements cc ON cc.clientId = bc.id AND cc.company_id = bc.company_id
      WHERE bc.company_id = ?
    `;
    
    const binds = [companyId];
    if (status !== 'Todos') {
      query += ` AND bc.status = ?`;
      binds.push(status);
    }
    query += ` GROUP BY bc.id ORDER BY bc.name ASC`;

    const { results } = await context.env.DB.prepare(query).bind(...binds).all();

    const clientesMapeados = results.map(row => ({
      ...row,
      type: row.contact || 'B2C',
      ivaCondition: row.iva_condition || 'Consumidor Final',
      city: row.city || '', province: row.province || '', country: row.country || 'Argentina',
      od_diam: row.od_diam || '', od_esf: row.od_esf || '', od_cil: row.od_cil || '', od_eje: row.od_eje || '', od_add: row.od_add || '', od_di: row.od_di || '', od_alt: row.od_alt || '',
      oi_diam: row.oi_diam || '', oi_esf: row.oi_esf || '', oi_cil: row.oi_cil || '', oi_eje: row.oi_eje || '', oi_add: row.oi_add || '', oi_di: row.oi_di || '', oi_alt: row.oi_alt || '',
      dp: row.dp || '', tratamientos: row.tratamientos || '',
      createdAt: row.created_at || '', balance: Number(row.balance || 0)
    }));

    if (!withBalance) return Response.json(clientesMapeados.map(({ balance, ...rest }) => rest));
    return Response.json(clientesMapeados);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    await ensureTableExists(context.env.DB);
    const data = await context.request.json();
    const id = data.id || 'cli_' + Date.now();
    const name = data.name || 'Sin Nombre';

    await context.env.DB.prepare(`
      INSERT INTO business_clients (
        id, company_id, name, contact, phone, email, cuil, address, iva_condition, status, city, province, country, created_at,
        od_diam, od_esf, od_cil, od_eje, od_add, od_di, od_alt,
        oi_diam, oi_esf, oi_cil, oi_eje, oi_add, oi_di, oi_alt, dp, tratamientos
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, contact = excluded.contact, phone = excluded.phone, 
        email = excluded.email, cuil = excluded.cuil, address = excluded.address, 
        iva_condition = excluded.iva_condition, status = excluded.status,
        city = excluded.city, province = excluded.province, country = excluded.country,
        od_diam = excluded.od_diam, od_esf = excluded.od_esf, od_cil = excluded.od_cil, od_eje = excluded.od_eje, od_add = excluded.od_add, od_di = excluded.od_di, od_alt = excluded.od_alt,
        oi_diam = excluded.oi_diam, oi_esf = excluded.oi_esf, oi_cil = excluded.oi_cil, oi_eje = excluded.oi_eje, oi_add = excluded.oi_add, oi_di = excluded.oi_di, oi_alt = excluded.oi_alt,
        dp = excluded.dp, tratamientos = excluded.tratamientos
    `).bind(
      id, companyId, name, data.type || 'B2C', data.phone || '', data.email || '', data.cuil || '', 
      data.address || '', data.ivaCondition || 'Consumidor Final', data.status || 'Activo',
      data.city || '', data.province || '', data.country || 'Argentina', data.createdAt || new Date().toISOString(),
      data.od_diam || '', data.od_esf || '', data.od_cil || '', data.od_eje || '', data.od_add || '', data.od_di || '', data.od_alt || '',
      data.oi_diam || '', data.oi_esf || '', data.oi_cil || '', data.oi_eje || '', data.oi_add || '', data.oi_di || '', data.oi_alt || '',
      data.dp || '', data.tratamientos || ''
    ).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
