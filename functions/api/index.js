const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  try {
    // Hacemos una consulta súper básica a SQLite que no depende de tus tablas
    const { results } = await context.env.DB.prepare("SELECT date('now') as actual_date").all();

    return Response.json({
      status: "Conexión Exitosa con D1",
      db_date: results[0].actual_date,
      message: "¡El Worker está hablando correctamente con la base de datos!"
    }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({
      status: "Error de Conexión",
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}
