export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM Propiedades").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        await context.env.DB.prepare(
            "INSERT INTO Propiedades (id, nombre, precio, ubicacion, maps, fotos, descripcion, speech, script_wa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(data.id, data.nombre, data.precio, data.ubicacion, data.maps, data.fotos, data.descripcion, data.speech, data.script_wa).run();
        
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
