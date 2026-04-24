// arca.js - Conector Directo Multi-Tenant
const AFIP_SDK_TOKEN = "ukb9HbmorVpzrE0eF3QTe4pKEOqyp8uuQSbZ50Bkq8xUf2YR7uMqphOf3r3HWjmP"; // 👈 Pegá acá el Token que te da Afip SDK

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
    
    // 1. BUSCAMOS LAS CREDENCIALES DEL CLIENTE EN D1
    const clientData = await context.env.DB.prepare(`
        SELECT cuil, afip_crt, afip_key, afip_pto_vta, iva_condition 
        FROM clients 
        WHERE id = ?
    `).bind(companyId).first();
    
    if (!clientData || !clientData.cuil || !clientData.afip_crt || !clientData.afip_key) {
        throw new Error("Faltan certificados de ARCA para este cliente. Verifique el panel Master.");
    }

    // 2. PREPARAMOS EL PAYLOAD PARA AFIP SDK
    // Limpiamos el CUIT por seguridad
    const cuitLimpio = clientData.cuil.replace(/[^0-9]/g, '');
    
    const payload = {
        "cert": clientData.afip_crt,
        "key": clientData.afip_key,
        "cuit": cuitLimpio,
        "production": true, // 👈 Forzamos producción ya que tus certs son reales
        "cbte_tipo": 11,     // 11 = Factura C
        "pto_vta": parseInt(clientData.afip_pto_vta || 1),
        "concepto": 1,      // 1 = Productos (Cambiá a 2 si es Servicios)
        "doc_tipo": ventaData.cliente_doc && ventaData.cliente_doc.length > 8 ? 80 : 96, // 80=CUIT, 96=DNI
        "doc_nro": ventaData.cliente_doc ? parseInt(ventaData.cliente_doc) : 0,
        "cbte_fch": new Date().toISOString().slice(0,10).replace(/-/g, ''),
        "imp_total": parseFloat(ventaData.total),
        "imp_neto": parseFloat(ventaData.total),
        "imp_iva": 0,
        "mon_id": "PES",
        "mon_cotiz": 1
    };

    // 3. LLAMADA DIRECTA A LA API NACIONAL
    const response = await fetch("https://app.afipsdk.com/api/v1/afip/requests", {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AFIP_SDK_TOKEN}`
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || result.error) {
        throw new Error(result.error || "Error desconocido al contactar con la API de facturación.");
    }

    // 4. RESPONDEMOS AL FRONTEND CON EL CAE
    return Response.json({
        success: true,
        cae: result.cae,
        caeVto: result.cae_vto,
        puntoVenta: clientData.afip_pto_vta,
        numeroComprobante: result.cbte_nro
    });

  } catch (error) {
    console.error("Error en ARCA Worker:", error.message);
    return Response.json({ 
        success: false, 
        error: error.message 
    }, { status: 500 });
  }
}
