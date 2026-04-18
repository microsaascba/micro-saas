// Tu URL del Worker de Cloudflare
const API_URL = "https://tu-worker.tu-usuario.workers.dev/api";

// Ahora getData es ASÍNCRONO
async function getData(endpoint) {
  try {
    const response = await fetch(`${API_URL}/${endpoint}`);
    return await response.json();
  } catch (error) {
    console.error("Error cargando datos:", error);
    return [];
  }
}

async function setData(endpoint, data) {
  try {
    await fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error("Error guardando datos:", error);
  }
}
