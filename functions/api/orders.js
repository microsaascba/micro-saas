function getCompanyIdFromRequest(request) {
    return request.headers.get('x-company-id') || '';
}

export async function onRequestGet(context) {
    try {
        const companyId = getCompanyIdFromRequest(context.request);
        if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM optical_orders WHERE company_id = ? ORDER BY createdAt DESC"
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
            INSERT INTO optical_orders (
                id, company_id, date, clientId, clientName, 
                od_esf, od_cil, od_eje, od_add, od_diam, od_di, od_alt,
                oi_esf, oi_cil, oi_eje, oi_add, oi_diam, oi_di, oi_alt,
                dp, tratamientos, doctor, 
                frameCode, frameName, glassType, 
                deliveryDate, total, deposit, balance, 
                status, seller, notes, cupon, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                status = excluded.status,
                balance = excluded.balance,
                deposit = excluded.deposit,
                deliveryDate = excluded.deliveryDate,
                notes = excluded.notes,
                cupon = excluded.cupon,
                od_diam = excluded.od_diam,
                od_di = excluded.od_di,
                od_alt = excluded.od_alt,
                oi_diam = excluded.oi_diam,
                oi_di = excluded.oi_di,
                oi_alt = excluded.oi_alt,
                tratamientos = excluded.tratamientos,
                dp = excluded.dp
        `).bind(
            data.id, companyId, data.date, data.clientId, data.clientName,
            data.od_esf || '', data.od_cil || '', data.od_eje || '', data.od_add || '', data.od_diam || '', data.od_di || '', data.od_alt || '',
            data.oi_esf || '', data.oi_cil || '', data.oi_eje || '', data.oi_add || '', data.oi_diam || '', data.oi_di || '', data.oi_alt || '',
            data.dp || '', data.tratamientos || '', data.doctor || '',
            data.frameCode || '', data.frameName || '', data.glassType || '',
            data.deliveryDate || '', data.total || 0, data.deposit || 0, data.balance || 0,
            data.status || 'Pendiente', data.seller || 'Admin', data.notes || '', data.cupon || '', data.createdAt
        ).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
