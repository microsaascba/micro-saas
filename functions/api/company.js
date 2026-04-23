function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

// Función inteligente que verifica y crea las columnas fiscales si no existen
async function ensureFiscalColumns(db) {
  const { results } = await db.prepare("PRAGMA table_info(companies)").all();
  const existingCols = results.map(c => c.name);
  
  const colsToAdd = ['cuit', 'iibb', 'inicio_actividades', 'iva_condition', 'address', 'phone'];

  for (let col of colsToAdd) {
    if (!existingCols.includes(col)) {
      await db.prepare(`ALTER TABLE companies ADD COLUMN ${col} TEXT`).run();
    }
  }
}

export async function onRequestGet(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id' }, { status: 400 });

    await ensureFiscalColumns(context.env.DB);

    const company = await context.env.DB.prepare(`SELECT * FROM companies WHERE id = ?`).bind(companyId).first();
    return Response.json(company || {});
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id' }, { status: 400 });

    const data = await context.request.json();
    await ensureFiscalColumns(context.env.DB);

    await context.env.DB.prepare(`
      UPDATE companies SET 
        name = COALESCE(?, name),
        cuit = COALESCE(?, cuit),
        iibb = COALESCE(?, iibb),
        inicio_actividades = COALESCE(?, inicio_actividades),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone)
      WHERE id = ?
    `).bind(
      data.name, data.cuit, data.iibb, data.inicio_actividades, data.address, data.phone, companyId
    ).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
