function getCompanyIdFromRequest(request) {
    return request.headers.get('x-company-id') || '';
}

// Función mágica: Verifica y crea las columnas si no existen (Auto-Sanación)
async function ensureColumns(db) {
    const alters = [
        "ALTER TABLE products ADD COLUMN description TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN color TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN size TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN frente TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN patilla TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN lente TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN medidas TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN peso TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN talle TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN image1 TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN image2 TEXT DEFAULT '';",
        "ALTER TABLE products ADD COLUMN image3 TEXT DEFAULT '';"
    ];
    for (let q of alters) {
        try { await db.prepare(q).run(); } catch(e) { /* Si ya existe, lo ignora en silencio */ }
    }
}

export async function onRequestGet(context) {
    try {
        await ensureColumns(context.env.DB);
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
        await ensureColumns(context.env.DB);
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

        const data = await context.request.json();
        
        // REGLA ACTUALIZADA: Código automático de 4 cifras exactas
        let finalCode = (data.code || '').trim();
        if (!finalCode) {
            // Genera un número aleatorio entre 1000 y 9999
            finalCode = String(Math.floor(1000 + Math.random() * 9000));
        }

        await context.env.DB.prepare(`
            INSERT INTO products (
                id, company_id, name, description, category, code, cost, expenses, price,
                stock, stock_branches, status, color, talle, frente, patilla, lente, peso,
                image1, image2, image3, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                talle = excluded.talle,
                frente = excluded.frente,
                patilla = excluded.patilla,
                lente = excluded.lente,
                peso = excluded.peso,
                image1 = excluded.image1,
                image2 = excluded.image2,
                image3 = excluded.image3
        `).bind(
            data.id, companyId, data.name, data.description || '', data.category, finalCode,
            data.cost || 0, data.expenses || 0, data.price || 0,
            data.stock || 0, typeof data.stock_branches === 'string' ? data.stock_branches : JSON.stringify(data.stock_branches || {}), data.status || 'Activo',
            data.color || '', data.talle || '', data.frente || '', data.patilla || '', data.lente || '', data.peso || '',
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
