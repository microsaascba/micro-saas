function getCompanyIdFromRequest(request) {
    return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM obras_sociales WHERE company_id = ? ORDER BY name ASC"
        ).bind(companyId).all();

        return Response.json(results);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

        const data = await context.request.json();
        
        await context.env.DB.prepare(`
            INSERT INTO obras_sociales (id, company_id, name, createdAt) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name
        `).bind(
            data.id, 
            companyId, 
            data.name.trim(), 
            data.createdAt || new Date().toISOString()
        ).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
