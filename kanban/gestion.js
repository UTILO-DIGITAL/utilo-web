/*
 * Sección Gestión de la app (T0139 · Konamigas). La carga kanban/app.js cuando el perfil tiene GESTION (solo socios).
 * Lee y edita el Excel GESTION a través de la API del DAILY (funciones gestion* de GESTION_WEB.gs, KANBAN_CORE v27).
 * Contrato con app.js (igual que Economía):
 *   window.SX_CTX = { api, persona, pin, clave, color, accion }
 *   window.SX_MOD.GESTION.abrir(elemento)  → pinta la sección dentro del elemento.
 * T0142 · Equipos: inscripciones de equipos de una competición, con filtros (sin liga, por pagar, avisos, buscan equipo,
 *   error); en cada equipo se cambian liga, nivel, asignado, color, fechas límite y casillas de seguimiento, y se abren
 *   los WhatsApp que ya prepara el Excel (mensaje inicial, estado del equipo).
 * T0143 · Jugadoras: inscripciones de jugadoras por competición y equipo, con sus alertas; se corrigen los datos del
 *   formulario, se marcan ERROR, G.CONTACTS y XPORTY y se cambia de equipo.
 * Mismo estilo que Economía (se copia de economia.js con el prefijo gs-). Cada cambio queda en GESTION › LOG_APP.
 */
(function () {
  'use strict';
  var M = window.SX_MOD = window.SX_MOD || {};
  if (M.GESTION) return;

  var S = { tab: 'equipos', comp: '', datos: {}, opciones: null, el: null,
    eq: { filtro: 'todos', q: '' }, jug: { filtro: 'todas', q: '', equipo: '' } };

  function ctx() { return window.SX_CTX || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function llamar(fn, args) {
    var c = ctx();
    return fetch(c.api, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args || [], persona: c.persona, pin: c.pin })
    }).then(function (r) {
      if (!r.ok) throw new Error('No hay conexión (' + r.status + '). Prueba otra vez.');
      return r.json();
    }).then(function (o) {
      if (!o.ok) {
        if (/^ACCESO:/.test(o.error)) { try { localStorage.removeItem(c.clave); } catch (e) {} location.reload(); }
        throw new Error(String(o.error || 'Error').replace(/^(SECCION|ACCESO):\s*/, ''));
      }
      return o.r;
    });
  }

  /* ---------- estilos: los de Economía (economia.js) con el prefijo gs- ---------- */
  function tema() {
    // Se copia del kanban de la misma página (cabecera .cab): fuentes y color de los títulos.
    var t = { titulos: 'Montserrat, Lato, Arial, sans-serif', texto: 'Lato, Arial, sans-serif', destacado: '#ffffff' };
    try {
      var h1 = document.querySelector('header.cab h1');
      if (h1) { var c = getComputedStyle(h1); t.titulos = c.fontFamily; t.destacado = c.color; }
      t.texto = getComputedStyle(document.body).fontFamily || t.texto;
    } catch (e) {}
    if (!/Lato|Montserrat/i.test(t.texto + t.titulos) || !document.querySelector('link[href*="fonts.googleapis.com"]')) {
      if (!document.querySelector('link[data-gs-fuentes]')) {
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-gs-fuentes', '1');
        l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500&family=Lato:wght@400;600;700&display=swap';
        document.head.appendChild(l);
      }
      if (!/Lato/i.test(t.texto)) t.texto = 'Lato, Arial, sans-serif';
      if (!/Montserrat/i.test(t.titulos)) t.titulos = 'Montserrat, Lato, Arial, sans-serif';
    }
    return t;
  }

  function css() {
    var c = ctx(), col = c.color || '#020252', acc = c.accion || '#FF1B8C', T = tema();
    return '.gs{--gs-c:' + col + ';--gs-a:' + acc + ';--gs-v:#0f8a4b;--gs-r:#c62828;--gs-g:#6b6b85;--gs-l:#ececf4;--gs-f:#f6f6fa;--gs-d:' + T.destacado + ';' +
      '--gs-ft:' + T.texto + ';--gs-fh:' + T.titulos + ';font-family:var(--gs-ft);color:#1A1A40;font-size:14px;line-height:1.4}' +
      '.gs *{box-sizing:border-box}.gs button,.gs input,.gs select,.gs textarea{font-family:var(--gs-ft)}' +
      'html.gs-sin-scroll,html.gs-sin-scroll body{overflow:hidden}' +
      // Cabecera como la del kanban: título en Montserrat del color destacado, versión y «Pedir algo a Utilo» a la derecha.
      '.gs-cab{position:relative;background:var(--gs-c);color:#fff;padding:14px 18px 0}' +
      '.gs-cab h1{margin:0;padding-right:110px;font-family:var(--gs-fh);font-size:26px;font-weight:500;color:var(--gs-d);letter-spacing:0}' +
      '.gs-cab>p{margin:4px 0 0;font-size:13px;color:#fff;display:flex;align-items:center;gap:8px}' +
      '.gs-re{background:transparent;border:0;color:#fff;opacity:.85;font-size:15px;padding:0 4px;cursor:pointer}.gs-re:disabled{opacity:.4}' +
      '.gs-ver{position:absolute;top:18px;right:58px;background:transparent;border:0;color:#fff;font-size:11px;font-weight:700;padding:4px 6px;border-radius:999px;cursor:pointer}' +
      '.gs-sol{position:absolute;top:10px;right:12px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,252,247,.16);color:#fff;font-size:18px;cursor:pointer}' +
      '.gs-tabs{display:flex;gap:2px;margin:10px -18px 0;padding:0 10px;overflow-x:auto;scrollbar-width:none}.gs-tabs::-webkit-scrollbar{display:none}' +
      '.gs-tabs button{flex:0 0 auto;background:transparent;border:0;color:#fff;opacity:.7;font-size:14px;font-weight:700;padding:10px 10px 12px;border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}' +
      '.gs-tabs button[aria-selected=true]{opacity:1;border-bottom-color:var(--gs-a)}' +
      '.gs-tabs .gs-n{display:inline-block;min-width:20px;padding:2px 6px;margin-left:5px;border-radius:999px;background:var(--gs-a);color:#fff;font-size:11px}' +
      '.gs-main{max-width:760px;margin:0 auto;padding:16px 14px 120px}' +
      '.gs-fila{display:flex;gap:10px;flex-wrap:wrap;align-items:center}' +
      // Campos como los del kanban.
      '.gs select,.gs input[type=text],.gs input[type=search],.gs input[type=date],.gs input[inputmode],.gs textarea{font-size:15px;padding:8px 10px;border:1px solid #cfd8d4;border-radius:8px;background:#fff;color:inherit;min-width:0;max-width:100%}' +
      '.gs input[type=date]{-webkit-appearance:none;appearance:none;min-height:40px;width:100%}' +
      '.gs select:focus,.gs input:focus,.gs textarea:focus{outline:2px solid var(--gs-c);outline-offset:0;border-color:transparent}' +
      '.gs textarea{width:100%;resize:vertical}' +
      '.gs-sel{flex:1 1 140px}' +
      '.gs-card{background:#fff;border:1px solid var(--gs-l);border-radius:14px;padding:14px 16px;margin-top:12px}' +
      '.gs-av{margin-top:14px}.gs-av-t{display:flex;justify-content:space-between;font-size:13px;color:var(--gs-g);font-weight:600}' +
      '.gs-barra{height:8px;border-radius:999px;background:var(--gs-l);overflow:hidden;margin-top:6px}.gs-barra i{display:block;height:100%;background:var(--gs-c);border-radius:999px}' +
      '.gs-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}' +
      '.gs-kpi{background:var(--gs-f);border-radius:14px;padding:12px 14px}.gs-kpi.gs-grande{grid-column:1/-1;background:var(--gs-c);color:#fff}' +
      '.gs-kpi b{display:block;font-size:11px;letter-spacing:.4px;text-transform:uppercase;opacity:.75;font-weight:700}' +
      '.gs-kpi .gs-val{display:block;font-family:var(--gs-fh);font-weight:500;font-size:22px;margin-top:3px;font-variant-numeric:tabular-nums}.gs-kpi.gs-grande .gs-val{font-size:30px;color:var(--gs-d)}' +
      '.gs-kpi span.gs-sub{display:block;font-size:12.5px;margin-top:3px;opacity:.85}' +
      '.gs-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}' +
      '.gs-mini button,.gs-mini div{background:var(--gs-f);border:0;border-radius:12px;padding:10px;text-align:center;color:inherit}' +
      '.gs-mini b{display:block;font-family:var(--gs-fh);font-weight:500;font-size:19px;font-variant-numeric:tabular-nums}.gs-mini small{font-size:12px;color:var(--gs-g);font-weight:600}' +
      '.gs-mini button{cursor:pointer}.gs-mini button.gs-alerta b{color:var(--gs-a)}' +
      '.gs-h2{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--gs-c);margin:24px 2px 4px;font-weight:700}' +
      '.gs-pos{color:var(--gs-v)}.gs-neg{color:var(--gs-r)}.gs-kpi.gs-grande .gs-pos,.gs-kpi.gs-grande .gs-neg{color:#fff}' +
      '.gs-grupo{border-top:1px solid var(--gs-l)}.gs-grupo:first-of-type{border-top:0}' +
      '.gs-gb{display:block;width:100%;background:none;border:0;color:inherit;text-align:left;padding:11px 0;cursor:pointer;font-size:14px}' +
      '.gs-gl{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.gs-gl b{font-size:15px;font-weight:700}' +
      '.gs-gl .gs-num{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.gs-gs{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--gs-g);margin-top:3px}' +
      '.gs-gb .gs-barra{height:6px}.gs-barra i.gs-mal{background:var(--gs-r)}' +
      '.gs-flecha{display:inline-block;width:14px;color:var(--gs-g);transition:transform .15s}.gs-gb[aria-expanded=true] .gs-flecha{transform:rotate(90deg)}' +
      '.gs-lineas{padding:0 0 10px 14px}' +
      '.gs-linea{display:block;width:100%;background:none;border:0;border-top:1px dashed var(--gs-l);color:inherit;text-align:left;font-size:13.5px;padding:8px 0;cursor:pointer}' +
      '.gs-linea .gs-gl b{font-size:13.5px;font-weight:600}.gs-linea .gs-barra{height:4px;margin-top:5px}.gs-linea .gs-gs{font-size:12px}.gs-linea .gs-ir{color:var(--gs-c);font-weight:700}' +
      '.gs-gs b{font-weight:700}' +
      '.gs-avd summary{list-style:none;cursor:pointer}.gs-avd summary::-webkit-details-marker{display:none}.gs-avd[open] summary .gs-flecha{transform:rotate(90deg)}' +
      '.gs-avc{margin:10px 0 0 18px}.gs-avc .gs-av-t{font-size:12.5px}.gs-avc .gs-barra{height:5px;margin-top:4px}' +
      '.gs-socio{display:flex;justify-content:space-between;gap:10px;padding:5px 0 5px 14px;font-size:13px;color:var(--gs-g)}.gs-socio span:last-child{font-variant-numeric:tabular-nums}' +
      '.gs-rep{padding:0 16px}.gs-rep summary{list-style:none;cursor:pointer;padding:12px 0;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:14px}' +
      '.gs-rep summary::-webkit-details-marker{display:none}.gs-rep summary b{font-weight:700}.gs-rep summary .gs-flecha{transition:transform .15s}.gs-rep[open] summary .gs-flecha{transform:rotate(90deg)}' +
      '.gs-rep summary span:last-child{color:var(--gs-g);font-size:13px;white-space:nowrap}' +
      '.gs-rf{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--gs-l);font-size:14px}.gs-rf span:last-child{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.gs-rf.gs-tot{font-weight:700}.gs-rf small{display:block;color:var(--gs-g);font-size:12px;font-weight:400}' +
      '.gs-av2{border-left:4px solid var(--gs-r);padding:10px 12px;background:#fff;border-radius:10px;margin-top:10px;box-shadow:0 0 0 1px var(--gs-l) inset}' +
      '.gs-av2.gs-amb{border-left-color:#d98a00}.gs-av2.gs-inf{border-left-color:var(--gs-c)}' +
      '.gs-av2 b{display:block;font-size:14.5px}.gs-av2 p{margin:4px 0 0;font-size:13.5px}.gs-av2 .gs-a{display:inline-block;margin-top:6px}' +
      '.gs-pl{padding:9px 0;border-top:1px dashed var(--gs-l)}.gs-pl:first-child{border-top:0}.gs-pl .gs-gs{font-size:12px}' +
      '.gs-pl .gs-org{font-size:12px;color:var(--gs-g);margin-top:3px}' +
      '.gs-lista{list-style:none;margin:0;padding:0}.gs-item{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--gs-l);align-items:center}' +
      '.gs-item:first-child{border-top:0}.gs-item .gs-t{font-weight:700;font-size:14.5px}.gs-item .gs-s{font-size:12.5px;color:var(--gs-g);margin-top:2px}' +
      '.gs-item .gs-d{text-align:right;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      'button.gs-item{width:100%;background:none;border:0;border-top:1px solid var(--gs-l);color:inherit;text-align:left;cursor:pointer}' +
      '.gs-borrado .gs-t,.gs-borrado .gs-d{text-decoration:line-through;opacity:.55}' +
      '.gs-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.gs-chip{border:1px solid #cfd8d4;background:#fff;border-radius:999px;padding:7px 12px;font-size:13.5px;font-weight:600;color:inherit;cursor:pointer}' +
      '.gs-chip[aria-pressed=true]{background:var(--gs-c);border-color:var(--gs-c);color:#fff}' +
      '.gs-tag{display:inline-block;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--gs-a) 14%,#fff);color:var(--gs-a);font-size:12px;font-weight:700}' +
      '.gs-tag-g{background:var(--gs-f);color:var(--gs-g)}' +
      '.gs-a{color:var(--gs-c);font-weight:700;font-size:13px}' +
      '.gs-volver{background:none;border:0;color:var(--gs-c);font-size:15px;font-weight:700;padding:6px 0 10px;cursor:pointer}' +
      '.gs-liga .gs-gl b{font-size:15.5px}.gs-liga .gs-cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px;font-size:12px;color:var(--gs-g)}' +
      '.gs-liga .gs-cifras b{display:block;color:#1A1A40;font-size:14px;font-variant-numeric:tabular-nums}' +
      '.gs-vacio{text-align:center;color:var(--gs-g);padding:30px 10px}' +
      '.gs-cargando{text-align:center;color:var(--gs-g);padding:40px 10px}.gs-giro{width:30px;height:30px;border:3px solid var(--gs-l);border-top-color:var(--gs-c);border-radius:50%;margin:0 auto 12px;animation:ecg 0.8s linear infinite}@keyframes ecg{to{transform:rotate(360deg)}}' +
      '.gs-error{background:#fdecec;color:var(--gs-r);border-radius:10px;padding:10px 12px;margin-top:12px}' +
      // Botón de añadir: igual que «+ Nueva tarea» del kanban.
      '.gs-fab{position:fixed;right:20px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:44;background:var(--gs-a);color:#fff;border:0;border-radius:10px;padding:13.44px 23.52px;font-size:16.8px;font-weight:700;box-shadow:0 4px 14px rgba(28,43,38,.25);cursor:pointer}' +
      '.gs-fab:focus-visible,.gs button:focus-visible{outline:3px solid var(--gs-c);outline-offset:2px}' +
      // Ventanas: como «Nueva tarea» del kanban (tarjeta centrada arriba, velo oscuro).
      '.gs-velo{position:fixed;inset:0;z-index:60;background:rgba(28,43,38,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.gs-hoja{background:#fff;width:100%;max-width:560px;border-radius:14px;padding:22px 22px 18px;font-size:15px;margin-bottom:24px}' +
      '.gs-hoja h2{margin:0 0 14px;font-family:var(--gs-fh);font-weight:500;font-size:24px;color:var(--gs-c);display:flex;justify-content:space-between;align-items:flex-start;gap:10px;line-height:1.2}' +
      '.gs-x{background:none;border:0;font-size:28px;line-height:1;cursor:pointer;color:var(--gs-g);padding:0 2px}' +
      '.gs-sw{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--gs-f);padding:4px;border-radius:10px}' +
      '.gs-sw button{border:0;border-radius:8px;padding:10px;font-size:15px;font-weight:700;background:transparent;color:var(--gs-g);cursor:pointer}' +
      '.gs-sw button[aria-pressed=true]{background:#fff;color:#1A1A40;box-shadow:0 1px 4px rgba(0,0,0,.12)}' +
      '.gs-sw button[aria-pressed=true].gs-in{color:var(--gs-v)}.gs-sw button[aria-pressed=true].gs-out{color:var(--gs-r)}' +
      '.gs-campo{display:block;margin-top:12px;font-size:15px;font-weight:600;color:#1A1A40;min-width:0}.gs-campo>select,.gs-campo>input,.gs-campo>textarea{display:block;width:100%;margin-top:4px;font-weight:400}' +
      '.gs-opc{font-weight:400;color:var(--gs-g)}' +
      '.gs-dos{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}' +
      '.gs-check{display:flex;align-items:center;gap:8px;margin-top:12px;font-weight:600;font-size:14.5px}.gs-check input{width:20px;height:20px;flex:none}' +
      '.gs-imp{font-size:24px!important;font-weight:700;text-align:right}' +
      '.gs-acc{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px}' +
      '.gs-b1,.gs-b2{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;font-weight:700;cursor:pointer;text-decoration:none}' +
      '.gs-b1{background:var(--gs-a);color:#fff;border:0;padding:13.44px 23.52px;font-size:16.8px}.gs-b1:disabled,.gs-b2:disabled{opacity:.6}' +
      '.gs-b1r{background:var(--gs-r)}' +
      '.gs-b2{background:transparent;color:var(--gs-c);border:2px solid var(--gs-c);padding:11.2px 19.2px;font-size:16px}.gs-b2r{color:var(--gs-r);border-color:var(--gs-r)}' +
      '.gs-subir{display:flex;width:100%;margin-top:14px}' +
      '.gs-flist{margin-top:10px;max-height:46vh;overflow:auto}' +
      '.gs-dimp{font-family:var(--gs-fh);font-weight:500;font-size:30px;margin:-4px 0 10px;font-variant-numeric:tabular-nums}' +
      '.gs-dl{border-top:1px solid var(--gs-l)}.gs-df{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid var(--gs-l);font-size:14px}' +
      '.gs-df span:first-child{color:var(--gs-g);flex:none}.gs-df span:last-child{text-align:right;font-weight:600;word-break:break-word}' +
      '.gs-dtx{margin-top:12px;font-size:14px}.gs-dtx p{margin:4px 0 0;white-space:pre-wrap}' +
      '.gs-dhist{margin-top:12px}.gs-dhist summary{cursor:pointer;color:var(--gs-c);font-weight:700;font-size:14px}.gs-dhist pre{white-space:pre-wrap;font-family:var(--gs-ft);font-size:12.5px;color:var(--gs-g);margin:6px 0 0;background:var(--gs-f);padding:8px 10px;border-radius:8px}' +
      '.gs-aviso{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:70;background:#1A1A40;color:#fff;border-radius:10px;padding:12px 16px;font-weight:600;max-width:calc(100% - 32px);box-shadow:0 6px 18px rgba(0,0,0,.25)}' +
      '@media(min-width:620px){.gs-kpis{grid-template-columns:repeat(3,1fr)}.gs-kpi.gs-grande{grid-column:auto}.gs-velo{padding-top:48px}}' +
      '@media(min-width:900px){.gs-fab{bottom:20px}.gs-aviso{bottom:84px}.gs-main{padding-bottom:70px}}';
  }


  function cssExtra() {
    return '.gs-sec{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--gs-c);margin:18px 0 2px;font-weight:700}' +
      '.gs-btns{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 6px}.gs-btns a,.gs-btns button{font-size:14px;padding:9px 13px;border-width:1.5px}' +
      '.gs-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}' +
      '.gs-tag-r{background:#fdecec;color:var(--gs-r)}.gs-tag-v{background:#e6f4ec;color:var(--gs-v)}.gs-tag-a{background:#fff4e0;color:#a35d00}' +
      '.gs-alerta{border-left:4px solid #d98a00;background:#fff8ec;border-radius:10px;padding:10px 12px;margin:4px 0 8px;font-size:14px}' +
      '.gs-alerta p{margin:0 0 6px}.gs-alerta p:last-child{margin:0}' +
      '.gs-nota{font-size:12.5px;color:var(--gs-g);font-weight:400;margin-top:3px}' +
      '.gs-mas{text-align:center;color:var(--gs-g);font-size:13px;padding:12px 0 2px}' +
      '.gs-color{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid #cfd8d4;vertical-align:-1px;margin-right:4px}' +
      '.gs-pie{position:sticky;bottom:-18px;background:#fff;padding:12px 0 4px;margin-top:6px;border-top:1px solid var(--gs-l)}' +
      '.gs-checks .gs-check{margin-top:9px}';
  }

  /* ---------- utilidades ---------- */
  function cargando(msg) { return '<div class="gs-cargando"><div class="gs-giro"></div>' + esc(msg || 'Cargando…') + '</div>'; }
  function errorHtml(e) { return '<div class="gs-error" role="alert">' + esc(e && e.message || e) + '</div>'; }
  function $(s) { return S.el && S.el.querySelector(s); }
  function eur(n) { return (Math.round(Math.abs(n || 0) * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/,00$/, '') + ' €'; }
  function ligaCorta(l) { l = String(l || ''); var p = l.split('|'); return p.length > 2 ? p.slice(2).join('|').trim() : l; }
  function compCorta(c) { return String(c || '').replace(/^\d\d-\d\d \|\s*/, '').trim(); }
  function tag(t, c) { return '<span class="gs-tag ' + (c || '') + '">' + esc(t) + '</span>'; }
  function fila(et, v) { return v ? '<div class="gs-df"><span>' + esc(et) + '</span><span>' + v + '</span></div>' : ''; }
  function wa(tel) { var d = String(tel || '').replace(/\D/g, ''); if (!d) return ''; if (d.length === 9) d = '34' + d; return 'https://wa.me/' + d; }
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
      if (!S.comp) { var c = o.competiciones.filter(function (x) { return x.temp === o.temporada; })[0]; S.comp = c ? c.hash : ''; }
      return o;
    });
  }
  function olvidar() { var o = S.opciones; S.datos = {}; S.opciones = o; }
  function hora(h) { var x = $('#gs-hora'); if (x && h) x.textContent = 'Datos de las ' + String(h).slice(-5); }
  function urlFila(gid, f) { return S.opciones && S.opciones.url ? S.opciones.url + '#gid=' + gid + '&range=A' + f : ''; }

  /* ---------- ventanas (como las de Economía) ---------- */
  function ventana(titulo, html) {
    var raiz = S.el.querySelector('.gs');
    var m = document.createElement('div'); m.className = 'gs-velo';
    m.innerHTML = '<div class="gs-hoja" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '"><h2>' + esc(titulo) + '<button type="button" class="gs-x" aria-label="Cerrar">×</button></h2>' + html + '</div>';
    raiz.appendChild(m);
    document.documentElement.classList.add('gs-sin-scroll');
    var cerrar = function () { m.remove(); document.removeEventListener('keydown', tecla); if (!raiz.querySelector('.gs-velo')) document.documentElement.classList.remove('gs-sin-scroll'); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.gs-x') || e.target.closest('[data-gs-cerrar]')) cerrar(); });
    return { el: m.querySelector('.gs-hoja'), cerrar: cerrar };
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
    return '<label class="gs-campo" for="' + id + '">' + esc(c.et) + inp + (c.nota ? '<div class="gs-nota">' + esc(c.nota) + '</div>' : '') + '</label>';
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
  var TABS = [['equipos', 'Equipos'], ['jugadoras', 'Jugadoras']];

  function abrir(el) {
    S.el = el;
    var ver = document.querySelector('header.cab .ver-btn'), sol = document.querySelector('header.cab .sol-btn');
    el.innerHTML = '<div class="gs"><style>' + css() + cssExtra() + '</style>' +
      '<header class="gs-cab">' + (ver ? '<button type="button" class="gs-ver" id="gs-ver" title="Versión y novedades">' + esc(ver.textContent.trim()) + '</button>' : '') +
      (sol ? '<button type="button" class="gs-sol" id="gs-sol" title="Pide un cambio, cuéntanos un fallo o pregúntanos una duda" aria-label="Pedir algo a Utilo">💬</button>' : '') +
      '<h1>GESTIÓN</h1><p><span id="gs-hora">Excel GESTION</span><button class="gs-re" id="gs-re" type="button" aria-label="Actualizar" title="Actualizar">↻</button></p>' +
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
    var p = S.tab === 'jugadoras' ? pJugadoras : pEquipos;
    Promise.resolve(p(main, !!forzar)).then(function () { if (re) re.disabled = false; }, function () { if (re) re.disabled = false; });
  }

  /** Carga opciones + datos de la pestaña y pinta. */
  function cuando(main, clave, fn, forzar, msg, pinta) {
    var tab = S.tab;
    if (forzar || !S.opciones || !S.datos[clave()]) main.innerHTML = cargando(msg);
    return opciones(forzar && !S.opciones).then(function (o) {
      return dato(clave(), fn, [S.comp, !!forzar], forzar).then(function (r) { // forzar: el servidor relee GESTION (↻)
        if (S.tab !== tab || !document.body.contains(main)) return;
        hora(r.hora); pinta(o, r);
      });
    }).then(null, function (e) {
      if (S.tab === tab) main.innerHTML = errorHtml(e) + '<p style="text-align:center"><button class="gs-chip" type="button" id="gs-reint">Reintentar</button></p>';
      var b = $('#gs-reint'); if (b) b.onclick = function () { pintar(true); };
    });
  }

  function selectorComp(o) {
    var temps = {};
    o.competiciones.forEach(function (c) { (temps[c.temp] = temps[c.temp] || []).push(c); });
    return '<select class="gs-sel" id="gs-comp" aria-label="Competición">' + Object.keys(temps).sort().reverse().map(function (t) {
      return '<optgroup label="Temporada ' + esc(t) + '">' + temps[t].map(function (c) {
        return '<option value="' + esc(c.hash) + '"' + (c.hash === S.comp ? ' selected' : '') + '>' + esc(t + ' · ' + c.nombre.trim()) + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + '</select>';
  }
  function chips(lista, actual, id) {
    return '<div class="gs-chips" id="' + id + '" style="margin-top:10px">' + lista.map(function (c) {
      return '<button type="button" class="gs-chip" data-gs-f="' + c[0] + '" aria-pressed="' + (c[0] === actual) + '">' + esc(c[1]) + (c[2] != null ? ' · ' + c[2] : '') + '</button>';
    }).join('') + '</div>';
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
    return cuando(main, function () { return 'eq_' + S.comp; }, 'gestionEquipos', forzar, 'Cargando los equipos…', function (o, r) {
      var f = S.eq, cuenta = function (k) { return r.lista.filter(FILTROS_EQ[k]).length; };
      main.innerHTML = '<div class="gs-fila">' + selectorComp(o) + '</div>' +
        chips([['todos', 'Inscritos', cuenta('todos')], ['sinliga', 'Sin liga', cuenta('sinliga')], ['pagar', 'Por pagar', cuenta('pagar')],
          ['avisos', 'Avisos', cuenta('avisos')], ['buscan', 'Buscan equipo', cuenta('buscan')], ['error', 'Con ERROR', cuenta('error')]], f.filtro, 'gs-eqf') +
        '<div class="gs-fila" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-eqq" placeholder="Buscar: equipo, capitana, liga…" value="' + esc(f.q) + '" aria-label="Buscar"></div>' +
        '<div id="gs-eqlista"></div>';
      var pinta = function () {
        var q = norm(f.q).trim();
        var lista = r.lista.filter(FILTROS_EQ[f.filtro]).filter(function (e) { return !q || norm([e.equipo, e.capi, e.liga, e.asig, e.teamForm, e.mail].join(' ')).indexOf(q) >= 0; });
        $('#gs-eqlista').innerHTML = '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + lista.length + (lista.length === 1 ? ' inscripción' : ' inscripciones') + '</p>' +
          '<div class="gs-card"><div class="gs-lista">' + (lista.length ? lista.map(function (e, i) {
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
              '<div class="gs-t">' + esc(e.equipo || '(sin nombre)') + '</div>' +
              '<div class="gs-s">' + esc([e.liga ? ligaCorta(e.liga) : (e.dispo ? 'Quiere: ' + e.dispo : ''), e.capi, e.jugadoras ? e.jugadoras + ' jugadoras' : ''].filter(String).join(' · ')) + '</div>' +
              (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') +
              '</div><div class="gs-d">' + (e.nivel ? 'Nivel ' + esc(e.nivel) : '') + '</div></button>';
          }).join('') : '<div class="gs-vacio">No hay inscripciones con este filtro.</div>') + '</div></div>';
        [].forEach.call(main.querySelectorAll('[data-gs-i]'), function (b) { b.onclick = function () { fichaEquipo(r.lista[Number(b.getAttribute('data-gs-i'))], o, r); }; });
      };
      pinta();
      $('#gs-comp').onchange = function () { S.comp = this.value; S.jug.equipo = ''; pintar(); };
      $('#gs-eqf').onclick = function (ev) { var b = ev.target.closest('[data-gs-f]'); if (!b) return; f.filtro = b.getAttribute('data-gs-f'); pEquipos(main); };
      var t0; $('#gs-eqq').oninput = function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { f.q = v; pinta(); }, 150); };
    });
  }

  function fichaEquipo(e, o, r) {
    var ligas = o.ligas.filter(function (l) { return l.comp === e.comp; });
    var campos = [
      { k: 'LIGA', t: 'select', et: 'Liga', v: e.liga, opts: [['', '— Sin liga —']].concat(ligas.map(function (l) { return [l.hash, ligaCorta(l.hash) + (l.gestor ? ' · ' + l.gestor : '')]; })) },
      { k: 'NIVEL', t: 'select', et: 'Nivel', v: e.nivel == null ? '' : String(e.nivel), opts: [['', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
      { k: 'ASIG', t: 'select', et: 'Asignado (recibe la paga y señal)', v: e.asig, opts: [['', '—']].concat(o.staff.map(function (s) { return [s, s]; })) },
      { k: 'COLOR', t: 'select', et: 'Color de camiseta', v: e.color, opts: [['', '—']].concat(o.colores.map(function (c) { return [c.n, c.n]; })) },
      { k: 'F.L (P.S)', t: 'fecha', et: 'Fecha límite paga y señal', v: e.flP },
      { k: 'F.L (Insc)', t: 'fecha', et: 'Fecha límite inscripción', v: e.flI },
      { k: 'DESCUENTO', t: 'num', et: 'Descuento (€)', v: e.descuento == null ? '' : String(e.descuento) },
      { k: 'TEAM NEW NAME', t: 'texto', et: 'Nombre nuevo del equipo', v: e.teamNuevo, nota: 'Si lo rellenas, el equipo pasa a llamarse así en todo el Excel.' }
    ];
    var checks = [
      { k: 'M.I ENVIADO', t: 'si', et: 'Mensaje inicial enviado (M.I)', v: e.mi },
      { k: 'F.J', t: 'si', et: 'Formulario de jugadoras enviado (F.J)', v: e.fj },
      { k: 'Gr C/TS', t: 'si', et: 'En el grupo de capis / Team Search (Gr C/TS)', v: e.gr },
      { k: 'E.E ENVIADO', t: 'si', et: 'Estado del equipo enviado (E.E)', v: e.ee },
      { k: 'XPORTY', t: 'si', et: 'Dado de alta en Xporty', v: e.xporty },
      { k: 'CASH', t: 'si', et: 'Paga en efectivo', v: e.cash },
      { k: 'ERROR', t: 'si', et: 'Inscripción con ERROR (no cuenta)', v: e.error }
    ];
    var todos = campos.concat(checks), url = urlFila(r.gid, e.fila);
    var t = [];
    if (e.error) t.push(tag('ERROR', 'gs-tag-r'));
    if (e.buscan) t.push(tag('Busca equipo', 'gs-tag-g'));
    if (e.ocupado) t.push(tag('Nombre repetido ×' + e.ocupado, 'gs-tag-r'));
    if (e.revisar) t.push(tag(e.revisar, 'gs-tag-a'));
    var pend = e.pendiente == null ? '<span class="gs-pos">Al día</span>' : e.pendiente > 0 ? '<b class="gs-neg">Faltan ' + eur(e.pendiente) + '</b>' : '<b class="gs-pos">Ha pagado ' + eur(e.pendiente) + ' de más</b>';
    var v = ventana(e.equipo || 'Inscripción',
      (t.length ? '<div class="gs-tags" style="margin:-6px 0 8px">' + t.join('') + '</div>' : '') +
      '<div class="gs-btns">' +
      (e.linkContacto || wa(e.tel) ? '<a class="gs-b2" href="' + esc(e.linkContacto || wa(e.tel)) + '" target="_blank" rel="noopener">💬 Capitana</a>' : '') +
      (e.linkMensaje ? '<a class="gs-b2" href="' + esc(e.linkMensaje) + '" target="_blank" rel="noopener">📤 Mensaje inicial</a>' : '') +
      (e.linkEstado ? '<a class="gs-b2" href="' + esc(e.linkEstado) + '" target="_blank" rel="noopener">📋 Estado del equipo</a>' : '') +
      (!e.error && !e.buscan ? '<button type="button" class="gs-b2" id="gs-verjug">👥 Jugadoras</button>' : '') +
      (url ? '<a class="gs-b2" href="' + esc(url) + '" target="_blank" rel="noopener">Excel ↗</a>' : '') + '</div>' +
      '<div class="gs-sec">Liga y organización</div><div class="gs-dos">' + campos.slice(0, 4).map(htmlCampo).join('') + '</div>' +
      '<div class="gs-dos">' + campos.slice(4, 7).map(htmlCampo).join('') + '</div>' + htmlCampo(campos[7]) +
      '<div class="gs-sec">Seguimiento</div><div class="gs-checks">' + checks.map(htmlCampo).join('') + '</div>' +
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
      fila('Jugadoras inscritas', e.jugadoras ? esc(e.jugadoras) : '') + fila('Edad media', esc(e.edad)) + fila('Temporadas de media', esc(e.exp)) +
      fila('Fotos', esc(e.fotos)) + '</div>' +
      (e.comenta ? '<div class="gs-dtx"><b>Comentario</b><p>' + esc(e.comenta) + '</p></div>' : '') +
      '<div class="gs-error" id="gs-err" hidden></div>' +
      '<div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-gs-cerrar>Cerrar</button><button type="button" class="gs-b1" id="gs-ok" disabled>Sin cambios</button></div>');
    var vj = v.el.querySelector('#gs-verjug');
    if (vj) vj.onclick = function () { v.cerrar(); S.jug.equipo = e.equipo; S.jug.filtro = 'todas'; S.jug.q = ''; irTab('jugadoras'); };
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

  function pJugadoras(main, forzar) {
    return cuando(main, function () { return 'jug_' + S.comp; }, 'gestionJugadoras', forzar, 'Cargando las jugadoras…', function (o, r) {
      var f = S.jug;
      var equipos = []; r.lista.forEach(function (j) { if (j.equipo && equipos.indexOf(j.equipo) < 0) equipos.push(j.equipo); });
      equipos.sort();
      if (f.equipo && equipos.indexOf(f.equipo) < 0) equipos.unshift(f.equipo);
      var base = function (j) { return !f.equipo || j.equipo === f.equipo; };
      var cuenta = function (k) { return r.lista.filter(base).filter(FILTROS_JUG[k]).length; };
      main.innerHTML = '<div class="gs-fila">' + selectorComp(o) +
        '<select class="gs-sel" id="gs-jeq" aria-label="Equipo"><option value="">Todos los equipos (' + equipos.length + ')</option>' +
        equipos.map(function (x) { return '<option' + (x === f.equipo ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
        chips([['todas', 'Inscritas', cuenta('todas')], ['alerta', 'Con alerta', cuenta('alerta')], ['xporty', 'Sin Xporty', cuenta('xporty')],
          ['contactos', 'Sin contacto', cuenta('contactos')], ['personal', 'Cami personalizada', cuenta('personal')], ['error', 'Con ERROR', cuenta('error')]], f.filtro, 'gs-jf') +
        '<div class="gs-fila" style="margin-top:10px"><input type="search" class="gs-sel" id="gs-jq" placeholder="Buscar: nombre, DNI, correo, dorsal…" value="' + esc(f.q) + '" aria-label="Buscar"></div>' +
        '<div id="gs-jlista"></div>';
      var pinta = function () {
        var q = norm(f.q).trim();
        var lista = r.lista.filter(base).filter(FILTROS_JUG[f.filtro]).filter(function (j) {
          return !q || norm([j.nombreCompleto, j.nombre, j.ap1, j.ap2, j.dni, j.mail, j.cami, j.equipo, j.tel].join(' ')).indexOf(q) >= 0;
        });
        $('#gs-jlista').innerHTML = '<p class="gs-s" style="margin:12px 2px 0;font-size:13px;color:var(--gs-g)">' + lista.length + (lista.length === 1 ? ' jugadora' : ' jugadoras') + '</p>' +
          '<div class="gs-card"><div class="gs-lista">' + (lista.length ? lista.slice(0, MAX_LISTA).map(function (j) {
            var t = [];
            if (j.error) t.push(tag('ERROR', 'gs-tag-r'));
            if (j.alerta) t.push(tag('⚠️ ' + j.alerta.split('·')[0].trim().slice(0, 60), 'gs-tag-a'));
            if (!j.error && !j.xporty) t.push(tag('Sin Xporty', 'gs-tag-g'));
            if (!j.error && j.incluida === '🚫') t.push(tag('Cami personalizada', 'gs-tag-g'));
            return '<button type="button" class="gs-item" data-gs-i="' + r.lista.indexOf(j) + '"><div style="min-width:0">' +
              '<div class="gs-t">' + esc(j.nombreCompleto || j.mail) + '</div>' +
              '<div class="gs-s">' + esc([f.equipo ? '' : j.equipo, j.cami ? '👕 ' + j.cami : (j.dorsal ? '👕 ' + j.dorsal : ''), j.edad ? j.edad + ' años' : ''].filter(String).join(' · ')) + '</div>' +
              (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') + '</div></button>';
          }).join('') + (lista.length > MAX_LISTA ? '<div class="gs-mas">Y ' + (lista.length - MAX_LISTA) + ' más: elige un equipo o busca.</div>' : '')
            : '<div class="gs-vacio">No hay jugadoras con este filtro.</div>') + '</div></div>';
        [].forEach.call(main.querySelectorAll('[data-gs-i]'), function (b) { b.onclick = function () { fichaJugadora(r.lista[Number(b.getAttribute('data-gs-i'))], o, r, equipos); }; });
      };
      pinta();
      $('#gs-comp').onchange = function () { S.comp = this.value; f.equipo = ''; pintar(); };
      $('#gs-jeq').onchange = function () { f.equipo = this.value; pJugadoras(main); };
      $('#gs-jf').onclick = function (ev) { var b = ev.target.closest('[data-gs-f]'); if (!b) return; f.filtro = b.getAttribute('data-gs-f'); pJugadoras(main); };
      var t0; $('#gs-jq').oninput = function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { f.q = v; pinta(); }, 150); };
    });
  }

  function fichaJugadora(j, o, r, equipos) {
    // Equipos a los que se puede pasar: los inscritos (sin ERROR) de la competición, si ya están cargados.
    var eqs = (S.datos['eq_' + S.comp] ? S.datos['eq_' + S.comp].lista.filter(function (e) { return !e.error && !e.buscan; }).map(function (e) { return e.equipo; }) : equipos).slice().sort();
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
    var url = urlFila(r.gid, j.fila), tel = wa(j.tel);
    var alertas = j.alerta ? j.alerta.split(' · ').map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') : '';
    var v = ventana(j.nombreCompleto || 'Jugadora',
      (j.error ? '<div class="gs-tags" style="margin:-6px 0 8px">' + tag('ERROR: esta inscripción no cuenta', 'gs-tag-r') + '</div>' : '') +
      (alertas ? '<div class="gs-alerta">' + alertas + (j.linkAlerta ? '<p><a class="gs-a" href="' + esc(j.linkAlerta) + '" target="_blank" rel="noopener">💬 Enviar el aviso por WhatsApp ↗</a></p>' : '') + '</div>' : '') +
      '<div class="gs-btns">' + (tel ? '<a class="gs-b2" href="' + esc(tel) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' : '') +
      (url ? '<a class="gs-b2" href="' + esc(url) + '" target="_blank" rel="noopener">Excel ↗</a>' : '') + '</div>' +
      '<div class="gs-sec">Inscripción</div>' + htmlCampo(campos[0]) + htmlCampo(campos[1]) +
      '<div class="gs-sec">Datos personales</div><div class="gs-dos">' + campos.slice(2, 9).map(htmlCampo).join('') + '</div>' +
      '<div class="gs-sec">Seguimiento</div><div class="gs-checks">' + checks.map(htmlCampo).join('') + '</div>' +
      '<div class="gs-sec">Camiseta</div><div class="gs-dl">' +
      fila('Camiseta', esc(j.cami)) + fila('Incluida en el precio', j.incluida === '🚫' ? 'No: personalizada (+10 €)' : j.incluida === '✅' ? 'Sí' : '') +
      fila('Color', esc(j.color)) + fila('Pedido', esc(j.pedido)) + fila('Preparada', j.preparada ? 'Sí' : 'No') + fila('Entregada', j.entregada ? 'Sí' : 'No') +
      fila('Incidencia', esc(j.incidencia)) + '</div>' +
      '<div class="gs-sec">Más datos</div><div class="gs-dl">' +
      fila('Alta', esc(j.alta)) + fila('Correo', esc(j.mail)) + fila('Liga', esc(ligaCorta(j.liga))) + fila('Edad', esc(j.edad)) +
      fila('Temporadas con nosotras', esc(j.veterania)) + fila('Normas, imagen, datos y responsabilidad', esc(j.normas)) + fila('Fotos', esc(j.fotos)) + '</div>' +
      '<div class="gs-error" id="gs-err" hidden></div>' +
      '<div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-gs-cerrar>Cerrar</button><button type="button" class="gs-b1" id="gs-ok" disabled>Sin cambios</button></div>');
    guardable(v, campos.concat(checks), function (c) {
      return llamar('gestionJugadoraEditar', [{ fila: j.fila, ts: j.ts, mail: j.mail, comp: j.comp, nombre: j.nombreCompleto }, c]);
    }, function (c) {
      aplicarCambios(j, c, PROP_JUG);
      if (c['NOMBRE'] != null || c['1er APELLIDO'] != null) j.nombreCompleto = (j.nombre + ' ' + j.ap1).trim();
    });
  }

  M.GESTION = { abrir: abrir };
})();
