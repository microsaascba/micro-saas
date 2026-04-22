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
        
        // Campos Geográficos
        const city = data.city || '';
        const province = data.province || '';
        const country = data.country || 'Argentina';

        // Campos Exclusivos del Master
        const contact = data.contact || '';
        const fee = data.fee || 0;
        const dueDate = data.dueDate || '';
        const active = data.active !== undefined ? (data.active ? 1 : 0) : 1;
        const adminUser = data.adminUser || '';
        const adminPass = data.adminPass || '';
        const allowedModules = data.allowedModules ? JSON.stringify(data.allowedModules) : '[]';
        
        // NUEVO: Logo en Base64
        const logo = data.logo || '';
        
        await context.env.DB.prepare(`
            INSERT INTO clients (id, name, contact, phone, email, cuil, address, fee, dueDate, active, adminUser, adminPass, type, createdAt, ivaCondition, status, city, province, country, allowedModules, logo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name, contact = excluded.contact, phone = excluded.phone, email = excluded.email,
                cuil = excluded.cuil, address = excluded.address, fee = excluded.fee, dueDate = excluded.dueDate,
                active = excluded.active, adminUser = excluded.adminUser, adminPass = excluded.adminPass,
                type = excluded.type, ivaCondition = excluded.ivaCondition, status = excluded.status,
                city = excluded.city, province = excluded.province, country = excluded.country, allowedModules = excluded.allowedModules, logo = excluded.logo
        `).bind(
            id, name, contact, phone, email, cuil, address, fee, dueDate, active, adminUser, adminPass, 
            type, createdAt, ivaCondition, status, city, province, country, allowedModules, logo
        ).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(`Error POST DB: ${error.message}`, { status: 500 });
    }
}
