function getCompanyIdFromRequest(request) {
    return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id' }, { status: 400 });

        const url = new URL(context.request.url);
        const status = url.searchParams.get('status') || 'Todos';

        let query = "SELECT * FROM expenses WHERE company_id = ?";
        let params = [companyId];

        if (status !== 'Todos') {
            query += " AND status = ?";
            params.push(status);
        }
        query += " ORDER BY date DESC, createdAt DESC";

        const { results } = await context.env.DB.prepare(query).bind(...params).all();
        return Response.json(results);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id' }, { status: 400 });

        const data = await context.request.json();
        const id = data.id || 'exp_' + Date.now();
        const isMueveStock = data.mueveStock ? 1 : 0;
        const itemsJSON = data.itemsJSON || '[]';

        // 1. Guardar el Gasto en Contabilidad
        await context.env.DB.prepare(`
            INSERT INTO expenses (
                id, company_id, date, amount, concept, category, status, method, dueDate, notes,
                supplierId, invoiceType, invoiceNum, ivaAmount, nonTaxedAmount, branch, loadedBy, canceledBy, createdAt,
                itemsJSON, mueveStock
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                date = excluded.date, amount = excluded.amount, concept = excluded.concept, category = excluded.category,
                status = excluded.status, method = excluded.method, dueDate = excluded.dueDate, notes = excluded.notes,
                supplierId = excluded.supplierId, invoiceType = excluded.invoiceType, invoiceNum = excluded.invoiceNum,
                ivaAmount = excluded.ivaAmount, nonTaxedAmount = excluded.nonTaxedAmount, branch = excluded.branch,
                itemsJSON = excluded.itemsJSON, mueveStock = excluded.mueveStock
        `).bind(
            id, companyId, data.date, data.amount || 0, data.concept, data.category, data.status, data.method,
            data.dueDate || '', data.notes || '', data.supplierId || 'Varios/Consumidor Final', data.invoiceType || '',
            data.invoiceNum || '', data.ivaAmount || 0, data.nonTaxedAmount || 0, data.branch || 'Global',
            data.loadedBy || 'Admin', data.canceledBy || '', data.createdAt || new Date().toISOString(),
            itemsJSON, isMueveStock
        ).run();

        // 2. Lógica Logística (Mueve Stock y CPP)
        if (isMueveStock === 1 && data.status !== 'Anulado') {
            const items = JSON.parse(itemsJSON);
            for (let item of items) {
                // Traer producto actual
                const prod = await context.env.DB.prepare("SELECT * FROM products WHERE id = ? AND company_id = ?").bind(item.id, companyId).first();
                if (prod) {
                    let stockBranches = {};
                    try { stockBranches = JSON.parse(prod.stock_branches); } catch(e) { stockBranches = { "Central": prod.stock || 0 }; }
                    
                    const qty = Number(item.qty) || 0;
                    const unitCost = Number(item.cost) || 0;
                    
                    // Cálculo de Costo Promedio Ponderado (CPP)
                    const currentTotalStock = Number(prod.stock) || 0;
                    const currentUnitCost = Number(prod.cost) || 0;
                    
                    let newUnitCost = currentUnitCost;
                    const newTotalStock = currentTotalStock + qty;
                    
                    if (newTotalStock > 0) {
                        const totalValueBefore = currentTotalStock * currentUnitCost;
                        const incomingValue = qty * unitCost;
                        newUnitCost = (totalValueBefore + incomingValue) / newTotalStock;
                    }

                    // Sumar stock a la sucursal de destino
                    const targetBranch = data.branch === 'Global' ? 'Central' : data.branch;
                    stockBranches[targetBranch] = (stockBranches[targetBranch] || 0) + qty;

                    // Actualizar Producto
                    await context.env.DB.prepare(`
                        UPDATE products 
                        SET cost = ?, stock = ?, stock_branches = ? 
                        WHERE id = ? AND company_id = ?
                    `).bind(newUnitCost, newTotalStock, JSON.stringify(stockBranches), item.id, companyId).run();
                }
            }
        }

        return Response.json({ success: true, id: id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        const canceledBy = url.searchParams.get('canceledBy') || 'Admin';

        // Anulación suave (El stock se debe ajustar manualmente por el encargado si es necesario)
        await context.env.DB.prepare(
            "UPDATE expenses SET status = 'Anulado', canceledBy = ? WHERE id = ? AND company_id = ?"
        ).bind(canceledBy, id, companyId).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
