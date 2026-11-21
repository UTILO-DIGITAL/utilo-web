/*
 * web/dev/listado/ejemplo-telas.js · T0599 · Datos de ejemplo de la sección Listado con el modelo del Excel TELAS · GESTION
 * de Marta (T0598: normalizado, cada dato en una tabla y las demás lo señalan por su ID) y la configuración de sus
 * secciones del menú: Seguimiento, Clientes, Proveedores y Mis telas, cada una la sección Listado con lo suyo.
 *
 * Las tablas y columnas son las de clientes/telas/tablas/GESTION/ (T0598), solo las que usan estas secciones. Todo es
 * inventado: ni las marcas, ni los proveedores, ni las personas son de verdad. Las fechas se cuentan desde hoy (siempre hay
 * algo con la fecha pasada, de esta semana y más adelante). Lleva a propósito los casos raros: fechas «17/11/2026» y
 * «2026-11-17», huecos, «400–500», un diseño sin coste, una tela sin foto, un DNI y un IBAN pegados en unas notas (la sección
 * no los enseña), una tarea sin «con quién» y otra sin fecha, y una tabla de preferencias vacía.
 * NUCLEO.secciones es lo que iría en config.json · nucleo (con «modulo»: «listado»); _refs, lo que pone montar.js desde los
 * YAML. Lo usan web/dev/listado/ (npm run local → /dev/listado/) y herramientas/probar-listado.js.
 */
(function () {
  'use strict';

  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function dia(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function diaBarras(n) { var d = new Date(); d.setDate(d.getDate() + n); return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear(); }
  /** Una muestra de tela dibujada (rayas, cuadros, puntos, flores o liso), para que haya fotos sin pedir nada fuera. */
  function muestra(tipo, a, b) {
    var p = { rayas: '<rect width="40" height="40" fill="' + a + '"/><rect width="40" height="8" y="6" fill="' + b + '"/><rect width="40" height="4" y="26" fill="' + b + '"/>',
      cuadros: '<rect width="40" height="40" fill="' + a + '"/><rect width="20" height="20" fill="' + b + '" opacity=".7"/><rect x="20" y="20" width="20" height="20" fill="' + b + '" opacity=".7"/>',
      puntos: '<rect width="40" height="40" fill="' + a + '"/><circle cx="10" cy="10" r="5" fill="' + b + '"/><circle cx="30" cy="30" r="5" fill="' + b + '"/>',
      flores: '<rect width="40" height="40" fill="' + a + '"/><circle cx="20" cy="20" r="9" fill="' + b + '"/><circle cx="20" cy="20" r="3" fill="' + a + '"/><circle cx="4" cy="4" r="4" fill="' + b + '"/><circle cx="36" cy="36" r="4" fill="' + b + '"/>',
      liso: '<rect width="40" height="40" fill="' + a + '"/><path d="M0 40L40 0" stroke="' + b + '" stroke-width=".6" opacity=".5"/>' }[tipo];
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' + p + '</svg>');
  }
  /** Una tabla: { clave, columnas, filas }; cada fila con todas sus columnas (las que no dice, vacías). */
  function tabla(columnas, filas, clave) {
    return { clave: clave || 'ID', columnas: columnas, filas: filas.map(function (f) { var r = {}; columnas.forEach(function (c) { r[c] = f[c] === undefined ? '' : f[c]; }); return r; }) };
  }
  /** Una dimensión (las opciones de un desplegable): ID, NOMBRE y ORDEN. */
  function dimension(pre, nombres) { return tabla(['ID', 'NOMBRE', 'ORDEN'], nombres.map(function (n, i) { return { ID: pre + dos(i + 1), NOMBRE: n, ORDEN: i + 1 }; })); }
  function idDe(dim, nombre) { var f = dim.filas.filter(function (x) { return x.NOMBRE === nombre; })[0]; if (!f) throw new Error('No hay «' + nombre + '»'); return f.ID; }

  /* ---------- dimensiones ---------- */
  var FASES = dimension('FA', ['Por contactar', '1 Contactado', '2 Interesado', '3 Reunión hecha', '4 Cuestionario enviado', '5 Cuestionario recibido', '6 Propuesta enviada',
    '7 Muestras enviadas', '8 Primer pedido', '9 Cliente habitual', 'En pausa', 'Descartado']);
  var ESTADOS_TAREA = dimension('ET', ['Pendiente', 'En curso', 'Esperando respuesta', 'Hecha', 'Descartada']);
  var TIPOS_SEGUIMIENTO = dimension('TS', ['Tarea', 'Reunión', 'Nota']);
  var TEMAS = dimension('TE', ['Clientes', 'Proveedores', 'Telas', 'Pedidos', 'Empresa', 'Envíos', 'Ferias', 'Formación', 'Marca propia']);
  var FORMATOS = dimension('FO', ['Videollamada', 'Llamada', 'Presencial', 'WhatsApp', 'Email', 'Visita a taller', 'Feria']);
  var PRIORIDADES = dimension('PR', ['Alta', 'Media', 'Baja']);
  var TIPOS_MARCA = dimension('TM', ['Tapicería', 'Decoración', 'Interiorismo']);
  var VIAS = dimension('VI', ['Instagram', 'Email', 'Feria', 'WhatsApp', 'Recomendación']);
  var ESTADOS_PROVEEDOR = dimension('EP', ['Por contactar', 'Contactado', 'Catálogo recibido', 'Muestras pedidas', 'Muestras recibidas', 'Aprobado', 'Visitar en persona', 'En pausa', 'Descartado']);
  var TIPOS_PROVEEDOR = dimension('TP', ['Plataforma online', 'Taller / fabricante', 'Artesano', 'Tienda mayorista', 'Fábrica exportadora', 'Mercado / zona']);
  var REGIONES = dimension('RE', ['Rajasthan', 'Gujarat', 'Uttar Pradesh', 'Tamil Nadu']);
  var ESTADOS_TELA = dimension('ES', ['Candidata', 'Muestra pedida', 'Muestra recibida', 'Propuesta a marca', 'Aprobada', 'Descartada']);
  var TECNICAS = dimension('TC', ['Block print', 'Ikat', 'Rayas de telar', 'Liso', 'Floral estampado', 'Serigrafía', 'Jacquard', 'Bordado', 'Otra']);
  var SI_NO = dimension('SN', ['Sí', 'No', 'No lo sé']);
  var f = function (n) { return idDe(FASES, n); }, et = function (n) { return idDe(ESTADOS_TAREA, n); }, ep = function (n) { return idDe(ESTADOS_PROVEEDOR, n); };
  var es = function (n) { return idDe(ESTADOS_TELA, n); }, tc = function (n) { return idDe(TECNICAS, n); }, te = function (n) { return idDe(TEMAS, n); };

  /* ---------- marcas (clientes y prospección juntos: ser cliente es la fase), proveedores y otros ---------- */
  var MARCAS = tabla(['ID', 'NOMBRE', 'ID_FASE', 'ID_TIPO_MARCA', 'ID_PRIORIDAD', 'ID_VIA', 'CIUDAD', 'DIRECCION', 'WEB', 'INSTAGRAM', 'QUE_FABRICAN', 'NOTA', 'NOTAS'], [
    { ID: 'M-001', NOMBRE: 'Casa Albero', ID_FASE: f('6 Propuesta enviada'), ID_TIPO_MARCA: 'TM01', ID_PRIORIDAD: 'PR01', ID_VIA: 'VI01', CIUDAD: 'Valencia', DIRECCION: 'Polígono Sur, nave 4 (Valencia)',
      WEB: 'https://casaalbero.example', INSTAGRAM: '@casaalbero', QUE_FABRICAN: 'Sofás y cabeceros', NOTA: 'Quieren ver colores tierra.', NOTAS: 'Les gusta el lino lavado.' },
    { ID: 'M-002', NOMBRE: 'Nido Sur', ID_FASE: f('3 Reunión hecha'), ID_TIPO_MARCA: 'TM02', ID_PRIORIDAD: 'PR01', ID_VIA: 'VI02', CIUDAD: 'Sevilla', QUE_FABRICAN: 'Cojines y ropa de cama' },
    { ID: 'M-003', NOMBRE: 'Lumbre Estudio', ID_FASE: f('8 Primer pedido'), ID_TIPO_MARCA: 'TM01', ID_PRIORIDAD: 'PR01', ID_VIA: 'VI03', CIUDAD: 'Madrid', QUE_FABRICAN: 'Tapicería a medida',
      NOTAS: 'Pagan por transferencia a la cuenta ES91 2100 0418 4502 0005 1332' },
    { ID: 'M-004', NOMBRE: 'Atelier Olmo', ID_FASE: f('2 Interesado'), ID_TIPO_MARCA: 'TM03', ID_PRIORIDAD: 'PR02', ID_VIA: 'VI01', CIUDAD: 'Bilbao', NOTAS: 'Aún sin persona de contacto.' },
    { ID: 'M-005', NOMBRE: 'Telar Gris', ID_FASE: f('Descartado'), ID_TIPO_MARCA: 'TM01', CIUDAD: 'Barcelona', NOTA: 'Pedido mínimo demasiado alto para ellos.' }
  ].concat(['Hogar Brisa', 'Cardo & Lana', 'Estudio Marea', 'La Tapicera', 'Sofás Duna', 'Cojín Azul', 'Taller Ocre', 'Mimbre Norte', 'Casa Vela', 'Interiorismo Pino', 'Butacas Roble', 'Deco Salitre']
    .map(function (n, i) {
      return { ID: 'X-' + ('00' + (i + 1)).slice(-3), NOMBRE: n, ID_FASE: f(['Por contactar', '1 Contactado', 'Por contactar', '2 Interesado', 'Descartado', 'Por contactar'][i % 6]),
        ID_TIPO_MARCA: 'TM0' + (i % 3 + 1), ID_PRIORIDAD: ['PR01', 'PR02', 'PR03', ''][i % 4], ID_VIA: 'VI0' + (i % 3 + 1), CIUDAD: ['Madrid', 'Valencia', 'Barcelona', 'Málaga', 'Zaragoza'][i % 5],
        INSTAGRAM: '@' + n.toLowerCase().replace(/[^a-z]/g, ''), QUE_FABRICAN: ['Sofás', 'Cojines', 'Cortinas', 'Proyectos de hotel'][i % 4], NOTA: i % 5 === 0 ? 'Vista en una feria; hacen mucho lino.' : '' };
    })));
  var PROVEEDORES = tabla(['ID', 'NOMBRE', 'ID_ESTADO', 'ID_PRIORIDAD', 'ID_TIPO', 'ID_VIA', 'ZONA', 'ID_REGION', 'DIRECCION', 'WEB', 'QUE_TIENEN', 'BASES', 'ANCHO', 'PESO', 'PEDIDO_MINIMO',
    'PRECIO_30', 'PRECIO_100', 'MUESTRAS', 'PLAZO', 'ENVIA_ESPANA', 'OJO', 'CARPETA', 'NOTAS'], [
    { ID: 'P-001', NOMBRE: 'Jaipur Hand Block Co.', ID_ESTADO: ep('Muestras pedidas'), ID_PRIORIDAD: 'PR01', ID_TIPO: 'TP02', ID_VIA: 'VI04', ZONA: 'Jaipur', ID_REGION: 'RE01', QUE_TIENEN: 'Block print a mano',
      BASES: 'Algodón, lino', ANCHO: '110 / 140', PESO: '120–180', PEDIDO_MINIMO: '50', PRECIO_30: '420', PRECIO_100: '360', MUESTRAS: 'Gratis, pago el envío', PLAZO: '3–4 semanas', ENVIA_ESPANA: 'Sí',
      OJO: 'Los colores varían de un lote a otro.' },
    { ID: 'P-002', NOMBRE: 'Tejidos Varanasi Loom', ID_ESTADO: ep('Catálogo recibido'), ID_PRIORIDAD: 'PR02', ID_TIPO: 'TP05', ZONA: 'Varanasi', ID_REGION: 'RE03', QUE_TIENEN: 'Ikat y jacquard',
      PEDIDO_MINIMO: '100', PRECIO_100: '610', ENVIA_ESPANA: 'No lo sé', NOTAS: 'Cuenta para pagar: IN12 3456 (pedir factura proforma)' },
    { ID: 'P-003', NOMBRE: 'Kutch Weavers', ID_ESTADO: ep('Visitar en persona'), ID_PRIORIDAD: 'PR01', ID_TIPO: 'TP03', ZONA: 'Bhuj', ID_REGION: 'RE02', QUE_TIENEN: 'Rayas de telar, lana y algodón',
      PEDIDO_MINIMO: '30', PRECIO_30: '380', ENVIA_ESPANA: 'Sí', NOTAS: 'Muy buen trato.' },
    { ID: 'P-004', NOMBRE: 'Mercado de Surat (varios)', ID_ESTADO: ep('Por contactar'), ID_PRIORIDAD: 'PR03', ID_TIPO: 'TP06', ZONA: 'Surat', ID_REGION: 'RE02' },
    { ID: 'P-005', NOMBRE: 'Coimbatore Mills', ID_ESTADO: ep('Descartado'), ID_TIPO: 'TP05', ZONA: 'Coimbatore', ID_REGION: 'RE04', OJO: 'Solo poliéster.' }
  ]);
  var OTROS_CONTACTOS = tabla(['ID', 'NOMBRE'], [{ ID: 'O-001', NOMBRE: 'Gestoría' }, { ID: 'O-002', NOMBRE: 'Transitario' }, { ID: 'O-003', NOMBRE: 'Feria Textil Hábitat' }]);
  var PERSONAS = tabla(['ID', 'NOMBRE', 'CARGO', 'EMAIL', 'TELEFONO', 'ID_MARCA', 'ID_PROVEEDOR'], [
    { ID: 'PE-001', NOMBRE: 'Lucía Ferrer', CARGO: 'Compras', EMAIL: 'lucia@casaalbero.example', TELEFONO: '+34 600 111 222', ID_MARCA: 'M-001' },
    { ID: 'PE-002', NOMBRE: 'Andrés Ferrer', CARGO: 'Taller', TELEFONO: '+34 600 111 333', ID_MARCA: 'M-001' },
    { ID: 'PE-003', NOMBRE: 'Pablo Ruiz', EMAIL: 'pablo@nidosur.example', TELEFONO: '+34 611 333 444', ID_MARCA: 'M-002' },
    { ID: 'PE-004', NOMBRE: 'Irene Sanz', EMAIL: 'irene@lumbre.example', ID_MARCA: 'M-003' },
    { ID: 'PE-005', NOMBRE: 'Ravi', TELEFONO: '+91 98 0000 0001', ID_PROVEEDOR: 'P-001' }
  ]);
  var NECESIDADES = tabla(['ID_MARCA', 'MATERIAL', 'QUE_TELAS', 'ANCHO', 'PESO', 'MARTINDALE_MIN', 'PAGAN_HOY', 'PRECIO_OBJETIVO', 'CANTIDADES', 'ID_IMPORTAN', 'ID_ANTICIPO'], [
    { ID_MARCA: 'M-001', MATERIAL: 'Lino y algodón', QUE_TELAS: 'Lisos lavados y rayas', ANCHO: '140 o más', PESO: '400–500', MARTINDALE_MIN: '25.000', PAGAN_HOY: '14', PRECIO_OBJETIVO: '11',
      CANTIDADES: '300 m al trimestre', ID_IMPORTAN: 'SN02', ID_ANTICIPO: 'SN01' },
    { ID_MARCA: 'M-002', QUE_TELAS: 'Block print, florales', PAGAN_HOY: '9,50', PRECIO_OBJETIVO: 'Ideal 8, aceptan 9', ID_ANTICIPO: 'SN03' }
  ], 'ID_MARCA');

  /* ---------- seguimiento: tareas y reuniones, cada una con su ID ---------- */
  // T0652 · El resumen de con quién es cada tarea (el mismo en Hoy y en Seguimiento). Lo hecho: lo cerrado y las notas.
  var CONTEXTO_SEG = { campo: 'CON_QUIEN', notas: 'NOTAS', hecho: [{ o: [{ campo: 'ID_ESTADO', es: ['Hecha'] }, { campo: 'ID_TIPO', es: ['Nota'] }] }],
    de: {
      ID_MARCA: { tabla: 'MARCAS', seccion: 'clientes', sub: ['CIUDAD', 'QUE_FABRICAN'], chips: [{ campo: 'ID_FASE', sinNumero: true }, { campo: 'ID_PRIORIDAD', antes: 'Prioridad' }], nota: 'NOTA',
        lineas: [{ titulo: 'Buscan', tabla: 'NECESIDADES', campo: 'ID_MARCA', columnas: ['MATERIAL', { campo: 'PAGAN_HOY', antes: 'pagan hoy', despues: ' €/m' }, { campo: 'PRECIO_OBJETIVO', antes: 'objetivo', despues: ' €/m' }] },
          { titulo: 'Hablar con', tabla: 'PERSONAS', campo: 'ID_MARCA', columnas: ['NOMBRE', 'CARGO', 'TELEFONO'] }] },
      ID_PROVEEDOR: { tabla: 'PROVEEDORES', seccion: 'proveedores', sub: ['ZONA', 'QUE_TIENEN'], chips: [{ campo: 'ID_ESTADO', sinNumero: true }, { campo: 'ID_PRIORIDAD', antes: 'Prioridad' }], nota: 'OJO',
        lineas: [{ titulo: 'Hablar con', tabla: 'PERSONAS', campo: 'ID_PROVEEDOR', columnas: ['NOMBRE', 'CARGO', 'TELEFONO'] }] } } };
  var seg = [
    [dia(-9), 'Tarea', 'Clientes', 'Pendiente', 'Mandar la propuesta de lino lavado', 'Piden 3 colores y precio puesto en su taller de Valencia.', { ID_MARCA: 'M-001' }],
    [diaBarras(-4), 'Tarea', 'Proveedores', 'Esperando respuesta', 'Pedir la carta de colores del ikat', 'Escrito por WhatsApp; suelen tardar.', { ID_PROVEEDOR: 'P-002' }],
    [dia(-2), 'Tarea', 'Clientes', 'En curso', 'Llamar para cerrar la reunión de muestras', '', { ID_MARCA: 'M-003' }],
    [dia(-1), 'Tarea', 'Empresa', 'Pendiente', 'Preguntar por el alta de autónoma', 'DNI de la gestora para el poder: 12345678Z', { ID_OTRO: 'O-001' }],
    [dia(0), 'Reunión', 'Clientes', 'Pendiente', 'Videollamada: enseñar 6 block print', 'Enlace en el calendario.', { ID_MARCA: 'M-002', ID_FORMATO: 'FO01' }],
    [dia(0), 'Tarea', 'Proveedores', 'Pendiente', 'Confirmar plazo de las muestras BP-004 y BP-007', '', { ID_PROVEEDOR: 'P-001' }],
    [dia(2), 'Reunión', 'Clientes', 'Pendiente', 'Reunión en su taller (presencial)', 'Llevar el muestrario de rayas.', { ID_MARCA: 'M-001', ID_FORMATO: 'FO03' }],
    [dia(3), 'Tarea', 'Envíos', 'Pendiente', 'Pedir precio del envío de 30 m por avión', '', { ID_OTRO: 'O-002' }],
    [dia(5), 'Tarea', 'Telas', 'Pendiente', 'Fotografiar las 12 muestras nuevas', 'Sin «con quién»: es cosa mía.', {}],
    [dia(6), 'Tarea', 'Clientes', 'Pendiente', 'Mandar cuestionario de necesidades', '', { ID_MARCA: 'M-004' }],
    [dia(12), 'Tarea', 'Ferias', 'Pendiente', 'Decidir si voy a la feria de enero', '', { ID_OTRO: 'O-003' }],
    [dia(20), 'Reunión', 'Proveedores', 'Pendiente', 'Visitar el taller', '', { ID_PROVEEDOR: 'P-003', ID_FORMATO: 'FO06' }],
    [dia(35), 'Reunión', 'Clientes', 'Pendiente', 'Revisión de la primera tirada', '', { ID_MARCA: 'M-003' }],
    ['', 'Tarea', 'Marca propia', 'Pendiente', 'Pensar el nombre comercial', 'Sin fecha a propósito.', {}],
    [dia(-15), 'Reunión', 'Clientes', 'Hecha', 'Primera reunión: qué fabrican y qué pagan hoy', 'Pagan hoy 14 €/m por un lino parecido.', { ID_MARCA: 'M-001' }],
    [dia(-12), 'Tarea', 'Proveedores', 'Hecha', 'Pedir muestras de block print', '', { ID_PROVEEDOR: 'P-001' }],
    [diaBarras(-20), 'Reunión', 'Clientes', 'Hecha', 'Llamada de presentación', '', { ID_MARCA: 'M-002' }],
    [dia(-30), 'Tarea', 'Clientes', 'Descartada', 'Propuesta de jacquard', 'No les cuadra el pedido mínimo.', { ID_MARCA: 'M-005' }],
    [dia(-6), 'Tarea', 'Proveedores', 'Hecha', 'Pedir muestras de rayas de telar', '', { ID_PROVEEDOR: 'P-003' }],
    // T0643: una nota (sin estado: ni círculo ni «Pasar»), el siguiente paso con una marca (una tarea, T0661) y una tarea con marca y sin área (como en su
    // Excel: al guardar su ficha, el área se pone sola).
    [dia(-3), 'Nota', 'Proveedores', '', 'El ikat destiñe un poco al lavarlo a 40°', '', { ID_PROVEEDOR: 'P-002' }],
    [dia(1), 'Tarea', 'Clientes', 'Pendiente', 'Llamar para ver si les cuadra el precio', '', { ID_MARCA: 'M-002' }],
    [dia(4), 'Tarea', '', 'Pendiente', 'Mandarles la carta de colores', '', { ID_MARCA: 'M-003' }]
  ];
  var SEGUIMIENTO = tabla(['ID', 'FECHA', 'ID_TIPO', 'ID_TEMA', 'ID_ESTADO', 'ID_FORMATO', 'DETALLE', 'NOTAS', 'ID_MARCA', 'ID_PROVEEDOR', 'ID_OTRO'], seg.map(function (r, i) {
    var x = { ID: 'S-' + ('000' + (i + 2)).slice(-4), FECHA: r[0], ID_TIPO: idDe(TIPOS_SEGUIMIENTO, r[1]), ID_TEMA: r[2] ? te(r[2]) : '', ID_ESTADO: r[3] ? et(r[3]) : '', DETALLE: r[4], NOTAS: r[5] };
    Object.keys(r[6]).forEach(function (k) { x[k] = r[6][k]; });
    return x;
  }));

  /* ---------- diseños (lo común) y telas (cada color) ---------- */
  var DISENOS = tabla(['ID', 'ID_TECNICA', 'ID_PROVEEDOR', 'BORDADO_HILO', 'ANCHO', 'GSM', 'GLM', 'MARTINDALE', 'RAPPORT_ANCHO', 'RAPPORT_LARGO', 'LAVABLE', 'LIMPIEZA_SECO', 'USO', 'OEKO_TEX', 'COSTE_INR', 'MARGEN'], [
    { ID: 'BP-001', ID_TECNICA: tc('Block print'), ID_PROVEEDOR: 'P-001', ANCHO: '140', GSM: '160', MARTINDALE: '20.000', USO: 'Cojines', COSTE_INR: 380 },
    { ID: 'BP-004', ID_TECNICA: tc('Block print'), ID_PROVEEDOR: 'P-001', ANCHO: '110', GSM: '140', COSTE_INR: 420 },
    { ID: 'FL-011', ID_TECNICA: tc('Floral estampado'), ID_PROVEEDOR: 'P-001', ANCHO: '140', GSM: '150', COSTE_INR: 400 },
    { ID: 'IK-002', ID_TECNICA: tc('Ikat'), ID_PROVEEDOR: 'P-002', ANCHO: '140', GSM: '220', MARTINDALE: '30.000', COSTE_INR: 792, MARGEN: 0.4 },
    { ID: 'LI-010', ID_TECNICA: tc('Liso'), ID_PROVEEDOR: 'P-002', ANCHO: '280', GSM: '320', USO: 'Tapicería, cortinas', COSTE_INR: '' },
    { ID: 'RY-003', ID_TECNICA: tc('Rayas de telar'), ID_PROVEEDOR: 'P-003', ANCHO: '150', GSM: '400–500', MARTINDALE: '40.000', USO: 'Tapicería', COSTE_INR: 380 }
  ]);
  var TELAS = tabla(['ID', 'ID_DISENO', 'COLOR', 'REF_PROVEEDOR', 'ID_ESTADO', 'MUESTRA_EN_MANO', 'ENLACE_FOTO', 'ENLACE_ETIQUETA', 'NOTAS', 'SIMULAR'], [
    { ID: 'BP-001-01', ID_DISENO: 'BP-001', COLOR: 'Índigo', REF_PROVEEDOR: 'JHB-221', ID_ESTADO: es('Propuesta a marca'), MUESTRA_EN_MANO: 'Sí', ENLACE_FOTO: muestra('flores', '#25406b', '#e9e2cf') },
    { ID: 'BP-001-02', ID_DISENO: 'BP-001', COLOR: 'Verde salvia', REF_PROVEEDOR: 'JHB-222', ID_ESTADO: es('Muestra pedida'), ENLACE_FOTO: muestra('flores', '#8aa58c', '#f5f1e8') },
    { ID: 'BP-004-01', ID_DISENO: 'BP-004', COLOR: 'Terracota', REF_PROVEEDOR: 'JHB-240', ID_ESTADO: es('Muestra pedida'), ENLACE_FOTO: 'https://drive.google.com/file/d/1EjemploDeFotoSinCompartir00/view' }, // T0633: una de Drive que no se puede ver
    { ID: 'FL-011-01', ID_DISENO: 'FL-011', COLOR: 'Rosa empolvado', ID_ESTADO: es('Descartada'), ENLACE_FOTO: muestra('flores', '#e4b9b0', '#8c4a52'), NOTAS: 'A ninguna marca le ha gustado.' },
    { ID: 'IK-002-01', ID_DISENO: 'IK-002', COLOR: 'Mostaza y crudo', REF_PROVEEDOR: 'VL-IK9', ID_ESTADO: es('Candidata'), ENLACE_FOTO: muestra('cuadros', '#d4a73a', '#f6efe0') },
    { ID: 'LI-010-01', ID_DISENO: 'LI-010', COLOR: 'Lino natural', ID_ESTADO: es('Candidata'), ENLACE_FOTO: muestra('liso', '#d8ccb4', '#8f8166'), NOTAS: 'Sin precio todavía: el proveedor no ha contestado.' },
    { ID: 'RY-003-01', ID_DISENO: 'RY-003', COLOR: 'Crudo y negro', ID_ESTADO: es('Aprobada'), ENLACE_FOTO: muestra('rayas', '#efe8da', '#2b2b2b') },
    { ID: 'RY-003-02', ID_DISENO: 'RY-003', COLOR: 'Azul y blanco', ID_ESTADO: es('Candidata'), ENLACE_FOTO: '', NOTAS: 'Falta la foto.' }
  ]);
  var INTERESES = tabla(['ID', 'ID_TELA', 'ID_MARCA'], [{ ID: 'I-001', ID_TELA: 'BP-001-01', ID_MARCA: 'M-002' }, { ID: 'I-002', ID_TELA: 'RY-003-01', ID_MARCA: 'M-001' }, { ID: 'I-003', ID_TELA: 'RY-003-01', ID_MARCA: 'M-003' }]);
  var AJUSTES = tabla(['ID', 'RUPIAS_POR_EURO', 'MARGEN', 'ENVIO_ARANCEL'], [{ ID: 1, RUPIAS_POR_EURO: 110, MARGEN: '50%', ENVIO_ARANCEL: 5 }]);
  var PREFERENCIAS = tabla(['ID', 'VALOR'], []);

  /* ---------- T0641 · composición de cada diseño y la comparativa (lo que paga hoy cada marca frente a la tela de Marta) ---------- */
  var FIBRAS = dimension('FI', ['Algodón', 'Lino', 'Viscosa', 'Poliéster', 'Seda', 'Yute']);
  var fi = function (n) { return idDe(FIBRAS, n); };
  var COMPOSICION = tabla(['ID', 'ID_DISENO', 'ID_FIBRA', 'PARTE'], [
    { ID: 'BP-001·FI01', ID_DISENO: 'BP-001', ID_FIBRA: fi('Algodón'), PARTE: 1 },
    { ID: 'IK-002·FI01', ID_DISENO: 'IK-002', ID_FIBRA: fi('Algodón'), PARTE: '0,7' },
    { ID: 'IK-002·FI05', ID_DISENO: 'IK-002', ID_FIBRA: fi('Seda'), PARTE: 0.3 },
    { ID: 'RY-003·FI01', ID_DISENO: 'RY-003', ID_FIBRA: fi('Algodón'), PARTE: 0.55 },
    { ID: 'RY-003·FI02', ID_DISENO: 'RY-003', ID_FIBRA: fi('Lino'), PARTE: 0.45 }
  ]);
  var COMPETIDORES = tabla(['ID', 'NOMBRE'], [{ ID: 'COM001', NOMBRE: 'Almacén Textil Centro' }, { ID: 'COM002', NOMBRE: 'Tejidos del Norte' }]);
  var TIPOS_PRECIO = dimension('TPC', ['Objetivo', 'Pagan hoy', 'Catálogo']);
  var ESTADOS_COMPARATIVA = dimension('ECO', ['Buscando', 'Propuesta enviada', 'Muestra enviada']);
  var tp = function (n) { return idDe(TIPOS_PRECIO, n); }, eco = function (n) { return idDe(ESTADOS_COMPARATIVA, n); };
  var COMPARATIVA = tabla(['ID', 'ID_MARCA', 'SU_TELA', 'USO', 'COMPOSICION', 'ANCHO', 'GSM', 'ID_COMPETIDOR', 'DETALLE_COMPETIDOR', 'PRECIO_A_BATIR', 'ID_TIPO_PRECIO', 'ID_DISENO', 'ID_ESTADO', 'NOTAS'], [
    // Casa Albero: dos telas con alternativa. La primera, los mismos 140 cm (por metro); la segunda, 140 frente a 150 (por m²).
    { ID: 'C-002', ID_MARCA: 'M-001', SU_TELA: 'Ikat de algodón y seda', USO: 'Cojines y pufs', COMPOSICION: '70 % algodón · 30 % seda', ANCHO: '140', GSM: '210', ID_COMPETIDOR: 'COM001',
      DETALLE_COMPETIDOR: 'Madrid, hoy 22–26 €/m', PRECIO_A_BATIR: 24, ID_TIPO_PRECIO: tp('Pagan hoy'), ID_DISENO: 'IK-002', ID_ESTADO: eco('Propuesta enviada'), NOTAS: 'Les gustó la mostaza; piden la carta de colores.' },
    { ID: 'C-003', ID_MARCA: 'M-001', SU_TELA: 'Rayas de algodón para tapizar', USO: 'Cabeceros', COMPOSICION: '100 % algodón', ANCHO: '140', GSM: '450', ID_COMPETIDOR: 'COM002',
      PRECIO_A_BATIR: 15, ID_TIPO_PRECIO: tp('Objetivo'), ID_DISENO: 'RY-003', ID_ESTADO: eco('Muestra enviada') },
    // Nido Sur: una sin alternativa todavía y otra con un diseño que aún no tiene coste.
    { ID: 'C-004', ID_MARCA: 'M-002', SU_TELA: 'Lino lavado grueso', USO: 'Fundas de sofá', ANCHO: '280', PRECIO_A_BATIR: 19, ID_TIPO_PRECIO: tp('Objetivo'), ID_ESTADO: eco('Buscando') },
    { ID: 'C-005', ID_MARCA: 'M-002', SU_TELA: 'Lino natural liso', USO: 'Cortinas', ANCHO: '280', ID_COMPETIDOR: 'COM001', PRECIO_A_BATIR: 16, ID_TIPO_PRECIO: tp('Pagan hoy'), ID_DISENO: 'LI-010', ID_ESTADO: eco('Buscando') },
    // Lumbre Estudio: sin su ancho (por metro) y paga menos de lo que a Marta le cuesta la suya.
    { ID: 'C-006', ID_MARCA: 'M-003', SU_TELA: 'Estampado de catálogo', USO: 'Cojines', ID_COMPETIDOR: 'COM002', PRECIO_A_BATIR: 8, ID_TIPO_PRECIO: tp('Catálogo'), ID_DISENO: 'BP-004', ID_ESTADO: eco('Buscando'),
      NOTAS: 'Con este precio no compensa.' }
  ]);

  var TABLAS = { FASES: FASES, ESTADOS_TAREA: ESTADOS_TAREA, TIPOS_SEGUIMIENTO: TIPOS_SEGUIMIENTO, TEMAS: TEMAS, FORMATOS: FORMATOS, PRIORIDADES: PRIORIDADES, TIPOS_MARCA: TIPOS_MARCA,
    VIAS: VIAS, ESTADOS_PROVEEDOR: ESTADOS_PROVEEDOR, TIPOS_PROVEEDOR: TIPOS_PROVEEDOR, REGIONES: REGIONES, ESTADOS_TELA: ESTADOS_TELA, TECNICAS: TECNICAS, SI_NO: SI_NO,
    MARCAS: MARCAS, PROVEEDORES: PROVEEDORES, OTROS_CONTACTOS: OTROS_CONTACTOS, PERSONAS: PERSONAS, NECESIDADES: NECESIDADES, SEGUIMIENTO: SEGUIMIENTO,
    DISENOS: DISENOS, TELAS: TELAS, INTERESES: INTERESES, AJUSTES: AJUSTES, PREFERENCIAS: PREFERENCIAS,
    FIBRAS: FIBRAS, COMPOSICION: COMPOSICION, COMPETIDORES: COMPETIDORES, TIPOS_PRECIO: TIPOS_PRECIO, ESTADOS_COMPARATIVA: ESTADOS_COMPARATIVA, COMPARATIVA: COMPARATIVA };

  /** Las referencias de cada tabla, como las saca montar.js de los YAML de GESTION (config._refs). */
  var REFS = {
    SEGUIMIENTO: { ID_TIPO: 'TIPOS_SEGUIMIENTO', ID_TEMA: 'TEMAS', ID_ESTADO: 'ESTADOS_TAREA', ID_FORMATO: 'FORMATOS', ID_MARCA: 'MARCAS', ID_PROVEEDOR: 'PROVEEDORES', ID_OTRO: 'OTROS_CONTACTOS' },
    MARCAS: { ID_FASE: 'FASES', ID_TIPO_MARCA: 'TIPOS_MARCA', ID_PRIORIDAD: 'PRIORIDADES', ID_VIA: 'VIAS' },
    PROVEEDORES: { ID_ESTADO: 'ESTADOS_PROVEEDOR', ID_PRIORIDAD: 'PRIORIDADES', ID_TIPO: 'TIPOS_PROVEEDOR', ID_VIA: 'VIAS', ID_REGION: 'REGIONES' },
    PERSONAS: { ID_MARCA: 'MARCAS', ID_PROVEEDOR: 'PROVEEDORES' },
    NECESIDADES: { ID_MARCA: 'MARCAS', ID_IMPORTAN: 'SI_NO', ID_ANTICIPO: 'SI_NO' },
    DISENOS: { ID_TECNICA: 'TECNICAS', ID_PROVEEDOR: 'PROVEEDORES' },
    TELAS: { ID_DISENO: 'DISENOS', ID_ESTADO: 'ESTADOS_TELA' },
    INTERESES: { ID_TELA: 'TELAS', ID_MARCA: 'MARCAS' },
    COMPOSICION: { ID_DISENO: 'DISENOS', ID_FIBRA: 'FIBRAS' },
    COMPARATIVA: { ID_MARCA: 'MARCAS', ID_COMPETIDOR: 'COMPETIDORES', ID_TIPO_PRECIO: 'TIPOS_PRECIO', ID_DISENO: 'DISENOS', ID_ESTADO: 'ESTADOS_COMPARATIVA' }
  };
  function refsDesde(t) { var r = {}; (function ir(x, n) { if (r[x] || n > 2) return; r[x] = REFS[x] || {}; Object.keys(r[x]).forEach(function (c) { ir(r[x][c], n + 1); }); })(t, 0); return r; }

  /* ---------- las secciones del menú (config.json · nucleo.secciones) ---------- */
  var NO_HECHAS = { campo: 'ID_ESTADO', no: ['Hecha', 'Descartada'] };
  var COMUN = {
    VALORES: { RUPIAS: { tabla: 'AJUSTES', fila: 1, columna: 'RUPIAS_POR_EURO' }, MARGEN: { tabla: 'AJUSTES', fila: 1, columna: 'MARGEN' }, ENVIO: { tabla: 'AJUSTES', fila: 1, columna: 'ENVIO_ARANCEL' } },
    PERSONALIZAN: ['Dueña'], PREFERENCIAS: 'PREFERENCIAS'
  };
  // T0641 · Lo que le cuesta una tela puesta en España: coste del proveedor en euros + envío (Marta aún no pone precios).
  var EUROS = ['/', 'ID_DISENO.COSTE_INR', '$RUPIAS'], COSTE = ['redondear', ['+', EUROS, '$ENVIO'], 2];
  var COMP_DE = { tabla: 'COMPOSICION', campo: 'ID_DISENO', con: 'ID_DISENO', orden: '-PARTE', columnas: ['PARTE', 'ID_FIBRA'], campos: { PARTE: { tipo: 'porcentaje' } } };
  var COMPARATIVA_REL = {
    titulo: 'Comparativa', tabla: 'COMPARATIVA', campo: 'ID_MARCA', con: 'ID', nombre: 'SU_TELA', siHay: true, perfiles: ['Dueña'], // lo que le cuesta: no para la ayudante
    tarjeta: { titulo: 'SU_TELA', linea: ['HOY', 'PROPUESTA', 'HUECO'], debajo: ['ID_ESTADO'],
      comparar: { titulos: ['Su tela', 'Tu alternativa'], filas: [
        { titulo: 'Composición', campos: ['COMPOSICION', 'ALT_COMPOSICION'] }, { titulo: 'Ancho', campos: ['ANCHO', 'ID_DISENO.ANCHO'] },
        { titulo: 'Peso', campos: ['GSM', 'ID_DISENO.GSM'] }, { titulo: 'Por metro', campos: ['PRECIO_SU', 'MI_COSTE'] }, { titulo: 'Por m²', campos: ['M2_SU', 'M2_MIO'] }] },
      detalle: ['USO', 'PROVEEDOR_HOY', 'NOTAS'] },
    campos: {
      SU_TELA: { titulo: 'Su tela' }, USO: { titulo: 'Para' }, ANCHO: { titulo: 'Ancho', unidad: 'cm' }, GSM: { titulo: 'Peso', unidad: 'g/m²' },
      'ID_DISENO.ANCHO': { titulo: 'Ancho', unidad: 'cm' }, 'ID_DISENO.GSM': { titulo: 'Peso', unidad: 'g/m²' },
      PRECIO_A_BATIR: { titulo: 'Precio a batir', tipo: 'importe', unidad: '€/m' }, ID_ESTADO: { titulo: 'Estado' }, NOTAS: { titulo: 'Notas', tipo: 'nota' },
      MI_COSTE: { titulo: 'Te cuesta', tipo: 'importe', unidad: '€/m', calculo: COSTE, envio: '$ENVIO' }, // T0678: sin envío, «Falta el envío»
      A_TU_ANCHO: { titulo: 'A tu ancho', tipo: 'importe', unidad: '€/m', calculo: ['*', ['/', 'PRECIO_A_BATIR', 'ANCHO'], 'ID_DISENO.ANCHO'] },
      HUECO: { titulo: 'Hasta su precio', tipo: 'importe', unidad: '€/m', signo: { mas: 'Hasta su precio te quedan {}', menos: 'Tu coste ya pasa su precio en {}', cero: 'Tu coste es su precio' },
        calculo: ['o', ['-', ['*', ['/', 'PRECIO_A_BATIR', 'ANCHO'], 'ID_DISENO.ANCHO'], 'MI_COSTE'], ['-', 'PRECIO_A_BATIR', 'MI_COSTE']] },
      M2_SU: { titulo: 'Por m²', tipo: 'importe', unidad: '€/m²', calculo: ['/', 'PRECIO_A_BATIR', ['/', 'ANCHO', 100]] },
      M2_MIO: { titulo: 'Por m²', tipo: 'importe', unidad: '€/m²', calculo: ['/', 'MI_COSTE', ['/', 'ID_DISENO.ANCHO', 100]] },
      HOY: { titulo: 'Hoy', plantilla: 'Hoy paga {PRECIO_A_BATIR}[ ({ID_COMPETIDOR})][ · a tu ancho, {A_TU_ANCHO}]' },
      PROPUESTA: { titulo: 'Tu alternativa', plantilla: '{ID_DISENO}[: te cuesta {MI_COSTE}]' },
      PRECIO_SU: { titulo: 'Precio', plantilla: '{PRECIO_A_BATIR}[ · {ID_TIPO_PRECIO}]' },
      PROVEEDOR_HOY: { titulo: 'Hoy la compra a', plantilla: '{ID_COMPETIDOR}[ ({DETALLE_COMPETIDOR})]' },
      ALT_COMPOSICION: { titulo: 'Composición', de: COMP_DE }
    }
  };
  var COLORES_TAREA = { 'Pendiente': 'medio', 'En curso': 'info', 'Esperando respuesta': 'info', 'Hecha': 'bien', 'Descartada': 'apagado' };
  function suSeguimiento(col) {
    // T0642: «+ Nueva tarea» debajo, que abre Seguimiento con una nueva ya puesta con esta marca o proveedor.
    var nueva = { titulo: 'Nueva tarea', poner: {} }; nueva.poner[col] = 'ID';
    return { nueva: nueva, titulo: 'Su seguimiento', tabla: 'SEGUIMIENTO', seccion: 'seguimiento', campo: col, con: 'ID', orden: '-FECHA', columnas: ['FECHA', 'DETALLE', 'ID_ESTADO'], codigo: 'ID', nombre: 'DETALLE',
      campos: { ID_ESTADO: { titulo: 'Estado', colores: COLORES_TAREA } } };
  }
  function mezcla() { var r = {}; [].forEach.call(arguments, function (o) { Object.keys(o).forEach(function (k) { r[k] = o[k]; }); }); return r; }

  var SECCIONES = {
    seguimiento: { modulo: 'listado', titulo: 'Seguimiento', icono: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l2 2 4-4M8 15h8"/>', config: mezcla(COMUN, {
      TABLA: 'SEGUIMIENTO', CODIGO: 'ID', NOMBRE: 'DETALLE', ORDEN: 'FECHA', TEXTO: 'Tus tareas, reuniones y notas.', FILAS: ['tarea', 'tareas'],
      COLUMNAS: ['FECHA', 'ID_TIPO', 'CON_QUIEN', 'DETALLE', 'ID_ESTADO'], DETALLE: ['CON_QUIEN', 'FECHA', 'ID_ESTADO'],
      CAMPOS: { CON_QUIEN: { titulo: 'Con quién', primero: ['ID_MARCA', 'ID_PROVEEDOR', 'ID_OTRO'], grupos: { ID_MARCA: 'Marcas', ID_PROVEEDOR: 'Proveedores', ID_OTRO: 'Otros' } }, ID_TIPO: { titulo: 'Tipo' }, ID_TEMA: { titulo: 'Área' }, ID_FORMATO: { titulo: 'Formato' },
        ID_MARCA: { titulo: 'Marca' }, ID_PROVEEDOR: { titulo: 'Proveedor' }, ID_OTRO: { titulo: 'Otro contacto' }, DETALLE: { titulo: 'Qué hay que hacer o qué pasó' },
        ID_ESTADO: { titulo: 'Estado', colores: COLORES_TAREA }, NOTAS: { titulo: 'Notas y enlaces', tipo: 'nota' } },
      FICHA: [{ titulo: '', campos: ['ID_ESTADO', 'FECHA', 'DETALLE', 'ID_TIPO', 'ID_TEMA', 'ID_FORMATO', 'NOTAS'] }, { titulo: 'Con quién', campos: ['ID_MARCA', 'ID_PROVEEDOR', 'ID_OTRO'] }],
      VISTAS: [
        { id: 'HOY', titulo: 'Hoy', texto: 'Lo que tienes por hacer, de lo más retrasado a lo de los próximos días.', filtro: [NO_HECHAS], agrupar: { campo: 'FECHA', por: 'plazo' }, orden: 'FECHA' },
        { id: 'TABLERO', titulo: 'Tablero', texto: 'Tus tareas y reuniones, en columnas según cómo van.', filtro: [{ campo: 'ID_ESTADO', no: ['Descartada'] }], tablero: { campo: 'ID_ESTADO', columnas: ['Pendiente', 'En curso', 'Esperando respuesta', 'Hecha'] }, orden: 'FECHA' },
        { id: 'REUNIONES', titulo: 'Reuniones', texto: 'Las reuniones: con quién y cuándo.', filas: ['reunión', 'reuniones'], filtro: [{ campo: 'ID_TIPO', es: 'Reunión' }], orden: '-FECHA' },
        { id: 'HECHO', titulo: 'Hecho', filtro: [{ campo: 'ID_ESTADO', es: ['Hecha', 'Descartada'] }], orden: '-FECHA' },
        { id: 'TODO', titulo: 'Todo', orden: '-FECHA', agrupar: 'ID_TEMA' }
      ],
      AVISOS: [
        { id: 'PASADA', titulo: 'Con la fecha pasada', nivel: 'alto', si: [NO_HECHAS, { campo: 'FECHA', hasta: -1 }] },
        { id: 'PRONTO', titulo: 'Vence pronto', texto: 'Lo que no está hecho y vence en los próximos días.', nivel: 'medio', dias: 3, si: [NO_HECHAS, { campo: 'FECHA', desde: 0, hasta: 'dias' }] },
        { id: 'ESPERANDO', titulo: 'Esperando respuesta hace días', texto: 'Para insistir.', nivel: 'medio', dias: 3, si: [{ campo: 'ID_ESTADO', es: 'Esperando respuesta' }, { campo: 'FECHA', hasta: '-dias' }] }
      ],
      EDITAR: ['FECHA', 'ID_TIPO', 'ID_ESTADO', 'ID_TEMA', 'ID_FORMATO', 'DETALLE', 'NOTAS', 'ID_MARCA', 'ID_PROVEEDOR', 'ID_OTRO'], CREAR: true,
      NUEVA: { ID_ESTADO: 'Pendiente', ID_TIPO: 'Tarea', FECHA: 'hoy' }, OBLIGATORIAS: ['DETALLE', 'ID_ESTADO'],
      // T0643: cerrar y pasar en un toque, el siguiente paso al cerrar con una marca o un proveedor, el alta con el texto primero y el área puesta sola.
      RAPIDAS: { HECHA: { campo: 'ID_ESTADO', valor: 'Hecha' }, PASAR: 'FECHA', SI: [{ campo: 'ID_TIPO', no: ['Nota'] }, NO_HECHAS],
        CERRAR_HOY: true, HABLADO: 'NOTAS', // T0732: antes de tiempo, con la fecha de hoy; lo hablado, en sus notas
        SIGUIENTE: { con: ['ID_MARCA', 'ID_PROVEEDOR'], copia: ['ID_MARCA', 'ID_PROVEEDOR', 'ID_OTRO', 'ID_TEMA'], pone: { ID_TIPO: 'Tarea', ID_ESTADO: 'Pendiente' } } },
      ALTA: { titulo: 'Nueva tarea', campos: ['DETALLE', 'CON_QUIEN', 'FECHA', 'ID_TEMA'], mas: ['ID_TIPO', 'ID_FORMATO', 'NOTAS'] },
      DEDUCIR: { ID_TEMA: { ID_MARCA: 'Clientes', ID_PROVEEDOR: 'Proveedores' } },
      // T0652: el nombre de con quién es abre lo último con esa marca o ese proveedor, lo que queda y su ficha en dos líneas.
      CONTEXTO: CONTEXTO_SEG,
      _refs: refsDesde('SEGUIMIENTO') }) },

    clientes: { modulo: 'listado', titulo: 'Clientes', icono: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.9 2.6 2.6 3 5.2"/>', config: mezcla(COMUN, {
      TABLA: 'MARCAS', CODIGO: 'ID', NOMBRE: 'NOMBRE', ORDEN: 'NOMBRE', TEXTO: 'Las marcas: las que ya son clientes y las de prospección, según su fase.', FILAS: ['cliente', 'clientes'],
      COLUMNAS: ['NOMBRE', 'ID_FASE', 'CIUDAD', 'PROXIMO_PASO', 'FECHA_PASO'], DETALLE: ['ID_FASE', 'PROXIMO_PASO'],
      CAMPOS: { NOMBRE: { titulo: 'Marca' }, ID_FASE: { titulo: 'Fase', tipo: 'estado', sinNumero: true, colores: { '8 Primer pedido': 'bien', '9 Cliente habitual': 'bien', 'En pausa': 'apagado', 'Descartado': 'apagado', 'Por contactar': 'medio' } },
        ID_TIPO_MARCA: { titulo: 'Tipo' }, ID_PRIORIDAD: { titulo: 'Prioridad', colores: { 'Alta': 'alto' } }, ID_VIA: { titulo: 'Primer contacto por' }, WEB: { tipo: 'enlace' }, INSTAGRAM: { titulo: 'Instagram', tipo: 'instagram' },
        DIRECCION: { titulo: 'Dirección (envíos)' }, NOTA: { titulo: 'Resumen' }, NOTAS: { tipo: 'nota' }, QUE_FABRICAN: { titulo: 'Qué fabrican' },
        // T0651: no se editan aquí: llevan a su tarea («· en su tarea» y la flecha).
        PROXIMO_PASO: { titulo: 'Próximo paso', de: { tabla: 'SEGUIMIENTO', campo: 'ID_MARCA', filtro: [NO_HECHAS], orden: 'FECHA', columna: 'DETALLE' }, ir: { seccion: 'seguimiento', texto: 'en su tarea' } },
        FECHA_PASO: { titulo: 'Fecha del próximo paso', tipo: 'fecha', de: { tabla: 'SEGUIMIENTO', campo: 'ID_MARCA', filtro: [NO_HECHAS], orden: 'FECHA', columna: 'FECHA' }, ir: { seccion: 'seguimiento', texto: 'en su tarea' } } },
      FICHA: [
        { titulo: 'En qué punto está', campos: ['ID_FASE', 'ID_PRIORIDAD', 'PROXIMO_PASO', 'FECHA_PASO'] },
        { titulo: 'La marca', campos: ['ID_TIPO_MARCA', 'QUE_FABRICAN', 'CIUDAD', 'DIRECCION', 'WEB', 'INSTAGRAM', 'ID_VIA', 'NOTA', 'NOTAS'] }
      ],
      RELACIONADOS: [
        // T0651: las personas se cambian, se añaden y se quitan desde la ficha; lo que buscan, igual (una ficha por marca); las
        // telas que le interesan se añaden eligiéndolas (con su código: el ID lo pone la tabla) y se quitan con su ✕.
        { titulo: 'Personas de contacto', tabla: 'PERSONAS', campo: 'ID_MARCA', con: 'ID', columnas: ['NOMBRE', 'CARGO', 'EMAIL', 'TELEFONO'], nombre: 'NOMBRE', campos: { EMAIL: { tipo: 'email' }, TELEFONO: { tipo: 'telefono' } },
          editar: true, crear: true, quitar: true, obligatorias: ['NOMBRE'], filas: ['persona de contacto', 'personas de contacto'] },
        { titulo: 'Qué buscan', datos: true, tabla: 'NECESIDADES', campo: 'ID_MARCA', con: 'ID', columnas: ['QUE_TELAS', 'PAGAN_HOY', 'PRECIO_OBJETIVO', 'CANTIDADES', 'ID_ANTICIPO'], clave: 'ID_MARCA', nombre: 'QUE_TELAS',
          campos: { QUE_TELAS: { titulo: 'Qué telas' }, PAGAN_HOY: { titulo: 'Pagan hoy (€/m)' }, PRECIO_OBJETIVO: { titulo: 'Precio objetivo (€/m)' }, CANTIDADES: { titulo: 'Cantidades' }, ID_ANTICIPO: { titulo: '¿Anticipo 50 %?' } },
          editar: true, crear: true, quitar: true, alta: ['QUE_TELAS', 'PAGAN_HOY'], filas: ['lo que buscan', 'lo que buscan'] },
        { titulo: 'Telas que le interesan', tabla: 'INTERESES', seccion: 'telas', campo: 'ID_MARCA', con: 'ID', clave: 'ID_TELA', nombre: 'ID_TELA', columnas: ['ID_TELA', 'ID_TELA.COLOR'],
          campos: { ID_TELA: { titulo: 'Tela' }, 'ID_TELA.COLOR': { titulo: 'Color' } }, vacio: 'Ninguna todavía.',
          crear: true, elegir: 'ID_TELA', quitar: true, id: '{ID_TELA}·{ID_MARCA}', filas: ['tela que le interesa', 'telas que le interesan'] },
        COMPARATIVA_REL,
        suSeguimiento('ID_MARCA')
      ],
      VISTAS: [
        { id: 'EN_MARCHA', titulo: 'En marcha', filtro: [{ campo: 'ID_FASE', no: ['Por contactar', 'En pausa', 'Descartado'] }] },
        { id: 'EMBUDO', titulo: 'Embudo', texto: 'Tus clientes en tres columnas: por empezar, hablando y comprando. Cada uno dice en qué fase está.', tablero: { campo: 'ID_FASE', columnas: [
          { titulo: 'Por empezar', valores: ['1 Contactado', '2 Interesado'] },
          { titulo: 'Hablando', valores: ['3 Reunión hecha', '4 Cuestionario enviado', '5 Cuestionario recibido', '6 Propuesta enviada', '7 Muestras enviadas'] },
          { titulo: 'Comprando', valores: ['8 Primer pedido', '9 Cliente habitual'] }] } },
        { id: 'PROSPECCION', titulo: 'Prospección', filtro: [{ campo: 'ID_FASE', es: ['Por contactar', '1 Contactado'] }], columnas: ['NOMBRE', 'ID_FASE', 'ID_PRIORIDAD', 'ID_TIPO_MARCA', 'CIUDAD', 'NOTA'] },
        { id: 'TODAS', titulo: 'Todas', agrupar: 'ID_FASE' }
      ],
      AVISOS: [
        { id: 'PASO_PASADO', titulo: 'Próximo paso con la fecha pasada', nivel: 'alto', si: [{ campo: 'ID_FASE', no: ['En pausa', 'Descartado'] }, { campo: 'FECHA_PASO', hasta: -1 }] },
        { id: 'SIN_PASO', titulo: 'Sin próximo paso', nivel: 'medio', si: [{ campo: 'ID_FASE', no: ['Por contactar', 'En pausa', 'Descartado'] }, { campo: 'PROXIMO_PASO', vacio: true }] },
        { id: 'ALTA_SIN_CONTACTAR', titulo: 'Prioridad alta sin contactar', nivel: 'medio', si: [{ campo: 'ID_PRIORIDAD', es: 'Alta' }, { campo: 'ID_FASE', es: 'Por contactar' }] }
      ],
      // T0651: todo lo suyo se edita tocándolo; «Añadir» con lo justo (y su ficha se abre para seguir); borrar, dentro de «Más».
      EDITAR: ['NOMBRE', 'ID_FASE', 'ID_PRIORIDAD', 'ID_TIPO_MARCA', 'QUE_FABRICAN', 'CIUDAD', 'DIRECCION', 'WEB', 'INSTAGRAM', 'ID_VIA', 'NOTA', 'NOTAS'], CREAR: true,
      OBLIGATORIAS: ['NOMBRE'], NUEVA: { ID_FASE: 'Por contactar' },
      ALTA: { titulo: 'Nueva marca', campos: ['NOMBRE', 'ID_FASE', 'CIUDAD', 'INSTAGRAM', 'WEB'], mas: ['ID_TIPO_MARCA', 'QUE_FABRICAN', 'ID_VIA', 'NOTA'], abrir: true },
      BORRAR: {
        con: [{ tabla: 'PERSONAS', campo: 'ID_MARCA', filas: ['persona de contacto', 'personas de contacto'] }, { tabla: 'NECESIDADES', campo: 'ID_MARCA', clave: 'ID_MARCA', filas: ['nota de lo que buscan', 'notas de lo que buscan'] },
          { tabla: 'INTERESES', campo: 'ID_MARCA', filas: ['tela que le interesa', 'telas que le interesan'] }],
        bloquean: [{ tabla: 'SEGUIMIENTO', campo: 'ID_MARCA', filas: ['cosa en su seguimiento', 'cosas en su seguimiento'] }, { tabla: 'COMPARATIVA', campo: 'ID_MARCA', filas: ['tela en su comparativa', 'telas en su comparativa'] }],
        texto: 'Si ya no trabajas con ella, ponla en Descartado: sigue en «Todas».',
        sino: { titulo: 'Poner en Descartado', poner: { ID_FASE: 'Descartado' }, hecho: 'Está en Descartado: la encontrarás en «Todas».' } },
      _refs: refsDesde('MARCAS') }) },

    proveedores: { modulo: 'listado', titulo: 'Proveedores', perfiles: ['Dueña'], icono: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', config: mezcla(COMUN, {
      TABLA: 'PROVEEDORES', CODIGO: 'ID', NOMBRE: 'NOMBRE', ORDEN: 'NOMBRE', FILAS: ['proveedor', 'proveedores'],
      COLUMNAS: ['NOMBRE', 'ID_ESTADO', 'ID_PRIORIDAD', 'ZONA', 'ID_TIPO', 'N_DISENOS', 'PROXIMO_PASO'], DETALLE: ['ID_ESTADO', 'ZONA', 'PROXIMO_PASO'],
      CAMPOS: { NOMBRE: { titulo: 'Proveedor', privado: true }, ID_ESTADO: { titulo: 'Estado', colores: { 'Aprobado': 'bien', 'Muestras pedidas': 'medio', 'En pausa': 'apagado', 'Descartado': 'apagado' } },
        ID_PRIORIDAD: { titulo: 'Prioridad', colores: { 'Alta': 'alto' } }, ID_TIPO: { titulo: 'Tipo' }, ID_REGION: { titulo: 'Región' }, ID_VIA: { titulo: 'Primer contacto por' }, ZONA: { titulo: 'Ciudad / zona' },
        QUE_TIENEN: { titulo: 'Qué tienen' }, BASES: { titulo: 'Bases (algodón, lino…)' }, ANCHO: { titulo: 'Ancho (cm)' }, PESO: { titulo: 'Peso (g/m²)' }, PEDIDO_MINIMO: { titulo: 'Pedido mínimo', unidad: 'm' },
        PRECIO_30: { titulo: 'Coste a 30 m (sin envío)', unidad: '₹/m', privado: true }, PRECIO_100: { titulo: 'Coste a 100 m (sin envío)', unidad: '₹/m', privado: true },
        PLAZO: { titulo: 'Plazo de producción' }, ENVIA_ESPANA: { titulo: '¿Envía a España?' }, OJO: { titulo: 'A tener en cuenta' }, CARPETA: { titulo: 'Carpeta en Drive', tipo: 'enlace' }, NOTAS: { tipo: 'nota' },
        N_DISENOS: { titulo: 'Diseños', de: { tabla: 'DISENOS', campo: 'ID_PROVEEDOR' } },
        PROXIMO_PASO: { titulo: 'Próximo paso', de: { tabla: 'SEGUIMIENTO', campo: 'ID_PROVEEDOR', filtro: [NO_HECHAS], orden: 'FECHA', columna: 'DETALLE' } },
        FECHA_PASO: { titulo: 'Fecha del próximo paso', tipo: 'fecha', de: { tabla: 'SEGUIMIENTO', campo: 'ID_PROVEEDOR', filtro: [NO_HECHAS], orden: 'FECHA', columna: 'FECHA' } } },
      FICHA: [
        { titulo: 'En qué punto está', campos: ['ID_ESTADO', 'ID_PRIORIDAD', 'PROXIMO_PASO', 'FECHA_PASO'] },
        { titulo: 'Qué tienen', campos: ['QUE_TIENEN', 'BASES', 'ANCHO', 'PESO', 'PEDIDO_MINIMO', 'PRECIO_30', 'PRECIO_100', 'MUESTRAS', 'PLAZO', 'ENVIA_ESPANA', 'OJO'] },
        { titulo: 'Dónde', campos: ['ZONA', 'ID_REGION', 'ID_TIPO', 'ID_VIA', 'DIRECCION', 'WEB', 'CARPETA', 'NOTAS'] }
      ],
      RELACIONADOS: [
        { titulo: 'Sus diseños', tabla: 'DISENOS', campo: 'ID_PROVEEDOR', con: 'ID', columnas: ['ID_TECNICA', 'ANCHO', 'GSM'], codigo: 'ID', nombre: 'ID_TECNICA', campos: { ID_TECNICA: { titulo: 'Técnica' } } },
        { titulo: 'Personas de contacto', tabla: 'PERSONAS', campo: 'ID_PROVEEDOR', con: 'ID', columnas: ['NOMBRE', 'TELEFONO', 'EMAIL'], nombre: 'NOMBRE' },
        suSeguimiento('ID_PROVEEDOR')
      ],
      VISTAS: [
        { id: 'ACTIVOS', titulo: 'Activos', filtro: [{ campo: 'ID_ESTADO', no: ['En pausa', 'Descartado'] }] },
        { id: 'TABLERO', titulo: 'Tablero', tablero: { campo: 'ID_ESTADO' } },
        { id: 'TODOS', titulo: 'Todos', agrupar: 'ID_ESTADO' }
      ],
      AVISOS: [
        { id: 'PASO_PASADO', titulo: 'Próximo paso con la fecha pasada', nivel: 'alto', si: [{ campo: 'ID_ESTADO', no: ['En pausa', 'Descartado'] }, { campo: 'FECHA_PASO', hasta: -1 }] },
        { id: 'SIN_PASO', titulo: 'Sin próximo paso', nivel: 'medio', si: [{ campo: 'ID_ESTADO', no: ['Por contactar', 'En pausa', 'Descartado'] }, { campo: 'PROXIMO_PASO', vacio: true }] }
      ],
      EDITAR: ['ID_ESTADO', 'ID_PRIORIDAD', 'OJO', 'NOTAS'], _refs: refsDesde('PROVEEDORES') }) },

    telas: { modulo: 'listado', titulo: 'Mis telas', perfiles: ['Dueña'], icono: '<path d="M4 5h12a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h12"/><path d="M4 5v14"/>', config: mezcla(COMUN, {
      TABLA: 'TELAS', CODIGO: 'ID', NOMBRE: 'COLOR', ORDEN: 'ID', FILAS: ['tela', 'telas'],
      COLUMNAS: ['ENLACE_FOTO', 'ID_DISENO.ID_TECNICA', 'COLOR', 'ID_DISENO.ANCHO', 'ID_DISENO.GSM', 'ID_DISENO.ID_PROVEEDOR', 'COSTE_ESPANA', 'ID_ESTADO'],
      DETALLE: ['ID_DISENO.ID_TECNICA', 'COSTE_ESPANA', 'ID_ESTADO'],
      CAMPOS: {
        ENLACE_FOTO: { titulo: 'Foto', tipo: 'foto' }, COLOR: { titulo: 'Color' }, ID_DISENO: { titulo: 'Diseño', soloAlta: true },
        'ID_DISENO.ID_TECNICA': { titulo: 'Técnica' }, 'ID_DISENO.ANCHO': { titulo: 'Ancho', unidad: 'cm' }, 'ID_DISENO.GSM': { titulo: 'Peso', unidad: 'g/m²' },
        'ID_DISENO.MARTINDALE': { titulo: 'Martindale' }, 'ID_DISENO.USO': { titulo: 'Uso' },
        'ID_DISENO.ID_PROVEEDOR': { titulo: 'Proveedor', privado: true }, REF_PROVEEDOR: { titulo: 'Referencia del proveedor', privado: true },
        'ID_DISENO.COSTE_INR': { titulo: 'Coste del proveedor (sin envío)', tipo: 'numero', unidad: '₹/m', privado: true },
        'ID_DISENO.MARGEN': { titulo: 'Margen del diseño', tipo: 'porcentaje', privado: true, ayuda: 'Vacío: el margen de Ajustes.' },
        PRECIO_TALLER: { titulo: 'Precio puesto en taller', tipo: 'importe', unidad: '€/m', precio: { envio: ['$ENVIO'] },
          calculo: ['redondear', ['*', ['+', ['/', 'ID_DISENO.COSTE_INR', '$RUPIAS'], '$ENVIO'], ['+', 1, ['o', 'ID_DISENO.MARGEN', '$MARGEN']]], 2],
          ayuda: 'Coste del proveedor en euros + envío y arancel + margen. Nunca sale sin el envío.' },
        ID_ESTADO: { titulo: 'Estado', colores: { 'Aprobada': 'bien', 'Propuesta a marca': 'info', 'Muestra pedida': 'medio', 'Descartada': 'apagado' } },
        MUESTRA_EN_MANO: { titulo: 'Muestra en mano' }, NOTAS: { tipo: 'nota' }, N_INTERESADAS: { titulo: 'Marcas interesadas', de: { tabla: 'INTERESES', campo: 'ID_TELA' } },
        // T0641
        COSTE_ESPANA: { titulo: 'Te cuesta con el envío', tipo: 'importe', unidad: '€/m', privado: true, calculo: COSTE, envio: '$ENVIO',
          desglose: [{ calculo: 'ID_DISENO.COSTE_INR', tipo: 'numero', unidad: '₹' }, '→', { calculo: EUROS }, '+ envío', { calculo: '$ENVIO' }],
          ayuda: 'El coste del proveedor en euros más el envío y el arancel de Ajustes. El precio para cada cliente lo pones tú.' },
        COMPOSICION: { titulo: 'Composición', de: COMP_DE },
        PESO: { titulo: 'Peso', plantilla: '{ID_DISENO.GSM}[ · {ID_DISENO.GLM}]' }, 'ID_DISENO.GLM': { titulo: 'Peso por metro', unidad: 'g/m' },
        RAPPORT: { titulo: 'Rapport', plantilla: '{ID_DISENO.RAPPORT_ANCHO} × {ID_DISENO.RAPPORT_LARGO} cm' },
        'ID_DISENO.BORDADO_HILO': { titulo: 'Hilo del bordado' }, 'ID_DISENO.LIMPIEZA_SECO': { titulo: 'Limpieza en seco' }, 'ID_DISENO.LAVABLE': { titulo: 'Lavable' }
      },
      FICHA: [
        { titulo: '', campos: ['ENLACE_FOTO', 'ID_ESTADO', 'COSTE_ESPANA'] },
        { titulo: 'La tela', campos: ['ID_DISENO', 'ID_DISENO.ID_TECNICA', 'COLOR', 'COMPOSICION', 'ID_DISENO.BORDADO_HILO', 'ID_DISENO.ANCHO', 'ID_DISENO.GSM', 'RAPPORT', 'ID_DISENO.MARTINDALE', 'ID_DISENO.USO',
          'ID_DISENO.LAVABLE', 'ID_DISENO.LIMPIEZA_SECO'] },
        { titulo: 'Proveedor y coste', campos: ['ID_DISENO.ID_PROVEEDOR', 'REF_PROVEEDOR', 'ID_DISENO.MARGEN'] },
        { titulo: 'Con las marcas', campos: ['N_INTERESADAS', 'MUESTRA_EN_MANO', 'NOTAS'] }
      ],
      RELACIONADOS: [{ titulo: 'Marcas interesadas', tabla: 'INTERESES', campo: 'ID_TELA', con: 'ID', seccion: 'clientes', clave: 'ID_MARCA', columnas: ['ID_MARCA'], nombre: 'ID_MARCA', campos: { ID_MARCA: { titulo: 'Marca' } },
        crear: true, elegir: 'ID_MARCA', quitar: true, id: '{ID_TELA}·{ID_MARCA}', filas: ['marca interesada', 'marcas interesadas'] }],
      VISTAS: [
        { id: 'CATALOGO', titulo: 'Mi catálogo', filtro: [{ campo: 'ID_ESTADO', no: ['Descartada'] }] },
        { id: 'MUESTRAS', titulo: 'Muestras', filtro: [{ campo: 'ID_ESTADO', es: ['Muestra pedida', 'Muestra recibida'] }] },
        { id: 'TODAS', titulo: 'Todas', agrupar: 'ID_DISENO.ID_TECNICA' }
      ],
      AVISOS: [
        { id: 'SIN_COSTE', titulo: 'Sin coste del proveedor', nivel: 'alto', si: [{ campo: 'ID_DISENO.COSTE_INR', vacio: true }, { campo: 'ID_ESTADO', no: ['Descartada'] }] },
        { id: 'SIN_FOTO', titulo: 'Sin foto', nivel: 'info', si: [{ campo: 'ENLACE_FOTO', vacio: true }, { campo: 'ID_ESTADO', no: ['Descartada'] }] }
      ],
      // T0651: lo del diseño (ancho, peso, técnica, coste…) se edita desde la tela y cambia en todos sus colores (la ficha lo
      // dice); una tela nueva, eligiendo su diseño, con el código siguiente de ese diseño (BP-001-03); borrar, en «Más».
      EDITAR: ['COLOR', 'ID_ESTADO', 'MUESTRA_EN_MANO', 'NOTAS', 'REF_PROVEEDOR', 'ID_DISENO', 'ID_DISENO.ID_TECNICA', 'ID_DISENO.ANCHO', 'ID_DISENO.GSM', 'ID_DISENO.MARTINDALE', 'ID_DISENO.USO', 'ID_DISENO.COSTE_INR'],
      CREAR: true, OBLIGATORIAS: ['ID_DISENO', 'COLOR'], NUEVA: { ID_ESTADO: 'Candidata' }, NUEVO_ID: '{ID_DISENO}-{n:2}',
      // T0714: o un diseño nuevo a la vez, con su proveedor; su código, el de los de su técnica (FL-012) o, si es la primera, con sus letras.
      ALTA: { titulo: 'Nueva tela', campos: ['ID_DISENO', 'COLOR', 'REF_PROVEEDOR', 'ID_ESTADO'], abrir: true,
        nuevo: { campo: 'ID_DISENO', titulo: 'Diseño nuevo', campos: ['ID_DISENO.ID_PROVEEDOR', 'ID_DISENO.ID_TECNICA', 'ID_DISENO.ANCHO', 'ID_DISENO.GSM', 'ID_DISENO.COSTE_INR'],
          obligatorias: ['ID_DISENO.ID_PROVEEDOR'], codigo: { segun: 'ID_TECNICA', cifras: 3 } } },
      BORRAR: { con: [{ tabla: 'INTERESES', campo: 'ID_TELA', filas: ['marca interesada', 'marcas interesadas'] }] },
      _refs: refsDesde('TELAS') }) }
  };
  // T0629: como la app de Marta, con Hoy y Prospección (sobre las mismas tablas) y en su orden. Con Perfil, la dueña y quien
  // administra tienen 7 en el menú (en el móvil, 4 abajo y «Más»); la ayudante, Hoy, Seguimiento, Clientes, Prospección y
  // Perfil: 5 justas, la barra sin «Más».
  var SEG = SECCIONES.seguimiento.config, MAR = SECCIONES.clientes.config;
  SECCIONES = {
    hoy: { modulo: 'listado', titulo: 'Hoy', icono: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      config: mezcla(SEG, { TEXTO: 'Lo que tienes por hacer.', VISTAS: SEG.VISTAS.filter(function (v) { return v.id === 'HOY'; }), _refs: refsDesde('SEGUIMIENTO') }) },
    seguimiento: SECCIONES.seguimiento,
    clientes: SECCIONES.clientes,
    prospeccion: { modulo: 'listado', titulo: 'Prospección', icono: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8v6M8 11h6"/>',
      config: mezcla(MAR, { TEXTO: 'Marcas, tiendas y editores a los que escribir o que ya has contactado.', FILAS: ['marca', 'marcas'], VACIO: 'No hay marcas en prospección.',
        VISTAS: MAR.VISTAS.filter(function (v) { return v.id === 'PROSPECCION' || v.id === 'TODAS'; }), _refs: refsDesde('MARCAS') }) },
    proveedores: SECCIONES.proveedores,
    telas: SECCIONES.telas
  };
  // Las tablas de lo relacionado y de los «de», con sus referencias (como montar.js: lo que se lee, dos saltos).
  Object.keys(SECCIONES).forEach(function (n) {
    var c = SECCIONES[n].config;
    var mas = (c.RELACIONADOS || []).map(function (r) { return r.tabla; }).concat(Object.keys(c.CAMPOS || {}).map(function (k) { return c.CAMPOS[k].de && c.CAMPOS[k].de.tabla; }).filter(Boolean));
    (c.RELACIONADOS || []).forEach(function (r) { Object.keys(r.campos || {}).forEach(function (k) { var de = r.campos[k].de; if (de && de.tabla) mas.push(de.tabla); }); }); // T0641
    mas.forEach(function (t) { var x = refsDesde(t); Object.keys(x).forEach(function (k) { c._refs[k] = c._refs[k] || x[k]; }); });
  });

  // T0662 · Lo que la sección no dice llega a la web con el defecto de motor/modulos/listado/modulo.json, como lo monta
  // montar.js (RAPIDAS, ALTA y CONTEXTO, {}): así se ve aquí lo mismo que en la app de verdad. probar-listado.js comprueba que son esos.
  var DEFECTOS = {"TABLA":"","CLAVE":"ID","CODIGO":"","NOMBRE":"","COLUMNAS":[],"DETALLE":[],"ORDEN":"","FILTRO":[],"BUSCAR":[],"CAMPOS":{},"FICHA":[],"RELACIONADOS":[],"VISTAS":[],"AVISOS":[],"EDITAR":[],"CREAR":false,"NUEVO_ID":"","BORRAR":{},"ACCIONES":[],"GUARDAR":"solo","MIAS":{},"NUEVA":{},"RAPIDAS":{},"ALTA":{},"DEDUCIR":{},"CONTEXTO":{},"RESUMEN":{},"ARRIBA":[],"OBLIGATORIAS":[],"FILTROS":[],"TEXTO":"","FILAS":[],"VACIO":"","ANTIGUO":false,"VALORES":{},"PROHIBIDO":["CONTRASENA","CUENTA","DNI"],"SOLO_LEER":[],"PERSONALIZAN":[],"VENTAS":{},"PREFERENCIAS":""};
  Object.keys(SECCIONES).forEach(function (n) {
    var c = SECCIONES[n].config;
    Object.keys(DEFECTOS).forEach(function (k) { if (!(k in c)) c[k] = JSON.parse(JSON.stringify(DEFECTOS[k])); });
  });

  // T0672 · El aviso de arriba, como en la app de Marta (nucleo.aviso), y una sección sin él ("": Mis telas), para ver que
  // cambia al pasar de una sección a otra. En su app, Economía lleva el suyo («Aquí sí se guarda…»; npm run local -- telas).
  SECCIONES.telas.aviso = '';
  // T0717 · La ayudante solo mira Clientes (SOLO_LEER): la ve entera, sin nada que cambie; Prospección y Seguimiento, sí los cambia.
  SECCIONES.clientes.config.SOLO_LEER = ['Ayudante'];
  var E = { nucleo: { perfiles: ['Dueña', 'Ayudante'], aviso: 'Esto es una prueba: lo que cambies aquí no se guarda. Tu Excel sigue mandando.', secciones: SECCIONES }, tablas: TABLAS, refs: REFS, defectos: DEFECTOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  if (typeof window !== 'undefined') window.LISTADO_EJEMPLO = E;
})();
