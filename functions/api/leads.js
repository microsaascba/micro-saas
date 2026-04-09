export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const agenteId = url.searchParams.get('agente_id');
    const db = context.env.DB;

    try {
        let queryLeads = "SELECT * FROM Leads WHERE estado = 'No Contactado'";
        let stmtLeads = db.prepare(queryLeads);
        if (agenteId && agenteId !== 'todos' && agenteId !== 'null') {
            queryLeads += " AND agente_id = ?";
            stmtLeads = db.prepare(queryLeads).bind(agenteId);
        }
        const leadsRes = await stmtLeads.all();

        let queryContactos = "SELECT * FROM Leads WHERE estado != 'No Contactado'";
        let stmtContactos = db.prepare(queryContactos);
        if (agenteId && agenteId !== 'todos' && agenteId !== 'null') {
            queryContactos += " AND agente_id = ?";
            stmtContactos = db.prepare(queryContactos).bind(agenteId);
        }
        const contactosRes = await stmtContactos.all();
        let contactos = contactosRes.results;

        // Anidar notas
        for (let c of contactos) {
            const notasRes = await db.prepare("SELECT * FROM Notas WHERE lead_id = ? ORDER BY fecha DESC").bind(c.id).all();
            c.notas = notasRes.results.map(n => ({ text: n.nota, time: new Date(n.fecha).toLocaleString() }));
        }

        return new Response(JSON.stringify({ leads: leadsRes.results, contactos: contactos }), { 
            headers: { "Content-Type": "application/json" } 
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        await context.env.DB.prepare(
            "INSERT INTO Leads (id, nombre, telefono, origen, prop_id, agente_id, estado, fecha_ingreso) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(data.id, data.nombre, data.telefono, data.origen, data.prop_id, data.agente_id, data.estado, data.fecha_ingreso).run();
        
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestPut(context) {
    try {
        // Obtenemos el ID desde la URL (ej: /api/leads?id=123)
        const url = new URL(context.request.url);
        const leadId = url.searchParams.get('id'); 
        const data = await context.request.json();
        
        await context.env.DB.prepare(
            "UPDATE Leads SET estado = ? WHERE id = ?"
        ).bind(data.estado, leadId).run();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
