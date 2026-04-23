export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM optical_orders ORDER BY createdAt DESC"
        ).all();
        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        
        await context.env.DB.prepare(`
            INSERT INTO optical_orders (
                id, date, clientId, clientName, 
                od_esf, od_cil, od_eje, od_add, 
                oi_esf, oi_cil, oi_eje, oi_add, 
                dp, altura, doctor, 
                frameCode, frameName, glassType, 
                deliveryDate, total, deposit, balance, 
                status, seller, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                status = excluded.status,
                balance = excluded.balance,
                deposit = excluded.deposit,
                deliveryDate = excluded.deliveryDate,
                notes = excluded.notes
        `).bind(
            data.id, data.date, data.clientId, data.clientName,
            data.od_esf || '', data.od_cil || '', data.od_eje || '', data.od_add || '',
            data.oi_esf || '', data.oi_cil || '', data.oi_eje || '', data.oi_add || '',
            data.dp || '', data.altura || '', data.doctor || '',
            data.frameCode || '', data.frameName || '', data.glassType || '',
            data.deliveryDate || '', data.total || 0, data.deposit || 0, data.balance || 0,
            data.status || 'Pendiente', data.seller || 'Admin', data.notes || '', data.createdAt
        ).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
