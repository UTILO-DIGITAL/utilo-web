/*
 * Sección Gestión de la app (T0139 · Konamigas). La carga kanban4/app.js cuando el perfil tiene GESTION (solo socios).
 * Lee y edita el Excel GESTION a través del motor del negocio (módulo privado gestion de UTILO_CORE, T0206), con la llave de la persona.
 * T0207: las fotos que no se subieron ni se eligieron desde la app no se pueden previsualizar: se abren en Drive.
 * Contrato con app.js (igual que Economía):
 *   window.SX_CTX = { api, persona, clave, color, accion }   (T0207 · kanban4: sin PIN; la llave de Google la pone google.js)
 *   window.SX_MOD.GESTION.abrir(elemento)  → pinta la sección dentro del elemento.
 * Se carga una TEMPORADA entera (todas sus competiciones) y se filtra por competición y liga.
 * Resumen: como la hoja RESUMEN, por día y liga (desplegables, con el gestor y su WhatsApp): equipos por nivel, color, capitana,
 *   jugadoras y pagos. Los KPIs llevan a su pestaña ya filtrada; Alertas junta pagos, problemas de inscripción y jugadoras con alerta.
 * T0142 · Equipos: filtros (sin liga, por pagar, avisos, buscan equipo, error); ficha con liga, nivel, asignado, color, fechas
 *   límite y casillas de seguimiento, fotos del equipo y los WhatsApp que ya prepara el Excel.
 * T0143 · Jugadoras: por equipo, con sus alertas; se corrigen los datos del formulario, se marcan ERROR, G.CONTACTS y XPORTY
 *   y se cambia de equipo. Buscar mira en toda la temporada (también ERROR); con un correo, «todo lo de este correo».
 * T0234 · Camisetas: lo que falta por entregar, por estado y por equipo, y marcar cada camiseta (Preparada, Entregada, No llegó,
 *   Defectuosa). El estado es ESTADO CAMISETA de GESTION (la misma fórmula que DB_CAMISETAS del Excel CAMISETAS) y el reparto,
 *   REPARTO: la app no los calcula. Marcar escribe MARCA CAMISETA.
 * T0240 · Camisetas › Stock y Pedidos, de solo lectura, del Excel CAMISETAS (módulo privado camisetas, camisetasDatos): libres
 *   o en el local por modelo, color y dorsal-talla (en el ordenador, un cuadro como el de CAMISETAS; en el móvil, una tarjeta por
 *   color) y cada pedido con su paso. Hacer pedidos y el recuento siguen en el menú «Camisetas» del Excel.
 * T0246 · Camisetas por modelo: Stock y Pedidos se eligen por modelo, sin temporada (el modelo es de la competición y sus
 *   camisetas sirven a todas las competiciones que lo llevan, de cualquier temporada); Entregas sigue por temporada. Marca nueva
 *   «Sin camiseta»: no se le hará (ni se pide ni guarda una del local) y no cuenta como pendiente.
 * T0235 · Equipos, Jugadoras y, dentro de cada equipo, Camisetas van por orden de inscripción (Marca temporal de GESTION),
 *   de la más antigua a la más reciente, con las de ERROR en su sitio: así se ve una inscripción mal hecha y la que la corrige.
 * T0237 · Alertas › Camisetas: un equipo por línea con lo que pide hacer algo (repartir hoy, reparto pasado, preparadas sin
 *   partido, por pedir), de ALERTA CAMISETA de GESTION; lleva a Camisetas › Para hacer de ese equipo. ALERTA y REVISAR ya solo
 *   traen problemas de inscripción. En la lista de alertas el detalle va debajo del nombre, entero.
 * WhatsApp: en el móvil se abre la app (whatsapp://); en el ordenador, WhatsApp Web.
 * Mismo estilo que Economía (se copia de economia.js con el prefijo gs-). Cada cambio queda en GESTION › LOG_APP.
 */
(function () {
  'use strict';
  var M = window.SX_MOD = window.SX_MOD || {};
  if (M.GESTION) return;

  // temp: temporada cargada (todas sus competiciones); fComp y fLiga: filtros de la app; dia: día elegido en Resumen.
  var S = { tab: 'resumen', temp: '', fComp: '', fLiga: '', dia: '', datos: {}, opciones: null, el: null,
    eq: { filtro: 'todos', q: '' }, jug: { filtro: 'todas', q: '', equipo: '' }, cam: { filtro: 'pendientes', q: '', todo: {}, equipo: '' },
    // T0240: Camisetas › Entregas (de GESTION), Stock y Pedidos (del Excel CAMISETAS)
    cs: { vista: 'entregas', modelo: '', ver: 'libres', ped: 'marcha' } };

  function ctx() { return window.SX_CTX || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /** T0207 · UTILO_CORE: con la llave de Google de la persona (google.js · UG.seccion), que pide conectar el Excel si falta. */
  function llamar(fn, args) {
    var c = ctx();
    return window.UG.seccion(c.api, { fn: fn, args: args || [] }, c.clave);
  }

  /* ---------- estilos (T0149 · PROTOCOLO DISEÑO UTILO) ----------
   * Solo variables de [negocio]/marca.css y estilos/base.css: ningún color, letra ni radio escrito aquí.
   * Los botones, campos y ventanas se ven como los del tablero (estilos/kanban.css); los campos los pone base.css.
   * Los alias --gs-* siguen para los estilos que van en el propio HTML. */
  function css() {
    return '.gs{--gs-c:var(--color-principal);--gs-a:var(--color-accion);--gs-v:var(--color-bien);--gs-r:var(--color-error);' +
      '--gs-g:var(--color-suave);--gs-l:var(--color-linea);--gs-f:var(--color-tarjeta-cab,var(--color-bloque));--gs-am:var(--estado-pr);' +
      'font:400 14px/1.45 var(--fuente-texto);color:var(--color-texto)}' +
      '.gs *{box-sizing:border-box}.gs button{font-family:var(--fuente-texto)}' +
      'html.gs-sin-scroll,html.gs-sin-scroll body{overflow:hidden}' +
      // Cabecera como la del tablero: título, versión y «Pedir algo a Utilo» en una línea; debajo, la hora y las pestañas.
      '.gs-cab{background:var(--color-principal);color:var(--color-sobre-principal);padding:var(--e3) var(--e4) 0;display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2) var(--e3)}' +
      '.gs-cab h1{order:-1;flex:1 1 auto;min-width:0;margin:0;font:var(--peso-titulos) 24px/1.2 var(--fuente-titulos);color:var(--color-sobre-principal);display:flex;align-items:baseline;flex-wrap:wrap;gap:0 var(--e3)}' +
      '.gs-pint{font:400 22px/1.1 var(--fuente-destacar,var(--fuente-titulos));color:var(--color-destacado);transform:rotate(-3deg);display:inline-block}' +
      '.gs-cab>p{flex:1 1 100%;margin:0;font-size:13px;display:flex;align-items:center;gap:var(--e2);font-variant-numeric:tabular-nums}' +
      '.gs-re{min-width:44px;min-height:36px;background:transparent;border:0;color:inherit;font-size:18px;padding:0;cursor:pointer}.gs-re:disabled{opacity:.5;cursor:wait}' +
      '.gs-ver,.gs-sol{min-height:36px;padding:0 var(--e3);border:0;border-radius:var(--radio);background:var(--color-fondo);color:var(--color-principal-oscuro);' +
      'font:700 14px/1 var(--fuente-texto);cursor:pointer;display:inline-flex;align-items:center;gap:var(--e2);font-variant-numeric:tabular-nums}' +
      '.gs-sol{width:44px;padding:0;justify-content:center}.gs-sol svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}' +
      '.gs-tabs{flex:1 1 100%;display:flex;gap:2px;margin:0 calc(-1 * var(--e4));padding:0 var(--e2);overflow-x:auto;scrollbar-width:none}.gs-tabs::-webkit-scrollbar{display:none}' +
      '.gs-tabs button{flex:0 0 auto;min-height:44px;background:transparent;border:0;color:var(--color-sobre-principal);opacity:.75;font:700 14px/1 var(--fuente-texto);padding:0 var(--e3);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}' +
      '.gs-tabs button[aria-selected=true]{opacity:1;border-bottom-color:var(--color-destacado)}' +
      '.gs-tabs .gs-n{display:inline-block;min-width:20px;padding:2px var(--e1);margin-left:var(--e1);border-radius:var(--radio-peq);background:var(--color-destacado);color:var(--color-texto);font-size:12px;text-align:center;font-variant-numeric:tabular-nums}' +
      // T0225: junto al menú del ordenador, la cabecera va sobre el fondo de la página (el color de la marca es el menú, base.css).
      '@media(min-width:900px){body.u-con-barra .gs-cab{background:var(--color-fondo);color:var(--color-texto);border-bottom:1px solid var(--color-linea)}' +
      'body.u-con-barra .gs-cab h1,body.u-con-barra .gs-pint{color:var(--color-principal-oscuro)}body.u-con-barra .gs-cab>p{color:var(--color-suave)}' +
      'body.u-con-barra .gs-ver,body.u-con-barra .gs-sol{background:transparent;border:1.5px solid var(--color-principal-oscuro)}' +
      'body.u-con-barra .gs-tabs button{color:var(--color-suave);opacity:1}body.u-con-barra .gs-tabs button[aria-selected=true]{color:var(--color-principal-oscuro);border-bottom-color:var(--color-principal-oscuro)}' +
      'body.u-con-barra .gs-tabs .gs-n{background:var(--gs-f)}}' +
      '.gs-main{max-width:760px;margin:0 auto;padding:var(--e4) var(--e4) 120px}' +
      '.gs-fila{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center}' +
      // Campos: los de base.css (.u input, .u select). Aquí solo el ancho.
      '.gs input[type=date]{-webkit-appearance:none;appearance:none;width:100%}' +
      '.gs textarea{width:100%}' +
      '.gs-sel{flex:1 1 140px}' +
      '.gs-card{background:var(--color-tarjeta,var(--color-superficie));border:1px solid var(--gs-l);border-radius:var(--radio);padding:var(--e3) var(--e4);margin-top:var(--e3)}' +
      '.gs-av{margin-top:var(--e4)}.gs-av-t{display:flex;justify-content:space-between;gap:var(--e2);font-size:13px;color:var(--gs-g);font-weight:600}' +
      '.gs-barra{height:8px;border-radius:var(--radio-peq);background:var(--gs-l);overflow:hidden;margin-top:var(--e2)}.gs-barra i{display:block;height:100%;background:var(--gs-c)}' +
      '.gs-kpis{display:grid;grid-template-columns:1fr 1fr;gap:var(--e2);margin-top:var(--e4)}' +
      '.gs-kpi{background:var(--gs-f);border-radius:var(--radio);padding:var(--e3) var(--e4)}' +
      '.gs-kpi.gs-grande{grid-column:1/-1;background:var(--gs-c);color:var(--color-sobre-principal)}' +
      '.gs-kpi b{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;color:var(--gs-g)}.gs-kpi.gs-grande b{color:inherit}' +
      '.gs-kpi .gs-val{display:block;font:var(--peso-titulos) 22px/1.2 var(--fuente-titulos);margin-top:var(--e1);font-variant-numeric:tabular-nums}' +
      '.gs-kpi.gs-grande .gs-val{font-size:30px;color:var(--color-destacado)}' +
      '.gs-kpi span.gs-sub{display:block;font-size:13px;margin-top:var(--e1)}' +
      '.gs-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--e2);margin-top:var(--e2)}' +
      '.gs-mini button,.gs-mini div{background:var(--gs-f);border:0;border-radius:var(--radio);padding:var(--e2);text-align:center;color:inherit}' +
      '.gs-mini b{display:block;font:var(--peso-titulos) 20px/1.2 var(--fuente-titulos);font-variant-numeric:tabular-nums}.gs-mini small{font-size:12px;color:var(--gs-g);font-weight:600}' +
      '.gs-mini button{cursor:pointer;min-height:44px}.gs-mini button.gs-alerta b{color:var(--gs-r)}' +
      '.gs .gs-h2{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--color-principal-oscuro);margin:var(--e5) 0 var(--e1);font-weight:700;font-family:var(--fuente-texto)}' +
      '.gs-pos{color:var(--gs-v)}.gs-neg{color:var(--gs-r)}.gs-amb{color:var(--gs-am)}.gs-kpi.gs-grande .gs-pos,.gs-kpi.gs-grande .gs-neg{color:inherit}' +
      '.gs-grupo{border-top:1px solid var(--gs-l)}.gs-grupo:first-of-type{border-top:0}' +
      '.gs-gb{display:block;width:100%;background:none;border:0;color:inherit;text-align:left;padding:var(--e3) 0;cursor:pointer;font-size:14px}' +
      '.gs-gl{display:flex;justify-content:space-between;gap:var(--e2);align-items:baseline}.gs-gl b{font-size:15px;font-weight:700}' +
      '.gs-gl .gs-num{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}' +
      '.gs-gs{display:flex;justify-content:space-between;gap:var(--e2);font-size:13px;color:var(--gs-g);margin-top:var(--e1)}' +
      '.gs-gb .gs-barra{height:6px}.gs-barra i.gs-mal{background:var(--gs-r)}' +
      '.gs-flecha{display:inline-block;width:14px;color:var(--gs-g);transition:transform .15s}.gs-gb[aria-expanded=true] .gs-flecha{transform:rotate(90deg)}' +
      '.gs-lineas{padding:0 0 var(--e2) var(--e4)}' +
      '.gs-linea{display:block;width:100%;background:none;border:0;border-top:1px solid var(--gs-l);color:inherit;text-align:left;font-size:14px;padding:var(--e2) 0;cursor:pointer}' +
      '.gs-linea .gs-gl b{font-size:14px;font-weight:600}.gs-linea .gs-barra{height:4px;margin-top:var(--e1)}.gs-linea .gs-gs{font-size:12px}.gs-linea .gs-ir{color:var(--color-principal-oscuro);font-weight:700}' +
      '.gs-gs b{font-weight:700}' +
      '.gs-avd summary{list-style:none;cursor:pointer}.gs-avd summary::-webkit-details-marker{display:none}.gs-avd[open] summary .gs-flecha{transform:rotate(90deg)}' +
      '.gs-avc{margin:var(--e2) 0 0 var(--e4)}.gs-avc .gs-av-t{font-size:13px}.gs-avc .gs-barra{height:5px;margin-top:var(--e1)}' +
      '.gs-socio{display:flex;justify-content:space-between;gap:var(--e2);padding:var(--e1) 0 var(--e1) var(--e4);font-size:13px;color:var(--gs-g)}.gs-socio span:last-child{font-variant-numeric:tabular-nums}' +
      '.gs-rep{padding:0 var(--e4)}.gs-rep summary{list-style:none;cursor:pointer;padding:var(--e3) 0;display:flex;justify-content:space-between;gap:var(--e2);align-items:center;font-size:14px}' +
      '.gs-rep summary::-webkit-details-marker{display:none}.gs-rep summary b{font-weight:700}.gs-rep[open] summary .gs-flecha{transform:rotate(90deg)}' +
      '.gs-rep summary span:last-child{color:var(--gs-g);font-size:13px;white-space:nowrap}' +
      '.gs-rf{display:flex;justify-content:space-between;gap:var(--e2);padding:var(--e2) 0;border-top:1px solid var(--gs-l);font-size:14px}.gs-rf span:last-child{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.gs-rf.gs-tot{font-weight:700}.gs-rf small{display:block;color:var(--gs-g);font-size:12px;font-weight:400}' +
      // Avisos: franja de 4 px con el color del aviso, sin sombra.
      '.gs-av2{border:1px solid var(--gs-l);border-left:4px solid var(--gs-r);padding:var(--e3);background:var(--color-superficie);border-radius:var(--radio);margin-top:var(--e2)}' +
      '.gs-av2.gs-amb{border-left-color:var(--gs-am);color:inherit}.gs-av2.gs-inf{border-left-color:var(--gs-c)}' +
      '.gs-av2 b{display:block;font-size:15px}.gs-av2 p{margin:var(--e1) 0 0;font-size:14px}.gs-av2 .gs-a{display:inline-block;margin-top:var(--e2)}' +
      '.gs-pl{padding:var(--e2) 0;border-top:1px solid var(--gs-l)}.gs-pl:first-child{border-top:0}.gs-pl .gs-gs{font-size:12px}' +
      '.gs-pl .gs-org{font-size:12px;color:var(--gs-g);margin-top:var(--e1)}' +
      // Listas: filas separadas por una línea, cifras alineadas a la derecha.
      '.gs-lista{list-style:none;margin:0;padding:0}.gs-item{display:flex;justify-content:space-between;gap:var(--e3);padding:var(--e3) 0;border-top:1px solid var(--gs-l);align-items:center}' +
      '.gs-item:first-child{border-top:0}.gs-item .gs-t{font-weight:700;font-size:15px}.gs-item .gs-s{font-size:13px;color:var(--gs-g);margin-top:2px}' +
      '.gs-item .gs-d{text-align:right;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      // T0235: una inscripción con ERROR no cuenta: fondo rojizo y raya roja, en la lista y en la tabla.
      '.gs-item.gs-err{background:color-mix(in srgb,var(--gs-r) 13%,var(--color-superficie));border-left:4px solid var(--gs-r);padding-left:var(--e3);padding-right:var(--e3);border-radius:var(--radio)}' +
      '.gs-tabla tr.gs-err td{background:color-mix(in srgb,var(--gs-r) 13%,var(--color-superficie))}.gs-tabla tr.gs-err td:first-child{box-shadow:inset 4px 0 0 var(--gs-r)}' +
      '.gs-tabla tr.gs-err:hover td{background:color-mix(in srgb,var(--gs-r) 19%,var(--color-superficie))}' +
      '.gs-tag.gs-tag-err{background:var(--gs-r);border:1px solid var(--gs-r);color:var(--color-superficie)}' +
      '.gs-alta{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--gs-g)}.gs-s .gs-alta{opacity:.75;font-size:.92em}' +
      'button.gs-item{width:100%;background:none;border:0;border-top:1px solid var(--gs-l);color:inherit;text-align:left;cursor:pointer}' +
      '.gs-borrado .gs-t,.gs-borrado .gs-d{text-decoration:line-through;opacity:.6}' +
      // Filtros en botones (como los del tablero) y etiquetas pequeñas.
      '.gs-chips{display:flex;gap:var(--e2);flex-wrap:wrap;margin-top:var(--e1)}' +
      '.gs-chip{min-height:40px;border:1.5px solid var(--color-borde-campo);background:var(--color-superficie);border-radius:var(--radio);padding:0 var(--e3);font:600 14px/1 var(--fuente-texto);color:inherit;cursor:pointer;font-variant-numeric:tabular-nums}' +
      '.gs-chip[aria-pressed=true]{background:var(--gs-c);border-color:var(--gs-c);color:var(--color-sobre-principal)}' +
      '.gs-tag{display:inline-flex;align-items:center;gap:var(--e1);padding:1px var(--e2);border-radius:var(--radio-peq);background:var(--gs-f);color:var(--color-texto);font:700 12px/1.6 var(--fuente-texto)}' +
      '.gs-tag svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
      '.gs-tag-g{background:transparent;border:1px solid var(--gs-l);color:var(--gs-g)}' +
      '.gs-a{color:var(--color-principal-oscuro);font-weight:700;font-size:13px}' +
      '.gs-volver{background:none;border:0;color:var(--color-principal-oscuro);font:700 15px/1 var(--fuente-texto);min-height:44px;padding:0;cursor:pointer}' +
      '.gs-liga .gs-gl b{font-size:15px}.gs-liga .gs-cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--e2);margin-top:var(--e2);font-size:12px;color:var(--gs-g)}' +
      '.gs-liga .gs-cifras b{display:block;color:var(--color-texto);font-size:14px;font-variant-numeric:tabular-nums}' +
      '.gs-vacio{color:var(--gs-g);padding:var(--e6) var(--e2);text-align:center}' +
      '.gs-cargando{text-align:center;color:var(--gs-g);padding:var(--e7) var(--e2);display:flex;flex-direction:column;gap:var(--e3)}' +
      '.gs-error{border:1px solid var(--gs-r);border-left-width:4px;color:var(--gs-r);background:var(--color-superficie);font-weight:700;border-radius:var(--radio);padding:var(--e3);margin-top:var(--e3)}' +
      // Botón de añadir: el mismo que «Añadir tarea» del tablero (lo único que flota, con sombra).
      '.gs-fab{position:fixed;right:var(--e4);bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:44;min-height:52px;padding:0 var(--e5);border:0;border-radius:var(--radio);' +
      'background:var(--gs-a);color:var(--color-sobre-accion);font:800 19px/1 var(--fuente-texto);box-shadow:var(--sombra-flota);cursor:pointer}' +
      // Ventanas: como «Nueva tarea» del tablero.
      '.gs-velo{position:fixed;inset:0;z-index:60;background:var(--color-velo);display:flex;align-items:flex-start;justify-content:center;padding:6vh var(--e3);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.gs-hoja{background:var(--color-fondo);color:var(--color-texto);width:100%;max-width:560px;border-radius:var(--radio);padding:var(--e5);font-size:15px;margin-bottom:var(--e5);box-shadow:var(--sombra-flota)}' +
      '.gs-hoja h2{margin:0 0 var(--e3);font:var(--peso-titulos) 24px/1.2 var(--fuente-titulos);color:var(--color-principal-oscuro);display:flex;justify-content:space-between;align-items:flex-start;gap:var(--e2)}' +
      '.gs-x{flex:none;width:44px;height:44px;margin:-10px -10px 0 0;background:none;border:0;font-size:28px;line-height:1;cursor:pointer;color:var(--gs-g);padding:0}' +
      '.gs-sw{display:grid;grid-template-columns:1fr 1fr;gap:var(--e1);background:var(--gs-f);padding:var(--e1);border-radius:var(--radio)}' +
      '.gs-sw button{min-height:44px;border:1px solid transparent;border-radius:var(--radio-peq);font:700 15px/1 var(--fuente-texto);background:transparent;color:var(--gs-g);cursor:pointer}' +
      '.gs-sw button[aria-pressed=true]{background:var(--color-superficie);border-color:var(--gs-l);color:var(--color-texto)}' +
      '.gs-sw button[aria-pressed=true].gs-in{color:var(--gs-v)}.gs-sw button[aria-pressed=true].gs-out{color:var(--gs-r)}' +
      '.gs-campo{display:block;margin-top:var(--e3);font:700 12px/1.3 var(--fuente-texto);color:var(--color-principal-oscuro);text-transform:uppercase;letter-spacing:.02em;min-width:0}' +
      '.gs-campo>select,.gs-campo>input,.gs-campo>textarea{display:block;width:100%;margin-top:var(--e1);text-transform:none;letter-spacing:0}' +
      '.gs-opc{font-weight:400;color:var(--gs-g);text-transform:none;letter-spacing:0}' +
      '.gs-dos{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--e3)}' +
      '.gs-check{display:flex;align-items:center;gap:var(--e2);margin-top:var(--e3);font-weight:600;font-size:15px;min-height:32px}.gs-check input{flex:none}' +
      '.gs .gs-imp{font-size:24px!important;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}' +
      '.gs-acc{display:flex;justify-content:flex-end;gap:var(--e2);flex-wrap:wrap;margin-top:var(--e4)}' +
      // Un solo botón con el color de acción por pantalla (-b1); los demás, con contorno (-b2).
      '.gs-b1,.gs-b2{display:inline-flex;align-items:center;justify-content:center;gap:var(--e2);min-height:44px;border-radius:var(--radio);cursor:pointer;text-decoration:none}' +
      '.gs-b1{background:var(--gs-a);color:var(--color-sobre-accion);border:0;padding:0 var(--e5);font:800 17px/1.2 var(--fuente-texto)}.gs-b1:disabled,.gs-b2:disabled{opacity:.6;cursor:default}' +
      '.gs-b1r{background:var(--gs-r);color:var(--color-superficie)}' +
      '.gs-b2{background:transparent;color:var(--color-principal-oscuro);border:1.5px solid var(--color-principal-oscuro);padding:0 var(--e4);font:700 15px/1.2 var(--fuente-texto)}.gs-b2r{color:var(--gs-r);border-color:var(--gs-r)}' +
      '.gs-subir{display:flex;width:100%;margin-top:var(--e3)}' +
      '.gs-flist{margin-top:var(--e2);max-height:46vh;overflow:auto}' +
      '.gs-dimp{font:var(--peso-titulos) 30px/1.2 var(--fuente-titulos);margin:0 0 var(--e2);font-variant-numeric:tabular-nums}' +
      '.gs-dl{border-top:1px solid var(--gs-l)}.gs-df{display:flex;justify-content:space-between;gap:var(--e3);padding:var(--e2) 0;border-bottom:1px solid var(--gs-l);font-size:14px}' +
      '.gs-df span:first-child{color:var(--gs-g);flex:none}.gs-df span:last-child{text-align:right;font-weight:600;word-break:break-word}' +
      '.gs-dtx{margin-top:var(--e3);font-size:14px}.gs-dtx p{margin:var(--e1) 0 0;white-space:pre-wrap}' +
      '.gs-dhist{margin-top:var(--e3)}.gs-dhist summary{cursor:pointer;color:var(--color-principal-oscuro);font-weight:700;font-size:14px;min-height:32px}' +
      '.gs-dhist pre{white-space:pre-wrap;font:400 13px/1.45 var(--fuente-texto);color:var(--gs-g);margin:var(--e1) 0 0;background:var(--gs-f);padding:var(--e2) var(--e3);border-radius:var(--radio-peq)}' +
      '.gs-aviso{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(136px + env(safe-area-inset-bottom,0px));z-index:70;background:var(--color-texto);color:var(--color-fondo);' +
      'border-radius:var(--radio);padding:var(--e3) var(--e4);font:600 15px/1.4 var(--fuente-texto);max-width:calc(100% - var(--e6));box-shadow:var(--sombra-flota)}' +
      '@media(min-width:620px){.gs-kpis{grid-template-columns:repeat(3,1fr)}.gs-kpi.gs-grande{grid-column:auto}}' +
      '@media(max-width:640px){.gs-velo{padding:0}.gs-hoja{border-radius:0;min-height:100%;max-width:none;margin:0}}' +
      '@media(min-width:900px){.gs-fab{bottom:var(--e4)}.gs-aviso{bottom:84px}.gs-main{padding-bottom:var(--e7)}}' +
      // T0225: en el ordenador, todo el ancho junto al menú; las listas que se comparan van en tabla (base.css · u-tabla).
      '.gs-aviso{left:calc(50% + var(--medio-menu, 0px))}' +
      '@media(min-width:900px){.gs-cab{padding-left:var(--e5);padding-right:var(--e5)}.gs-tabs{margin:0 calc(-1 * var(--e5));padding:0 var(--e3)}' +
      '.gs-main{max-width:none;margin:0;padding:var(--e5) var(--e5) var(--e7)}.gs-main>.gs-fila{max-width:760px}' +
      // T0233: en Resumen, los KPIs junto a Alertas, y los días en columnas con sus ligas una debajo de otra (los filtros, como en Equipos: T0238).
      '.gs-res-top{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:var(--e3);align-items:start;margin-top:var(--e3)}' +
      '.gs-res-top>.gs-mini{margin-top:0!important;grid-template-columns:repeat(2,1fr)!important}.gs-res-top>.gs-alts{margin-top:0}' +
      '.gs-semana{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:0 var(--e4);align-items:start}' +
      '.gs-semana .gs-ligas{display:block;margin-top:0}.gs-semana .gs-ligas>.gs-liga{margin-top:var(--e3)}' +
      '.gs-tabla{margin-top:var(--e3)}.gs-tabla .gs-tags{margin-top:0}.gs-tabla .gs-color{margin-right:var(--e2)}' +
      // T0232: en Equipos y Jugadoras, los desplegables y el buscador en una fila que ocupa todo el ancho; los botones de filtro, debajo.
      '.gs-filtrar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2)}.gs-filtrar>.gs-filtros,.gs-filtrar>.gs-fila,.gs-filtrar>.gs-mas,.gs-mas>.gs-filtros,.gs-mas>.gs-fila{display:contents}' +
      '.gs-fbtn,.gs-puestos{display:none!important}' +
      '.gs-filtrar .gs-sel{flex:1 1 200px;min-width:200px;max-width:280px}.gs-filtrar #gs-temp{flex:0 0 112px;min-width:0}' +
      '.gs-filtrar input[type=search]{order:1;flex:2 1 260px;min-width:260px;max-width:none}.gs-filtrar>.gs-chips{order:2;flex:1 1 100%;margin-top:var(--e1)!important}}';
  }
  /** T0225: en el ordenador (desde 900 px) las listas van en tabla; en el móvil, la lista de siempre. */
  var ANCHO = window.matchMedia ? matchMedia('(min-width:900px)') : { matches: false };
  function ancho() { return ANCHO.matches; }

  /** T0149: icono de «Pedir algo a Utilo» (bocadillo), del mismo juego que la barra de secciones. */
  var ICONO_SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
  /** T0149: palabra en Permanent Marker de la cabecera (recurso propio de la marca): la temporada. */
  function pintada(t) { var x = S.el && S.el.querySelector('#gs-pint'); if (x && t) { x.textContent = t; x.hidden = false; } }


  /** Lo que solo tiene Gestión (resumen por día y liga, alertas, fichas de equipo y jugadora). Mismas reglas que css(). */
  function cssExtra() {
    return '.gs-sec{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--color-principal-oscuro);margin:var(--e4) 0 2px;font-weight:700}' +
      '.gs-btns{display:flex;gap:var(--e2);flex-wrap:wrap;margin:2px 0 var(--e2)}.gs-btns a,.gs-btns button{font-size:14px}' +
      '.gs-tags{display:flex;gap:var(--e1);flex-wrap:wrap;margin-top:var(--e1)}' +
      '.gs-tag-r{background:transparent;border:1px solid var(--gs-r);color:var(--gs-r)}.gs-tag-v{background:transparent;border:1px solid var(--gs-v);color:var(--gs-v)}' +
      '.gs-tag-a{background:transparent;border:1px solid var(--gs-am);color:var(--gs-am)}' +
      '.gs-al{border:1px solid var(--gs-l);border-left:4px solid var(--gs-am);background:var(--color-superficie);border-radius:var(--radio);padding:var(--e3);margin:var(--e1) 0 var(--e2);font-size:14px}' +
      '.gs-al p{margin:0 0 var(--e1)}.gs-al p:last-child{margin:0}' +
      '.gs-nota{font-size:13px;color:var(--gs-g);font-weight:400;margin-top:var(--e1);text-transform:none;letter-spacing:0}' +
      '.gs-mas{text-align:center;color:var(--gs-g);font-size:13px;padding:var(--e3) 0 2px}' +
      // Color de la camiseta del equipo: es un dato, no un adorno.
      '.gs-color{display:inline-block;width:13px;height:13px;border-radius:50%;border:1px solid var(--color-borde-campo);vertical-align:-2px;margin-right:var(--e2);flex:none}' +
      '.gs-pie{position:sticky;bottom:calc(-1 * var(--e5));background:var(--color-fondo);padding:var(--e3) 0 var(--e1);margin-top:var(--e2);border-top:1px solid var(--gs-l)}' +
      '.gs-checks .gs-check{margin-top:var(--e2)}' +
      '.gs-filtros{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--e2)}.gs-filtros select{width:100%}' +
      '@media(max-width:520px){.gs-filtros{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.gs-filtros select:first-child{grid-column:1/-1}}' +
      '.gs-aviso-b{font-size:13px;color:var(--gs-g);margin:var(--e2) 0 0}' +
      '.gs-dias{display:flex;gap:var(--e2);flex-wrap:wrap;margin-top:var(--e2)}' +
      '.gs-liga-t{display:flex;justify-content:space-between;gap:var(--e2);align-items:baseline}.gs-liga-t b{font-size:15px}.gs-liga-t span{font-size:13px;color:var(--gs-g)}' +
      '.gs-eqr{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:var(--e1) var(--e2);align-items:center;width:100%;background:none;border:0;border-top:1px solid var(--gs-l);padding:var(--e2) 0;min-height:44px;text-align:left;color:inherit;cursor:pointer;font-size:14px}' +
      '.gs-eqr .gs-n{font-weight:700;font-size:12px;background:var(--gs-f);border-radius:var(--radio-peq);padding:2px var(--e1);text-align:center;min-width:24px;font-variant-numeric:tabular-nums}' +
      '.gs-eqr b{display:flex;align-items:center;min-width:0}.gs-eqr b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.gs-eqr small{grid-column:2/4;color:var(--gs-g);font-size:13px}' +
      '.gs-eqr .gs-pag{font-size:13px;font-weight:700;white-space:nowrap}' +
      // T0238: la cabecera de cada liga va en el color de bloque (en Konamigas, desde T0237, el azul de --color-tarjeta-cab), para que se distinga del fondo.
      '.gs-liga{padding:0;overflow:hidden;border-color:var(--color-borde-campo)}.gs-liga[open]{padding-bottom:var(--e1)}' +
      '.gs-liga summary{list-style:none;cursor:pointer;position:relative;padding:var(--e3) calc(var(--e4) + 28px) var(--e3) var(--e4);background:var(--gs-f)}.gs-liga summary::-webkit-details-marker{display:none}' +
      '.gs-liga summary:after{content:"\\25BE";position:absolute;right:var(--e4);top:var(--e3);font-size:20px;color:var(--color-principal-oscuro);transition:transform .15s}.gs-liga[open] summary:after{transform:rotate(180deg)}' +
      '.gs-liga[open] summary{border-bottom:1px solid var(--color-borde-campo)}.gs-liga>.gs-eqr{width:calc(100% - 2 * var(--e4));margin:0 var(--e4)}.gs-liga summary+.gs-eqr{border-top:0}' +
      '.gs-liga .gs-wa{background:var(--color-superficie)}' +
      '.gs-liga-n{font:var(--peso-titulos) 20px/1.2 var(--fuente-titulos);color:var(--color-principal-oscuro)}' +
      '.gs-liga-n small{display:block;font:700 12px/1.3 var(--fuente-texto);letter-spacing:.04em;text-transform:uppercase;color:var(--gs-g);margin-bottom:2px}' +
      '.gs-liga-g{display:flex;align-items:center;gap:var(--e2);flex-wrap:wrap;margin-top:var(--e2);font-size:14px}' +
      '.gs-wa{display:inline-flex;align-items:center;min-height:36px;padding:0 var(--e3);border-radius:var(--radio);border:1.5px solid var(--color-principal-oscuro);color:var(--color-principal-oscuro);text-decoration:none;font:700 13px/1 var(--fuente-texto)}' +
      '.gs-liga-s{font-size:13px;color:var(--gs-g);margin-top:var(--e1)}' +
      '.gs-alts{padding-top:var(--e3);padding-bottom:var(--e2)}.gs-alts-t{font:var(--peso-titulos) 16px/1.2 var(--fuente-titulos);margin-bottom:var(--e1)}' +
      '.gs-alt{border-top:1px solid var(--gs-l);padding:var(--e2) 0}.gs-alt summary{display:flex;justify-content:space-between;gap:var(--e2);cursor:pointer;list-style:none;font-size:15px;min-height:32px;align-items:center}' +
      '.gs-alt summary::-webkit-details-marker{display:none}.gs-alt summary em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums}.gs-alt[data-gs-vacio] summary{cursor:default;color:var(--gs-g)}' +
      '.gs-alt-i{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;width:100%;background:none;border:0;border-top:1px solid var(--gs-l);padding:var(--e2) 0;text-align:left;color:inherit;cursor:pointer;font-size:14px}' +
      '.gs-alt-i b{display:flex;align-items:center;min-width:0}.gs-alt-i b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gs-alt-i small{color:var(--gs-g);font-size:13px}.gs-alt-i .gs-pag{font-size:13px;font-weight:700}' +
      '.gs-alt-i .gs-pag span{display:block}' + // T0237: una alerta por línea
      '.gs-dia-h{font:var(--peso-titulos) 20px/1.2 var(--fuente-titulos);color:var(--color-principal-oscuro);margin:var(--e5) 0 0}' +
      '@media(min-width:900px){.gs-ligas{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:var(--e3);align-items:start;margin-top:var(--e3)}.gs-ligas>.gs-card{margin-top:0}}' + // T0225
      '.gs-fotos{display:flex;gap:var(--e2);flex-wrap:wrap}.gs-fotos button{font-size:14px}' +
      // T0234 · Camisetas: una tarjeta por equipo con su avance y sus jugadoras; el siguiente paso, a mano derecha.
      '.gs-cam-h{display:flex;justify-content:space-between;gap:var(--e2);align-items:baseline}.gs-cam-h b{display:flex;align-items:center;min-width:0;font-size:15px}' +
      '.gs-cam-h b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gs-cam-h>span{font-size:13px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      '.gs-cam-eq .gs-barra{height:6px}.gs-barra i.gs-ok{background:var(--gs-v)}' +
      '.gs-cam-s{font-size:13px;color:var(--gs-g);margin-top:var(--e1)}' +
      '.gs-cam-j{display:flex;align-items:center;gap:var(--e2);border-top:1px solid var(--gs-l);padding:var(--e2) 0;margin-top:var(--e2)}.gs-cam-j+.gs-cam-j{margin-top:0}' +
      '.gs-cam-n{flex:1 1 auto;min-width:0;background:none;border:0;padding:0;text-align:left;color:inherit;cursor:pointer;min-height:44px;font-size:14px}' +
      '.gs-cam-n b{display:block;font-weight:600}.gs-cam-n small{display:block;font-size:12px;color:var(--gs-g);margin-top:2px}' +
      '.gs-cam-n .gs-tags{margin-top:var(--e1)}' +
      '.gs-cam-j .gs-b2{flex:none;max-width:45%;min-height:44px;padding:0 var(--e3);font-size:14px}' +
      '.gs-cam-mas{margin-top:var(--e2)}' +
      // T0238: en el móvil, arriba solo el buscador y «Filtros» (como en el tablero, T0231); temporada, competición, liga y equipo, plegados.
      // Los filtros puestos salen debajo, con ✕ para quitarlos. Los botones de estado y los días, en una fila que se desliza de lado.
      '.gs-fbtn{display:inline-flex;align-items:center;gap:var(--e2);flex:none}.gs-fbtn[aria-expanded=true]{background:var(--gs-f)}' +
      '.gs-fbtn::after{content:"";width:8px;height:8px;margin-top:-4px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .15s}' +
      '.gs-fbtn[aria-expanded=true]::after{margin-top:4px;transform:rotate(-135deg)}' +
      '.gs-fn{min-width:22px;padding:0 6px;border-radius:var(--radio-peq);background:var(--color-texto);color:var(--color-fondo);font:700 12px/1.7 var(--fuente-texto);text-align:center}' +
      '.gs-puestos{display:flex;flex-wrap:wrap;gap:var(--e1)}' +
      '.gs-puesto{display:inline-flex;align-items:center;gap:var(--e2);min-height:32px;max-width:100%;padding:0 var(--e2) 0 var(--e3);border:1px solid var(--gs-l);border-radius:var(--radio);background:var(--gs-f);color:inherit;font:600 13px/1.2 var(--fuente-texto);cursor:pointer}' +
      '.gs-puesto span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gs-puesto i{font-style:normal;color:var(--gs-g);font-size:15px}' +
      '@media(max-width:899px){.gs-filtrar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2)}' +
      '.gs-filtrar>.gs-busca{order:1;flex:1 1 0;min-width:0;margin-top:0!important}.gs-busca input{width:100%;min-width:0}.gs-filtrar>.gs-fbtn{order:2}' +
      '.gs-filtrar>.gs-puestos{order:3;flex:1 1 100%}.gs-filtrar>.gs-mas{order:4;flex:1 1 100%}.gs-mas.gs-cerr{display:none}.gs-mas>.gs-fila{margin-top:var(--e2)!important}' +
      '.gs-filtrar>.gs-chips{order:5;flex:1 1 100%;margin-top:var(--e1)!important}' +
      '.gs-filtrar>.gs-chips,.gs-dias{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-left:calc(-1 * var(--e4));margin-right:calc(-1 * var(--e4));padding:0 var(--e4)}' +
      '.gs-filtrar>.gs-chips::-webkit-scrollbar,.gs-dias::-webkit-scrollbar{display:none}.gs-chips .gs-chip,.gs-dias .gs-chip{flex:none;white-space:nowrap}}' +
      '.gs-marcas{display:grid;grid-template-columns:1fr 1fr;gap:var(--e2);margin-top:var(--e2)}.gs-marcas .gs-b2[aria-pressed=true]{background:var(--gs-c);border-color:var(--gs-c);color:var(--color-sobre-principal)}' +
      '@media(min-width:900px){.gs-cam-eqs{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:var(--e3);align-items:start}.gs-cam-eqs>.gs-card{margin-top:var(--e3)}}' +
      '.gs-visor img{display:block;max-width:100%;max-height:70vh;margin:0 auto;border-radius:var(--radio);background:var(--gs-f)}' +
      // T0240 · Camisetas: Entregas · Stock · Pedidos arriba; stock en cuadro (ordenador) o por color (móvil); pedidos con sus pasos.
      '.gs-sw3{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:var(--e3)}' +
      '@media(min-width:900px){.gs-sw3{max-width:480px}}' +
      '.gs-cs-f{grid-template-columns:minmax(0,1fr);max-width:420px}@media(max-width:520px){.gs-cs-f{grid-template-columns:minmax(0,1fr)}}' + // T0246: un solo selector, el de modelo
      '.gs-cs-mi{margin:6px 2px 0}' +
      '@media(min-width:900px){.gs-cs-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
      '.gs-cs-mh{display:flex;justify-content:space-between;gap:var(--e2);align-items:baseline}.gs-cs-mh b{font:var(--peso-titulos) 17px/1.25 var(--fuente-titulos);color:var(--color-principal-oscuro)}' +
      '.gs-cs-mh span{font-size:13px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      '.gs-cs-tw{overflow-x:auto;margin-top:var(--e3)}' +
      '.gs-cs-t{border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}' +
      '.gs-cs-t th,.gs-cs-t td{border:1px solid var(--gs-l);padding:var(--e1) var(--e2);text-align:center;white-space:nowrap;background:var(--color-superficie)}' +
      '.gs-cs-t thead th,.gs-cs-t tfoot th,.gs-cs-t tfoot td,.gs-cs-t .gs-cs-tot{background:var(--gs-f);font-weight:700}' +
      '.gs-cs-t tbody th{text-align:left;font-weight:600}.gs-cs-t td{min-width:44px}' +
      // Con muchas dorsal-talla el cuadro se desliza de lado: la columna del color se queda fija.
      '.gs-cs-t th:first-child{position:sticky;left:0;z-index:1;box-shadow:inset -1px 0 0 var(--gs-l)}' +
      '.gs-cs-t .gs-cs-neg{background:color-mix(in srgb,var(--gs-r) 13%,var(--color-superficie));font-weight:700}' +
      '.gs-cs-c{border-top:1px solid var(--gs-l);padding:var(--e2) 0;margin-top:var(--e2)}.gs-cs-c+.gs-cs-c{margin-top:0}' +
      '.gs-cs-ch{display:flex;justify-content:space-between;gap:var(--e2);align-items:center;font-size:14px}.gs-cs-ch b{display:flex;align-items:center;min-width:0;font-weight:600}' +
      '.gs-cs-ch b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gs-cs-ch>span{font-weight:700;font-variant-numeric:tabular-nums}' +
      '.gs-cs-ks{display:flex;flex-wrap:wrap;gap:var(--e1);margin-top:var(--e2)}' +
      '.gs-cs-k{display:inline-flex;gap:var(--e1);align-items:baseline;padding:2px var(--e2);border-radius:var(--radio-peq);background:var(--gs-f);font-size:13px;font-variant-numeric:tabular-nums}' +
      '.gs-cs-k.gs-cs-neg{background:transparent;border:1px solid var(--gs-r);color:var(--gs-r)}' +
      '@media(min-width:900px){.gs-cs-peds{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:var(--e3);align-items:start}.gs-cs-peds>.gs-card{margin-top:var(--e3)}}' +
      '.gs-cs-p .gs-cam-h b span{white-space:normal}' +
      '.gs-pasos{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--e1);margin-top:var(--e3)}' +
      '.gs-pasos i{display:block;height:6px;border-radius:var(--radio-peq);background:var(--gs-l)}.gs-pasos small{display:block;font-size:11px;color:var(--gs-g);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.gs-pasos .gs-hecho i{background:var(--gs-v)}.gs-pasos .gs-ahora i{background:var(--gs-am)}.gs-pasos .gs-ahora small{color:var(--color-texto);font-weight:700}' +
      '@media(max-width:520px){.gs-pasos small{display:none}}' + // en el móvil no caben: el paso lo dice la etiqueta de arriba
      '.gs-cs-sig{margin:var(--e2) 0 0;font-size:14px}' +
      '.gs-cs-dl{margin-top:var(--e2)}' +
      '.gs-cs-col{margin-top:var(--e2)}.gs-cs-cl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 var(--e2);border-top:1px solid var(--gs-l);padding:var(--e2) 0;font-size:14px}' +
      '.gs-cs-cl b{display:flex;align-items:center;min-width:0;font-weight:600}.gs-cs-cl b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gs-cs-cl>span{font-weight:700;font-variant-numeric:tabular-nums}' +
      '.gs-cs-cl small{grid-column:1/-1;color:var(--gs-g);font-size:13px}' +
      '.gs-cs-pie{margin:var(--e5) 2px 0}';
  }

  /* ---------- utilidades ---------- */
  function cargando(msg) { return '<div class="gs-cargando" role="status"><div class="u-carga"></div>' + esc(msg || 'Cargando…') + '</div>'; }
  function errorHtml(e) { return '<div class="gs-error" role="alert">' + esc(e && e.message || e) + '</div>'; }
  function $(s) { return S.el && S.el.querySelector(s); }
  function eur(n) { return (Math.round(Math.abs(n || 0) * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/,00$/, '') + ' €'; }
  function ligaCorta(l) { l = String(l || ''); var p = l.split('|'); return p.length > 2 ? p.slice(2).join('|').trim() : l; }
  function compCorta(c) { return String(c || '').replace(/^\d\d-\d\d \|\s*/, '').trim(); }
  function tag(t, c) { return '<span class="gs-tag ' + (c || '') + '">' + esc(t) + '</span>'; }
  function fila(et, v) { return v ? '<div class="gs-df"><span>' + esc(et) + '</span><span>' + v + '</span></div>' : ''; }
  function esMovil() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer:coarse)').matches); }
  /** WhatsApp: en el ordenador, WhatsApp Web; en el móvil, la app (whatsapp://), que es lo que funciona desde la app web. */
  function waUrl(u) {
    u = String(u || ''); if (!u) return '';
    var m = u.match(/^https:\/\/(?:web|api)\.whatsapp\.com\/send\/?\?(.*)$/) || u.match(/^https:\/\/wa\.me\/(\d+)\??(.*)$/);
    if (!m) return u;
    var q = m.length === 3 ? 'phone=' + m[1] + (m[2] ? '&' + m[2] : '') : m[1];
    return esMovil() ? 'whatsapp://send?' + q : 'https://web.whatsapp.com/send?' + q;
  }
  function wa(tel) { var d = String(tel || '').replace(/\D/g, ''); if (!d) return ''; if (d.length === 9) d = '34' + d; return waUrl('https://web.whatsapp.com/send?phone=' + d); }
  function aWa(url, txt) { url = waUrl(url); return url ? '<a class="gs-b2" href="' + esc(url) + '"' + (/^whatsapp:/.test(url) ? '' : ' target="_blank" rel="noopener"') + '>' + txt + '</a>' : ''; }
  function colorHex(n) { var c = (S.opciones && S.opciones.colores || []).filter(function (x) { return x.n === n; })[0]; return c && /^#/.test(c.hex) ? c.hex : ''; }
  /** T0235: por orden de inscripción (ts: Marca temporal de GESTION); a igual hora, por fila. */
  function porAlta(l) { return l.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0) || a.fila - b.fila; }); }
  /** Fecha y hora de inscripción, «26/10/26 09:05»: columna en el ordenador; en el móvil, solo buscando, para no cargar la lista. */
  function alta(x) {
    if (!x.ts) return '';
    var d = new Date(x.ts), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function punto(n) { var h = colorHex(n); return h ? '<i class="gs-color" style="background:' + esc(h) + '" title="' + esc(n) + '"></i>' : ''; }
  function aviso(t) {
    var a = document.createElement('div'); a.className = 'gs-aviso'; a.setAttribute('role', 'status'); a.textContent = t;
    (S.el.querySelector('.gs') || document.body).appendChild(a);
    setTimeout(function () { a.remove(); }, 4500);
  }
  function dato(clave, fn, args, forzar) {
    if (!forzar && S.datos[clave]) return Promise.resolve(S.datos[clave]);
    return llamar(fn, args).then(function (r) { S.datos[clave] = r; return r; });
  }
  function opciones(forzar) {
    if (S.opciones && !forzar) return Promise.resolve(S.opciones);
    return llamar('gestionOpciones').then(function (o) {
      S.opciones = o;
      if (!S.temp) S.temp = o.temporada;
      return o;
    });
  }
  function olvidar() { var o = S.opciones; S.datos = {}; S.opciones = o; }
  function hora(h) { var x = $('#gs-hora'); if (x && h) x.textContent = 'Datos de las ' + String(h).slice(-5); }
  function urlFila(gid, f) { return S.opciones && S.opciones.url && gid ? S.opciones.url + '#gid=' + gid + '&range=A' + f : ''; }
  function norm2(s) { return norm(s).replace(/\s+/g, ' ').trim(); }
  var DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  function nomDia(d) { return ({ MIERCOLES: 'Miércoles', SABADO: 'Sábado', 'SIN LIGA': 'Sin liga' })[d] || (d.charAt(0) + d.slice(1).toLowerCase()); }
  function diaDeLiga(hash) { var l = ((S.opciones || {}).ligas || []).filter(function (x) { return x.hash === hash; })[0]; return l ? norm(l.dia) : ''; }
  function gestorDeLiga(hash) { var l = ((S.opciones || {}).ligas || []).filter(function (x) { return x.hash === hash; })[0]; return l ? l.gestor : ''; }

  /* ---------- ventanas (como las de Economía) ---------- */
  function ventana(titulo, html) {
    var raiz = S.el.querySelector('.gs');
    var m = document.createElement('div'); m.className = 'gs-velo';
    m.innerHTML = '<div class="gs-hoja" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '"><h2>' + esc(titulo) + '<button type="button" class="gs-x" aria-label="Cerrar">×</button></h2>' + html + '</div>';
    raiz.appendChild(m);
    document.documentElement.classList.add('gs-sin-scroll');
    var cerrar = function () { m.remove(); document.removeEventListener('keydown', tecla); if (!raiz.querySelector('.gs-velo')) document.documentElement.classList.remove('gs-sin-scroll'); };
    var tecla = function (e) { if (e.key === 'Escape' && raiz.lastElementChild === m) cerrar(); };
    document.addEventListener('keydown', tecla);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.gs-x') === m.querySelector('.gs-x') || e.target.closest('[data-gs-cerrar]')) cerrar(); });
    return { el: m.querySelector('.gs-hoja'), cerrar: cerrar };
  }

  /** Ver un archivo de Drive (foto, factura, ticket) dentro de la app. */
  function visor(url, titulo) {
    var v = ventana(titulo || 'Archivo', '<div class="gs-visor">' + cargando('Abriendo el archivo…') + '</div>');
    llamar('gestionArchivo', [url]).then(function (a) {
      v.el.querySelector('.gs-visor').innerHTML = (a.img ? '<img alt="' + esc(a.nombre) + '" src="' + a.img + '">' : '<p>' + (a.abrir ? 'Este archivo no se subió ni se eligió desde la app: ábrelo en Drive.' : 'Este archivo no se puede ver aquí.') + '</p>') +
        '<div class="gs-acc"><a class="gs-b2" href="' + esc(a.url || url) + '" target="_blank" rel="noopener">Abrir en Drive ↗</a></div>';
    }, function (e) { v.el.querySelector('.gs-visor').innerHTML = errorHtml(e) + '<div class="gs-acc"><a class="gs-b2" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir en Drive ↗</a></div>'; });
  }
  function htmlFotos(lista) {
    if (!lista || !lista.length) return '';
    return '<div class="gs-sec">Fotos</div><div class="gs-fotos">' + lista.map(function (f, i) {
      return '<button type="button" class="gs-b2" data-gs-foto="' + i + '">' + esc(f.t || 'Foto ' + (i + 1)) + '</button>';
    }).join('') + '</div>';
  }
  function engancharFotos(hoja, lista, titulo) {
    [].forEach.call(hoja.querySelectorAll('[data-gs-foto]'), function (b) {
      b.onclick = function () { var f = lista[Number(b.getAttribute('data-gs-foto'))]; visor(f.url, titulo + ' · ' + (f.t || 'Foto')); };
    });
  }

  /* ---------- formulario de campos editables (equipos y jugadoras) ----------
   * campo: { k: COLUMNA del Excel, t: 'select'|'texto'|'num'|'fecha'|'si', et: etiqueta, v: valor actual, opts: [[valor, texto]], nota } */
  function htmlCampo(c) {
    var id = 'gs-f-' + c.k.replace(/[^A-Za-z0-9]/g, '_'), v = c.v == null ? '' : c.v;
    if (c.t === 'si') return '<label class="gs-check"><input type="checkbox" id="' + id + '" data-gs-k="' + esc(c.k) + '"' + (v ? ' checked' : '') + '> ' + esc(c.et) + '</label>';
    var inp;
    if (c.t === 'select') {
      var opts = c.opts.slice();
      if (v !== '' && !opts.some(function (o) { return String(o[0]) === String(v); })) opts.unshift([v, v + ' (no está en la lista)']);
      inp = '<select id="' + id + '" data-gs-k="' + esc(c.k) + '">' + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else {
      var tipo = c.t === 'fecha' ? 'date' : 'text', extra = c.t === 'num' ? ' inputmode="decimal"' : '';
      inp = '<input type="' + tipo + '" id="' + id + '" data-gs-k="' + esc(c.k) + '" value="' + esc(v) + '"' + extra + ' autocomplete="off">';
    }
    return '<label class="gs-campo" for="' + id + '">' + (c.pre || '') + esc(c.et) + inp + (c.nota ? '<div class="gs-nota">' + esc(c.nota) + '</div>' : '') + '</label>';
  }
  function valorCampo(el) { return el.type === 'checkbox' ? el.checked : el.value.trim(); }
  /** Lo que ha cambiado respecto a los valores originales: { COLUMNA: valor }. */
  function cambios(hoja, campos) {
    var o = {};
    campos.forEach(function (c) {
      var el = hoja.querySelector('[data-gs-k="' + c.k + '"]'); if (!el) return;
      var v = valorCampo(el), antes = c.t === 'si' ? !!c.v : String(c.v == null ? '' : c.v);
      if (c.t === 'num' && v !== '' && antes !== '' && Number(String(v).replace(',', '.')) === Number(antes)) return;
      if (v !== antes) o[c.k] = v;
    });
    return o;
  }
  /** Activa «Guardar» solo cuando hay cambios; al guardar llama a fn(cambios) y, si va bien, aplicar(cambios) en lo cargado.
   * No se vuelve a pedir la lista: GESTION tarda en recalcular tras un cambio y la app esperaría para nada. */
  function guardable(v, campos, fn, aplicar) {
    var ok = v.el.querySelector('#gs-ok'), err = v.el.querySelector('#gs-err');
    var mira = function () { var n = Object.keys(cambios(v.el, campos)).length; ok.disabled = !n; ok.textContent = n ? 'Guardar ' + n + (n === 1 ? ' cambio' : ' cambios') : 'Sin cambios'; };
    v.el.addEventListener('input', mira); v.el.addEventListener('change', mira); mira();
    ok.onclick = function () {
      var c = cambios(v.el, campos); if (!Object.keys(c).length) return;
      ok.disabled = true; ok.textContent = 'Guardando…'; err.hidden = true;
      // Si otro cambio acaba de hacerse, GESTION aún está recalculando y guardar puede tardar hasta un minuto.
      var lento = setTimeout(function () { ok.textContent = 'Guardando… (el Excel está recalculando, puede tardar un minuto)'; }, 8000);
      fn(c).then(function (r) {
        clearTimeout(lento); v.cerrar();
        if (r.cambios && aplicar) aplicar(c);
        aviso(r.cambios ? 'Guardado en GESTION (' + r.cambios + (r.cambios === 1 ? ' cambio).' : ' cambios).') : 'No había nada que cambiar.');
        pintar();
      }, function (e) { clearTimeout(lento); err.textContent = e.message; err.hidden = false; mira(); });
    };
  }

  /** Columna del Excel → campo del registro en la app (igual que GES_EQ_PROP y GES_JUG_PROP de GESTION_WEB.gs). */
  var PROP_EQ = { 'NIVEL': 'nivel', 'LIGA': 'liga', 'ASIG': 'asig', 'COLOR': 'color', 'DESCUENTO': 'descuento', 'TEAM NEW NAME': 'teamNuevo',
    'F.L (P.S)': 'flP', 'F.L (Insc)': 'flI', 'ERROR': 'error', 'F.J': 'fj', 'M.I ENVIADO': 'mi', 'Gr C/TS': 'gr', 'CASH': 'cash', 'E.E ENVIADO': 'ee', 'XPORTY': 'xporty' };
  var PROP_JUG = { 'NOMBRE': 'nombre', '1er APELLIDO': 'ap1', '2ndo APELLIDO': 'ap2', 'FECHA NACIMIENTO': 'fnac', 'NUMERO TELEFONO': 'tel', 'DNI': 'dni',
    'Usuario Instagram': 'insta', 'DORSAL - CAMISETA': 'dorsal', 'ERROR': 'error', 'G.CONTACTS': 'gcontacts', 'XPORTY': 'xporty', 'EQUIPO': 'equipo' };
  function fechaTxt(f) { var m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? Number(m[3]) + '/' + m[2] + '/' + m[1] : ''; }
  /** Pone en el registro ya cargado lo que se acaba de guardar (lo que calculan las fórmulas se ve al pulsar ↻). */
  function aplicarCambios(o, c, props) {
    Object.keys(c).forEach(function (k) {
      var p = props[k]; if (!p) return;
      var v = c[k];
      if (p === 'nivel' || p === 'descuento') v = v === '' ? null : Number(String(v).replace(',', '.'));
      if (p === 'equipo') v = String(v).toUpperCase();
      o[p] = v;
      if (p === 'flP') o.flPTxt = fechaTxt(v);
      if (p === 'flI') o.flITxt = fechaTxt(v);
      if (p === 'fnac') o.fnacTxt = fechaTxt(v);
    });
  }

  /* ---------- armazón ---------- */
  var TABS = [['resumen', 'Resumen'], ['equipos', 'Equipos'], ['jugadoras', 'Jugadoras'], ['camisetas', 'Camisetas']];

  function abrir(el) {
    S.el = el;
    var ver = document.querySelector('header.cab .ver-btn'), sol = document.querySelector('header.cab .sol-btn');
    el.innerHTML = '<div class="gs"><style>' + css() + cssExtra() + '</style>' +
      '<header class="gs-cab">' + (ver ? '<button type="button" class="gs-ver" id="gs-ver" title="Versión y novedades">' + esc(ver.textContent.trim()) + '</button>' : '') +
      (sol ? '<button type="button" class="gs-sol" id="gs-sol" title="Pide un cambio, cuéntanos un fallo o pregúntanos una duda" aria-label="Pedir algo a Utilo">' + ICONO_SOL + '</button>' : '') +
      '<h1>Gestión <span class="gs-pint" id="gs-pint" hidden></span></h1><p><span id="gs-hora">Excel GESTION</span><button class="gs-re" id="gs-re" type="button" aria-label="Actualizar" title="Volver a leer el Excel">↻</button></p>' +
      '<nav class="gs-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-gs-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</nav></header>' +
      '<main class="gs-main" id="gs-main"></main></div>';
    el.querySelector('.gs-tabs').onclick = function (e) { var b = e.target.closest('[data-gs-tab]'); if (b) irTab(b.getAttribute('data-gs-tab')); };
    $('#gs-re').onclick = function () { olvidar(); S.opciones = null; pintar(true); };
    if ($('#gs-ver')) $('#gs-ver').onclick = function () { var b = document.querySelector('header.cab .ver-btn'); if (b) b.click(); };
    if ($('#gs-sol')) $('#gs-sol').onclick = function () { var b = document.querySelector('header.cab .sol-btn'); if (b) b.click(); };
    // T0225: en las tablas, Intro o espacio sobre una fila abre su ficha
    el.addEventListener('keydown', function (e) { var tr = e.target.closest && e.target.closest('tr[tabindex]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); } });
    pintar();
  }

  // T0225: al pasar de móvil a ordenador (o al revés) cambia lista por tabla
  if (ANCHO.addEventListener) ANCHO.addEventListener('change', function () { if (S.el && document.body.contains(S.el) && S.tab !== 'resumen') pintar(); });

  function irTab(t) {
    S.tab = t;
    [].forEach.call(S.el.querySelectorAll('[data-gs-tab]'), function (x) { x.setAttribute('aria-selected', x.getAttribute('data-gs-tab') === t); });
    window.scrollTo(0, 0); document.body.scrollTop = 0; // T0224: en el móvil el scroll es del body
    pintar();
  }

  function pintar(forzar) {
    var main = $('#gs-main'); if (!main) return;
    var re = $('#gs-re'); if (re) re.disabled = true;
    var p = S.tab === 'camisetas' ? pCamisetas : S.tab === 'jugadoras' ? pJugadoras : S.tab === 'equipos' ? pEquipos : pResumen;
    Promise.resolve(p(main, !!forzar)).then(function () { if (re) re.disabled = false; }, function () { if (re) re.disabled = false; });
  }

  /** Carga opciones + los datos de la temporada y pinta. forzar: el servidor relee GESTION (↻). */
  function cuando(main, tipo, forzar, msg, pinta) {
    var tab = S.tab;
    var clave = function () { return tipo + '_' + S.temp; }, fn = tipo === 'jug' ? 'gestionJugadoras' : 'gestionEquipos';
    if (forzar || !S.opciones || !S.datos[clave()]) main.innerHTML = cargando(msg);
    return opciones(forzar && !S.opciones).then(function (o) {
      return dato(clave(), fn, [S.temp, !!forzar], forzar).then(function (r) {
        if (S.tab !== tab || !document.body.contains(main)) return;
        hora(r.hora); pintada(S.temp); pinta(o, r);
      });
    }).then(null, function (e) {
      if (S.tab === tab) main.innerHTML = errorHtml(e) + '<p style="text-align:center"><button class="gs-chip" type="button" id="gs-reint">Reintentar</button></p>';
      var b = $('#gs-reint'); if (b) b.onclick = function () { pintar(true); };
    });
  }

  /* ---------- filtros comunes: temporada (se carga entera), competición y liga ---------- */
  function htmlFiltros(o) {
    var temps = []; o.competiciones.forEach(function (c) { if (temps.indexOf(c.temp) < 0) temps.push(c.temp); });
    temps.sort().reverse();
    var comps = o.competiciones.filter(function (c) { return c.temp === S.temp; });
    var ligas = o.ligas.filter(function (l) { return l.comp.slice(0, 5) === S.temp && (!S.fComp || l.comp === S.fComp); });
    return '<div class="gs-filtros">' +
      '<select class="gs-sel" id="gs-temp" aria-label="Temporada">' + temps.map(function (t) { return '<option' + (t === S.temp ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<select class="gs-sel" id="gs-fcomp" aria-label="Competición"><option value="">Todas las competiciones</option>' + comps.map(function (c) {
        return '<option value="' + esc(c.hash) + '"' + (c.hash === S.fComp ? ' selected' : '') + '>' + esc(c.nombre.trim()) + '</option>';
      }).join('') + '</select>' +
      '<select class="gs-sel" id="gs-fliga" aria-label="Liga"><option value="">Todas las ligas</option>' + ligas.map(function (l) {
        return '<option value="' + esc(l.hash) + '"' + (l.hash === S.fLiga ? ' selected' : '') + '>' + esc((S.fComp ? '' : compCorta(l.comp) + ' · ') + ligaCorta(l.hash)) + '</option>';
      }).join('') + '<option value="SIN"' + (S.fLiga === 'SIN' ? ' selected' : '') + '>Sin liga</option></select></div>';
  }
  function engancharFiltros(main, repinta) {
    $('#gs-temp').onchange = function () { S.temp = this.value; S.fComp = ''; S.fLiga = ''; S.jug.equipo = ''; pintar(); };
    $('#gs-fcomp').onchange = function () { S.fComp = this.value; S.fLiga = ''; S.jug.equipo = ''; repinta(); };
    $('#gs-fliga').onchange = function () { S.fLiga = this.value; S.jug.equipo = ''; repinta(); };
  }
  /** T0238: en el móvil, «Filtros» pliega temporada, competición, liga (y lo que traiga extra); los puestos salen con ✕. */
  function ultimaTemp(o) { return o.competiciones.map(function (c) { return c.temp; }).sort().pop() || S.temp; }
  function puestos(o) {
    var p = [];
    if (S.temp !== ultimaTemp(o)) p.push(['temp', 'Temporada ' + S.temp]);
    if (S.fComp) { var c = o.competiciones.filter(function (x) { return x.hash === S.fComp; })[0]; p.push(['comp', c ? c.nombre.trim() : compCorta(S.fComp)]); }
    if (S.fLiga) p.push(['liga', S.fLiga === 'SIN' ? 'Sin liga' : ligaCorta(S.fLiga)]);
    if (S.tab === 'jugadoras' && S.jug.equipo) p.push(['equipo', S.jug.equipo]);
    return p;
  }
  function filtrosPlegables(o, extra) {
    var p = puestos(o);
    return '<button type="button" class="gs-chip gs-fbtn" id="gs-fbtn" aria-expanded="' + !!S.filAb + '" aria-controls="gs-mas">Filtros' +
      (p.length ? '<span class="gs-fn">' + p.length + '</span>' : '') + '</button>' +
      (p.length && !S.filAb ? '<div class="gs-puestos">' + p.map(function (x) {
        return '<button type="button" class="gs-puesto" data-gs-quitar="' + x[0] + '" aria-label="Quitar ' + esc(x[1]) + '"><span>' + esc(x[1]) + '</span><i aria-hidden="true">✕</i></button>';
      }).join('') + '</div>' : '') +
      '<div class="gs-mas' + (S.filAb ? '' : ' gs-cerr') + '" id="gs-mas">' + htmlFiltros(o) + (extra || '') + '</div>';
  }
  function engancharPlegables(main, o, repinta) {
    var b = $('#gs-fbtn'); if (b) b.onclick = function () { S.filAb = !S.filAb; repinta(); };
    [].forEach.call(main.querySelectorAll('[data-gs-quitar]'), function (x) {
      x.onclick = function () {
        var k = x.getAttribute('data-gs-quitar');
        if (k === 'temp') { S.temp = ultimaTemp(o); S.fComp = ''; S.fLiga = ''; S.jug.equipo = ''; pintar(); return; }
        if (k === 'comp') S.fComp = '';
        if (k === 'comp' || k === 'liga') S.fLiga = '';
        S.jug.equipo = '';
        repinta();
      };
    });
  }
  function buscaPh(largo) { return ancho() ? largo : 'Buscar…'; }
  function enFiltro(x) {
    return (!S.fComp || x.comp === S.fComp) && (!S.fLiga || (S.fLiga === 'SIN' ? !x.liga : x.liga === S.fLiga));
  }
  function chips(lista, actual, id) {
    return '<div class="gs-chips" id="' + id + '" style="margin-top:10px">' + lista.map(function (c) {
      return '<button type="button" class="gs-chip" data-gs-f="' + c[0] + '" aria-pressed="' + (c[0] === actual) + '">' + esc(c[1]) + (c[2] != null ? ' · ' + c[2] : '') + '</button>';
    }).join('') + '</div>';
  }
  function esCorreo(q) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(q || '').trim()); }

  /* ---------- RESUMEN (como la hoja RESUMEN, de la temporada elegida) ---------- */
  function edad1(x, entero) {
    var n = parseFloat(String(x == null ? '' : x).replace(',', '.'));
    if (!isFinite(n) || n <= 0) return '';
    if (entero && n === Math.round(n)) return String(n);
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  }
  function telDe(n) { return ((S.opciones || {}).tels || {})[n] || ''; }
  function estadoPago(e) {
    return !e.ps ? '<span class="gs-pag gs-neg">Sin P.S.</span>' : e.pendiente > 0.005 ? '<span class="gs-pag gs-neg">Faltan ' + eur(e.pendiente) + '</span>' :
      e.pago ? '<span class="gs-pag gs-pos">Pagado</span>' : '<span class="gs-pag gs-amb">Falta inscripción</span>';
  }

  function pResumen(main, forzar) {
    return cuando(main, 'eq', forzar, 'Cargando la temporada…', function (o, r) {
      var vale = function (e) { return !e.error && !e.buscan && enFiltro(e); };
      var eqs = r.lista.filter(vale);
      var nJug = eqs.reduce(function (a, e) { return a + (e.jugadoras || 0); }, 0);
      var porPagar = eqs.filter(FILTROS_EQ.pagar), avisos = eqs.filter(FILTROS_EQ.avisos), sinLiga = eqs.filter(FILTROS_EQ.sinliga);
      // Días con ligas (por el día de juego de DB_LIGAS), en orden de la semana; al final, los equipos sin liga.
      var grupos = {};
      eqs.forEach(function (e) { var k = e.liga || 'SIN'; (grupos[k] = grupos[k] || []).push(e); });
      var dias = {};
      Object.keys(grupos).forEach(function (k) { var d = k === 'SIN' ? 'SIN LIGA' : (diaDeLiga(k) || 'OTRO'); (dias[d] = dias[d] || []).push(k); });
      var ordenDias = DIAS.filter(function (d) { return dias[d]; }).concat(Object.keys(dias).filter(function (d) { return DIAS.indexOf(d) < 0; }));
      if (S.dia && !dias[S.dia]) S.dia = '';
      S.abiertas = S.abiertas || {};
      var nAl = porPagar.length + avisos.length + sinLiga.length;
      var h = '<div class="gs-filtrar">' + filtrosPlegables(o) + '</div>' + '<div class="gs-res-top">' + // T0233 · T0238
        '<div class="gs-mini" style="margin-top:12px;grid-template-columns:repeat(4,1fr)">' +
        '<button type="button" data-gs-kpi="equipos"><b>' + eqs.length + '</b><small>Equipos</small></button>' +
        '<button type="button" data-gs-kpi="jugadoras"><b>' + nJug + '</b><small>Jugadoras</small></button>' +
        '<button type="button" data-gs-kpi="pagar" class="' + (porPagar.length ? 'gs-alerta' : '') + '"><b>' + porPagar.length + '</b><small>Por pagar</small></button>' +
        '<button type="button" data-gs-kpi="alertas" class="' + (nAl ? 'gs-alerta' : '') + '"><b id="gs-nal">' + nAl + '</b><small>Alertas</small></button></div>' +
        // Alertas: pagos, avisos del Excel, equipos sin liga y jugadoras con alerta (estas, en cuanto se cargan).
        '<div class="gs-card gs-alts" id="gs-alts"><div class="gs-alts-t">Alertas</div>' +
        htmlAlerta('pagar', 'Pagos pendientes', porPagar, function (e) { return estadoPago(e); }, r) +
        htmlAlerta('avisos', 'Problemas en la inscripción', avisos, function (e) {
          return '<span class="gs-pag gs-amb">' + (e.ocupado ? ['Nombre repetido ×' + e.ocupado] : []).concat(partesAlerta(e.revisar)).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</span>';
        }, r) +
        htmlAlerta('sinliga', 'Equipos sin liga', sinLiga, function () { return ''; }, r) +
        '<div id="gs-aljug"><details class="gs-alt"><summary><span>Jugadoras con alerta</span><em>…</em></summary><p class="gs-nota">Cargando las jugadoras…</p></details></div>' +
        '<div id="gs-alcam"><details class="gs-alt"><summary><span>Camisetas</span><em>…</em></summary><p class="gs-nota">Cargando las camisetas…</p></details></div></div></div>' +
        '<div class="gs-dias">' + [''].concat(ordenDias).map(function (d) {
          return '<button type="button" class="gs-chip" data-gs-dia="' + esc(d) + '" aria-pressed="' + (d === (S.dia || '')) + '">' + esc(d ? nomDia(d) : 'Todos los días') + '</button>';
        }).join('') + '<button type="button" class="gs-chip" id="gs-todas">' + (Object.keys(S.abiertas).some(function (k) { return S.abiertas[k]; }) ? 'Cerrar todas' : 'Abrir todas') + '</button></div><div class="gs-semana">';
      ordenDias.filter(function (d) { return !S.dia || d === S.dia; }).forEach(function (d) {
        h += '<section class="gs-dia"><div class="gs-dia-h">' + esc(nomDia(d)) + '</div><div class="gs-ligas">';
        dias[d].sort().forEach(function (k) {
          var lista = grupos[k].slice().sort(function (a, b) { return (b.nivel || 0) - (a.nivel || 0) || a.equipo.localeCompare(b.equipo); });
          var jug = lista.reduce(function (a, e) { return a + (e.jugadoras || 0); }, 0);
          var pend = lista.filter(FILTROS_EQ.pagar).length;
          var gestor = k === 'SIN' ? '' : gestorDeLiga(k), tel = telDe(gestor);
          h += '<details class="gs-card gs-liga" data-gs-liga="' + esc(k) + '"' + (S.abiertas[k] ? ' open' : '') + '><summary>' +
            '<div class="gs-liga-n">' + (k === 'SIN' ? 'Sin liga' : '<small>' + esc(compCorta(k.split('|').slice(0, 2).join('|'))) + '</small>' + esc(ligaCorta(k))) + '</div>' +
            (gestor ? '<div class="gs-liga-g"><span>Gestor: <b>' + esc(gestor) + '</b></span>' + (tel ? aWa(wa(tel), 'WhatsApp').replace('class="gs-b2"', 'class="gs-wa"') : '') + '</div>' : '') +
            '<div class="gs-liga-s">' + lista.length + (lista.length === 1 ? ' equipo · ' : ' equipos · ') + jug + ' jugadoras' + (pend ? ' · <b class="gs-neg">' + pend + ' por pagar</b>' : ' · todo pagado') + '</div>' +
            '</summary>' +
            lista.map(function (e) {
              return '<button type="button" class="gs-eqr" data-gs-i="' + r.lista.indexOf(e) + '"><span class="gs-n">' + (e.nivel || '–') + '</span>' +
                '<b>' + punto(e.color) + '<span>' + esc(e.equipo) + '</span></b>' + estadoPago(e) +
                '<small>' + esc([e.capi, e.jugadoras ? e.jugadoras + ' jugadoras' : 'sin jugadoras', edad1(e.edad) ? edad1(e.edad) + ' años' : ''].filter(String).join(' · ')) + '</small></button>';
            }).join('') + '</details>';
        });
        h += '</div></section>';
      });
      h += '</div>';
      if (!ordenDias.length) h += '<div class="gs-vacio">No hay equipos con estos filtros.</div>';
      main.innerHTML = h;
      engancharFiltros(main, function () { pResumen(main); });
      engancharPlegables(main, o, function () { pResumen(main); });
      [].forEach.call(main.querySelectorAll('[data-gs-dia]'), function (b) { b.onclick = function () { S.dia = b.getAttribute('data-gs-dia'); pResumen(main); }; });
      [].forEach.call(main.querySelectorAll('[data-gs-i]'), function (b) { b.onclick = function () { fichaEquipo(r.lista[Number(b.getAttribute('data-gs-i'))], o, r); }; });
      [].forEach.call(main.querySelectorAll('details.gs-liga'), function (x) {
        x.addEventListener('toggle', function () { S.abiertas[x.getAttribute('data-gs-liga')] = x.open; });
      });
      $('#gs-todas').onclick = function () {
        var ls = main.querySelectorAll('details.gs-liga'), abrir = !Object.keys(S.abiertas).some(function (k) { return S.abiertas[k]; });
        [].forEach.call(ls, function (x) { S.abiertas[x.getAttribute('data-gs-liga')] = abrir; });
        pResumen(main);
      };
      // KPIs: llevan a la pestaña donde se ven esos datos, con los mismos filtros.
      [].forEach.call(main.querySelectorAll('[data-gs-kpi]'), function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-gs-kpi');
          if (k === 'alertas') { var a = $('#gs-alts'); a.scrollIntoView({ behavior: 'smooth', block: 'start' }); [].forEach.call(a.querySelectorAll('details'), function (x) { if (x.querySelector('.gs-alt-i')) x.open = true; }); return; }
          if (k === 'jugadoras') { S.jug.filtro = 'todas'; S.jug.q = ''; S.jug.equipo = ''; irTab('jugadoras'); return; }
          S.eq.filtro = k === 'pagar' ? 'pagar' : 'todos'; S.eq.q = ''; irTab('equipos');
        };
      });
      engancharAlertas(main, function (e) { fichaEquipo(e, o, r); });
      // Jugadoras con alerta: se cargan aparte (o salen de lo ya cargado) y se añaden a Alertas.
      // T0237: con ↻ también se releen las jugadoras (antes solo los equipos: Camisetas y Jugadoras con alerta seguían con lo guardado).
      dato('jug_' + S.temp, 'gestionJugadoras', [S.temp, !!forzar], forzar).then(function (rj) {
        var cont = main.querySelector('#gs-aljug'); if (!cont || !document.body.contains(cont)) return;
        var js = rj.lista.filter(function (j) { return enFiltro(j) && FILTROS_JUG.alerta(j); });
        cont.innerHTML = htmlAlerta('alerta', 'Jugadoras con alerta', js, function (j) {
          return '<span class="gs-pag gs-amb">' + partesAlerta(j.alerta).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</span>';
        }, rj, true);
        // T0237: Camisetas, un equipo por línea.
        var cams = equiposCamAlerta(rj.lista.filter(enFiltro)), cc = main.querySelector('#gs-alcam');
        if (cc) cc.innerHTML = htmlAlertaCam(cams);
        var n = main.querySelector('#gs-nal'), tot = nAl + js.length + cams.length;
        if (n) { n.textContent = tot; if (tot) n.parentNode.classList.add('gs-alerta'); }
        engancharAlertas(cont, function (j) { fichaJugadora(j, o, rj); });
        if (cc) [].forEach.call(cc.querySelectorAll('[data-gs-alc]'), function (b) {
          b.onclick = function () { S.cam.filtro = 'alerta'; S.cam.q = ''; S.cam.todo = {}; S.cam.equipo = b.getAttribute('data-gs-alc'); irTab('camisetas'); };
        });
      }, function () { var cont = main.querySelector('#gs-aljug'); if (cont) cont.innerHTML = ''; var cc = main.querySelector('#gs-alcam'); if (cc) cc.innerHTML = ''; });
    });
  }

  /** Un grupo de Alertas: se despliega con la lista; cada una abre su ficha; al final, ir a la pestaña ya filtrada. */
  function htmlAlerta(filtro, titulo, lista, detalle, r, deJugadoras) {
    if (!lista.length) return '<details class="gs-alt" data-gs-vacio><summary><span>' + esc(titulo) + '</span><em class="gs-pos">0</em></summary></details>';
    return '<details class="gs-alt"><summary><span>' + esc(titulo) + '</span><em class="gs-neg">' + lista.length + '</em></summary>' +
      lista.slice(0, 40).map(function (x) {
        return '<button type="button" class="gs-alt-i" data-gs-al="' + r.lista.indexOf(x) + '"><b>' + (deJugadoras ? '' : punto(x.color)) + '<span>' +
          esc(deJugadoras ? (x.nombreCompleto || x.mail) : x.equipo) + '</span></b>' + detalle(x) +
          '<small>' + esc(deJugadoras ? [x.equipo, ligaCorta(x.liga)].filter(String).join(' · ') : [x.capi, x.liga ? ligaCorta(x.liga) : compCorta(x.comp)].filter(String).join(' · ')) + '</small></button>';
      }).join('') + (lista.length > 40 ? '<div class="gs-mas">Y ' + (lista.length - 40) + ' más.</div>' : '') +
      '<p style="margin:8px 0 2px"><button type="button" class="gs-chip" data-gs-ir="' + filtro + '">Ver en ' + (deJugadoras ? 'Jugadoras' : 'Equipos') + ' ›</button></p></details>';
  }
  /** T0237 · Las alertas de ALERTA o REVISAR, una por una (« · » seguido del emoji de la siguiente). */
  function partesAlerta(t) { return String(t || '').split(/ · (?=[\u2190-\u2BFF\u{1F000}-\u{1FAFF}])/u).map(function (x) { return x.trim(); }).filter(String); }
  /**
   * T0237 · Lo que pide hacer algo con la camiseta, de ALERTA CAMISETA (GESTION). «Pedida», «Por preparar» y «Reparto programado»
   * no son alerta: se ven en Camisetas. [clave, una, varias, color de la etiqueta en Camisetas]
   */
  var ALERTAS_CAM = [['hoy', /^🚚 Repartir HOY/, 'para repartir hoy', 'para repartir hoy', 'gs-tag-a'],
    ['pasado', /^⏰/, 'con reparto pasado sin entregar', 'con reparto pasado sin entregar', 'gs-tag-r'],
    ['sin', /^📦/, 'preparada sin partido', 'preparadas sin partido', 'gs-tag-a'], ['pedir', /^🧾/, 'por pedir', 'por pedir', '']];
  function alertaCam(j) {
    if (j.error || !j.alertaCami) return null;
    return ALERTAS_CAM.filter(function (a) { return a[1].test(j.alertaCami); })[0] || null;
  }
  /** Equipos con alguna camiseta que pide hacer algo: { k (comp|equipo), equipo, comp, liga, color, n, cuenta: { hoy: 2, … } }. */
  function equiposCamAlerta(lista) {
    var g = {}, orden = [];
    lista.forEach(function (j) {
      var a = alertaCam(j); if (!a) return;
      var k = j.comp + '|' + j.equipo;
      if (!g[k]) { g[k] = { k: k, equipo: j.equipo, comp: j.comp, liga: j.liga, color: j.color, n: 0, cuenta: {} }; orden.push(k); }
      g[k].n++; g[k].cuenta[a[0]] = (g[k].cuenta[a[0]] || 0) + 1;
    });
    // Primero lo más urgente: hoy, luego reparto pasado; después, por nombre.
    var peso = function (e) { return e.cuenta.hoy ? 0 : e.cuenta.pasado ? 1 : 2; };
    return orden.map(function (k) { return g[k]; }).sort(function (a, b) { return peso(a) - peso(b) || a.equipo.localeCompare(b.equipo); });
  }
  function textoCam(e) {
    return ALERTAS_CAM.filter(function (a) { return e.cuenta[a[0]]; }).map(function (a) { var c = e.cuenta[a[0]]; return c + ' ' + (c === 1 ? a[2] : a[3]); }).join(' · ');
  }
  function htmlAlertaCam(eqs) {
    if (!eqs.length) return '<details class="gs-alt" data-gs-vacio><summary><span>Camisetas</span><em class="gs-pos">0</em></summary></details>';
    return '<details class="gs-alt"><summary><span>Camisetas</span><em class="gs-neg">' + eqs.length + '</em></summary>' +
      eqs.map(function (e) {
        return '<button type="button" class="gs-alt-i" data-gs-alc="' + esc(e.k) + '"><b>' + punto(e.color) + '<span>' + esc(e.equipo) + '</span></b>' +
          '<span class="gs-pag ' + (e.cuenta.hoy || e.cuenta.pasado ? 'gs-neg' : 'gs-amb') + '">' + esc(textoCam(e)) + '</span>' +
          '<small>' + esc([e.n + (e.n === 1 ? ' camiseta' : ' camisetas'), e.liga ? ligaCorta(e.liga) : compCorta(e.comp)].join(' · ')) + '</small></button>';
      }).join('') +
      '<p style="margin:8px 0 2px"><button type="button" class="gs-chip" data-gs-alc="">Ver en Camisetas ›</button></p></details>';
  }
  function engancharAlertas(cont, abrirFicha) {
    [].forEach.call(cont.querySelectorAll('[data-gs-ir]'), function (b) {
      if (b.closest('#gs-aljug') && cont.id !== 'gs-aljug') return;
      b.onclick = function () {
        var f = b.getAttribute('data-gs-ir');
        if (f === 'alerta') { S.jug.filtro = 'alerta'; S.jug.q = ''; S.jug.equipo = ''; irTab('jugadoras'); }
        else { S.eq.filtro = f; S.eq.q = ''; irTab('equipos'); }
      };
    });
    [].forEach.call(cont.querySelectorAll('[data-gs-al]'), function (b) {
      if (b.closest('#gs-aljug') && cont.id !== 'gs-aljug') return;
      b.onclick = function () {
        var det = b.closest('details'), datos = det && det.parentNode.id === 'gs-aljug' ? S.datos['jug_' + S.temp] : S.datos['eq_' + S.temp];
        abrirFicha(datos.lista[Number(b.getAttribute('data-gs-al'))]);
      };
    });
  }

  /* ---------- EQUIPOS (T0142) ---------- */
  var FILTROS_EQ = {
    todos: function (e) { return !e.error && !e.buscan; },
    sinliga: function (e) { return !e.error && !e.buscan && !e.liga; },
    pagar: function (e) { return !e.error && !e.buscan && (e.pendiente > 0.005 || !e.ps); },
    avisos: function (e) { return !e.error && !e.buscan && (e.revisar || e.ocupado); },
    buscan: function (e) { return !e.error && e.buscan; },
    error: function (e) { return e.error; }
  };

  function pEquipos(main, forzar) {
    return cuando(main, 'eq', forzar, 'Cargando los equipos…', function (o, r) {
      var f = S.eq, base = r.lista.filter(enFiltro), cuenta = function (k) { return base.filter(FILTROS_EQ[k]).length; };
      main.innerHTML = '<div class="gs-filtrar">' + filtrosPlegables(o) + // T0232 · T0238
        chips([['todos', 'Inscritos', cuenta('todos')], ['sinliga', 'Sin liga', cuenta('sinliga')], ['pagar', 'Por pagar', cuenta('pagar')],
          ['avisos', 'Avisos', cuenta('avisos')], ['buscan', 'Buscan equipo', cuenta('buscan')], ['error', 'Con ERROR', cuenta('error')]], f.filtro, 'gs-eqf') +
        '<div class="gs-fila gs-busca" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-eqq" placeholder="' + buscaPh('Buscar: equipo, capitana, correo, liga…') + '" value="' + esc(f.q) + '" aria-label="Buscar"></div></div>' +
        '<div id="gs-eqlista"></div>';
      var pinta = function () {
        var q = norm2(f.q);
        // Buscando, se mira en toda la temporada, también lo que tiene ERROR.
        var lista = porAlta(q ? r.lista.filter(function (e) { return norm2([e.equipo, e.capi, e.liga, e.asig, e.teamForm, e.mail, e.tel].join(' ')).indexOf(q) >= 0; })
          : base.filter(FILTROS_EQ[f.filtro]));
        $('#gs-eqlista').innerHTML = (q ? '<p class="gs-aviso-b">Buscando en toda la temporada ' + esc(S.temp) + ', también en las inscripciones con ERROR.</p>' : '') +
          (esCorreo(f.q) ? '<p style="margin:8px 0 0"><button type="button" class="gs-b2" id="gs-eqcorreo">Ver todo lo de este correo</button></p>' : '') +
          '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + lista.length + (lista.length === 1 ? ' inscripción' : ' inscripciones') + '</p>' +
          (lista.length && ancho() ? tablaEquipos(lista, r) : // T0225
          '<div class="gs-card"><div class="gs-lista">' + (lista.length ? lista.map(function (e) {
            var t = tagsEquipo(e);
            return '<button type="button" class="gs-item' + (e.error ? ' gs-err' : '') + '" data-gs-i="' + r.lista.indexOf(e) + '"><div style="min-width:0">' +
              '<div class="gs-t">' + punto(e.color) + esc(e.equipo || '(sin nombre)') + '</div>' +
              '<div class="gs-s">' + esc([S.fComp ? '' : compCorta(e.comp), e.liga ? ligaCorta(e.liga) : (e.dispo ? 'Quiere: ' + e.dispo : ''), e.capi, e.jugadoras ? e.jugadoras + ' jugadoras' : ''].filter(String).join(' · ')) +
                (q ? ' <span class="gs-alta">· ' + alta(e) + '</span>' : '') + '</div>' +
              (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') +
              '</div><div class="gs-d">' + (e.nivel ? 'Nivel ' + esc(e.nivel) : '') + '</div></button>';
          }).join('') : '<div class="gs-vacio">No hay inscripciones con este filtro.</div>') + '</div></div>');
        [].forEach.call(main.querySelectorAll('[data-gs-i]'), function (b) { b.onclick = function () { fichaEquipo(r.lista[Number(b.getAttribute('data-gs-i'))], o, r); }; });
        var bc = $('#gs-eqcorreo'); if (bc) bc.onclick = function () { verCorreo(f.q.trim()); };
      };
      pinta();
      engancharFiltros(main, function () { pEquipos(main); });
      engancharPlegables(main, o, function () { pEquipos(main); });
      $('#gs-eqf').onclick = function (ev) { var b = ev.target.closest('[data-gs-f]'); if (!b) return; f.filtro = b.getAttribute('data-gs-f'); f.q = ''; pEquipos(main); };
      var t0; $('#gs-eqq').oninput = function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { f.q = v; pinta(); }, 150); };
    });
  }

  function tagsEquipo(e) {
    var t = [];
    if (e.error) t.push(tag('ERROR · no cuenta', 'gs-tag-err'));
    if (e.buscan && !e.error) t.push(tag('Busca equipo', 'gs-tag-g'));
    if (!e.error && !e.buscan && !e.liga) t.push(tag('Sin liga'));
    if (!e.error && !e.buscan && !e.ps) t.push(tag('Sin paga y señal', 'gs-tag-a'));
    if (!e.error && e.pendiente > 0.005) t.push(tag('Faltan ' + eur(e.pendiente), 'gs-tag-a'));
    if (e.ocupado) t.push(tag('Nombre repetido ×' + e.ocupado, 'gs-tag-r'));
    if (e.revisar) t.push(tag(e.revisar, 'gs-tag-a'));
    if (!e.error && !e.buscan && !e.xporty) t.push(tag('Sin Xporty', 'gs-tag-g'));
    return t;
  }
  /** T0225: Equipos en el ordenador. Cada fila abre la ficha del equipo, como en el móvil. */
  function tablaEquipos(lista, r) {
    return '<table class="u-tabla gs-tabla"><thead><tr>' + '<th>Inscripción</th><th>Equipo</th>' + (S.fComp ? '' : '<th>Competición</th>') +
      '<th>Liga</th><th>Capitana</th><th class="num">Jugadoras</th><th class="num">Nivel</th><th>Avisos</th></tr></thead><tbody>' +
      lista.map(function (e) {
        return '<tr tabindex="0"' + (e.error ? ' class="gs-err"' : '') + ' data-gs-i="' + r.lista.indexOf(e) + '">' + '<td class="gs-alta">' + alta(e) + '</td><td class="u-tabla-t">' + punto(e.color) + esc(e.equipo || '(sin nombre)') + '</td>' +
          (S.fComp ? '' : '<td>' + esc(compCorta(e.comp)) + '</td>') +
          '<td>' + (e.liga ? esc(ligaCorta(e.liga)) : e.dispo ? '<span class="gs-opc">Quiere: ' + esc(e.dispo) + '</span>' : '') + '</td>' +
          '<td>' + esc(e.capi) + '</td><td class="num">' + (e.jugadoras || '') + '</td><td class="num">' + esc(e.nivel || '') + '</td>' +
          '<td><div class="gs-tags">' + tagsEquipo(e).join('') + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function fichaEquipo(e, o, r) {
    var ligas = o.ligas.filter(function (l) { return l.comp === e.comp; });
    var campos = [
      { k: 'LIGA', t: 'select', et: 'Liga', v: e.liga, opts: [['', '— Sin liga —']].concat(ligas.map(function (l) { return [l.hash, ligaCorta(l.hash) + (l.gestor ? ' · ' + l.gestor : '')]; })) },
      { k: 'NIVEL', t: 'select', et: 'Nivel', v: e.nivel == null ? '' : String(e.nivel), opts: [['', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
      { k: 'ASIG', t: 'select', et: 'Asignado (recibe la paga y señal)', v: e.asig, opts: [['', '—']].concat(o.staff.map(function (s) { return [s, s]; })) },
      { k: 'COLOR', t: 'select', et: 'Color de camiseta', pre: '<i class="gs-color" id="gs-colpre" style="background:' + esc(colorHex(e.color) || 'transparent') + '"></i>', v: e.color, opts: [['', '—']].concat(o.colores.map(function (c) { return [c.n, c.n]; })) },
      { k: 'F.L (P.S)', t: 'fecha', et: 'Fecha límite paga y señal', v: e.flP },
      { k: 'F.L (Insc)', t: 'fecha', et: 'Fecha límite inscripción', v: e.flI },
      { k: 'DESCUENTO', t: 'num', et: 'Descuento (€)', v: e.descuento == null ? '' : String(e.descuento) },
      { k: 'TEAM NEW NAME', t: 'texto', et: 'Nombre nuevo del equipo', v: e.teamNuevo, nota: 'Si lo rellenas, el equipo pasa a llamarse así en todo el Excel.' }
    ];
    var checks = [
      { k: 'M.I ENVIADO', t: 'si', et: 'Mensaje inicial enviado (M.I)', v: e.mi },
      { k: 'F.J', t: 'si', et: 'Equipo añadido al formulario de jugadoras (F.J)', v: e.fj },
      { k: 'Gr C/TS', t: 'si', et: 'En el grupo de WhatsApp de capitanas o de Team Search (Gr C/TS)', v: e.gr },
      { k: 'E.E ENVIADO', t: 'si', et: 'Estado del equipo enviado (E.E)', v: e.ee },
      { k: 'XPORTY', t: 'si', et: 'Dado de alta en Xporty', v: e.xporty },
      { k: 'CASH', t: 'si', et: 'Paga en efectivo', v: e.cash },
      { k: 'ERROR', t: 'si', et: 'Inscripción con ERROR (no cuenta)', v: e.error }
    ];
    var todos = campos.concat(checks), url = urlFila(r.gid || r.gidE, e.fila);
    var t = [];
    if (e.error) t.push(tag('ERROR', 'gs-tag-r'));
    if (e.buscan) t.push(tag('Busca equipo', 'gs-tag-g'));
    if (e.ocupado) t.push(tag('Nombre repetido ×' + e.ocupado, 'gs-tag-r'));
    if (e.revisar) t.push(tag(e.revisar, 'gs-tag-a'));
    var pend = e.pendiente == null ? '<span class="gs-pos">Al día</span>' : e.pendiente > 0 ? '<b class="gs-neg">Faltan ' + eur(e.pendiente) + '</b>' : '<b class="gs-pos">Ha pagado ' + eur(e.pendiente) + ' de más</b>';
    var v = ventana(e.equipo || 'Inscripción',
      '<p class="gs-nota" style="margin:-8px 0 8px">' + esc(compCorta(e.comp) + (e.liga ? ' · ' + ligaCorta(e.liga) : '')) + '</p>' +
      (t.length ? '<div class="gs-tags" style="margin:-4px 0 8px">' + t.join('') + '</div>' : '') +
      '<div class="gs-btns">' +
      aWa(e.linkContacto || wa(e.tel), 'Escribir a la capitana') + aWa(e.linkMensaje, 'Enviar mensaje inicial') + aWa(e.linkEstado, 'Enviar estado del equipo') +
      (!e.error && !e.buscan ? '<button type="button" class="gs-b2" id="gs-verjug">Ver jugadoras</button>' : '') +
      (e.mail ? '<button type="button" class="gs-b2" id="gs-vercorreo">Ver todo lo de su correo</button>' : '') +
      (url ? '<a class="gs-b2" href="' + esc(url) + '" target="_blank" rel="noopener">Excel ↗</a>' : '') + '</div>' +
      '<div class="gs-sec">Liga y organización</div><div class="gs-dos">' + campos.slice(0, 4).map(htmlCampo).join('') + '</div>' +
      '<div class="gs-dos">' + campos.slice(4, 7).map(htmlCampo).join('') + '</div>' + htmlCampo(campos[7]) +
      '<div class="gs-sec">Seguimiento</div><div class="gs-checks">' + checks.map(htmlCampo).join('') + '</div>' +
      htmlFotos(e.fotosLinks) +
      '<div class="gs-sec">Pagos</div><div class="gs-dl">' +
      fila('Precio', esc(e.precio)) + fila('Camisetas personalizadas', esc(e.camis)) + fila('Descuento', e.descuento ? eur(e.descuento) : '') +
      fila('Paga y señal', e.ps ? esc(e.ps + ' · ' + e.psFecha + (e.psRec ? ' · a ' + e.psRec : '')) : '<b class="gs-neg">Sin pagar</b>' + (e.flPTxt ? ' (límite ' + esc(e.flPTxt) + ')' : '')) +
      fila('Inscripción', e.pago ? esc(e.pago + ' · ' + e.pagoFecha + (e.pagoRec ? ' · a ' + e.pagoRec : '')) : 'Sin pagar' + (e.flITxt ? ' (límite ' + esc(e.flITxt) + ')' : '')) +
      fila('Pendiente', pend) + '</div>' +
      '<p class="gs-nota">Los pagos salen de ECONOMIA (MOVIMIENTOS): se apuntan en la sección Economía.</p>' +
      '<div class="gs-sec">Inscripción</div><div class="gs-dl">' +
      fila('Alta', esc(e.alta)) + fila('Correo', esc(e.mail)) + fila('Capitana', esc(e.capi)) + fila('Teléfono', esc(e.tel)) +
      fila('Nombre en el formulario', esc(e.teamForm)) + fila('Antes se llamaba', esc(e.teamAnterior)) +
      fila('Disponibilidad', esc(e.dispo)) + fila('Horas favoritas', esc(e.horas)) + fila('Nacidas en', esc(e.nacimiento)) +
      fila('Jugadoras inscritas', e.jugadoras ? esc(e.jugadoras) : '') + fila('Edad media', esc(edad1(e.edad))) + fila('Temporadas de media', esc(edad1(e.exp) || e.exp)) + '</div>' +
      (e.comenta ? '<div class="gs-dtx"><b>Comentario</b><p>' + esc(e.comenta) + '</p></div>' : '') +
      '<div class="gs-error" id="gs-err" hidden></div>' +
      '<div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-gs-cerrar>Cerrar</button><button type="button" class="gs-b1" id="gs-ok" disabled>Sin cambios</button></div>');
    engancharFotos(v.el, e.fotosLinks || [], e.equipo);
    var sc = v.el.querySelector('[data-gs-k="COLOR"]'), pre = v.el.querySelector('#gs-colpre');
    if (sc && pre) sc.addEventListener('change', function () { pre.style.background = colorHex(sc.value) || 'transparent'; });
    var vj = v.el.querySelector('#gs-verjug');
    if (vj) vj.onclick = function () { v.cerrar(); S.jug.equipo = e.equipo; S.jug.filtro = 'todas'; S.jug.q = ''; S.fComp = e.comp; S.fLiga = ''; irTab('jugadoras'); };
    var vc = v.el.querySelector('#gs-vercorreo'); if (vc) vc.onclick = function () { verCorreo(e.mail); };
    guardable(v, todos, function (c) {
      return llamar('gestionEquipoEditar', [{ fila: e.fila, ts: e.ts, mail: e.mail, comp: e.comp, equipo: e.equipo }, c]);
    }, function (c) { aplicarCambios(e, c, PROP_EQ); });
  }

  /* ---------- JUGADORAS (T0143) ---------- */
  var FILTROS_JUG = {
    todas: function (j) { return !j.error; },
    alerta: function (j) { return !!j.alerta; }, // T0237: con ERROR, ALERTA solo trae el 🔙 (recuperar la camiseta)
    xporty: function (j) { return !j.error && !j.xporty; },
    contactos: function (j) { return !j.error && !j.gcontacts; },
    personal: function (j) { return !j.error && j.incluida === '🚫'; },
    error: function (j) { return j.error; }
  };
  var MAX_LISTA = 250;

  function tagsJugadora(j) {
    var t = [];
    if (j.error) t.push(tag('ERROR · no cuenta', 'gs-tag-err'));
    if (j.porDni) t.push(tag('Mismo DNI, otro correo', 'gs-tag-a'));
    partesAlerta(j.alerta).forEach(function (x) { t.push(tag(x, 'gs-tag-a')); }); // T0237: enteras, sin cortar
    if (!j.error && !j.xporty) t.push(tag('Sin Xporty', 'gs-tag-g'));
    if (!j.error && j.incluida === '🚫') t.push(tag('Cami personalizada', 'gs-tag-g'));
    return t;
  }
  /** T0225: Jugadoras en el ordenador. Cada fila abre la ficha de la jugadora, como en el móvil. */
  function tablaJugadoras(lista, r, conEquipo) {
    return '<table class="u-tabla gs-tabla"><thead><tr>' + '<th>Inscripción</th><th>Jugadora</th>' + (conEquipo ? '<th>Equipo</th>' : '') +
      '<th>Camiseta</th><th class="num">Edad</th><th>Avisos</th></tr></thead><tbody>' +
      lista.map(function (j) {
        return '<tr tabindex="0"' + (j.error ? ' class="gs-err"' : '') + ' data-gs-j="' + r.lista.indexOf(j) + '">' + '<td class="gs-alta">' + alta(j) + '</td><td class="u-tabla-t">' + esc(j.nombreCompleto || j.mail) + '</td>' +
          (conEquipo ? '<td>' + punto(j.color) + esc(j.equipo) + (S.fComp ? '' : ' <span class="gs-opc">· ' + esc(compCorta(j.comp)) + '</span>') + '</td>' : '') +
          '<td>' + esc(j.cami || (j.dorsal ? 'Dorsal ' + j.dorsal : '')) + '</td><td class="num">' + esc(edad1(j.edad, true)) + '</td>' +
          '<td><div class="gs-tags">' + tagsJugadora(j).join('') + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function itemJugadora(j, i, conEquipo, conAlta) {
    var t = tagsJugadora(j);
    return '<button type="button" class="gs-item' + (j.error ? ' gs-err' : '') + '" data-gs-j="' + i + '"><div style="min-width:0">' +
      '<div class="gs-t">' + esc(j.nombreCompleto || j.mail) + '</div>' +
      '<div class="gs-s">' + esc([conEquipo ? compCorta(j.comp) + ' · ' + j.equipo : '', j.cami ? 'Camiseta ' + j.cami : (j.dorsal ? 'Dorsal ' + j.dorsal : ''), edad1(j.edad, true) ? edad1(j.edad, true) + ' años' : ''].filter(String).join(' · ')) +
      (j.color ? ' ' + punto(j.color) : '') + (conAlta ? ' <span class="gs-alta">· ' + alta(j) + '</span>' : '') + '</div>' +
      (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') + '</div></button>';
  }

  function pJugadoras(main, forzar) {
    return cuando(main, 'jug', forzar, 'Cargando las jugadoras…', function (o, r) {
      var f = S.jug, enF = r.lista.filter(enFiltro);
      var equipos = []; enF.forEach(function (j) { if (j.equipo && equipos.indexOf(j.equipo) < 0) equipos.push(j.equipo); });
      equipos.sort();
      if (f.equipo && equipos.indexOf(f.equipo) < 0) equipos.unshift(f.equipo);
      var base = enF.filter(function (j) { return !f.equipo || j.equipo === f.equipo; });
      var cuenta = function (k) { return base.filter(FILTROS_JUG[k]).length; };
      main.innerHTML = '<div class="gs-filtrar">' + filtrosPlegables(o, // T0232 · T0238
        '<div class="gs-fila" style="margin-top:8px"><select class="gs-sel" id="gs-jeq" aria-label="Equipo"><option value="">Todos los equipos (' + equipos.length + ')</option>' +
        equipos.map(function (x) { return '<option' + (x === f.equipo ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>') +
        chips([['todas', 'Inscritas', cuenta('todas')], ['alerta', 'Con alerta', cuenta('alerta')], ['xporty', 'Sin Xporty', cuenta('xporty')],
          ['contactos', 'Sin contacto', cuenta('contactos')], ['personal', 'Cami personalizada', cuenta('personal')], ['error', 'Con ERROR', cuenta('error')]], f.filtro, 'gs-jf') +
        '<div class="gs-fila gs-busca" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-jq" placeholder="' + buscaPh('Buscar: nombre, correo, DNI, teléfono, dorsal…') + '" value="' + esc(f.q) + '" aria-label="Buscar"></div></div>' +
        '<div id="gs-jlista"></div>';
      var pinta = function () {
        var q = norm2(f.q);
        // Buscando, se mira en toda la temporada, también lo que tiene ERROR (p. ej. dos inscripciones del mismo correo).
        var lista = porAlta(q ? r.lista.filter(function (j) { return norm2([j.nombreCompleto, j.nombre, j.ap1, j.ap2, j.dni, j.mail, j.cami, j.equipo, j.tel].join(' ')).indexOf(q) >= 0; })
          : base.filter(FILTROS_JUG[f.filtro]));
        $('#gs-jlista').innerHTML = (q ? '<p class="gs-aviso-b">Buscando en toda la temporada ' + esc(S.temp) + ', también en las inscripciones con ERROR.</p>' : '') +
          (esCorreo(f.q) ? '<p style="margin:8px 0 0"><button type="button" class="gs-b2" id="gs-jcorreo">Ver todo lo de este correo (todas las temporadas)</button></p>' : '') +
          '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + lista.length + (lista.length === 1 ? ' inscripción' : ' inscripciones') + '</p>' +
          (lista.length && ancho() ? tablaJugadoras(lista.slice(0, MAX_LISTA), r, q || !f.equipo) + // T0225
            (lista.length > MAX_LISTA ? '<div class="gs-mas">Y ' + (lista.length - MAX_LISTA) + ' más: elige un equipo o busca.</div>' : '') :
          '<div class="gs-card"><div class="gs-lista">' + (lista.length ? lista.slice(0, MAX_LISTA).map(function (j) { return itemJugadora(j, r.lista.indexOf(j), q || !f.equipo, !!q); }).join('') +
            (lista.length > MAX_LISTA ? '<div class="gs-mas">Y ' + (lista.length - MAX_LISTA) + ' más: elige un equipo o busca.</div>' : '')
            : '<div class="gs-vacio">No hay jugadoras con este filtro.</div>') + '</div></div>');
        [].forEach.call(main.querySelectorAll('[data-gs-j]'), function (b) { b.onclick = function () { fichaJugadora(r.lista[Number(b.getAttribute('data-gs-j'))], o, r, equipos); }; });
        var bc = $('#gs-jcorreo'); if (bc) bc.onclick = function () { verCorreo(f.q.trim()); };
      };
      pinta();
      engancharFiltros(main, function () { pJugadoras(main); });
      engancharPlegables(main, o, function () { pJugadoras(main); });
      $('#gs-jeq').onchange = function () { f.equipo = this.value; pJugadoras(main); };
      $('#gs-jf').onclick = function (ev) { var b = ev.target.closest('[data-gs-f]'); if (!b) return; f.filtro = b.getAttribute('data-gs-f'); f.q = ''; pJugadoras(main); };
      var t0; $('#gs-jq').oninput = function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { f.q = v; pinta(); }, 150); };
    });
  }

  function fichaJugadora(j, o, r, equipos) {
    // Equipos a los que se puede pasar: los inscritos (sin ERROR) de su competición, si ya están cargados.
    var dEq = S.datos['eq_' + String(j.comp).slice(0, 5)];
    var eqs = (dEq ? dEq.lista.filter(function (e) { return !e.error && !e.buscan && e.comp === j.comp; }).map(function (e) { return e.equipo; }) : (equipos || [])).slice().sort();
    var campos = [
      { k: 'EQUIPO', t: 'select', et: 'Equipo', v: j.equipo, opts: eqs.map(function (x) { return [x, x]; }) },
      { k: 'DORSAL - CAMISETA', t: 'texto', et: 'Dorsal y talla', v: j.dorsal, nota: 'Como en el formulario, p. ej. «DORSAL 3 - Talla S». De aquí sale la camiseta: ' + (j.cami || '—') },
      { k: 'NOMBRE', t: 'texto', et: 'Nombre', v: j.nombre },
      { k: '1er APELLIDO', t: 'texto', et: 'Primer apellido', v: j.ap1 },
      { k: '2ndo APELLIDO', t: 'texto', et: 'Segundo apellido', v: j.ap2 },
      { k: 'FECHA NACIMIENTO', t: 'fecha', et: 'Fecha de nacimiento', v: j.fnac },
      { k: 'NUMERO TELEFONO', t: 'texto', et: 'Teléfono', v: j.tel },
      { k: 'DNI', t: 'texto', et: 'DNI', v: j.dni },
      { k: 'Usuario Instagram', t: 'texto', et: 'Instagram', v: j.insta }
    ];
    var checks = [
      { k: 'XPORTY', t: 'si', et: 'Dada de alta en Xporty', v: j.xporty },
      { k: 'G.CONTACTS', t: 'si', et: 'Guardada en Google Contacts', v: j.gcontacts },
      { k: 'ERROR', t: 'si', et: 'Inscripción con ERROR (no cuenta)', v: j.error }
    ];
    var url = urlFila(r.gid || r.gidJ, j.fila);
    var alertas = partesAlerta(j.alerta).concat(j.alertaCami ? [j.alertaCami] : []).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('');
    var lAl = waUrl(j.linkAlerta);
    var v = ventana(j.nombreCompleto || 'Jugadora',
      '<p class="gs-nota" style="margin:-8px 0 8px">' + esc(compCorta(j.comp) + ' · ' + j.equipo + ' · alta ' + j.alta) + '</p>' +
      (j.error ? '<div class="gs-tags" style="margin:-4px 0 8px">' + tag('ERROR: esta inscripción no cuenta', 'gs-tag-r') + '</div>' : '') +
      (alertas ? '<div class="gs-al">' + alertas + (lAl ? '<p><a class="gs-a" href="' + esc(lAl) + '"' + (/^whatsapp:/.test(lAl) ? '' : ' target="_blank" rel="noopener"') + '>Enviar el aviso por WhatsApp</a></p>' : '') + '</div>' : '') +
      '<div class="gs-btns">' + aWa(wa(j.tel), 'WhatsApp') +
      (j.mail ? '<button type="button" class="gs-b2" id="gs-vercorreo">Ver todo lo de su correo</button>' : '') +
      (url ? '<a class="gs-b2" href="' + esc(url) + '" target="_blank" rel="noopener">Excel ↗</a>' : '') + '</div>' +
      '<div class="gs-sec">Inscripción</div>' + htmlCampo(campos[0]) + htmlCampo(campos[1]) +
      '<div class="gs-sec">Datos personales</div><div class="gs-dos">' + campos.slice(2, 9).map(htmlCampo).join('') + '</div>' +
      '<div class="gs-sec">Seguimiento</div><div class="gs-checks">' + checks.map(htmlCampo).join('') + '</div>' +
      htmlFotos(j.fotosLinks) +
      '<div class="gs-sec">Camiseta</div><div class="gs-dl">' +
      fila('Camiseta', esc(j.cami)) + fila('Incluida en el precio', j.incluida === '🚫' ? 'No: personalizada (+10 €)' : j.incluida === '✅' ? 'Sí' : '') +
      fila('Color', j.color ? punto(j.color) + esc(j.color) : '') +
      fila('Estado', j.estadoCami ? '<span id="gs-camest">' + tagEstado(j) + '</span>' : '') + fila('Pedido', esc(j.pedidoFijo)) + fila('Reparto', esc(j.reparto)) + '</div>' +
      (!j.error && j.estadoCami ? '<p style="margin:8px 0 0"><button type="button" class="gs-b2" id="gs-cammarca">Marcar la camiseta</button></p>' : '') +
      '<div class="gs-sec">Más datos</div><div class="gs-dl">' +
      fila('Alta', esc(j.alta)) + fila('Correo', esc(j.mail)) + fila('Liga', esc(ligaCorta(j.liga))) + fila('Edad', esc(edad1(j.edad, true))) +
      fila('Temporadas con nosotras', esc(j.veterania)) + fila('Normas, imagen, datos y responsabilidad', esc(j.normas)) + '</div>' +
      '<div class="gs-error" id="gs-err" hidden></div>' +
      '<div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-gs-cerrar>Cerrar</button><button type="button" class="gs-b1" id="gs-ok" disabled>Sin cambios</button></div>');
    engancharFotos(v.el, j.fotosLinks || [], j.nombreCompleto);
    var vc = v.el.querySelector('#gs-vercorreo'); if (vc) vc.onclick = function () { verCorreo(j.mail); };
    var cm = v.el.querySelector('#gs-cammarca');
    if (cm) cm.onclick = function () { ventanaCamiseta(j, function () { var x = v.el.querySelector('#gs-camest'); if (x) x.innerHTML = tagEstado(j); }); };
    guardable(v, campos.concat(checks), function (c) {
      return llamar('gestionJugadoraEditar', [{ fila: j.fila, ts: j.ts, mail: j.mail, comp: j.comp, nombre: j.nombreCompleto }, c]);
    }, function (c) {
      aplicarCambios(j, c, PROP_JUG);
      if (c['NOMBRE'] != null || c['1er APELLIDO'] != null) j.nombreCompleto = (j.nombre + ' ' + j.ap1).trim();
    });
  }

  /* ---------- CAMISETAS (T0234) ----------
   * Solo las inscripciones con camiseta y sin ERROR (las que tienen ESTADO CAMISETA, como DB_CAMISETAS).
   * «Recalculando»: se acaba de quitar la marca y el estado depende del pedido; lo da GESTION al pulsar ↻. */
  // [estado, chip, color de la etiqueta, en el resumen del equipo: una, varias]
  var ESTADOS_CAM = [['Por pedir', 'Por pedir', 'gs-tag-r', 'por pedir', 'por pedir'], ['Pedida', 'Pedidas', 'gs-tag-g', 'pedida', 'pedidas'],
    ['Por preparar', 'Por preparar', 'gs-tag-a', 'por preparar', 'por preparar'], ['Preparada', 'Preparadas', '', 'preparada', 'preparadas'],
    ['Entregada', 'Entregadas', 'gs-tag-v', 'entregada', 'entregadas'], ['Sin camiseta', 'Sin camiseta', 'gs-tag-g', 'sin camiseta', 'sin camiseta']];
  // T0246: «Sin camiseta» es para quien no tendrá camiseta (p. ej. de una temporada pasada que no la recogió): ni se pide ni guarda una del local.
  var MARCAS = ['Preparada', 'Entregada', 'No llegó', 'Defectuosa', 'Sin camiseta'];
  /** Ya no falta nada: entregada o sin camiseta (T0246). */
  function camHecha(j) { return j.estadoCami === 'Entregada' || j.estadoCami === 'Sin camiseta'; }
  function conCami(j) { return !j.error && !!j.estadoCami; }
  function tagEstado(j) {
    if (j.estadoCami === 'Recalculando') return tag('Recalculando: pulsa ↻', 'gs-tag-g');
    var e = ESTADOS_CAM.filter(function (x) { return x[0] === j.estadoCami; })[0];
    return tag(j.estadoCami, e ? e[2] : 'gs-tag-g');
  }
  /** Lo que hace falta saber de su camiseta en cada estado: el pedido si está pedida, el reparto si está preparada. */
  function detalleCami(j) {
    var x = [j.cami];
    if (j.marca === 'No llegó' || j.marca === 'Defectuosa') x.push(j.marca);
    if (j.estadoCami === 'Pedida' && j.pedidoFijo) x.push('Pedido ' + j.pedidoFijo);
    // Recién marcada, REPARTO aún no se ha recalculado en GESTION: no es que no tenga partido.
    if (j.estadoCami === 'Preparada') x.push(j.reparto ? 'Reparto: ' + j.reparto : j.recalc ? 'Reparto: lo calcula GESTION, pulsa ↻ en un minuto' : 'Sin reparto: el equipo no tiene próximo partido');
    return x.filter(String).join(' · ');
  }
  /** El paso que se da desde la lista; el resto (No llegó, Defectuosa, quitar la marca), en su ventana. */
  /** T0237: la alerta de su camiseta (repartir hoy, reparto pasado, sin partido); «por pedir» ya lo dice su estado. */
  function tagAlertaCam(j) { var a = alertaCam(j); return a && a[0] !== 'pedir' ? tag(a[0] === 'hoy' ? 'Repartir hoy' : a[0] === 'pasado' ? 'Reparto pasado' : 'Sin partido', a[4]) : ''; }
  function siguiente(j) { return j.estadoCami === 'Por preparar' ? 'Preparada' : j.estadoCami === 'Preparada' ? 'Entregada' : ''; }

  /** Escribe MARCA CAMISETA en GESTION (gestionJugadoraEditar) y pone en lo cargado el estado que devuelve el motor. */
  function marcar(j, marca) {
    return llamar('gestionJugadoraEditar', [{ fila: j.fila, ts: j.ts, mail: j.mail, comp: j.comp, nombre: j.nombreCompleto }, { 'MARCA CAMISETA': marca }]).then(function (r) {
      if (r.cambios) { j.marca = marca; j.reparto = ''; j.alertaCami = ''; j.recalc = true; if (r.estadoCami) j.estadoCami = r.estadoCami; }
      aviso(r.cambios ? (j.nombreCompleto || 'Camiseta') + ': ' + (marca ? marca.toLowerCase() : 'sin marca') + '.' : 'Ya estaba así.');
      return r;
    });
  }
  /** Botón que marca: se desactiva mientras guarda y avisa si GESTION está recalculando. */
  function conEspera(b, fn) {
    var antes = b.textContent; b.disabled = true; b.textContent = 'Guardando…';
    // T0237: texto corto; el largo no cabía en el botón y aplastaba el nombre de la jugadora en el móvil.
    var lento = setTimeout(function () { b.textContent = 'Recalculando…'; b.title = 'El Excel está recalculando: puede tardar un minuto'; }, 8000);
    return fn().then(function (r) { clearTimeout(lento); return r; }, function (e) { clearTimeout(lento); b.disabled = false; b.textContent = antes; b.title = ''; throw e; });
  }

  /** Ventana de una camiseta: sus datos y las cuatro marcas (la puesta, apretada) o quitarla. */
  function ventanaCamiseta(j, hecho) {
    var v = ventana(j.nombreCompleto || 'Camiseta',
      '<p class="gs-nota" style="margin:-8px 0 8px">' + esc(compCorta(j.comp) + ' · ' + j.equipo) + '</p>' +
      '<div class="gs-dl">' + fila('Camiseta', esc(j.cami)) + fila('Color', j.color ? punto(j.color) + esc(j.color) : '') +
      fila('Estado', tagEstado(j)) + fila('Pedido', esc(j.pedidoFijo)) + fila('Reparto', esc(j.reparto)) + fila('Marca', esc(j.marca) || 'Sin marca') + '</div>' +
      '<div class="gs-sec">Marcar como</div><div class="gs-marcas">' + MARCAS.map(function (m) {
        return '<button type="button" class="gs-b2" data-gs-marca="' + esc(m) + '" aria-pressed="' + (j.marca === m) + '">' + esc(m) + '</button>';
      }).join('') + '</div>' +
      '<p class="gs-nota">No llegó y Defectuosa la vuelven a Por pedir; «Actualizar camisetas» del Excel CAMISETAS apunta el −1 en el stock. Sin camiseta: no se le hará (no se pide ni guarda una del local).</p>' +
      '<div class="gs-error" id="gs-err" hidden></div>' +
      '<div class="gs-acc">' + (j.marca ? '<button type="button" class="gs-b2 gs-b2r" data-gs-marca="">Quitar la marca</button>' : '') +
      '<button type="button" class="gs-b2" data-gs-cerrar>Cerrar</button></div>');
    var err = v.el.querySelector('#gs-err');
    [].forEach.call(v.el.querySelectorAll('[data-gs-marca]'), function (b) {
      b.onclick = function () {
        var m = b.getAttribute('data-gs-marca');
        if (m === j.marca) { v.cerrar(); return; }
        err.hidden = true;
        [].forEach.call(v.el.querySelectorAll('[data-gs-marca]'), function (x) { x.disabled = true; });
        conEspera(b, function () { return marcar(j, m); }).then(function () { v.cerrar(); if (hecho) hecho(); pintar(); }, function (e) {
          [].forEach.call(v.el.querySelectorAll('[data-gs-marca]'), function (x) { x.disabled = false; });
          err.textContent = e.message; err.hidden = false;
        });
      };
    });
  }

  /* ---------- T0240 · Camisetas › Stock y Pedidos (Excel CAMISETAS, solo lectura) ---------- */
  var VISTAS_CAM = [['entregas', 'Entregas'], ['stock', 'Stock'], ['pedidos', 'Pedidos']];
  function selVista() {
    return '<div class="gs-sw gs-sw3" id="gs-csv" role="group" aria-label="Camisetas">' + VISTAS_CAM.map(function (v) {
      return '<button type="button" data-gs-csv="' + v[0] + '" aria-pressed="' + (S.cs.vista === v[0]) + '">' + v[1] + '</button>';
    }).join('') + '</div>';
  }
  function engancharVista(main) {
    var sv = $('#gs-csv'); if (!sv) return;
    sv.onclick = function (e) { var b = e.target.closest('[data-gs-csv]'); if (!b) return; S.cs.vista = b.getAttribute('data-gs-csv'); window.scrollTo(0, 0); pCamisetas(main); };
  }
  /** Muestra del color: el de DB_COLORES de CAMISETAS y, si no está, el de GESTION. */
  function puntoCam(r, n) {
    var c = (r.colores || {})[n], h = c ? c[0] : colorHex(n);
    return h ? '<i class="gs-color" style="background:' + esc(h) + '" title="' + esc(n) + '"></i>' : '';
  }
  function numCam(n) { return n ? '<span class="' + (n < 0 ? 'gs-neg' : '') + '">' + n + '</span>' : ''; }
  /**
   * T0246 · Stock y Pedidos van por modelo, sin temporada: el modelo es de la competición y sus camisetas sirven a todas
   * las competiciones que lo llevan, de cualquier temporada. Debajo, esas competiciones y el proveedor.
   */
  function filtrosCam(r) {
    var info = modeloCam(r);
    return '<div class="gs-filtros gs-cs-f">' +
      '<select class="gs-sel" id="gs-csm" aria-label="Modelo">' + r.modelos.map(function (m) {
        return '<option value="' + esc(m.modelo) + '"' + (m.modelo === r.modelo ? ' selected' : '') + '>' + esc(m.modelo) + '</option>';
      }).join('') + '</select></div>' +
      (info ? '<p class="gs-nota gs-cs-mi">' + esc([info.comps.length ? 'Lo llevan ' + info.comps.join(', ') : 'Ninguna competición lo lleva', info.proveedor].filter(String).join(' · ')) + '</p>' : '');
  }
  function modeloCam(r) { return r.modelos.filter(function (x) { return x.modelo === r.modelo; })[0]; }
  function engancharFiltrosCam(main) {
    var m = $('#gs-csm'); if (m) m.onchange = function () { S.cs.modelo = m.value; pCamisetas(main); };
  }
  function cuandoCam(main, forzar, msg, pinta) {
    var tab = S.tab, vista = S.cs.vista, clave = 'cs_' + S.cs.modelo;
    if (forzar || !S.datos[clave]) main.innerHTML = selVista() + cargando(msg);
    engancharVista(main);
    return opciones().then(function () {
      return dato(clave, 'camisetasDatos', [S.cs.modelo, !!forzar], forzar);
    }).then(function (r) {
      if (S.tab !== tab || S.cs.vista !== vista || !document.body.contains(main)) return;
      // Sin modelo elegido (o uno que ya no está), el motor da el que más jugadoras tiene en la temporada en curso.
      if (r.modelo !== S.cs.modelo) { S.cs.modelo = r.modelo; S.datos['cs_' + r.modelo] = r; }
      hora(r.hora);
      main.innerHTML = selVista() + pinta(r) + '<p class="gs-nota gs-cs-pie">Solo lectura, del Excel CAMISETAS' +
        (r.url ? ' (<a href="' + esc(r.url) + '" target="_blank" rel="noopener">abrir</a>)' : '') + '. Los pedidos y el recuento se hacen con su menú «Camisetas».</p>';
      engancharVista(main); engancharFiltrosCam(main);
      return r;
    }).then(null, function (e) {
      if (S.tab !== tab || S.cs.vista !== vista) return;
      main.innerHTML = selVista() + errorHtml(e) + '<p style="text-align:center"><button class="gs-chip" type="button" id="gs-reint">Reintentar</button></p>';
      engancharVista(main);
      var b = $('#gs-reint'); if (b) b.onclick = function () { pintar(true); };
    });
  }

  /** Stock: libres (o en el local) por modelo, color y dorsal-talla. Las mismas cuentas que la pestaña STOCK. */
  function pCamStock(main, forzar) {
    return cuandoCam(main, forzar, 'Cargando el stock…', function (r) {
      var f = S.cs, k = f.ver === 'local' ? 'local' : 'libres';
      var filas = r.stock;
      var suma = function (c) { return filas.reduce(function (s, x) { return s + x[c]; }, 0); };
      var neg = filas.filter(function (x) { return x[k] < 0; }).length;
      var h = filtrosCam(r) +
        chips([['libres', 'Libres'], ['local', 'En el local']], k, 'gs-csver') +
        '<div class="gs-kpis gs-cs-kpis">' +
          '<div class="gs-kpi"><b>En el local</b><span class="gs-val">' + suma('local') + '</span><span class="gs-sub">sueltas, sin contar los packs</span></div>' +
          '<div class="gs-kpi"><b>Por preparar</b><span class="gs-val">' + suma('reservadas') + '</span><span class="gs-sub">asignadas, falta el pack</span></div>' +
          '<div class="gs-kpi"><b>Libres</b><span class="gs-val">' + suma('libres') + '</span><span class="gs-sub">en el local, sin dueña</span></div>' +
          '<div class="gs-kpi"><b>En negativo</b><span class="gs-val ' + (neg ? 'gs-neg' : 'gs-pos') + '">' + neg + '</span><span class="gs-sub">' + (neg ? 'revisa con un recuento' : 'todo cuadra') + '</span></div>' +
        '</div>' +
        (neg ? '<div class="gs-al"><p>' + neg + (neg === 1 ? ' combinación sale' : ' combinaciones salen') + ' en negativo (en rojo): se han dado más camisetas de las que constan. Un recuento del local lo corrige.</p></div>' : '');
      // Color × dorsal-talla con lo que no es cero.
      var fm = filas.filter(function (x) { return x[k] !== 0; }), m = r.modelo;
      if (!fm.length) return h + '<div class="gs-vacio">' + (k === 'libres' ? 'No hay camisetas libres' : 'No hay camisetas en el local') + (m ? ' de ' + esc(m) : '') + '.</div>';
      return h + (function () {
        var cols = [], camis = [];
        fm.forEach(function (x) { if (cols.indexOf(x.color) < 0) cols.push(x.color); if (camis.indexOf(x.cami) < 0) camis.push(x.cami); });
        camis.sort(ordenCami);
        var val = function (c, ca) { var x = fm.filter(function (y) { return y.color === c && y.cami === ca; })[0]; return x ? x[k] : 0; };
        var tot = fm.reduce(function (s, x) { return s + x[k]; }, 0);
        var cab = '<div class="gs-cs-mh"><b>' + esc(m) + '</b><span>' + tot + (k === 'libres' ? ' libres' : ' en el local') + '</span></div>';
        if (ancho()) {
          return '<section class="gs-card">' + cab + '<div class="gs-cs-tw"><table class="gs-cs-t"><thead><tr><th>Color</th>' + camis.map(function (ca) { return '<th>' + esc(ca) + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>' +
            cols.map(function (c) {
              var t = 0;
              return '<tr><th>' + puntoCam(r, c) + esc(c) + '</th>' + camis.map(function (ca) { var n = val(c, ca); t += n; return '<td' + (n < 0 ? ' class="gs-cs-neg"' : '') + '>' + numCam(n) + '</td>'; }).join('') + '<td class="gs-cs-tot">' + numCam(t) + '</td></tr>';
            }).join('') +
            '</tbody><tfoot><tr><th>Total</th>' + camis.map(function (ca) { return '<td>' + numCam(cols.reduce(function (s, c) { return s + val(c, ca); }, 0)) + '</td>'; }).join('') + '<td>' + tot + '</td></tr></tfoot></table></div></section>';
        }
        return '<section class="gs-card">' + cab + cols.map(function (c) {
          var lc = camis.filter(function (ca) { return val(c, ca); }), t = lc.reduce(function (s, ca) { return s + val(c, ca); }, 0);
          return '<div class="gs-cs-c"><div class="gs-cs-ch"><b>' + puntoCam(r, c) + '<span>' + esc(c) + '</span></b><span class="' + (t < 0 ? 'gs-neg' : '') + '">' + t + '</span></div>' +
            '<div class="gs-cs-ks">' + lc.map(function (ca) { var n = val(c, ca); return '<span class="gs-cs-k' + (n < 0 ? ' gs-cs-neg' : '') + '">' + esc(ca) + ' <b>' + n + '</b></span>'; }).join('') + '</div></div>';
        }).join('') + '</section>';
      })();
    }).then(function (r) {
      var c = $('#gs-csver'); if (r && c) c.onclick = function (e) { var b = e.target.closest('[data-gs-f]'); if (!b) return; S.cs.ver = b.getAttribute('data-gs-f'); pCamisetas(main); };
    });
  }
  function ordenCami(a, b) {
    var t = ['XS', 'S', 'M', 'L', 'XL', 'XXL'], pa = String(a).split(' - '), pb = String(b).split(' - ');
    var na = parseInt(pa[0], 10), nb = parseInt(pb[0], 10);
    if (na !== nb) return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    return t.indexOf(pa[1]) - t.indexOf(pb[1]);
  }

  /** Pedidos del modelo (T0246; de cualquier temporada) con su paso (preparado → confirmado → asignado → recibido → en stock) y lo que falta. */
  var PASOS_PED = ['Preparado', 'Confirmado', 'Asignado', 'Recibido', 'En stock'];
  function pCamPedidos(main, forzar) {
    return cuandoCam(main, forzar, 'Cargando los pedidos…', function (r) {
      var f = S.cs, orden = r.pasos.map(function (p) { return p[0]; });
      var marcha = r.pedidos.filter(function (p) { return p.paso !== 'enStock'; });
      var lista = f.ped === 'todos' ? r.pedidos : marcha;
      var h = filtrosCam(r) + chips([['marcha', 'En marcha', marcha.length], ['todos', 'Todos', r.pedidos.length]], f.ped === 'todos' ? 'todos' : 'marcha', 'gs-csped');
      if (!lista.length) return h + '<div class="gs-vacio">' + (r.pedidos.length ? 'Todos los pedidos de ' + esc(r.modelo) + ' ya están en stock.' : 'No hay pedidos de ' + esc(r.modelo) + '.') + '</div>';
      return h + '<div class="gs-cs-peds">' + lista.map(function (p) {
        var i = orden.indexOf(p.paso), paso = r.pasos[i] || [], j = p.jugadoras || { total: 0, porEstado: {} };
        // Por entregar: solo lo que aún no tiene la jugadora (las entregadas no se cuentan).
        var pend = Object.keys(j.porEstado).filter(function (e) { return e !== 'Entregada'; }).map(function (e) {
          var x = ESTADOS_CAM.filter(function (y) { return y[0] === e; })[0], n = j.porEstado[e];
          return n + ' ' + (x ? (n === 1 ? x[3] : x[4]) : e.toLowerCase());
        });
        var huecos = p.asignado && !p.enStock && p.unidades > j.total ? p.unidades - j.total : 0;
        var porEntregar = pend.concat(huecos ? [huecos + ' sin jugadora'] : []).join(' · ') || (j.total ? 'nada: todas entregadas' : p.asignado || p.enStock ? 'ninguna jugadora tiene este pedido' : '');
        return '<section class="gs-card gs-cs-p"><div class="gs-cam-h"><b><span>' + esc(p.hash) + '</span></b>' + tag(paso[1] || p.paso, p.paso === 'enStock' ? 'gs-tag-v' : p.paso === 'sinConfirmar' ? 'gs-tag-r' : 'gs-tag-a') + '</div>' +
          '<div class="gs-cam-s">' + esc([p.temp, p.unidades + ' camisetas', p.fecha ? 'pedido el ' + p.fecha : ''].filter(String).join(' · ')) + '</div>' +
          '<div class="gs-pasos" aria-label="Paso ' + (i + 1) + ' de ' + PASOS_PED.length + '">' + PASOS_PED.map(function (n, x) {
            var c = x < i || p.paso === 'enStock' ? 'gs-hecho' : x === i ? 'gs-ahora' : '';
            return '<span class="' + c + '"><i></i><small>' + n + '</small></span>';
          }).join('') + '</div>' +
          (paso[2] ? '<p class="gs-cs-sig"><b>Falta:</b> ' + esc(paso[2]) + '</p>' : p.paso === 'asignado' ? '<p class="gs-cs-sig">Esperando al proveedor' + (p.estimada ? ': llega el ' + esc(p.estimada) : '') + '.</p>' :
            p.paso === 'enStock' ? '<p class="gs-cs-sig">Llegó y se volcó en el stock' + (p.enStock ? ' el ' + esc(p.enStock) : '') + ': sus camisetas ya cuentan en el local.</p>' : '') +
          '<div class="gs-dl gs-cs-dl">' + fila('Proveedor', esc(p.proveedor)) + fila('Contacto', esc(p.contacto)) +
            fila('Importe', p.precio != null ? eur(p.precio) + (p.unidades ? ' · ' + eur(p.precio / p.unidades) + ' cada una' : '') : '') +
            fila('Factura', p.factura ? '<span data-gs-fac="' + esc(p.factura) + '">' + esc(p.factura) + '</span>' : '') + fila('Entrega prevista', p.paso !== 'enStock' && p.paso !== 'recibido' ? esc(p.estimada) : '') +
            fila('Asignado', esc(p.asignado)) + fila('En stock', esc(p.enStock)) +
            // Asignado y aún no en stock: las del pedido sin jugadora (bajas o cambios) son huecos que «Actualizar camisetas» da a las
            // próximas inscripciones que encajen. En stock ya cuentan como libres en el local.
            fila('Por entregar', esc(porEntregar)) + '</div>' +
          (p.colores.length ? '<details class="gs-alt gs-cs-col"><summary><span>Por color y talla</span><em>' + p.colores.length + (p.colores.length === 1 ? ' color' : ' colores') + '</em></summary>' +
            p.colores.map(function (c) {
              return '<div class="gs-cs-cl"><b>' + puntoCam(r, c.color) + '<span>' + esc(c.color) + '</span></b><span>' + c.n + '</span><small>' + esc(c.tallas.map(function (t) { return t[0] + ' ' + t[1]; }).join(' · ')) + '</small></div>';
            }).join('') + '</details>' : '') +
          '</section>';
      }).join('') + '</div>';
    }).then(function (r) {
      var c = $('#gs-csped'); if (r && c) c.onclick = function (e) { var b = e.target.closest('[data-gs-f]'); if (!b) return; S.cs.ped = b.getAttribute('data-gs-f'); pCamisetas(main); };
      if (r) enlazarFacturas(main, r);
    });
  }
  /** «F.58», «f.058 algo.pdf» → «F.58» (como ecoCodigoArchivo_ de Economía). */
  function codFactura(t) { var m = String(t || '').trim().match(/^([A-Za-z]+)\.?\s*0*(\d+)/); return m ? m[1].toUpperCase() + '.' + m[2] : String(t || '').trim().toUpperCase(); }
  /** La factura de cada pedido, a su archivo de Drive (camisetasFacturas, de ECONOMIA); si no se encuentra, a la carpeta FACTURAS. */
  function enlazarFacturas(main, r) {
    var els = main.querySelectorAll('[data-gs-fac]'); if (!els.length) return;
    var cods = [].map.call(els, function (x) { return x.getAttribute('data-gs-fac'); }), clave = 'csfac_' + r.modelo;
    var pintar = function (m) {
      [].forEach.call(main.querySelectorAll('[data-gs-fac]'), function (x) {
        var t = x.getAttribute('data-gs-fac'), u = m[codFactura(t)];
        if (u) x.innerHTML = '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + ' · abrir en Drive ↗</a>';
        else if (m._carpeta) x.innerHTML = esc(t) + ' · <a href="' + esc(m._carpeta) + '" target="_blank" rel="noopener">buscar en FACTURAS ↗</a>';
      });
    };
    if (S.datos[clave]) return pintar(S.datos[clave]);
    llamar('camisetasFacturas', [cods]).then(function (m) { S.datos[clave] = m; if (document.body.contains(main)) pintar(m); }, function () {});
  }

  function pCamisetas(main, forzar) {
    if (S.cs.vista === 'stock') return pCamStock(main, forzar);
    if (S.cs.vista === 'pedidos') return pCamPedidos(main, forzar);
    return cuando(main, 'jug', forzar, 'Cargando las camisetas…', function (o, r) {
      var f = S.cam, enF = r.lista.filter(function (j) { return conCami(j) && enFiltro(j); });
      // T0237: desde Alertas › Camisetas llega con un equipo (comp|equipo); se quita con su chip.
      var eqF = f.equipo && enF.filter(function (j) { return j.comp + '|' + j.equipo === f.equipo; })[0];
      if (f.equipo && !eqF) f.equipo = '';
      var base = enF.filter(function (j) { return !f.equipo || j.comp + '|' + j.equipo === f.equipo; });
      var es = function (k) { return function (j) { return k === 'todas' || (k === 'alerta' ? !!alertaCam(j) : k === 'pendientes' ? !camHecha(j) : j.estadoCami === k); }; };
      var cuenta = function (k) { return base.filter(es(k)).length; };
      main.innerHTML = selVista() + '<div class="gs-filtrar">' + filtrosPlegables(o) + // T0238 · T0240: selector de vista
        (eqF ? '<div class="gs-chips" style="margin-top:10px"><button type="button" class="gs-chip" id="gs-cameq" aria-pressed="true">' + punto(eqF.color) + esc(eqF.equipo) + ' ✕</button></div>' : '') + // T0237
        chips([['alerta', 'Para hacer', cuenta('alerta')], ['pendientes', 'Por entregar', cuenta('pendientes')]].concat(ESTADOS_CAM.map(function (e) { return [e[0], e[1], cuenta(e[0])]; })).concat([['todas', 'Todas', base.length]]), f.filtro, 'gs-camf') +
        '<div class="gs-fila gs-busca" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-camq" placeholder="' + buscaPh('Buscar: equipo, jugadora, dorsal…') + '" value="' + esc(f.q) + '" aria-label="Buscar"></div></div>' +
        '<p class="gs-nota" style="margin:8px 2px 0">Lo que marques aquí lo recoge solo el Excel CAMISETAS. El stock y los pedidos, arriba.</p>' +
        '<div id="gs-camlista"></div>';
      var pinta = function () {
        var q = norm2(f.q);
        var vale = function (j) { return !q || norm2([j.equipo, j.nombreCompleto, j.cami, j.mail].join(' ')).indexOf(q) >= 0; };
        // Equipos con alguna camiseta del filtro; «Ver todo el equipo» enseña también las demás (entregadas y pendientes).
        var grupos = {}, orden = [];
        base.forEach(function (j) { var k = j.comp + '|' + j.equipo; if (!grupos[k]) { grupos[k] = []; orden.push(k); } grupos[k].push(j); });
        var eqs = orden.filter(function (k) { return grupos[k].some(function (j) { return es(f.filtro)(j) && vale(j); }); });
        eqs.sort(function (a, b) { return grupos[a][0].equipo.localeCompare(grupos[b][0].equipo); });
        var n = 0;
        var h = eqs.map(function (k) {
          var todas = porAlta(grupos[k]); // T0235
          var verTodo = !!f.todo[k] || f.filtro === 'todas';
          var lista = verTodo ? todas : todas.filter(function (j) { return es(f.filtro)(j) && vale(j); });
          n += lista.length;
          // T0246: las «Sin camiseta» no cuentan para entregar
          var ent = todas.filter(function (j) { return j.estadoCami === 'Entregada'; }).length, e0 = todas[0];
          var aDar = todas.filter(function (j) { return j.estadoCami !== 'Sin camiseta'; }).length;
          var resto = ESTADOS_CAM.filter(function (e) { return e[0] !== 'Entregada'; }).map(function (e) {
            var c = todas.filter(function (j) { return j.estadoCami === e[0]; }).length; return c ? c + ' ' + (c === 1 ? e[3] : e[4]) : '';
          }).filter(String);
          return '<section class="gs-card gs-cam-eq"><div class="gs-cam-h"><b>' + punto(e0.color) + '<span>' + esc(e0.equipo) + '</span></b>' +
            '<span class="' + (ent === aDar ? 'gs-pos' : '') + '">' + ent + ' de ' + aDar + ' entregadas</span></div>' +
            '<div class="gs-barra"><i class="gs-ok" style="width:' + (aDar ? Math.round(100 * ent / aDar) : 100) + '%"></i></div>' +
            '<div class="gs-cam-s">' + esc([S.fComp ? '' : compCorta(e0.comp), e0.liga ? ligaCorta(e0.liga) : '', resto.join(' · ') || 'Todo entregado'].filter(String).join(' · ')) + '</div>' +
            lista.map(function (j) {
              var s = siguiente(j), i = r.lista.indexOf(j);
              return '<div class="gs-cam-j"><button type="button" class="gs-cam-n" data-gs-cj="' + i + '"><b>' + esc(j.nombreCompleto || j.mail) + '</b>' +
                '<small>' + esc(detalleCami(j)) + '</small><div class="gs-tags">' + tagEstado(j) + tagAlertaCam(j) + '</div></button>' +
                (s ? '<button type="button" class="gs-b2" data-gs-sig="' + i + '">' + esc(s) + '</button>' : '') + '</div>';
            }).join('') +
            (f.filtro !== 'todas' && todas.length > lista.length || f.todo[k] ? '<p class="gs-cam-mas"><button type="button" class="gs-chip" data-gs-todo="' + esc(k) + '">' +
              (f.todo[k] ? 'Ver solo ' + (f.filtro === 'pendientes' ? 'lo que falta' : f.filtro === 'alerta' ? 'lo que hay que hacer' : 'el filtro') : 'Ver todo el equipo (' + todas.length + ')') + '</button></p>' : '') +
            '</section>';
        }).join('');
        $('#gs-camlista').innerHTML = (q ? '<p class="gs-aviso-b">Buscando en las camisetas de ' + esc(S.temp) + ' con este filtro.</p>' : '') +
          '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + n + (n === 1 ? ' camiseta' : ' camisetas') + ' · ' + eqs.length + (eqs.length === 1 ? ' equipo' : ' equipos') + '</p>' +
          (eqs.length ? '<div class="gs-cam-eqs">' + h + '</div>' : '<div class="gs-vacio">' + (base.length ? 'No hay camisetas con este filtro.' : 'No hay camisetas en esta temporada.') + '</div>');
        [].forEach.call(main.querySelectorAll('[data-gs-cj]'), function (b) { b.onclick = function () { ventanaCamiseta(r.lista[Number(b.getAttribute('data-gs-cj'))]); }; });
        [].forEach.call(main.querySelectorAll('[data-gs-sig]'), function (b) {
          b.onclick = function () {
            var j = r.lista[Number(b.getAttribute('data-gs-sig'))];
            conEspera(b, function () { return marcar(j, siguiente(j)); }).then(function () { pCamisetas(main); }, function (e) { aviso(e.message); });
          };
        });
        [].forEach.call(main.querySelectorAll('[data-gs-todo]'), function (b) { b.onclick = function () { var k = b.getAttribute('data-gs-todo'); f.todo[k] = !f.todo[k]; pinta(); }; });
      };
      pinta();
      engancharVista(main);
      engancharFiltros(main, function () { pCamisetas(main); });
      engancharPlegables(main, o, function () { pCamisetas(main); });
      var be = $('#gs-cameq'); if (be) be.onclick = function () { f.equipo = ''; pCamisetas(main); };
      $('#gs-camf').onclick = function (ev) { var b = ev.target.closest('[data-gs-f]'); if (!b) return; f.filtro = b.getAttribute('data-gs-f'); f.todo = {}; pCamisetas(main); };
      var t0; $('#gs-camq').oninput = function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { f.q = v; pinta(); }, 150); };
    });
  }

  /* ---------- todo lo de un correo (todas las temporadas) ---------- */
  function verCorreo(mail) {
    var v = ventana(mail, cargando('Buscando en todo GESTION…'));
    var c = { mail: String(mail || '').trim().toLowerCase() };
    opciones().then(function (o) {
      return llamar('gestionCorreo', [c.mail]).then(function (r) {
        var h = '<p class="gs-nota" style="margin:-8px 0 6px">Todas las temporadas. Lo más reciente, arriba.</p>' +
          '<div class="gs-sec">Inscripciones de jugadora (' + r.jugadoras.length + ')</div>' +
          (r.jugadoras.length ? '<div class="gs-lista">' + r.jugadoras.map(function (j, i) {
            return itemJugadora(j, i, true).replace('<div class="gs-s">', '<div class="gs-s">' + esc('Alta ' + j.alta) + ' · ');
          }).join('') + '</div>' : '<p class="gs-nota">Ninguna.</p>') +
          '<div class="gs-sec">Inscripciones de equipo como capitana (' + r.equipos.length + ')</div>' +
          (r.equipos.length ? '<div class="gs-lista">' + r.equipos.map(function (e, i) {
            return '<button type="button" class="gs-item' + (e.error ? ' gs-err' : '') + '" data-gs-ce="' + i + '"><div style="min-width:0"><div class="gs-t">' + punto(e.color) + esc(e.equipo || '(sin nombre)') + '</div>' +
              '<div class="gs-s">' + esc(['Alta ' + e.alta, compCorta(e.comp) || e.comp, e.liga ? ligaCorta(e.liga) : ''].filter(String).join(' · ')) + '</div>' +
              (e.error ? '<div class="gs-tags">' + tag('ERROR · no cuenta', 'gs-tag-err') + '</div>' : '') + '</div></button>';
          }).join('') + '</div>' : '<p class="gs-nota">Ninguna.</p>');
        v.el.innerHTML = v.el.querySelector('h2').outerHTML + h;
        [].forEach.call(v.el.querySelectorAll('[data-gs-j]'), function (b) { b.onclick = function () { fichaJugadora(r.jugadoras[Number(b.getAttribute('data-gs-j'))], o, { gidJ: r.gidJ }); }; });
        [].forEach.call(v.el.querySelectorAll('[data-gs-ce]'), function (b) { b.onclick = function () { fichaEquipo(r.equipos[Number(b.getAttribute('data-gs-ce'))], o, { gidE: r.gidE }); }; });
      });
    }).then(null, function (e) { var g = v.el.querySelector('.gs-cargando'); if (g) g.outerHTML = errorHtml(e); });
  }

  M.GESTION = { abrir: abrir };
})();
