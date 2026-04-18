export async function onRequestPost(context) {
  try {
    const { username, password } = await context.request.json();
    
    // Buscamos si existe la combinación exacta de usuario y clave
    const { results } = await context.env.DB.prepare(
      "SELECT id, username, role, active, allowedModules FROM users WHERE username = ? AND password = ?"
    ).bind(username, password).all();

    // Si no hay resultados, la clave o el usuario están mal
    if (results.length === 0) {
      return Response.json({ success: false, error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    const user = results[0];

    // Si el usuario está desactivado/bloqueado
    if (user.active !== 1) {
      return Response.json({ success: false, error: "Tu cuenta ha sido bloqueada. Contactá al administrador." }, { status: 403 });
    }

    // Convertimos la lista de permisos a un formato que el frontend entienda
    user.allowedModules = JSON.parse(user.allowedModules || '[]');

    return Response.json({ success: true, user });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
