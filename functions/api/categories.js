export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM categories ORDER BY name ASC").all();
        return Response.json(results);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        const id = data.id || 'cat_' + Date.now();
        const newName = data.name.trim();

        // Verificamos si es una edición
        if (data.oldName) {
            // Actualiza el nombre en la tabla de categorías
            await context.env.DB.prepare(
                "UPDATE categories SET name = ? WHERE id = ?"
            ).bind(newName, data.id).run();

            // CASCADE UPDATE: Actualiza todos los productos que tenían el nombre viejo
            await context.env.DB.prepare(
                "UPDATE products SET category = ? WHERE category = ?"
            ).bind(newName, data.oldName).run();

            return Response.json({ success: true, updated: true });
        }

        // Si es una creación nueva
        await context.env.DB.prepare(
            "INSERT INTO categories (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING"
        ).bind(id, newName).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        const catName = url.searchParams.get('name');

        if (!id) return Response.json({ error: 'Falta ID' }, { status: 400 });

        // Borrar de la tabla de categorías
        await context.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();

        // Opcional: Reasignar productos huérfanos a "Sin Categoría"
        if (catName) {
            await context.env.DB.prepare("UPDATE products SET category = 'Sin Categoría' WHERE category = ?").bind(catName).run();
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
