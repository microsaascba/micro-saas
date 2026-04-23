function getCompanyIdFromRequest(request) {
  return request.headers.get('x-company-id') || '';
}

export async function onRequestPost(context) {
  try {
    const companyId = getCompanyIdFromRequest(context.request);
    if (!companyId) return Response.json({ error: 'Falta company_id.' }, { status: 400 });

    const data = await context.request.json();
    
    // Aquí irán los datos que recibe de facturacion.html:
    // data.total, data.clienteDoc, data.tipoComprobante (A, B, C), etc.

    /* ====================================================================
    ESPACIO RESERVADO PARA LÓGICA ARCA (AFIP)
    Aquí se integrará el SDK de AFIP (ej. afip.js o API de terceros).
    Pasos que ocurrirán aquí en el futuro:
    1. Autenticación con WSAA (Certificado .crt y llave privada .key)
    2. Llamada a WSFEv1 (FECAESolicitar)
    ====================================================================
    */

    // SIMULACIÓN DE RESPUESTA EXITOSA DE ARCA (Delay de 1.5 seg para simular red)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generamos un CAE falso y fecha de vencimiento (10 días)
    const mockCae = "6" + Math.floor(Math.random() * 9000000000000) + "1";
    const vto = new Date();
    vto.setDate(vto.getDate() + 10);
    const mockVto = vto.toISOString().split('T')[0].split('-').reverse().join('/');

    // Simulamos que AFIP nos asignó el número de comprobante consecutivo
    const mockPuntoVenta = 1;
    const mockNumeroFactura = Math.floor(Math.random() * 5000) + 1000;

    return Response.json({
      success: true,
      cae: mockCae,
      caeVto: mockVto,
      puntoVenta: mockPuntoVenta,
      numeroComprobante: mockNumeroFactura,
      resultado: 'Aprobado' // A = Aprobado, R = Rechazado
    });

  } catch (error) {
    return Response.json({ error: 'Error al conectar con ARCA: ' + error.message }, { status: 500 });
  }
}
