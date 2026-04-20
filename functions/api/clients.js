export async function onRequestGet(context) {
    try {
        // Obtenemos los clientes ordenados alfabéticamente
        const { results } = await context.env.DB.prepare("SELECT * FROM clients ORDER BY name ASC").all();
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
        
        // Insertamos o actualizamos si el ID ya existe
        await context.env.DB.prepare(`
            INSERT INTO clients (id, name, cuil, address, type, email, phone, ivaCondition, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                cuil = excluded.cuil,
                address = excluded.address,
                type = excluded.type,
                email = excluded.email,
                phone = excluded.phone,
                ivaCondition = excluded.ivaCondition
        `).bind(
            data.id, 
            data.name, 
            data.cuil || '', 
            data.address || '', 
            data.type || 'B2C', 
            data.email || '', 
            data.phone || '', 
            data.ivaCondition || 'Consumidor Final', 
            data.createdAt || new Date().toISOString()
        ).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
