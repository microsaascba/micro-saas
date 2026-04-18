export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM sales ORDER BY createdAt DESC").all();
    const ventasFormateadas = results.map(venta => ({
      ...venta,
      items: JSON.parse(venta.itemsJSON || '[]'),
      client: venta.clientId 
    }));
    return Response.json(ventasFormateadas);
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const itemsString = JSON.stringify(data.items || []);
    const isB2BNum = data.isB2B ? 1 : 0;
    const clientNameOrId = data.clientId || data.client || 'Consumidor Final';
    const vendedor = data.seller || 'Admin';
    const sucursal = data.branch || 'Central'; // Recibe la sucursal de la caja

    // 1. DESCONTEO DE STOCK MULTI-DEPÓSITO
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        // Buscamos cómo está el stock de este producto en la base de datos
        const { results } = await context.env.DB.prepare("SELECT stock_branches, stock FROM products WHERE id = ?").bind(item.id).all();
        
        if (results.length > 0) {
          const prod = results[0];
          let branches = {};
          
          // Parseamos el JSON de sucursales
          try { 
            branches = JSON.parse(prod.stock_branches); 
          } catch(e) { 
            branches = { "Central": prod.stock || 0 }; 
          }

          // Si la sucursal no existe en el registro del producto, la creamos en 0
          if (branches[sucursal] === undefined) branches[sucursal] = 0;
          
          // ¡Acá restamos la venta a la sucursal correcta!
          branches[sucursal] -= item.qty;
          
          // Recalculamos el total de unidades que le quedan a la empresa
          let newTotalStock = 0;
          for (let b in branches) newTotalStock += branches[b];

          // Actualizamos el producto en la base de datos
          await context.env.DB.prepare(
            "UPDATE products SET stock = ?, stock_branches = ? WHERE id = ?"
          ).bind(newTotalStock, JSON.stringify(branches), item.id).run();
        }
      }
    }

    // 2. GUARDAR EL TICKET DE VENTA EN LA BASE DE DATOS
    await context.env.DB.prepare(`
      INSERT INTO sales (id, date, clientId, method, cupon, subtotal, promoDiscount, total, isB2B, itemsJSON, createdAt, seller, branch) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    `).bind(
      data.id, data.date || new Date().toISOString().split('T')[0], clientNameOrId, 
      data.method, data.cupon || '', data.subtotal, data.promoDiscount, data.total, isB2BNum, itemsString, data.createdAt, vendedor, sucursal
    ).run();
    
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function onRequestDelete(context) {
  // Nota: Si implementás anular venta, deberías hacer el proceso inverso (sumar stock)
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    await context.env.DB.prepare("DELETE FROM sales WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
