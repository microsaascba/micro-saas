export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT id, nombre, usuario, telefono, email FROM Agentes").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        await context.env.DB.prepare(
            "INSERT INTO Agentes (id, nombre, usuario, password_hash, telefono, email) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(data.id, data.nombre, data.usuario, data.password_hash, data.telefono, data.email).run();
        
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
