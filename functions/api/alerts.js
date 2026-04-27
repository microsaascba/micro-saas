export async function onRequestGet(context) {
    try {
        const companyId = context.request.headers.get('x-company-id') || '';
        const db = context.env.DB;

        if (!companyId) return Response.json({ error: 'Falta company_id' }, { status: 400 });

        // 1. CUENTAS POR PAGAR (Gastos Pendientes que vencen en 3 días o ya vencieron)
        const queryPayables = `
            SELECT e.id, e.concept, e.amount, e.dueDate, s.name as supplierName
            FROM expenses e
            LEFT JOIN suppliers s ON e.supplierId = s.id
            WHERE e.company_id = ? AND e.status = 'Pendiente' AND e.dueDate IS NOT NULL
            ORDER BY e.dueDate ASC
        `;
        const { results: payables } = await db.prepare(queryPayables).bind(companyId).all();

        const today = new Date();
        today.setHours(0,0,0,0);
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);

        const alertPayables = payables.filter(exp => {
            const due = new Date(exp.dueDate);
            due.setHours(0,0,0,0);
            return due <= threeDaysFromNow;
        });

        // 2. CUENTAS POR COBRAR (Saldos deudores sin movimiento en más de 30 días)
        const queryReceivables = `
            SELECT 
              bc.id, bc.name, bc.phone,
              SUM(
                CASE 
                  WHEN LOWER(cc.type) IN ('debit', 'debe', 'cargo') THEN cc.amount 
                  WHEN LOWER(cc.type) IN ('credit', 'haber', 'pago') THEN -cc.amount 
                  ELSE 0 
                END
              ) AS balance,
              MAX(cc.date) as last_movement
            FROM business_clients bc
            JOIN cc_movements cc ON cc.clientId = bc.id AND cc.company_id = bc.company_id
            WHERE bc.company_id = ?
            GROUP BY bc.id
            HAVING balance > 0
        `;
        const { results: receivables } = await db.prepare(queryReceivables).bind(companyId).all();

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const alertReceivables = receivables.filter(c => {
            if(!c.last_movement) return false;
            const lastMov = new Date(c.last_movement);
            return lastMov <= thirtyDaysAgo;
        });

        return Response.json({ 
            payables: alertPayables.map(p => ({ ...p, supplierName: p.supplierName || 'Varios / Cons. Final' })), 
            receivables: alertReceivables 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
