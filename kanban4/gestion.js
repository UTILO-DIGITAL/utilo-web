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
 * WhatsApp: en el móvil se abre la app (whatsapp://); en el ordenador, WhatsApp Web.
 * Mismo estilo que Economía (se copia de economia.js con el prefijo gs-). Cada cambio queda en GESTION › LOG_APP.
 */
(function () {
  'use strict';
  var M = window.SX_MOD = window.SX_MOD || {};
  if (M.GESTION) return;

  // temp: temporada cargada (todas sus competiciones); fComp y fLiga: filtros de la app; dia: día elegido en Resumen.
  var S = { tab: 'resumen', temp: '', fComp: '', fLiga: '', dia: '', datos: {}, opciones: null, el: null,
    eq: { filtro: 'todos', q: '' }, jug: { filtro: 'todas', q: '', equipo: '' } };

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
      '--gs-g:var(--color-suave);--gs-l:var(--color-linea);--gs-f:var(--color-bloque);--gs-am:var(--estado-pr);' +
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
      '.gs-main{max-width:760px;margin:0 auto;padding:var(--e4) var(--e4) 120px}' +
      '.gs-fila{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center}' +
      // Campos: los de base.css (.u input, .u select). Aquí solo el ancho.
      '.gs input[type=date]{-webkit-appearance:none;appearance:none;width:100%}' +
      '.gs textarea{width:100%}' +
      '.gs-sel{flex:1 1 140px}' +
      '.gs-card{background:var(--color-superficie);border:1px solid var(--gs-l);border-radius:var(--radio);padding:var(--e3) var(--e4);margin-top:var(--e3)}' +
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
      '@media(min-width:900px){.gs-fab{bottom:var(--e4)}.gs-aviso{bottom:84px}.gs-main{padding-bottom:var(--e7)}}';
  }

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
      '.gs-liga summary{list-style:none;cursor:pointer;position:relative;padding-right:28px}.gs-liga summary::-webkit-details-marker{display:none}' +
      '.gs-liga summary:after{content:"\\25BE";position:absolute;right:0;top:0;font-size:20px;color:var(--gs-g);transition:transform .15s}.gs-liga[open] summary:after{transform:rotate(180deg)}' +
      '.gs-liga[open] summary{margin-bottom:var(--e2)}' +
      '.gs-liga-n{font:var(--peso-titulos) 20px/1.2 var(--fuente-titulos);color:var(--color-principal-oscuro)}' +
      '.gs-liga-n small{display:block;font:700 12px/1.3 var(--fuente-texto);letter-spacing:.04em;text-transform:uppercase;color:var(--gs-g);margin-bottom:2px}' +
      '.gs-liga-g{display:flex;align-items:center;gap:var(--e2);flex-wrap:wrap;margin-top:var(--e2);font-size:14px}' +
      '.gs-wa{display:inline-flex;align-items:center;min-height:36px;padding:0 var(--e3);border-radius:var(--radio);border:1.5px solid var(--color-principal-oscuro);color:var(--color-principal-oscuro);text-decoration:none;font:700 13px/1 var(--fuente-texto)}' +
      '.gs-liga-s{font-size:13px;color:var(--gs-g);margin-top:var(--e1)}' +
      '.gs-alts{padding-top:var(--e3);padding-bottom:var(--e2)}.gs-alts-t{font:var(--peso-titulos) 16px/1.2 var(--fuente-titulos);margin-bottom:var(--e1)}' +
      '.gs-alt{border-top:1px solid var(--gs-l);padding:var(--e2) 0}.gs-alt summary{display:flex;justify-content:space-between;gap:var(--e2);cursor:pointer;list-style:none;font-size:15px;min-height:32px;align-items:center}' +
      '.gs-alt summary::-webkit-details-marker{display:none}.gs-alt summary em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums}.gs-alt[data-gs-vacio] summary{cursor:default;color:var(--gs-g)}' +
      '.gs-alt-i{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px var(--e2);width:100%;background:none;border:0;border-top:1px solid var(--gs-l);padding:var(--e2) 0;text-align:left;color:inherit;cursor:pointer;font-size:14px}' +
      '.gs-alt-i b{display:flex;align-items:center;min-width:0}.gs-alt-i b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gs-alt-i small{grid-column:1/-1;color:var(--gs-g);font-size:13px}.gs-alt-i .gs-pag{font-size:13px;font-weight:700;white-space:nowrap}' +
      '.gs-dia-h{font:var(--peso-titulos) 20px/1.2 var(--fuente-titulos);color:var(--color-principal-oscuro);margin:var(--e5) 0 0}' +
      '.gs-fotos{display:flex;gap:var(--e2);flex-wrap:wrap}.gs-fotos button{font-size:14px}' +
      '.gs-visor img{display:block;max-width:100%;max-height:70vh;margin:0 auto;border-radius:var(--radio);background:var(--gs-f)}';
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
  var TABS = [['resumen', 'Resumen'], ['equipos', 'Equipos'], ['jugadoras', 'Jugadoras']];

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
    pintar();
  }

  function irTab(t) {
    S.tab = t;
    [].forEach.call(S.el.querySelectorAll('[data-gs-tab]'), function (x) { x.setAttribute('aria-selected', x.getAttribute('data-gs-tab') === t); });
    window.scrollTo(0, 0);
    pintar();
  }

  function pintar(forzar) {
    var main = $('#gs-main'); if (!main) return;
    var re = $('#gs-re'); if (re) re.disabled = true;
    var p = S.tab === 'jugadoras' ? pJugadoras : S.tab === 'equipos' ? pEquipos : pResumen;
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
      var h = htmlFiltros(o) +
        '<div class="gs-mini" style="margin-top:12px;grid-template-columns:repeat(4,1fr)">' +
        '<button type="button" data-gs-kpi="equipos"><b>' + eqs.length + '</b><small>Equipos</small></button>' +
        '<button type="button" data-gs-kpi="jugadoras"><b>' + nJug + '</b><small>Jugadoras</small></button>' +
        '<button type="button" data-gs-kpi="pagar" class="' + (porPagar.length ? 'gs-alerta' : '') + '"><b>' + porPagar.length + '</b><small>Por pagar</small></button>' +
        '<button type="button" data-gs-kpi="alertas" class="' + (nAl ? 'gs-alerta' : '') + '"><b id="gs-nal">' + nAl + '</b><small>Alertas</small></button></div>' +
        // Alertas: pagos, avisos del Excel, equipos sin liga y jugadoras con alerta (estas, en cuanto se cargan).
        '<div class="gs-card gs-alts" id="gs-alts"><div class="gs-alts-t">Alertas</div>' +
        htmlAlerta('pagar', 'Pagos pendientes', porPagar, function (e) { return estadoPago(e); }, r) +
        htmlAlerta('avisos', 'Problemas en la inscripción', avisos, function (e) { return '<span class="gs-pag gs-amb">' + esc(e.ocupado ? 'Nombre repetido ×' + e.ocupado : e.revisar) + '</span>'; }, r) +
        htmlAlerta('sinliga', 'Equipos sin liga', sinLiga, function () { return ''; }, r) +
        '<div id="gs-aljug"><details class="gs-alt"><summary><span>Jugadoras con alerta</span><em>…</em></summary><p class="gs-nota">Cargando las jugadoras…</p></details></div></div>' +
        '<div class="gs-dias">' + [''].concat(ordenDias).map(function (d) {
          return '<button type="button" class="gs-chip" data-gs-dia="' + esc(d) + '" aria-pressed="' + (d === (S.dia || '')) + '">' + esc(d ? nomDia(d) : 'Todos los días') + '</button>';
        }).join('') + '<button type="button" class="gs-chip" id="gs-todas">' + (Object.keys(S.abiertas).some(function (k) { return S.abiertas[k]; }) ? 'Cerrar todas' : 'Abrir todas') + '</button></div>';
      ordenDias.filter(function (d) { return !S.dia || d === S.dia; }).forEach(function (d) {
        h += '<div class="gs-dia-h">' + esc(nomDia(d)) + '</div>';
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
      });
      if (!ordenDias.length) h += '<div class="gs-vacio">No hay equipos con estos filtros.</div>';
      main.innerHTML = h;
      engancharFiltros(main, function () { pResumen(main); });
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
      dato('jug_' + S.temp, 'gestionJugadoras', [S.temp, false]).then(function (rj) {
        var cont = main.querySelector('#gs-aljug'); if (!cont || !document.body.contains(cont)) return;
        var js = rj.lista.filter(function (j) { return enFiltro(j) && FILTROS_JUG.alerta(j); });
        cont.innerHTML = htmlAlerta('alerta', 'Jugadoras con alerta', js, function (j) { return '<span class="gs-pag gs-amb">' + esc(String(j.alerta).split('·')[0].trim().slice(0, 40)) + '</span>'; }, rj, true);
        var n = main.querySelector('#gs-nal'); if (n) { n.textContent = nAl + js.length; if (nAl + js.length) n.parentNode.classList.add('gs-alerta'); }
        engancharAlertas(cont, function (j) { fichaJugadora(j, o, rj); });
      }, function () { var cont = main.querySelector('#gs-aljug'); if (cont) cont.innerHTML = ''; });
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
      main.innerHTML = htmlFiltros(o) +
        chips([['todos', 'Inscritos', cuenta('todos')], ['sinliga', 'Sin liga', cuenta('sinliga')], ['pagar', 'Por pagar', cuenta('pagar')],
          ['avisos', 'Avisos', cuenta('avisos')], ['buscan', 'Buscan equipo', cuenta('buscan')], ['error', 'Con ERROR', cuenta('error')]], f.filtro, 'gs-eqf') +
        '<div class="gs-fila" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-eqq" placeholder="Buscar: equipo, capitana, correo, liga…" value="' + esc(f.q) + '" aria-label="Buscar"></div>' +
        '<div id="gs-eqlista"></div>';
      var pinta = function () {
        var q = norm2(f.q);
        // Buscando, se mira en toda la temporada, también lo que tiene ERROR.
        var lista = q ? r.lista.filter(function (e) { return norm2([e.equipo, e.capi, e.liga, e.asig, e.teamForm, e.mail, e.tel].join(' ')).indexOf(q) >= 0; })
          : base.filter(FILTROS_EQ[f.filtro]);
        $('#gs-eqlista').innerHTML = (q ? '<p class="gs-aviso-b">Buscando en toda la temporada ' + esc(S.temp) + ', también en las inscripciones con ERROR.</p>' : '') +
          (esCorreo(f.q) ? '<p style="margin:8px 0 0"><button type="button" class="gs-b2" id="gs-eqcorreo">Ver todo lo de este correo</button></p>' : '') +
          '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + lista.length + (lista.length === 1 ? ' inscripción' : ' inscripciones') + '</p>' +
          '<div class="gs-card"><div class="gs-lista">' + (lista.length ? lista.map(function (e) {
            var t = [];
            if (e.error) t.push(tag('ERROR', 'gs-tag-r'));
            if (e.buscan && !e.error) t.push(tag('Busca equipo', 'gs-tag-g'));
            if (!e.error && !e.buscan && !e.liga) t.push(tag('Sin liga'));
            if (!e.error && !e.buscan && !e.ps) t.push(tag('Sin paga y señal', 'gs-tag-a'));
            if (!e.error && e.pendiente > 0.005) t.push(tag('Faltan ' + eur(e.pendiente), 'gs-tag-a'));
            if (e.ocupado) t.push(tag('Nombre repetido ×' + e.ocupado, 'gs-tag-r'));
            if (e.revisar) t.push(tag(e.revisar, 'gs-tag-a'));
            if (!e.error && !e.buscan && !e.xporty) t.push(tag('Sin Xporty', 'gs-tag-g'));
            return '<button type="button" class="gs-item" data-gs-i="' + r.lista.indexOf(e) + '"><div style="min-width:0">' +
              '<div class="gs-t">' + punto(e.color) + esc(e.equipo || '(sin nombre)') + '</div>' +
              '<div class="gs-s">' + esc([S.fComp ? '' : compCorta(e.comp), e.liga ? ligaCorta(e.liga) : (e.dispo ? 'Quiere: ' + e.dispo : ''), e.capi, e.jugadoras ? e.jugadoras + ' jugadoras' : ''].filter(String).join(' · ')) + '</div>' +
              (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') +
              '</div><div class="gs-d">' + (e.nivel ? 'Nivel ' + esc(e.nivel) : '') + '</div></button>';
          }).join('') : '<div class="gs-vacio">No hay inscripciones con este filtro.</div>') + '</div></div>';
        [].forEach.call(main.querySelectorAll('[data-gs-i]'), function (b) { b.onclick = function () { fichaEquipo(r.lista[Number(b.getAttribute('data-gs-i'))], o, r); }; });
        var bc = $('#gs-eqcorreo'); if (bc) bc.onclick = function () { verCorreo(f.q.trim()); };
      };
      pinta();
      engancharFiltros(main, function () { pEquipos(main); });
      $('#gs-eqf').onclick = function (ev) { var b = ev.target.closest('[data-gs-f]'); if (!b) return; f.filtro = b.getAttribute('data-gs-f'); f.q = ''; pEquipos(main); };
      var t0; $('#gs-eqq').oninput = function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { f.q = v; pinta(); }, 150); };
    });
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
    alerta: function (j) { return !j.error && j.alerta; },
    xporty: function (j) { return !j.error && !j.xporty; },
    contactos: function (j) { return !j.error && !j.gcontacts; },
    personal: function (j) { return !j.error && j.incluida === '🚫'; },
    error: function (j) { return j.error; }
  };
  var MAX_LISTA = 250;

  function itemJugadora(j, i, conEquipo) {
    var t = [];
    if (j.error) t.push(tag('ERROR', 'gs-tag-r'));
    if (j.porDni) t.push(tag('Mismo DNI, otro correo', 'gs-tag-a'));
    if (j.alerta) t.push(tag(j.alerta.split('·')[0].trim().slice(0, 60), 'gs-tag-a'));
    if (!j.error && !j.xporty) t.push(tag('Sin Xporty', 'gs-tag-g'));
    if (!j.error && j.incluida === '🚫') t.push(tag('Cami personalizada', 'gs-tag-g'));
    return '<button type="button" class="gs-item" data-gs-j="' + i + '"><div style="min-width:0">' +
      '<div class="gs-t">' + esc(j.nombreCompleto || j.mail) + '</div>' +
      '<div class="gs-s">' + esc([conEquipo ? compCorta(j.comp) + ' · ' + j.equipo : '', j.cami ? 'Camiseta ' + j.cami : (j.dorsal ? 'Dorsal ' + j.dorsal : ''), edad1(j.edad, true) ? edad1(j.edad, true) + ' años' : ''].filter(String).join(' · ')) +
      (j.color ? ' ' + punto(j.color) : '') + '</div>' +
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
      main.innerHTML = htmlFiltros(o) +
        '<div class="gs-fila" style="margin-top:8px"><select class="gs-sel" id="gs-jeq" aria-label="Equipo"><option value="">Todos los equipos (' + equipos.length + ')</option>' +
        equipos.map(function (x) { return '<option' + (x === f.equipo ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
        chips([['todas', 'Inscritas', cuenta('todas')], ['alerta', 'Con alerta', cuenta('alerta')], ['xporty', 'Sin Xporty', cuenta('xporty')],
          ['contactos', 'Sin contacto', cuenta('contactos')], ['personal', 'Cami personalizada', cuenta('personal')], ['error', 'Con ERROR', cuenta('error')]], f.filtro, 'gs-jf') +
        '<div class="gs-fila" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-jq" placeholder="Buscar: nombre, correo, DNI, teléfono, dorsal…" value="' + esc(f.q) + '" aria-label="Buscar"></div>' +
        '<div id="gs-jlista"></div>';
      var pinta = function () {
        var q = norm2(f.q);
        // Buscando, se mira en toda la temporada, también lo que tiene ERROR (p. ej. dos inscripciones del mismo correo).
        var lista = q ? r.lista.filter(function (j) { return norm2([j.nombreCompleto, j.nombre, j.ap1, j.ap2, j.dni, j.mail, j.cami, j.equipo, j.tel].join(' ')).indexOf(q) >= 0; })
          : base.filter(FILTROS_JUG[f.filtro]);
        $('#gs-jlista').innerHTML = (q ? '<p class="gs-aviso-b">Buscando en toda la temporada ' + esc(S.temp) + ', también en las inscripciones con ERROR.</p>' : '') +
          (esCorreo(f.q) ? '<p style="margin:8px 0 0"><button type="button" class="gs-b2" id="gs-jcorreo">Ver todo lo de este correo (todas las temporadas)</button></p>' : '') +
          '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + lista.length + (lista.length === 1 ? ' inscripción' : ' inscripciones') + '</p>' +
          '<div class="gs-card"><div class="gs-lista">' + (lista.length ? lista.slice(0, MAX_LISTA).map(function (j) { return itemJugadora(j, r.lista.indexOf(j), q || !f.equipo); }).join('') +
            (lista.length > MAX_LISTA ? '<div class="gs-mas">Y ' + (lista.length - MAX_LISTA) + ' más: elige un equipo o busca.</div>' : '')
            : '<div class="gs-vacio">No hay jugadoras con este filtro.</div>') + '</div></div>';
        [].forEach.call(main.querySelectorAll('[data-gs-j]'), function (b) { b.onclick = function () { fichaJugadora(r.lista[Number(b.getAttribute('data-gs-j'))], o, r, equipos); }; });
        var bc = $('#gs-jcorreo'); if (bc) bc.onclick = function () { verCorreo(f.q.trim()); };
      };
      pinta();
      engancharFiltros(main, function () { pJugadoras(main); });
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
    var alertas = j.alerta ? j.alerta.split(' · ').map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') : '';
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
      fila('Color', j.color ? punto(j.color) + esc(j.color) : '') + fila('Pedido', esc(j.pedido)) + fila('Preparada', j.preparada ? 'Sí' : 'No') + fila('Entregada', j.entregada ? 'Sí' : 'No') +
      fila('Incidencia', esc(j.incidencia)) + '</div>' +
      '<div class="gs-sec">Más datos</div><div class="gs-dl">' +
      fila('Alta', esc(j.alta)) + fila('Correo', esc(j.mail)) + fila('Liga', esc(ligaCorta(j.liga))) + fila('Edad', esc(edad1(j.edad, true))) +
      fila('Temporadas con nosotras', esc(j.veterania)) + fila('Normas, imagen, datos y responsabilidad', esc(j.normas)) + '</div>' +
      '<div class="gs-error" id="gs-err" hidden></div>' +
      '<div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-gs-cerrar>Cerrar</button><button type="button" class="gs-b1" id="gs-ok" disabled>Sin cambios</button></div>');
    engancharFotos(v.el, j.fotosLinks || [], j.nombreCompleto);
    var vc = v.el.querySelector('#gs-vercorreo'); if (vc) vc.onclick = function () { verCorreo(j.mail); };
    guardable(v, campos.concat(checks), function (c) {
      return llamar('gestionJugadoraEditar', [{ fila: j.fila, ts: j.ts, mail: j.mail, comp: j.comp, nombre: j.nombreCompleto }, c]);
    }, function (c) {
      aplicarCambios(j, c, PROP_JUG);
      if (c['NOMBRE'] != null || c['1er APELLIDO'] != null) j.nombreCompleto = (j.nombre + ' ' + j.ap1).trim();
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
            return '<button type="button" class="gs-item" data-gs-ce="' + i + '"><div style="min-width:0"><div class="gs-t">' + punto(e.color) + esc(e.equipo || '(sin nombre)') + '</div>' +
              '<div class="gs-s">' + esc(['Alta ' + e.alta, compCorta(e.comp) || e.comp, e.liga ? ligaCorta(e.liga) : ''].filter(String).join(' · ')) + '</div>' +
              (e.error ? '<div class="gs-tags">' + tag('ERROR', 'gs-tag-r') + '</div>' : '') + '</div></button>';
          }).join('') + '</div>' : '<p class="gs-nota">Ninguna.</p>');
        v.el.innerHTML = v.el.querySelector('h2').outerHTML + h;
        [].forEach.call(v.el.querySelectorAll('[data-gs-j]'), function (b) { b.onclick = function () { fichaJugadora(r.jugadoras[Number(b.getAttribute('data-gs-j'))], o, { gidJ: r.gidJ }); }; });
        [].forEach.call(v.el.querySelectorAll('[data-gs-ce]'), function (b) { b.onclick = function () { fichaEquipo(r.equipos[Number(b.getAttribute('data-gs-ce'))], o, { gidE: r.gidE }); }; });
      });
    }).then(null, function (e) { var g = v.el.querySelector('.gs-cargando'); if (g) g.outerHTML = errorHtml(e); });
  }

  M.GESTION = { abrir: abrir };
})();
