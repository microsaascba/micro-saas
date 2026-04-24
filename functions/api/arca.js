function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const ventaData = await context.request.json();
    
    // 🔗 ACÁ CONECTAMOS CON TU SERVIDOR EN RENDER
    const renderUrl = "https://api-afip-microsaas.onrender.com/emitir-factura-c";
    
    const response = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ventaData)
    });

    const arcaData = await response.json();

    if (arcaData.success) {
        return Response.json({
          success: true,
          cae: arcaData.cae,
          caeVto: arcaData.caeVto,
          puntoVenta: arcaData.puntoVenta,
          numeroComprobante: arcaData.numeroComprobante
        });
    } else {
        throw new Error(arcaData.error || "El servidor de AFIP rechazó la solicitud.");
    }

  } catch (error) {
    return Response.json({ error: 'Error al conectar con el puente ARCA: ' + error.message }, { status: 500 });
  }
}
