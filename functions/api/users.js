export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT id, username, role, active, createdAt FROM users ORDER BY createdAt DESC").all();
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO users (id, username, password, role, active, createdAt) 
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `).bind(data.id, data.username, data.password, data.role, 1, new Date().toISOString()).run();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    // Si mandó contraseña nueva, la actualizamos. Si no, solo actualizamos el rol y usuario.
    if (data.password) {
      await context.env.DB.prepare("UPDATE users SET username = ?1, password = ?2, role = ?3 WHERE id = ?4")
        .bind(data.username, data.password, data.role, data.id).run();
    } else {
      await context.env.DB.prepare("UPDATE users SET username = ?1, role = ?2 WHERE id = ?3")
        .bind(data.username, data.role, data.id).run();
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    await context.env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
