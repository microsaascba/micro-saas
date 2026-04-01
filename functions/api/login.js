export async function onRequestPost(context) {
  try {
    const { username, password } = await context.request.json();
    
    // Buscamos el usuario en la base de datos
    const { results } = await context.env.DB.prepare(
      "SELECT id, username, role FROM users WHERE username = ? AND password = ? AND active = 1"
    ).bind(username, password).all();
    
    if (results.length > 0) {
      // Login exitoso
      return Response.json({ success: true, user: results[0] });
    } else {
      // Login fallido
      return Response.json({ success: false, message: "Usuario o contraseña incorrectos" }, { status: 401 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
