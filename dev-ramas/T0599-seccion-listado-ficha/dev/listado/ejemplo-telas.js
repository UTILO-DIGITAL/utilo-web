/*
 * web/dev/listado/ejemplo-telas.js · T0599 · Datos de ejemplo de la sección Listado, inventados, que imitan las pestañas
 * del Excel Maestro de Marta (Seguimiento, Clientes, Prospección, Proveedores y Mis telas) con los nombres de columna de
 * su copia limpia (T0598), y la configuración de la sección para ellas.
 *
 * Ninguna marca, proveedor ni persona es de verdad. Las fechas se cuentan desde hoy, para que siempre haya algo con la
 * fecha pasada, algo de esta semana y algo más adelante. Lleva a propósito los casos raros: fechas «17/11/2026» y
 * «2026-11-17», huecos, textos como «400–500», márgenes «50%» y 0,4, una tela sin coste, un DNI y un IBAN pegados en
 * unas notas (la sección no los enseña) y una tabla de preferencias vacía.
 *
 * Lo usan web/dev/listado/index.html (npm run local → /dev/listado/) y herramientas/probar-listado.js.
 */
(function () {
  'use strict';

  function dia(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function diaBarras(n) { var d = new Date(); d.setDate(d.getDate() + n); return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  /** Una muestra de tela dibujada (rayas, cuadros, puntos o liso), para que la lista tenga fotos sin pedir nada fuera. */
  function muestra(tipo, a, b) {
    var p = { rayas: '<rect width="40" height="40" fill="' + a + '"/><rect width="40" height="8" y="6" fill="' + b + '"/><rect width="40" height="4" y="26" fill="' + b + '"/>',
      cuadros: '<rect width="40" height="40" fill="' + a + '"/><rect width="20" height="20" fill="' + b + '" opacity=".7"/><rect x="20" y="20" width="20" height="20" fill="' + b + '" opacity=".7"/>',
      puntos: '<rect width="40" height="40" fill="' + a + '"/><circle cx="10" cy="10" r="5" fill="' + b + '"/><circle cx="30" cy="30" r="5" fill="' + b + '"/>',
      flores: '<rect width="40" height="40" fill="' + a + '"/><circle cx="20" cy="20" r="9" fill="' + b + '"/><circle cx="20" cy="20" r="3" fill="' + a + '"/><circle cx="4" cy="4" r="4" fill="' + b + '"/><circle cx="36" cy="36" r="4" fill="' + b + '"/>',
      liso: '<rect width="40" height="40" fill="' + a + '"/><path d="M0 40L40 0" stroke="' + b + '" stroke-width=".6" opacity=".5"/>' }[tipo];
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' + p + '</svg>');
  }
  function cols(o) { return Object.keys(o); }

  var ESTADO_TAREA = ['Pendiente', 'En curso', 'Esperando respuesta', 'Hecha', 'Descartada'];
  var FASES = ['1 Contactado', '2 Interesado', '3 Reunión hecha', '4 Cuestionario enviado', '5 Cuestionario recibido', '6 Propuesta enviada',
    '7 Muestras enviadas', '8 Primer pedido', '9 Cliente habitual', 'En pausa', 'Descartado'];
  var ESTADO_PROV = ['Por contactar', 'Contactado', 'Catálogo recibido', 'Muestras pedidas', 'Muestras recibidas', 'Aprobado', 'Visitar en persona', 'En pausa', 'Descartado'];
  var ESTADO_TELA = ['Candidata', 'Muestra pedida', 'Muestra recibida', 'Propuesta a marca', 'Aprobada', 'Descartada'];
  var TECNICAS = ['Block print', 'Ikat', 'Rayas de telar', 'Liso', 'Floral estampado', 'Serigrafía', 'Jacquard', 'Bordado', 'Otra'];
  var TEMAS = ['Clientes', 'Proveedores', 'Telas', 'Pedidos', 'Empresa', 'Envíos', 'Ferias', 'Formación', 'Marca propia'];

  /* ---------- tablas ---------- */

  var S = { ID: '', FECHA: '', CON_QUIEN: '', AREA: '', DETALLE: '', ESTADO: '', TIPO: '', NOTAS: '' };
  var seguimiento = [
    [dia(-9), 'Casa Albero', 'Clientes', 'Mandar la propuesta de lino lavado', 'Pendiente', 'Tarea', 'Piden 3 colores y precio puesto en su taller de Valencia.'],
    [diaBarras(-4), 'Tejidos Varanasi Loom', 'Proveedores', 'Pedir la carta de colores del ikat', 'Esperando respuesta', 'Tarea', 'Escrito por WhatsApp; suelen tardar.'],
    [dia(-2), 'Lumbre Estudio', 'Clientes', 'Llamar para cerrar la reunión de muestras', 'En curso', 'Tarea', ''],
    [dia(-1), 'Gestoría', 'Empresa', 'Preguntar por el alta de autónoma', 'Pendiente', 'Tarea', 'DNI de la gestora para el poder: 12345678Z'],
    [dia(0), 'Nido Sur', 'Clientes', 'Videollamada: enseñar 6 block print', 'Pendiente', 'Reunión', 'Enlace en el calendario.'],
    [dia(0), 'Jaipur Hand Block Co.', 'Proveedores', 'Confirmar plazo de las muestras BP-004 y BP-007', 'Pendiente', 'Tarea', ''],
    [dia(2), 'Casa Albero', 'Clientes', 'Reunión en su taller (presencial)', 'Pendiente', 'Reunión', 'Llevar el muestrario de rayas.'],
    [dia(3), 'Transitario', 'Envíos', 'Pedir precio del envío de 30 m por avión', 'Pendiente', 'Tarea', ''],
    [dia(5), '', 'Telas', 'Fotografiar las 12 muestras nuevas', 'Pendiente', 'Tarea', 'Sin «con quién»: es cosa mía.'],
    [dia(6), 'Atelier Olmo', 'Clientes', 'Mandar cuestionario de necesidades', 'Pendiente', 'Tarea', ''],
    [dia(12), 'Feria Textil Hábitat', 'Ferias', 'Decidir si voy a la feria de enero', 'Pendiente', 'Tarea', ''],
    [dia(20), 'Kutch Weavers', 'Proveedores', 'Visitar el taller', 'Pendiente', 'Reunión', ''],
    [dia(35), 'Lumbre Estudio', 'Clientes', 'Revisión de la primera tirada', 'Pendiente', 'Reunión', ''],
    ['', 'Marca propia', 'Marca propia', 'Pensar el nombre comercial', 'Pendiente', 'Tarea', 'Sin fecha a propósito.'],
    [dia(-15), 'Casa Albero', 'Clientes', 'Primera reunión: qué fabrican y qué pagan hoy', 'Hecha', 'Reunión', 'Pagan hoy 14 €/m por un lino parecido.'],
    [dia(-12), 'Jaipur Hand Block Co.', 'Proveedores', 'Pedir muestras de block print', 'Hecha', 'Tarea', ''],
    [diaBarras(-20), 'Nido Sur', 'Clientes', 'Llamada de presentación', 'Hecha', 'Reunión', ''],
    [dia(-30), 'Telar Gris', 'Clientes', 'Propuesta de jacquard', 'Descartada', 'Tarea', 'No les cuadra el pedido mínimo.'],
    [dia(-6), 'Kutch Weavers', 'Proveedores', 'Pedir muestras de rayas de telar', 'Hecha', 'Tarea', '']
  ].map(function (r, i) { return { ID: 'T' + ('000' + (i + 1)).slice(-4), FECHA: r[0], CON_QUIEN: r[1], AREA: r[2], DETALLE: r[3], ESTADO: r[4], TIPO: r[5], NOTAS: r[6] }; });

  var C0 = { ID: '', CLIENTE: '', FASE: '', CONTACTO: '', EMAIL: '', TELEFONO: '', CIUDAD: '', PROXIMO_PASO: '', FECHA: '', VENTAS: '', VIA: '', WEB: '',
    INSTAGRAM: '', DIRECCION: '', CARGO: '', QUE_FABRICAN: '', MATERIAL: '', QUE_TELAS: '', ANCHO: '', PESO: '', MARTINDALE_MIN: '', PAGAN_HOY: '',
    PRECIO_OBJETIVO: '', CANTIDADES: '', IMPORTAN_EORI: '', ANTICIPO_50: '', NOTAS: '' };
  function cli(o) { var r = {}; Object.keys(C0).forEach(function (k) { r[k] = o[k] === undefined ? '' : o[k]; }); return r; }
  var clientes = [
    cli({ ID: 'M-001', CLIENTE: 'Casa Albero', FASE: '6 Propuesta enviada', CONTACTO: 'Lucía Ferrer', CARGO: 'Compras', EMAIL: 'lucia@casaalbero.example', TELEFONO: '+34 600 111 222',
      CIUDAD: 'Valencia', PROXIMO_PASO: 'Mandar la propuesta de lino lavado', FECHA: dia(-9), VENTAS: 0, VIA: 'Instagram', WEB: 'https://casaalbero.example', INSTAGRAM: '@casaalbero',
      DIRECCION: 'Polígono Sur, nave 4 (Valencia)', QUE_FABRICAN: 'Sofás y cabeceros', MATERIAL: 'Lino y algodón', QUE_TELAS: 'Lisos lavados y rayas', ANCHO: '140 o más',
      PESO: '400–500', MARTINDALE_MIN: '25.000', PAGAN_HOY: '14', PRECIO_OBJETIVO: '11', CANTIDADES: '300 m al trimestre', IMPORTAN_EORI: 'No', ANTICIPO_50: 'Sí', NOTAS: 'Quieren ver colores tierra.' }),
    cli({ ID: 'M-002', CLIENTE: 'Nido Sur', FASE: '3 Reunión hecha', CONTACTO: 'Pablo Ruiz', EMAIL: 'pablo@nidosur.example', TELEFONO: '+34 611 333 444', CIUDAD: 'Sevilla',
      PROXIMO_PASO: 'Videollamada: enseñar 6 block print', FECHA: dia(0), VENTAS: '', VIA: 'Email', QUE_FABRICAN: 'Cojines y ropa de cama', QUE_TELAS: 'Block print, florales', PAGAN_HOY: '9,50', PRECIO_OBJETIVO: 'Ideal 8, aceptan 9', ANTICIPO_50: 'No lo sé' }),
    cli({ ID: 'M-003', CLIENTE: 'Lumbre Estudio', FASE: '8 Primer pedido', CONTACTO: 'Irene Sanz', EMAIL: 'irene@lumbre.example', CIUDAD: 'Madrid', PROXIMO_PASO: 'Llamar para cerrar la reunión de muestras',
      FECHA: dia(-2), VENTAS: 1840.5, VIA: 'Feria', QUE_FABRICAN: 'Tapicería a medida', PAGAN_HOY: '18', PRECIO_OBJETIVO: '15', IMPORTAN_EORI: 'Sí', ANTICIPO_50: 'Sí',
      NOTAS: 'Pagan por transferencia a la cuenta ES91 2100 0418 4502 0005 1332' }),
    cli({ ID: 'M-004', CLIENTE: 'Atelier Olmo', FASE: '2 Interesado', CONTACTO: '', CIUDAD: 'Bilbao', PROXIMO_PASO: '', FECHA: '', VIA: 'Instagram', NOTAS: 'Aún sin persona de contacto.' }),
    cli({ ID: 'M-005', CLIENTE: 'Telar Gris', FASE: 'Descartado', CONTACTO: 'Marc Vidal', CIUDAD: 'Barcelona', NOTAS: 'Pedido mínimo demasiado alto para ellos.' })
  ];

  var P0 = { ID: '', NOMBRE: '', TIPO: '', ESTADO: '', PRIORIDAD: '', NOTA: '', VIA: '', CIUDAD: '', WEB: '', INSTAGRAM: '', CONTACTO: '', EMAIL: '', TELEFONO: '', QUE_FABRICAN: '' };
  var nombresPros = ['Hogar Brisa', 'Cardo & Lana', 'Estudio Marea', 'La Tapicera', 'Sofás Duna', 'Cojín Azul', 'Taller Ocre', 'Mimbre Norte', 'Casa Vela', 'Ropa de Casa Alba',
    'Interiorismo Pino', 'Butacas Roble', 'Estudio Arcilla', 'Hilo Fino', 'Deco Salitre', 'Telas y Cía', 'Sillería Monte', 'Almohada Clara'];
  var estadosPros = ['Por contactar', '1 Contactado', '2 Interesado', 'Por contactar', '1 Contactado', 'Descartado'];
  var prospeccion = nombresPros.map(function (n, i) {
    var r = {}; Object.keys(P0).forEach(function (k) { r[k] = ''; });
    r.ID = 'X-' + (i < 9 ? '00' : '0') + (i + 1); r.NOMBRE = n; r.TIPO = ['Tapicería', 'Decoración', 'Interiorismo'][i % 3];
    r.ESTADO = estadosPros[i % estadosPros.length]; r.PRIORIDAD = ['Alta', 'Media', 'Baja', ''][i % 4];
    r.NOTA = i % 5 === 0 ? 'Vista en una feria; hacen mucho lino.' : (i % 3 === 0 ? '' : 'Contactar por Instagram.');
    r.VIA = ['Instagram', 'Email', 'Feria'][i % 3]; r.CIUDAD = ['Madrid', 'Valencia', 'Barcelona', 'Málaga', 'Zaragoza'][i % 5];
    r.INSTAGRAM = '@' + n.toLowerCase().replace(/[^a-z]/g, ''); r.QUE_FABRICAN = ['Sofás', 'Cojines', 'Cortinas', 'Proyectos de hotel'][i % 4];
    return r;
  });

  var V0 = { ID: '', PROVEEDOR: '', ESTADO: '', PRIORIDAD: '', CONTACTO: '', EMAIL: '', TELEFONO: '', ZONA: '', PROXIMO_PASO: '', FECHA: '', N_TELAS: '', VIA: '', TIPO: '',
    REGION: '', DIRECCION: '', WEB: '', QUE_TIENEN: '', BASES: '', ANCHO: '', PESO: '', PEDIDO_MINIMO: '', PRECIO_30: '', PRECIO_100: '', MUESTRAS: '', PLAZO: '',
    ENVIA_ESPANA: '', OJO: '', CARPETA: '', NOTAS: '' };
  function prov(o) { var r = {}; Object.keys(V0).forEach(function (k) { r[k] = o[k] === undefined ? '' : o[k]; }); return r; }
  var proveedores = [
    prov({ ID: 'P-001', PROVEEDOR: 'Jaipur Hand Block Co.', ESTADO: 'Muestras pedidas', PRIORIDAD: 'Alta', CONTACTO: 'Ravi', TELEFONO: '+91 98 0000 0001', ZONA: 'Jaipur', TIPO: 'Taller / fabricante',
      REGION: 'Rajasthan', PROXIMO_PASO: 'Confirmar plazo de las muestras', FECHA: dia(-18), VIA: 'WhatsApp', QUE_TIENEN: 'Block print a mano', BASES: 'Algodón, lino', ANCHO: '110 / 140',
      PESO: '120–180', PEDIDO_MINIMO: '50', PRECIO_30: '420', PRECIO_100: '360', MUESTRAS: 'Gratis, pago el envío', PLAZO: '3–4 semanas', ENVIA_ESPANA: 'Sí', OJO: 'Los colores varían de un lote a otro.' }),
    prov({ ID: 'P-002', PROVEEDOR: 'Tejidos Varanasi Loom', ESTADO: 'Catálogo recibido', PRIORIDAD: 'Media', ZONA: 'Varanasi', TIPO: 'Fábrica exportadora', PROXIMO_PASO: 'Pedir la carta de colores del ikat',
      FECHA: diaBarras(-4), QUE_TIENEN: 'Ikat y jacquard', PEDIDO_MINIMO: '100', PRECIO_100: '610', ENVIA_ESPANA: 'No lo sé', NOTAS: 'Cuenta para pagar: IN12 3456 (pedir factura proforma)' }),
    prov({ ID: 'P-003', PROVEEDOR: 'Kutch Weavers', ESTADO: 'Visitar en persona', PRIORIDAD: 'Alta', ZONA: 'Bhuj', TIPO: 'Artesano', PROXIMO_PASO: 'Visitar el taller', FECHA: dia(20),
      QUE_TIENEN: 'Rayas de telar, lana y algodón', PEDIDO_MINIMO: '30', PRECIO_30: '380', ENVIA_ESPANA: 'Sí', NOTAS: 'Muy buen trato.' }),
    prov({ ID: 'P-004', PROVEEDOR: 'Mercado de Surat (varios)', ESTADO: 'Por contactar', PRIORIDAD: 'Baja', ZONA: 'Surat', TIPO: 'Mercado / zona' }),
    prov({ ID: 'P-005', PROVEEDOR: 'Coimbatore Mills', ESTADO: 'Descartado', PRIORIDAD: '', ZONA: 'Coimbatore', TIPO: 'Fábrica exportadora', OJO: 'Solo poliéster.' })
  ];

  var T0 = { CODIGO: '', TECNICA: '', COLOR: '', ALGODON: '', LINO: '', VISCOSA: '', POLIESTER: '', ACRILICO: '', YUTE: '', OTROS: '', BORDADO_HILO: '', ANCHO: '', GSM: '', GLM: '',
    MARTINDALE: '', RAPPORT_ANCHO: '', RAPPORT_LARGO: '', LAVABLE: '', LIMPIEZA_SECO: '', USO: '', OEKO_TEX: '', ID_PROVEEDOR: '', PROVEEDOR: '', REF_PROVEEDOR: '', COSTE_INR: '',
    COSTE_EUR: '', ENVIO_ARANCEL: '', COSTE_ESPANA: '', MARGEN: '', PRECIO_MARCA: '', MUESTRA_EN_MANO: '', ENLACE_FOTO: '', ENLACE_ETIQUETA: '', MARCAS_INTERESADAS: '', ESTADO: '', NOTAS: '', SIMULAR: '' };
  var NOM_PROV = {}; proveedores.forEach(function (p) { NOM_PROV[p.ID] = p.PROVEEDOR; });
  function tela(o) { var r = {}; Object.keys(T0).forEach(function (k) { r[k] = o[k] === undefined ? '' : o[k]; }); r.PROVEEDOR = NOM_PROV[r.ID_PROVEEDOR] || ''; return r; }
  var telas = [
    tela({ CODIGO: 'BP-001', TECNICA: 'Block print', COLOR: 'Índigo', ALGODON: 100, ANCHO: '140', GSM: '160', MARTINDALE: '20.000', USO: 'Cojines', ID_PROVEEDOR: 'P-001', REF_PROVEEDOR: 'JHB-221', COSTE_INR: 380, MARGEN: '50%', MUESTRA_EN_MANO: 'Sí', ENLACE_FOTO: muestra('flores', '#25406b', '#e9e2cf'), ESTADO: 'Propuesta a marca', MARCAS_INTERESADAS: 'Nido Sur' }),
    tela({ CODIGO: 'BP-004', TECNICA: 'Block print', COLOR: 'Terracota', ALGODON: 100, ANCHO: '110', GSM: '140', ID_PROVEEDOR: 'P-001', REF_PROVEEDOR: 'JHB-240', COSTE_INR: 420, ENLACE_FOTO: muestra('puntos', '#b65a3a', '#f3e6d6'), ESTADO: 'Muestra pedida' }),
    tela({ CODIGO: 'BP-007', TECNICA: 'Block print', COLOR: 'Verde salvia', ALGODON: 60, LINO: 40, ANCHO: '140', GSM: '180', ID_PROVEEDOR: 'P-001', COSTE_INR: 450, ENVIO_ARANCEL: 6.5, MARGEN: 0.4, ENLACE_FOTO: muestra('flores', '#8aa58c', '#f5f1e8'), ESTADO: 'Muestra pedida' }),
    tela({ CODIGO: 'IK-002', TECNICA: 'Ikat', COLOR: 'Mostaza y crudo', ALGODON: 100, ANCHO: '140', GSM: '220', MARTINDALE: '30.000', ID_PROVEEDOR: 'P-002', REF_PROVEEDOR: 'VL-IK9', COSTE_EUR: 7.2, ENLACE_FOTO: muestra('cuadros', '#d4a73a', '#f6efe0'), ESTADO: 'Candidata' }),
    tela({ CODIGO: 'RY-003', TECNICA: 'Rayas de telar', COLOR: 'Crudo y negro', ALGODON: 100, ANCHO: '150', GSM: '400–500', MARTINDALE: '40.000', USO: 'Tapicería', ID_PROVEEDOR: 'P-003', COSTE_INR: 380, ENLACE_FOTO: muestra('rayas', '#efe8da', '#2b2b2b'), ESTADO: 'Aprobada', MARCAS_INTERESADAS: 'Casa Albero, Lumbre Estudio' }),
    tela({ CODIGO: 'RY-008', TECNICA: 'Rayas de telar', COLOR: 'Azul y blanco', ALGODON: 100, ANCHO: '150', GSM: '420', ID_PROVEEDOR: 'P-003', COSTE_INR: 395, ENLACE_FOTO: '', ESTADO: 'Candidata', NOTAS: 'Falta la foto.' }),
    tela({ CODIGO: 'LI-010', TECNICA: 'Liso', COLOR: 'Lino natural', LINO: 100, ANCHO: '280', GSM: '320', USO: 'Tapicería, cortinas', ID_PROVEEDOR: 'P-002', COSTE_INR: '', COSTE_EUR: '', ENLACE_FOTO: muestra('liso', '#d8ccb4', '#8f8166'), ESTADO: 'Candidata', NOTAS: 'Sin precio todavía: el proveedor no ha contestado.' }),
    tela({ CODIGO: 'FL-011', TECNICA: 'Floral estampado', COLOR: 'Rosa empolvado', ALGODON: 70, VISCOSA: 30, ANCHO: '140', GSM: '150', ID_PROVEEDOR: 'P-001', COSTE_INR: 400, ENLACE_FOTO: muestra('flores', '#e4b9b0', '#8c4a52'), ESTADO: 'Descartada', NOTAS: 'A ninguna marca le ha gustado.' }),
    tela({ CODIGO: 'JQ-012', TECNICA: 'Jacquard', COLOR: 'Gris perla', ALGODON: 55, POLIESTER: 45, ANCHO: '140', GSM: '380', MARTINDALE: '50.000', ID_PROVEEDOR: 'P-002', COSTE_INR: 690, ENVIO_ARANCEL: '', MARGEN: '', ENLACE_FOTO: muestra('cuadros', '#c9c9c4', '#8d8d88'), ESTADO: 'Muestra recibida' })
  ];

  var TABLAS = {
    SEGUIMIENTO: { clave: 'ID', columnas: cols(S), filas: seguimiento },
    CLIENTES: { clave: 'ID', columnas: cols(C0), filas: clientes },
    PROSPECCION: { clave: 'ID', columnas: cols(P0), filas: prospeccion },
    PROVEEDORES: { clave: 'ID', columnas: cols(V0), filas: proveedores },
    TELAS: { clave: 'CODIGO', columnas: cols(T0), filas: telas },
    AJUSTES: { clave: 'FILA', columnas: ['FILA', 'RUPIAS_POR_EURO', 'MARGEN', 'ENVIO_ARANCEL'], filas: [{ FILA: 1, RUPIAS_POR_EURO: 110, MARGEN: '50%', ENVIO_ARANCEL: 5 }] },
    PREFERENCIAS: { clave: 'ID', columnas: ['ID', 'VALOR'], filas: [] }
  };

  /* ---------- configuración de la sección (nucleo.secciones.listado.config) ---------- */

  var NO_HECHAS = { campo: 'ESTADO', no: ['Hecha', 'Descartada'] };
  var COLORES_TAREA = { 'Pendiente': 'medio', 'En curso': 'info', 'Esperando respuesta': 'info', 'Hecha': 'bien', 'Descartada': 'apagado' };
  var COLORES_FASE = { '8 Primer pedido': 'bien', '9 Cliente habitual': 'bien', 'En pausa': 'apagado', 'Descartado': 'apagado' };
  var COLORES_PROV = { 'Aprobado': 'bien', 'Muestras pedidas': 'medio', 'En pausa': 'apagado', 'Descartado': 'apagado' };
  var COLORES_TELA = { 'Aprobada': 'bien', 'Propuesta a marca': 'info', 'Muestra pedida': 'medio', 'Descartada': 'apagado' };
  var CONTACTO = { CONTACTO: { titulo: 'Persona de contacto' }, EMAIL: { tipo: 'email' }, TELEFONO: { titulo: 'Teléfono / WhatsApp', tipo: 'telefono' }, WEB: { tipo: 'enlace' } };
  function mezcla() { var r = {}; [].forEach.call(arguments, function (o) { Object.keys(o).forEach(function (k) { r[k] = o[k]; }); }); return r; }
  var PRECIO = ['redondear', ['*',
    ['+', ['o', 'COSTE_EUR', ['/', 'COSTE_INR', '$RUPIAS']], ['o', 'ENVIO_ARANCEL', '$ENVIO']],
    ['+', 1, ['o', 'MARGEN', '$MARGEN']]], 2];

  var CONFIG = { // (más abajo, NUCLEO: una sección del menú por apartado)
    AYUDA: '',
    VALORES: {
      RUPIAS: { tabla: 'AJUSTES', fila: 1, columna: 'RUPIAS_POR_EURO' },
      MARGEN: { tabla: 'AJUSTES', fila: 1, columna: 'MARGEN' },
      ENVIO: { tabla: 'AJUSTES', fila: 1, columna: 'ENVIO_ARANCEL' }
    },
    PERSONALIZAN: ['Dueña'],
    PREFERENCIAS: 'PREFERENCIAS',
    APARTADOS: [
      { id: 'SEGUIMIENTO', titulo: 'Seguimiento', tabla: 'SEGUIMIENTO', clave: 'ID', codigo: 'ID', nombre: 'DETALLE',
        texto: 'Tareas y reuniones en una sola lista.',
        columnas: ['FECHA', 'TIPO', 'CON_QUIEN', 'DETALLE', 'ESTADO'], detalle: ['CON_QUIEN', 'FECHA', 'ESTADO'], orden: 'FECHA',
        campos: { FECHA: { tipo: 'fecha' }, TIPO: { opciones: ['Tarea', 'Reunión'] }, AREA: { opciones: TEMAS }, CON_QUIEN: { titulo: 'Con quién' },
          DETALLE: { titulo: 'Qué hay que hacer / qué pasó' }, ESTADO: { tipo: 'estado', opciones: ESTADO_TAREA, colores: COLORES_TAREA }, NOTAS: { titulo: 'Notas / enlace', tipo: 'nota' } },
        ficha: [{ titulo: '', campos: ['FECHA', 'TIPO', 'CON_QUIEN', 'AREA', 'ESTADO', 'DETALLE', 'NOTAS'] }],
        vistas: [
          { id: 'HOY', titulo: 'Hoy', filtro: [NO_HECHAS], agrupar: { campo: 'FECHA', por: 'plazo' }, orden: 'FECHA' },
          { id: 'TABLERO', titulo: 'Tablero', filtro: [{ campo: 'ESTADO', no: ['Descartada'] }], tablero: { campo: 'ESTADO', columnas: ['Pendiente', 'En curso', 'Esperando respuesta', 'Hecha'] }, orden: 'FECHA' },
          { id: 'REUNIONES', titulo: 'Reuniones', filtro: [{ campo: 'TIPO', es: 'Reunión' }], orden: '-FECHA' },
          { id: 'HECHO', titulo: 'Hecho', filtro: [{ campo: 'ESTADO', es: ['Hecha', 'Descartada'] }], orden: '-FECHA' },
          { id: 'TODO', titulo: 'Todo', orden: '-FECHA', agrupar: 'AREA' }
        ],
        avisos: [
          { id: 'PASADA', titulo: 'Con la fecha pasada', nivel: 'alto', si: [NO_HECHAS, { campo: 'FECHA', hasta: -1 }] },
          { id: 'PRONTO', titulo: 'Vence pronto', texto: 'Lo que no está hecho y vence en los próximos días.', nivel: 'medio', dias: 3, si: [NO_HECHAS, { campo: 'FECHA', desde: 0, hasta: 'dias' }] },
          { id: 'ESPERANDO', titulo: 'Esperando respuesta hace días', texto: 'Para insistir.', nivel: 'medio', dias: 3, si: [{ campo: 'ESTADO', es: 'Esperando respuesta' }, { campo: 'FECHA', hasta: '-dias' }] }
        ],
        editar: ['FECHA', 'TIPO', 'CON_QUIEN', 'AREA', 'ESTADO', 'DETALLE', 'NOTAS'], crear: true },

      { id: 'CLIENTES', titulo: 'Clientes', tabla: 'CLIENTES', codigo: 'ID', nombre: 'CLIENTE',
        columnas: ['CLIENTE', 'FASE', 'CONTACTO', 'CIUDAD', 'PROXIMO_PASO', 'FECHA', 'VENTAS'], detalle: ['FASE', 'PROXIMO_PASO'], orden: '-FASE',
        campos: mezcla(CONTACTO, { FASE: { tipo: 'estado', opciones: FASES, colores: COLORES_FASE }, FECHA: { tipo: 'fecha', titulo: 'Fecha del próximo paso' },
          VENTAS: { tipo: 'importe', titulo: 'Ventas' }, DIRECCION: { titulo: 'Dirección (envíos)' }, QUE_FABRICAN: { titulo: 'Qué fabrican' }, MATERIAL: { titulo: 'Material que buscan' },
          QUE_TELAS: { titulo: 'Qué telas necesitan' }, PESO: { titulo: 'Peso (g/m²)' }, MARTINDALE_MIN: { titulo: 'Martindale mín.' }, PAGAN_HOY: { titulo: 'Pagan hoy (€/m)' },
          PRECIO_OBJETIVO: { titulo: 'Precio objetivo (€/m)' }, CANTIDADES: { titulo: 'Cantidades y reposición' }, IMPORTAN_EORI: { titulo: '¿Importan ellos? (EORI)' },
          ANTICIPO_50: { titulo: '¿Aceptan anticipo del 50 %?' }, NOTAS: { tipo: 'nota' } }),
        ficha: [
          { titulo: 'En qué punto está', campos: ['FASE', 'PROXIMO_PASO', 'FECHA', 'VENTAS'] },
          { titulo: 'Contacto', campos: ['CONTACTO', 'CARGO', 'EMAIL', 'TELEFONO', 'CIUDAD', 'DIRECCION', 'WEB', 'INSTAGRAM', 'VIA'] },
          { titulo: 'Qué buscan', campos: ['QUE_FABRICAN', 'MATERIAL', 'QUE_TELAS', 'ANCHO', 'PESO', 'MARTINDALE_MIN', 'PAGAN_HOY', 'PRECIO_OBJETIVO', 'CANTIDADES'] },
          { titulo: 'Condiciones', campos: ['IMPORTAN_EORI', 'ANTICIPO_50'] },
          { titulo: 'Notas', campos: ['NOTAS'] }
        ],
        relacionados: [{ titulo: 'Su seguimiento', apartado: 'SEGUIMIENTO', campo: 'CON_QUIEN', con: 'CLIENTE', orden: '-FECHA', columnas: ['FECHA', 'DETALLE', 'ESTADO'] }],
        vistas: [
          { id: 'EN_MARCHA', titulo: 'En marcha', filtro: [{ campo: 'FASE', no: ['En pausa', 'Descartado'] }] },
          { id: 'EMBUDO', titulo: 'Embudo', tablero: { campo: 'FASE', columnas: FASES.slice(0, 9) } },
          { id: 'TODOS', titulo: 'Todos', agrupar: 'FASE' }
        ],
        avisos: [
          { id: 'PASO_PASADO', titulo: 'Próximo paso con la fecha pasada', nivel: 'alto', si: [{ campo: 'FASE', no: ['En pausa', 'Descartado'] }, { campo: 'FECHA', hasta: -1 }] },
          { id: 'SIN_PASO', titulo: 'Sin próximo paso', nivel: 'medio', si: [{ campo: 'FASE', no: ['En pausa', 'Descartado'] }, { campo: 'PROXIMO_PASO', vacio: true }] }
        ] },

      { id: 'PROSPECCION', titulo: 'Prospección', tabla: 'PROSPECCION', codigo: 'ID', nombre: 'NOMBRE',
        columnas: ['NOMBRE', 'TIPO', 'ESTADO', 'PRIORIDAD', 'CIUDAD', 'NOTA'], detalle: ['ESTADO', 'PRIORIDAD', 'CIUDAD'], orden: 'NOMBRE',
        campos: mezcla(CONTACTO, { NOMBRE: { titulo: 'Marca' }, ESTADO: { tipo: 'estado', opciones: ['Por contactar'].concat(FASES), colores: { 'Por contactar': 'medio', 'Descartado': 'apagado' } },
          PRIORIDAD: { opciones: ['Alta', 'Media', 'Baja'], colores: { 'Alta': 'alto' } }, NOTA: { titulo: 'Nota (una línea)' }, QUE_FABRICAN: { titulo: 'Qué fabrican / venden' } }),
        ficha: [
          { titulo: 'La marca', campos: ['TIPO', 'ESTADO', 'PRIORIDAD', 'NOTA', 'QUE_FABRICAN'] },
          { titulo: 'Contacto', campos: ['CONTACTO', 'EMAIL', 'TELEFONO', 'CIUDAD', 'WEB', 'INSTAGRAM', 'VIA'] }
        ],
        relacionados: [{ titulo: 'Su seguimiento', apartado: 'SEGUIMIENTO', campo: 'CON_QUIEN', con: 'NOMBRE', orden: '-FECHA', columnas: ['FECHA', 'DETALLE', 'ESTADO'] }],
        vistas: [
          { id: 'ALTA', titulo: 'Prioridad alta', filtro: [{ campo: 'PRIORIDAD', es: 'Alta' }, { campo: 'ESTADO', no: ['Descartado'] }] },
          { id: 'POR_CONTACTAR', titulo: 'Por contactar', filtro: [{ campo: 'ESTADO', es: 'Por contactar' }] },
          { id: 'TODAS', titulo: 'Todas', agrupar: 'ESTADO' }
        ],
        avisos: [{ id: 'ALTA_SIN_CONTACTAR', titulo: 'Prioridad alta sin contactar', nivel: 'medio', si: [{ campo: 'PRIORIDAD', es: 'Alta' }, { campo: 'ESTADO', es: 'Por contactar' }] }] },

      { id: 'PROVEEDORES', titulo: 'Proveedores', tabla: 'PROVEEDORES', codigo: 'ID', nombre: 'PROVEEDOR',
        columnas: ['PROVEEDOR', 'ESTADO', 'PRIORIDAD', 'ZONA', 'TIPO', 'PROXIMO_PASO', 'FECHA'], detalle: ['ESTADO', 'ZONA', 'PROXIMO_PASO'], orden: 'PROVEEDOR',
        campos: mezcla(CONTACTO, { PROVEEDOR: { privado: true }, ESTADO: { tipo: 'estado', opciones: ESTADO_PROV, colores: COLORES_PROV }, PRIORIDAD: { opciones: ['Alta', 'Media', 'Baja'], colores: { 'Alta': 'alto' } },
          ZONA: { titulo: 'Ciudad / zona' }, FECHA: { tipo: 'fecha', titulo: 'Fecha del próximo paso' }, REGION: { titulo: 'Estado (India)' }, QUE_TIENEN: { titulo: 'Qué tienen' },
          BASES: { titulo: 'Bases (algodón, lino…)' }, ANCHO: { titulo: 'Ancho (cm)' }, PESO: { titulo: 'Peso (GSM)' }, PEDIDO_MINIMO: { titulo: 'Pedido mínimo', unidad: 'm' },
          PRECIO_30: { titulo: 'Coste a 30 m (sin envío)', unidad: '₹/m', privado: true }, PRECIO_100: { titulo: 'Coste a 100 m (sin envío)', unidad: '₹/m', privado: true },
          PLAZO: { titulo: 'Plazo de producción' }, ENVIA_ESPANA: { titulo: '¿Envía a España?' }, OJO: { titulo: 'Pega / ojo' }, CARPETA: { titulo: 'Carpeta en Drive', tipo: 'enlace' }, NOTAS: { tipo: 'nota' } }),
        ficha: [
          { titulo: 'En qué punto está', campos: ['ESTADO', 'PRIORIDAD', 'PROXIMO_PASO', 'FECHA'] },
          { titulo: 'Qué tienen', campos: ['QUE_TIENEN', 'BASES', 'ANCHO', 'PESO', 'PEDIDO_MINIMO', 'PRECIO_30', 'PRECIO_100', 'MUESTRAS', 'PLAZO', 'ENVIA_ESPANA', 'OJO'] },
          { titulo: 'Contacto', campos: ['CONTACTO', 'EMAIL', 'TELEFONO', 'ZONA', 'REGION', 'TIPO', 'VIA', 'WEB', 'CARPETA'] },
          { titulo: 'Notas', campos: ['NOTAS'] }
        ],
        relacionados: [
          { titulo: 'Sus telas en mi catálogo', apartado: 'TELAS', campo: 'ID_PROVEEDOR', con: 'ID', columnas: ['ENLACE_FOTO', 'CODIGO', 'COLOR', 'ESTADO'] },
          { titulo: 'Su seguimiento', apartado: 'SEGUIMIENTO', campo: 'CON_QUIEN', con: 'PROVEEDOR', orden: '-FECHA', columnas: ['FECHA', 'DETALLE', 'ESTADO'] }
        ],
        vistas: [
          { id: 'ACTIVOS', titulo: 'Activos', filtro: [{ campo: 'ESTADO', no: ['En pausa', 'Descartado'] }], orden: 'PRIORIDAD' },
          { id: 'TABLERO', titulo: 'Tablero', tablero: { campo: 'ESTADO' } },
          { id: 'TODOS', titulo: 'Todos', agrupar: 'ESTADO' }
        ],
        avisos: [
          { id: 'MUESTRAS', titulo: 'Muestras pedidas hace tiempo', texto: 'Para reclamarlas.', nivel: 'medio', dias: 14, si: [{ campo: 'ESTADO', es: 'Muestras pedidas' }, { campo: 'FECHA', hasta: '-dias' }] },
          { id: 'PASO_PASADO', titulo: 'Próximo paso con la fecha pasada', nivel: 'alto', si: [{ campo: 'ESTADO', no: ['En pausa', 'Descartado', 'Muestras pedidas'] }, { campo: 'FECHA', hasta: -1 }] }
        ] },

      { id: 'TELAS', titulo: 'Mis telas', tabla: 'TELAS', clave: 'CODIGO', codigo: 'CODIGO', nombre: 'COLOR',
        columnas: ['ENLACE_FOTO', 'CODIGO', 'TECNICA', 'COLOR', 'ANCHO', 'GSM', 'PROVEEDOR', 'PRECIO_TALLER', 'ESTADO'], detalle: ['TECNICA', 'COLOR', 'PRECIO_TALLER'], orden: 'CODIGO',
        campos: {
          CODIGO: { titulo: 'Código' }, ENLACE_FOTO: { titulo: 'Foto', tipo: 'foto' }, ANCHO: { titulo: 'Ancho', unidad: 'cm' }, GSM: { titulo: 'Peso', unidad: 'g/m²' },
          ALGODON: { tipo: 'numero', unidad: '%' }, LINO: { tipo: 'numero', unidad: '%' }, VISCOSA: { tipo: 'numero', unidad: '%' }, POLIESTER: { titulo: 'Poliéster', tipo: 'numero', unidad: '%' },
          ESTADO: { tipo: 'estado', opciones: ESTADO_TELA, colores: COLORES_TELA }, USO: { titulo: 'Uso' }, MARTINDALE: { titulo: 'Martindale' },
          PROVEEDOR: { privado: true }, ID_PROVEEDOR: { titulo: 'Proveedor (ID)', privado: true }, REF_PROVEEDOR: { titulo: 'Ref. del proveedor', privado: true },
          COSTE_INR: { titulo: 'Coste del proveedor (sin envío)', tipo: 'numero', unidad: '₹/m', privado: true },
          COSTE_EUR: { titulo: 'Coste del proveedor (sin envío)', tipo: 'importe', unidad: '€/m', privado: true },
          ENVIO_ARANCEL: { titulo: 'Envío + arancel', tipo: 'importe', unidad: '€/m', privado: true, ayuda: 'Vacío: el estimado de Ajustes.' },
          MARGEN: { titulo: 'Margen', tipo: 'porcentaje', privado: true, ayuda: 'Vacío: el margen por defecto.' },
          PRECIO_TALLER: { titulo: 'Precio puesto en taller', tipo: 'importe', unidad: '€/m', calculo: PRECIO, precio: { envio: ['ENVIO_ARANCEL', '$ENVIO'] },
            ayuda: 'Coste del proveedor + envío y arancel + margen. Nunca sale sin el envío.' },
          MARCAS_INTERESADAS: { titulo: 'Marcas interesadas' }, MUESTRA_EN_MANO: { titulo: 'Muestra en mano' }, NOTAS: { tipo: 'nota' }
        },
        ficha: [
          { titulo: '', campos: ['ENLACE_FOTO', 'ESTADO', 'PRECIO_TALLER'] },
          { titulo: 'La tela', campos: ['TECNICA', 'COLOR', 'ALGODON', 'LINO', 'VISCOSA', 'POLIESTER', 'ANCHO', 'GSM', 'MARTINDALE', 'USO'] },
          { titulo: 'Proveedor y coste', campos: ['PROVEEDOR', 'REF_PROVEEDOR', 'COSTE_INR', 'COSTE_EUR', 'ENVIO_ARANCEL', 'MARGEN'] },
          { titulo: 'Con las marcas', campos: ['MARCAS_INTERESADAS', 'MUESTRA_EN_MANO', 'NOTAS'] }
        ],
        vistas: [
          { id: 'CATALOGO', titulo: 'Mi catálogo', filtro: [{ campo: 'ESTADO', no: ['Descartada'] }] },
          { id: 'ENSENAR', titulo: 'Para enseñar', cliente: true, filtro: [{ campo: 'ESTADO', no: ['Descartada'] }],
            columnas: ['ENLACE_FOTO', 'CODIGO', 'TECNICA', 'COLOR', 'ANCHO', 'GSM', 'MARTINDALE', 'PRECIO_TALLER'] },
          { id: 'MUESTRAS', titulo: 'Muestras', filtro: [{ campo: 'ESTADO', es: ['Muestra pedida', 'Muestra recibida'] }] },
          { id: 'TODAS', titulo: 'Todas', agrupar: 'TECNICA' }
        ],
        avisos: [
          { id: 'SIN_COSTE', titulo: 'Sin coste: no hay precio', nivel: 'alto', si: [{ campo: 'COSTE_INR', vacio: true }, { campo: 'COSTE_EUR', vacio: true }, { campo: 'ESTADO', no: ['Descartada'] }] },
          { id: 'SIN_FOTO', titulo: 'Sin foto', nivel: 'info', si: [{ campo: 'ENLACE_FOTO', vacio: true }, { campo: 'ESTADO', no: ['Descartada'] }] }
        ] }
    ]
  };

  /* ---------- las secciones del menú (config.json · nucleo), cada una la sección Listado con lo suyo ---------- */
  // Arriba, cada apartado con sus claves en minúsculas, más corto de leer; aquí se pasa a la configuración de cada sección.
  var ICONOS = {
    SEGUIMIENTO: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l2 2 4-4M8 15h8"/>',
    CLIENTES: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.9 2.6 2.6 3 5.2"/>',
    PROSPECCION: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    PROVEEDORES: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    TELAS: '<path d="M4 5h12a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h12"/><path d="M4 5v14"/>'
  };
  var POR_ID = {}; CONFIG.APARTADOS.forEach(function (a) { POR_ID[a.id] = a; });
  function seccionDe(a) {
    var c = { TABLA: a.tabla, CLAVE: a.clave || 'ID', CODIGO: a.codigo || '', NOMBRE: a.nombre, COLUMNAS: a.columnas || [], DETALLE: a.detalle || [], ORDEN: a.orden || '',
      CAMPOS: a.campos || {}, FICHA: a.ficha || [], VISTAS: a.vistas || [], AVISOS: a.avisos || [], EDITAR: a.editar || [], CREAR: !!a.crear, TEXTO: a.texto || '',
      VALORES: CONFIG.VALORES, PERSONALIZAN: CONFIG.PERSONALIZAN, PREFERENCIAS: CONFIG.PREFERENCIAS };
    // Lo relacionado apunta a otro apartado: su tabla, su sección y cómo se ven sus filas (su código y sus campos).
    c.RELACIONADOS = (a.relacionados || []).map(function (r) {
      var o = POR_ID[r.apartado];
      return { titulo: r.titulo, tabla: o.tabla, seccion: o.id.toLowerCase(), campo: r.campo, con: r.con, orden: r.orden || '', columnas: r.columnas,
        clave: o.clave || 'ID', codigo: o.codigo || '', nombre: o.nombre, campos: o.campos || {} };
    });
    return { modulo: 'listado', titulo: a.titulo, icono: ICONOS[a.id], perfiles: /PROVEEDORES|TELAS/.test(a.id) ? ['Dueña'] : 'todos', config: c };
  }
  var NUCLEO = { perfiles: ['Dueña', 'Ayudante'], secciones: {} };
  CONFIG.APARTADOS.forEach(function (a) { NUCLEO.secciones[a.id.toLowerCase()] = seccionDe(a); });

  var E = { nucleo: NUCLEO, tablas: TABLAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  if (typeof window !== 'undefined') window.LISTADO_EJEMPLO = E;
})();
