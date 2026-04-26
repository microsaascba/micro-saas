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
                od_esf, od_cil, od_eje, od_base, od_add, od_diam, od_di, od_alt,
                oi_esf, oi_cil, oi_eje, oi_base, oi_add, oi_diam, oi_di, oi_alt,
                dp, diseno, calibrado, material, color_lente, antirreflex, tinte, tratamientos, doctor, 
                frameCode, frameName, glassType, 
                deliveryDate, total, deposit, balance, 
                status, seller, notes, cupon, createdAt,
                os_name, os_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                status = excluded.status,
                balance = excluded.balance,
                deposit = excluded.deposit,
                deliveryDate = excluded.deliveryDate,
                notes = excluded.notes,
                cupon = excluded.cupon,
                od_esf = excluded.od_esf, od_cil = excluded.od_cil, od_eje = excluded.od_eje, od_add = excluded.od_add,
                od_diam = excluded.od_diam, od_di = excluded.od_di, od_alt = excluded.od_alt, od_base = excluded.od_base,
                oi_esf = excluded.oi_esf, oi_cil = excluded.oi_cil, oi_eje = excluded.oi_eje, oi_add = excluded.oi_add,
                oi_diam = excluded.oi_diam, oi_di = excluded.oi_di, oi_alt = excluded.oi_alt, oi_base = excluded.oi_base,
                dp = excluded.dp, diseno = excluded.diseno, calibrado = excluded.calibrado, material = excluded.material,
                color_lente = excluded.color_lente, antirreflex = excluded.antirreflex, tinte = excluded.tinte, tratamientos = excluded.tratamientos,
                doctor = excluded.doctor, frameCode = excluded.frameCode, frameName = excluded.frameName, glassType = excluded.glassType,
                total = excluded.total, os_name = excluded.os_name, os_amount = excluded.os_amount
        `).bind(
            data.id, companyId, data.date, data.clientId, data.clientName,
            data.od_esf || '', data.od_cil || '', data.od_eje || '', data.od_base || '', data.od_add || '', data.od_diam || '', data.od_di || '', data.od_alt || '',
            data.oi_esf || '', data.oi_cil || '', data.oi_eje || '', data.oi_base || '', data.oi_add || '', data.oi_diam || '', data.oi_di || '', data.oi_alt || '',
            data.dp || '', data.diseno || '', data.calibrado || '', data.material || '', data.color_lente || '', data.antirreflex || '', data.tinte || '', data.tratamientos || '', data.doctor || '',
            data.frameCode || '', data.frameName || '', data.glassType || '',
            data.deliveryDate || '', data.total || 0, data.deposit || 0, data.balance || 0,
            data.status || 'Pendiente', data.seller || 'Admin', data.notes || '', data.cupon || '', data.createdAt,
            data.os_name || '', data.os_amount || 0
        ).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
