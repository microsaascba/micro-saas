export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM clients ORDER BY name ASC").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(`Error GET: ${error.message}`, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        
        const id = data.id || 'cli_' + Date.now();
        const name = data.name || 'Sin Nombre';
        const cuil = data.cuil || '';
        const address = data.address || '';
        const type = data.type || 'B2C';
        const email = data.email || '';
        const phone = data.phone || '';
        const ivaCondition = data.ivaCondition || 'Consumidor Final';
        const createdAt = data.createdAt || new Date().toISOString();
        
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
        `).bind(id, name, cuil, address, type, email, phone, ivaCondition, createdAt).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(`Error POST DB: ${error.message}`, { status: 500 });
    }
}

// ESTO ES LO QUE FALTABA PARA QUE EL BOTÓN BORRAR FUNCIONE
export async function onRequestDelete(context) {
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        
        if (!id) return new Response("Falta el ID", { status: 400 });

        await context.env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(id).run();
        
        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(`Error DELETE DB: ${error.message}`, { status: 500 });
    }
}
