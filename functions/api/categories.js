export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM categories ORDER BY name ASC").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(`Error GET: ${error.message}`, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        const id = data.id || 'cat_' + Date.now();
        const name = data.name;

        await context.env.DB.prepare(`
            INSERT INTO categories (id, name) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name
        `).bind(id, name).run();

        return new Response("OK", { status: 200 });
    } catch (error) {
        return new Response(`Error POST DB: ${error.message}`, { status: 500 });
    }
}
