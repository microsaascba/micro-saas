function getCompanyIdFromRequest(request) {
    return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        const url = new URL(context.request.url);
        const status = url.searchParams.get('status') || 'Activo';

        let query = "SELECT * FROM products WHERE company_id = ?";
        let params = [companyId];

        if (status !== 'Todos') {
            query += " AND status = ?";
            params.push(status);
        }

        query += " ORDER BY name ASC";

        const { results } = await context.env.DB.prepare(query).bind(...params).all();
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
        
        // REGLA DE ORO: Si el código viene vacío, generamos uno automático
        let finalCode = (data.code || '').trim();
        if (!finalCode) {
            finalCode = 'ART-' + Math.random().toString(36).substring(2, 7).toUpperCase() + Date.now().toString().slice(-4);
        }

        await context.env.DB.prepare(`
            INSERT INTO products (
                id, company_id, name, description, category, code, cost, expenses, price, 
                stock, stock_branches, status, color, size, 
                promoType, promoValue, promoLinked, image1, image2, image3, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                description = excluded.description,
                category = excluded.category,
                code = excluded.code,
                cost = excluded.cost,
                expenses = excluded.expenses,
                price = excluded.price,
                status = excluded.status,
                color = excluded.color,
                size = excluded.size,
                promoType = excluded.promoType,
                promoValue = excluded.promoValue,
                promoLinked = excluded.promoLinked,
                image1 = excluded.image1,
                image2 = excluded.image2,
                image3 = excluded.image3
        `).bind(
            data.id, companyId, data.name, data.description || '', data.category, finalCode,
            data.cost || 0, data.expenses || 0, data.price || 0, 
            data.stock || 0, data.stock_branches || '{}', data.status || 'Activo',
            data.color || '', data.size || '',
            data.promoType || 'none', data.promoValue || 0, data.promoLinked || '',
            data.image1 || '', data.image2 || '', data.image3 || '',
            data.createdAt || new Date().toISOString()
        ).run();

        return Response.json({ success: true, codeAssigned: finalCode });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');

        await context.env.DB.prepare(
            "UPDATE products SET status = 'Inactivo' WHERE id = ? AND company_id = ?"
        ).bind(id, companyId).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
