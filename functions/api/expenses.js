export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();

        // Armamos el SQL con todas las columnas nuevas incluidas
        const stmt = context.env.DB.prepare(`
            INSERT INTO expenses (
                id, date, amount, concept, category, status, method, createdAt,
                supplierId, invoiceType, invoiceNum, ivaAmount, nonTaxedAmount, branch, loadedBy, canceledBy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                status = excluded.status,
                amount = excluded.amount,
                concept = excluded.concept,
                category = excluded.category,
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
            data.id, 
            data.date, 
            data.amount || 0, 
            data.concept || '', 
            data.category || '', 
            data.status || 'Pagado', 
            data.method || 'Efectivo', 
            data.createdAt || new Date().toISOString(),
            data.supplierId || '', 
            data.invoiceType || '', 
            data.invoiceNum || '', 
            data.ivaAmount || 0, 
            data.nonTaxedAmount || 0, 
            data.branch || 'Global',
            data.loadedBy || 'Admin',
            data.canceledBy || ''
        ).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
