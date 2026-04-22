export async function onRequestPost(context) {
  try {
    const { username, password } = await context.request.json();

    const { results } = await context.env.DB.prepare(
      "SELECT id, username, role, active, allowedModules, company_id FROM users WHERE username = ? AND password = ?"
    ).bind(username, password).all();

    if (!results.length) {
      return Response.json(
        { success: false, error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const user = results[0];

    if (Number(user.active) !== 1) {
      return Response.json(
        { success: false, error: "Tu cuenta ha sido bloqueada. Contactá al administrador." },
        { status: 403 }
      );
    }

    user.allowedModules = JSON.parse(user.allowedModules || "[]");

    return Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        allowedModules: user.allowedModules,
        company_id: user.company_id
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message || "Error interno." },
      { status: 500 }
    );
  }
}
