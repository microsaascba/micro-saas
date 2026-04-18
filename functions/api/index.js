export default {
  async fetch(request, env) {
    // 1. Manejo de CORS (Para que tus HTML puedan consultarlo sin bloqueos de seguridad)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname; // Ej: /api/products

    try {
      // ==========================================
      // RUTAS PARA PRODUCTOS
      // ==========================================
      if (path === '/api/products' && request.method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY name ASC").all();
        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (path === '/api/products' && request.method === 'POST') {
        const p = await request.json();
        // UPSERT: Si el ID ya existe lo actualiza, si no, lo inserta
        await env.DB.prepare(`
          INSERT INTO products (id, name, code, category, cost, price, stock, status, promoType, promoValue, promoLinked) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
          name=excluded.name, code=excluded.code, category=excluded.category, cost=excluded.cost, price=excluded.price, stock=excluded.stock, status=excluded.status, promoType=excluded.promoType, promoValue=excluded.promoValue, promoLinked=excluded.promoLinked
        `).bind(p.id, p.name, p.code, p.category, p.cost, p.price, p.stock, p.status, p.promoType, p.promoValue, p.promoLinked).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (path === '/api/products' && request.method === 'DELETE') {
        const { id } = await request.json();
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // (Acá se agregarían las rutas para clientes, ventas, etc. siguiendo la misma lógica)
      
      return new Response("Ruta no encontrada", { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(error.message, { status: 500, headers: corsHeaders });
    }
  }
};
