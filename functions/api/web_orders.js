// /functions/api/web_orders.js
export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        const companyId = request.headers.get('x-company-id') || data.companyId;

        if (!companyId || !data.cart || data.cart.length === 0) {
            return Response.json({ error: 'Datos incompletos para procesar la orden.' }, { status: 400 });
        }

        const db = context.env.DB;
        let totalOrden = 0;
        const itemsConfirmados = [];

        // 1. VALIDACIÓN ESTRICTA DE STOCK Y PRECIOS REALES
        for (const item of data.cart) {
            const prodData = await db.prepare("SELECT price, stock, stock_branches FROM products WHERE id = ? AND company_id = ?").bind(item.id, companyId).first();

            if (!prodData) {
                return Response.json({ error: `El producto ${item.name} ya no existe.` }, { status: 400 });
            }

            if (prodData.stock < item.qty) {
                return Response.json({ error: `¡Ups! Alguien acaba de comprar el último ${item.name}. Solo quedan ${prodData.stock} en stock.` }, { status: 400 });
            }

            // Usamos el precio de la DB para evitar que un hacker altere el precio en el frontend
            const precioReal = prodData.price;
            totalOrden += precioReal * item.qty;

            itemsConfirmados.push({
                id: item.id,
                name: item.name,
                price: precioReal,
                qty: item.qty,
                subtotal: precioReal * item.qty
            });
        }

        // 2. INYECCIÓN DIRECTA AL ERP (Tabla sales)
        const idVenta = 'vta_' + Date.now();
        const fechaActual = new Date().toISOString();

        await db.prepare(`
            INSERT INTO sales (id, company_id, client, total, method, itemsJSON, branch, seller, createdAt, closed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            idVenta,
            companyId,
            data.customerName || 'Cliente Web',
            totalOrden,
            'A Acordar / Web',
            JSON.stringify(itemsConfirmados),
            'Web', // Etiquetamos la sucursal como 'Web' para que no ensucie la caja física
            'E-commerce',
            fechaActual,
            0 // Queda abierta (no cerrada) para que el administrador la vea en sus métricas
        ).run();

        // 3. DESCUENTO DE STOCK (Si quisieras descontarlo automáticamente. Por seguridad, muchos SaaS prefieren que el admin apruebe el pedido antes de tocar el stock físico. Por ahora lo descontamos del stock global).
        for (const item of data.cart) {
             await db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND company_id = ?").bind(item.qty, item.id, companyId).run();
        }

        // CABECERAS CORS para permitir solicitudes desde cualquier dominio web
        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-company-id"
        };

        return new Response(JSON.stringify({ success: true, orderId: idVenta }), { headers, status: 200 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// Para responder correctamente a la validación previa del navegador (CORS preflight)
export async function onRequestOptions(context) {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-company-id"
        }
    });
}
