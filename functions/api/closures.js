function getCompanyIdFromRequest(request) {
    return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM closures WHERE company_id = ? ORDER BY createdAt DESC"
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
        
        // 1. Guardar el resumen del cierre
        await context.env.DB.prepare(`
            INSERT INTO closures (id, company_id, date, branch, user, total_cash, total_debit, total_credit, total_transfer, total_cc, grand_total, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.id, companyId, data.date, data.branch, data.user,
            data.total_cash, data.total_debit, data.total_credit, data.total_transfer, data.total_cc, data.grand_total, data.createdAt
        ).run();

        // 2. Marcar las ventas del día como "Cerradas" para que no aparezcan en el próximo cierre
        await context.env.DB.prepare(`
            UPDATE sales SET closed = 1 WHERE company_id = ? AND branch = ? AND closed = 0
        `).bind(companyId, data.branch).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
