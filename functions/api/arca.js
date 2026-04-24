function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const ventaData = await context.request.json();
    
    // 1. BUSCAMOS LAS CREDENCIALES DEL INQUILINO EN LA BASE DE DATOS
    const company = await context.env.DB.prepare(`SELECT cuit, afip_crt, afip_key, afip_pto_vta FROM companies WHERE id = ?`).bind(companyId).first();
    
    if (!company || !company.cuit || !company.afip_crt || !company.afip_key || !company.afip_pto_vta) {
        throw new Error("El sistema no tiene los certificados de AFIP configurados para esta empresa.");
    }

    // 2. LE INYECTAMOS LAS CREDENCIALES A LA VENTA
    ventaData.afip_cuit = Number(company.cuit.replace(/[^0-9]/g, '')); // Limpiamos guiones
    ventaData.afip_cert = company.afip_crt;
    ventaData.afip_key = company.afip_key;
    ventaData.afip_pto_vta = company.afip_pto_vta;

    // 3. MANDAMOS TODO A RENDER
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}
