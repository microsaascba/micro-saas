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

    const { results } = await context.env.DB.prepare(`
      SELECT *
      FROM categories
      WHERE company_id = ?1
      ORDER BY name ASC
    `).bind(companyId).all();

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
    const id = data.id || `cat_${Date.now()}`;
    const name = safeString(data.name);

    if (!name) {
      return Response.json({ error: 'Nombre obligatorio.' }, { status: 400 });
    }

    const existing = await context.env.DB.prepare(`
      SELECT id
      FROM categories
      WHERE LOWER(name) = LOWER(?1)
        AND company_id = ?2
        AND id != ?3
      LIMIT 1
    `).bind(name, companyId, id).first();

    if (existing) {
      return Response.json({ error: 'La categoría ya existe.' }, { status: 400 });
    }

    await context.env.DB.prepare(`
      INSERT INTO categories (id, company_id, name)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name
    `).bind(id, companyId, name).run();

    return Response.json({ success: true, id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (!companyId) {
      return Response.json({ error: 'Falta company_id.' }, { status: 400 });
    }

    if (!id) {
      return Response.json({ error: 'Falta id.' }, { status: 400 });
    }

    const inUse = await context.env.DB.prepare(`
      SELECT id
      FROM products
      WHERE company_id = ?1 AND category = (
        SELECT name FROM categories WHERE id = ?2 AND company_id = ?1
      )
      LIMIT 1
    `).bind(companyId, id).first();

    if (inUse) {
      return Response.json({ error: 'No se puede eliminar: la categoría está en uso por productos.' }, { status: 400 });
    }

    await context.env.DB.prepare(`
      DELETE FROM categories
      WHERE id = ?1 AND company_id = ?2
    `).bind(id, companyId).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
