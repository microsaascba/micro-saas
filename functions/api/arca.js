function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) {
        return Response.json({ error: 'Falta el ID del cliente (company_id) en la petición.' }, { status: 400 });
    }

    const ventaData = await context.request.json();
    
    // 1. BUSCAMOS LAS CREDENCIALES DEL INQUILINO EN LA TABLA CLIENTS
    // Nota: Usamos "cuil" porque así se llama la columna del identificador fiscal en tu tabla master
    const clientData = await context.env.DB.prepare(`
        SELECT cuil, afip_crt, afip_key, afip_pto_vta 
        FROM clients 
        WHERE id = ?
    `).bind(companyId).first();
    
    // Si no encuentra al cliente o le falta algún certificado, bloquea la operación
    if (!clientData || !clientData.cuil || !clientData.afip_crt || !clientData.afip_key || !clientData.afip_pto_vta) {
        throw new Error("El sistema no tiene los certificados de AFIP configurados para esta sucursal. Contacte al administrador.");
    }

    // 2. LE INYECTAMOS LAS CREDENCIALES A LA VENTA
    // Limpiamos los guiones del CUIT/CUIL por si lo escribieron con formato
    ventaData.afip_cuit = Number(clientData.cuil.replace(/[^0-9]/g, ''));
    ventaData.afip_cert = clientData.afip_crt;
    ventaData.afip_key = clientData.afip_key;
    ventaData.afip_pto_vta = clientData.afip_pto_vta;

    // 3. MANDAMOS TODO AL SERVIDOR DE RENDER (El Traductor AFIP)
    const renderUrl = "https://api-afip-microsaas.onrender.com/emitir-factura-c"; 
    
    const response = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ventaData)
    });

    const arcaData = await response.json();

    // 4. RESPONDEMOS A LA TICKETERA DEL CLIENTE
    if (arcaData.success) {
        return Response.json({
          success: true,
          cae: arcaData.cae,
          caeVto: arcaData.caeVto,
          puntoVenta: arcaData.puntoVenta,
          numeroComprobante: arcaData.numeroComprobante
        });
    } else {
        // Si AFIP o Render devuelven un error, se lo mostramos al usuario
        throw new Error(arcaData.error || "El servidor de AFIP rechazó la solicitud.");
    }

  } catch (error) {
    console.error("Error en Puente ARCA:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
