export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT id, nombre, usuario, telefono, email, direccion, ciudad, provincia FROM Agentes").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        await context.env.DB.prepare(
            "INSERT INTO Agentes (id, nombre, usuario, password_hash, telefono, email, direccion, ciudad, provincia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(data.id, data.nombre, data.usuario, data.password_hash, data.telefono, data.email, data.direccion, data.ciudad, data.provincia).run();
        
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestPut(context) {
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        const data = await context.request.json();
        await context.env.DB.prepare(
            "UPDATE Agentes SET nombre=?, telefono=?, email=?, direccion=?, ciudad=?, provincia=? WHERE id=?"
        ).bind(data.nombre, data.telefono, data.email, data.direccion, data.ciudad, data.provincia, id).run();
        
        return new Response(JSON.stringify({ok: true}));
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        await context.env.DB.prepare("DELETE FROM Agentes WHERE id=?").bind(id).run();
        return new Response(JSON.stringify({ok: true}));
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
