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
        const status = data.status || 'Activo';
        const createdAt = data.createdAt || new Date().toISOString();
        
        // NUEVO: Recibimos los módulos permitidos para esta empresa
        const allowedModules = data.allowedModules ? JSON.stringify(data.allowedModules) : '[]';
        
        await context.env.DB.prepare(`
            INSERT INTO clients (id, name, cuil, address, type, email, phone, ivaCondition, status, createdAt, allowedModules)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                cuil = excluded.cuil,
                address = excluded.address,
                type = excluded.type,
                email = excluded.email,
                phone = excluded.phone,
                ivaCondition = excluded.ivaCondition,
                status = excluded.status,
                allowedModules = excluded.allowedModules
        `).bind(id, name, cuil, address, type, email, phone, ivaCondition, status, createdAt, allowedModules).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(`Error POST DB: ${error.message}`, { status: 500 });
    }
}
