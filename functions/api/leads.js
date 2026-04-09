// functions/api/leads.js
export async function onRequestGet(context) {
  // context.env.DB es la conexión a tu D1 (configurada en wrangler.toml)
  const db = context.env.DB;
  
  // Leer si viene un filtro por URL: /api/leads?agente_id=juan
  const url = new URL(context.request.url);
  const agenteId = url.searchParams.get('agente_id');

  try {
    let query = "SELECT * FROM Leads ORDER BY fecha_ingreso DESC";
    let stmt = db.prepare(query);

    if (agenteId && agenteId !== 'todos') {
      query = "SELECT * FROM Leads WHERE agente_id = ? ORDER BY fecha_ingreso DESC";
      stmt = db.prepare(query).bind(agenteId);
    }

    const { results } = await stmt.all();
    
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
