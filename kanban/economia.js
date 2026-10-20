/*
 * Sección Economía de la app (T0133 · Konamigas). La carga kanban/app.js cuando el perfil tiene ECONOMIA.
 * Lee ECONOMIA v2 a través de la API del DAILY (funciones economia* del script fino, KANBAN_CORE v27)
 * y permite apuntar un movimiento. Contrato con app.js:
 *   window.SX_CTX = { api, persona, pin, clave, color, accion }
 *   window.SX_MOD.ECONOMIA.abrir(elemento)  → pinta la sección dentro del elemento.
 * Lo ya cargado se guarda en memoria: volver a la sección es instantáneo; ↻ vuelve a pedirlo.
 * Resumen: cada partida y subpartida dice si queda margen o te has pasado (y cuánto). Caja: lista solo con saldos;
 * en cada persona, recibido/pagado y el equipo. El avance de la temporada se despliega por competición (avanceComp).
 * de cada inscripción o paga y señal (CAJA!N, ECONOMIA_WEB.gs).
 * Resumen: desplegable discreto «Beneficio y reparto» de la temporada elegida (beneficio, reparto a socios, resultado) y pestaña Presupuesto
 * (T0134): avisos para afinar el presupuesto y de dónde sale cada partida (CONFIG · ORIGEN DEL PRESUPUESTO).
 */
(function () {
  'use strict';
  var M = window.SX_MOD = window.SX_MOD || {};
  if (M.ECONOMIA) return;

  var S = { tab: 'resumen', temp: '', comp: 'TODAS', cajaPersona: '', ligasTemp: '', pendFiltro: '', datos: {}, opciones: null, el: null };
  var abiertos = {};

  function ctx() { return window.SX_CTX || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function vacio(t) { t = String(t || '').trim(); return !t || t === '—' || t === '-'; }

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

  /* ---------- estilos ---------- */
  function css() {
    var c = ctx(), col = c.color || '#020252', acc = c.accion || '#FF1B8C';
    return '.ec{--ec-c:' + col + ';--ec-a:' + acc + ';--ec-v:#0f8a4b;--ec-r:#c62828;--ec-g:#6b6b85;--ec-l:#ececf4;--ec-f:#f6f6fa;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1A1A40;font-size:15px;line-height:1.35}' +
      '.ec *{box-sizing:border-box}' +
      '.ec-cab{background:var(--ec-c);color:#fff;padding:14px 18px 0}' +
      '.ec-cab>h1,.ec-cab>nav{max-width:760px;margin-left:auto!important;margin-right:auto!important}' +
      '.ec-cab h1{margin:0;font-size:24px;letter-spacing:.5px;color:#fff;display:flex;align-items:center;gap:10px}' +
      '.ec-cab h1 small{margin-left:auto;font-size:11.5px;font-weight:600;opacity:.8;letter-spacing:0}' +
      '.ec-re{background:transparent;border:1.5px solid rgba(255,255,255,.7);color:#fff;border-radius:999px;width:32px;height:32px;font-size:16px;cursor:pointer;flex:none}' +
      '.ec-re:disabled{opacity:.5}' +
      '.ec-tabs{display:flex;gap:4px;margin-top:12px;overflow-x:auto;scrollbar-width:none}.ec-tabs::-webkit-scrollbar{display:none}' +
      '.ec-tabs button{flex:1 0 auto;background:transparent;border:0;color:#fff;opacity:.7;font:700 14px/1 inherit;font-family:inherit;padding:10px 12px 12px;border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}' +
      '.ec-tabs button[aria-selected=true]{opacity:1;border-bottom-color:var(--ec-a)}' +
      '.ec-tabs .ec-n{display:inline-block;min-width:20px;padding:2px 6px;margin-left:5px;border-radius:999px;background:var(--ec-a);color:#fff;font-size:11.5px}' +
      '.ec-main{max-width:760px;margin:0 auto;padding:16px 14px 110px}' +
      '.ec-fila{display:flex;gap:10px;flex-wrap:wrap;align-items:center}' +
      '.ec select,.ec input[type=text],.ec input[type=date],.ec input[inputmode]{font:inherit;font-size:16px;padding:10px 12px;border:1.5px solid #d5d5e3;border-radius:10px;background:#fff;color:inherit;min-width:0}' +
      '.ec select:focus,.ec input:focus{outline:3px solid color-mix(in srgb,var(--ec-c) 25%,transparent);border-color:var(--ec-c)}' +
      '.ec-sel{flex:1 1 140px}' +
      '.ec-card{background:#fff;border:1px solid var(--ec-l);border-radius:14px;padding:14px 16px;margin-top:12px}' +
      '.ec-av{margin-top:14px}.ec-av-t{display:flex;justify-content:space-between;font-size:13px;color:var(--ec-g);font-weight:600}' +
      '.ec-barra{height:8px;border-radius:999px;background:var(--ec-l);overflow:hidden;margin-top:6px}.ec-barra i{display:block;height:100%;background:var(--ec-c);border-radius:999px}' +
      '.ec-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}' +
      '.ec-kpi{background:var(--ec-f);border-radius:14px;padding:12px 14px}.ec-kpi.ec-grande{grid-column:1/-1;background:var(--ec-c);color:#fff}' +
      '.ec-kpi b{display:block;font-size:12px;letter-spacing:.4px;text-transform:uppercase;opacity:.75}' +
      '.ec-kpi .ec-val{display:block;font-size:22px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}.ec-kpi.ec-grande .ec-val{font-size:30px}' +
      '.ec-kpi span.ec-sub{display:block;font-size:12.5px;margin-top:3px;opacity:.85}' +
      '.ec-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}' +
      '.ec-mini button,.ec-mini div{background:var(--ec-f);border:0;border-radius:12px;padding:10px;text-align:center;font:inherit;color:inherit}' +
      '.ec-mini b{display:block;font-size:19px;font-variant-numeric:tabular-nums}.ec-mini small{font-size:12px;color:var(--ec-g);font-weight:600}' +
      '.ec-mini button{cursor:pointer}.ec-mini button.ec-alerta b{color:var(--ec-a)}' +
      '.ec-h2{font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--ec-g);margin:24px 2px 4px;font-weight:800}' +
      '.ec-pos{color:var(--ec-v)}.ec-neg{color:var(--ec-r)}.ec-kpi.ec-grande .ec-pos,.ec-kpi.ec-grande .ec-neg{color:#fff}' +
      '.ec-grupo{border-top:1px solid var(--ec-l)}.ec-grupo:first-of-type{border-top:0}' +
      '.ec-gb{display:block;width:100%;background:none;border:0;font:inherit;color:inherit;text-align:left;padding:11px 0;cursor:pointer}' +
      '.ec-gl{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.ec-gl b{font-size:15px}' +
      '.ec-gl .ec-num{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.ec-gs{display:flex;justify-content:space-between;font-size:12.5px;color:var(--ec-g);margin-top:3px}' +
      '.ec-gb .ec-barra{height:6px}.ec-barra i.ec-mal{background:var(--ec-r)}' +
      '.ec-flecha{display:inline-block;width:14px;color:var(--ec-g);transition:transform .15s}.ec-gb[aria-expanded=true] .ec-flecha{transform:rotate(90deg)}' +
      '.ec-lineas{padding:0 0 10px 14px}.ec-linea{font-size:13.5px;padding:8px 0;border-top:1px dashed var(--ec-l)}' +
      '.ec-linea .ec-gl b{font-size:13.5px;font-weight:600}.ec-linea .ec-barra{height:4px;margin-top:5px}.ec-linea .ec-gs{font-size:12px}' +
      '.ec-gs b{font-weight:700}' +
      '.ec-avd summary{list-style:none;cursor:pointer}.ec-avd summary::-webkit-details-marker{display:none}.ec-avd[open] summary .ec-flecha{transform:rotate(90deg)}' +
      '.ec-avc{margin:10px 0 0 18px}.ec-avc .ec-av-t{font-size:12.5px}.ec-avc .ec-barra{height:5px;margin-top:4px}' +
      '.ec-socio{display:flex;justify-content:space-between;gap:10px;padding:5px 0 5px 14px;font-size:13px;color:var(--ec-g)}.ec-socio span:last-child{font-variant-numeric:tabular-nums}' +
      '.ec-rep{padding:0 16px}.ec-rep summary{list-style:none;cursor:pointer;padding:12px 0;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:14px}' +
      '.ec-rep summary::-webkit-details-marker{display:none}.ec-rep summary b{font-weight:700}.ec-rep summary .ec-flecha{transition:transform .15s}.ec-rep[open] summary .ec-flecha{transform:rotate(90deg)}' +
      '.ec-rep summary span:last-child{color:var(--ec-g);font-size:13px;white-space:nowrap}' +
      '.ec-rf{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--ec-l);font-size:14px}.ec-rf span:last-child{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.ec-rf.ec-tot{font-weight:800}.ec-rf small{display:block;color:var(--ec-g);font-size:12px;font-weight:400}' +
      '.ec-av2{border-left:4px solid var(--ec-r);padding:10px 12px;background:#fff;border-radius:10px;margin-top:10px;box-shadow:0 0 0 1px var(--ec-l) inset}' +
      '.ec-av2.ec-amb{border-left-color:#d98a00}.ec-av2.ec-inf{border-left-color:var(--ec-c)}' +
      '.ec-av2 b{display:block;font-size:14.5px}.ec-av2 p{margin:4px 0 0;font-size:13.5px}.ec-av2 .ec-a{display:inline-block;margin-top:6px}' +
      '.ec-pl{padding:9px 0;border-top:1px dashed var(--ec-l)}.ec-pl:first-child{border-top:0}.ec-pl .ec-gs{font-size:12px}' +
      '.ec-pl .ec-org{font-size:12px;color:var(--ec-g);margin-top:3px}' +
      '.ec-chipo{display:inline-block;font-size:11px;font-weight:800;padding:2px 7px;border-radius:999px;background:var(--ec-f);color:var(--ec-g);margin-left:6px;vertical-align:1px}' +
      '.ec-lista{list-style:none;margin:0;padding:0}.ec-item{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--ec-l);align-items:center}' +
      '.ec-item:first-child{border-top:0}.ec-item .ec-t{font-weight:700}.ec-item .ec-s{font-size:12.5px;color:var(--ec-g);margin-top:2px}' +
      '.ec-item .ec-d{text-align:right;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      'button.ec-item{width:100%;background:none;border:0;border-top:1px solid var(--ec-l);font:inherit;color:inherit;text-align:left;cursor:pointer}' +
      '.ec-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.ec-chip{border:1.5px solid #d5d5e3;background:#fff;border-radius:999px;padding:7px 12px;font:600 13.5px/1 inherit;font-family:inherit;color:inherit;cursor:pointer}' +
      '.ec-chip[aria-pressed=true]{background:var(--ec-c);border-color:var(--ec-c);color:#fff}' +
      '.ec-tag{display:inline-block;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--ec-a) 14%,#fff);color:var(--ec-a);font-size:12px;font-weight:800}' +
      '.ec-a{color:var(--ec-c);font-weight:700;font-size:13px}' +
      '.ec-volver{background:none;border:0;color:var(--ec-c);font:700 15px/1 inherit;font-family:inherit;padding:6px 0;cursor:pointer}' +
      '.ec-liga .ec-gl b{font-size:15.5px}.ec-liga .ec-cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px;font-size:12px;color:var(--ec-g)}' +
      '.ec-liga .ec-cifras b{display:block;color:#1A1A40;font-size:14px;font-variant-numeric:tabular-nums}' +
      '.ec-vacio{text-align:center;color:var(--ec-g);padding:30px 10px}' +
      '.ec-cargando{text-align:center;color:var(--ec-g);padding:40px 10px}.ec-giro{width:30px;height:30px;border:3px solid var(--ec-l);border-top-color:var(--ec-c);border-radius:50%;margin:0 auto 12px;animation:ecg 0.8s linear infinite}@keyframes ecg{to{transform:rotate(360deg)}}' +
      '.ec-error{background:#fdecec;color:var(--ec-r);border-radius:12px;padding:12px 14px;margin-top:12px}' +
      '.ec-fab{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:44;background:var(--ec-a);color:#fff;border:0;border-radius:999px;padding:14px 20px;font:800 16px/1 inherit;font-family:inherit;box-shadow:0 6px 18px rgba(0,0,0,.22);cursor:pointer}' +
      '.ec-fab:focus-visible,.ec button:focus-visible{outline:3px solid var(--ec-c);outline-offset:2px}' +
      '.ec-modal{position:fixed;inset:0;z-index:60;background:rgba(10,10,40,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.ec-hoja{background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px))}' +
      '.ec-hoja h2{margin:0 0 12px;font-size:20px;display:flex;justify-content:space-between;align-items:center}' +
      '.ec-x{background:none;border:0;font-size:26px;line-height:1;cursor:pointer;color:var(--ec-g)}' +
      '.ec-sw{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--ec-f);padding:4px;border-radius:12px}' +
      '.ec-sw button{border:0;border-radius:9px;padding:11px;font:800 15px/1 inherit;font-family:inherit;background:transparent;color:var(--ec-g);cursor:pointer}' +
      '.ec-sw button[aria-pressed=true]{background:#fff;color:#1A1A40;box-shadow:0 1px 4px rgba(0,0,0,.12)}' +
      '.ec-sw button[aria-pressed=true].ec-in{color:var(--ec-v)}.ec-sw button[aria-pressed=true].ec-out{color:var(--ec-r)}' +
      '.ec-campo{display:block;margin-top:12px;font-size:13px;font-weight:700;color:var(--ec-g)}.ec-campo>select,.ec-campo>input{display:block;width:100%;margin-top:5px}' +
      '.ec-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.ec-check{display:flex;align-items:center;gap:8px;margin-top:12px;font-weight:600;font-size:14.5px}.ec-check input{width:20px;height:20px}' +
      '.ec-imp{font-size:26px!important;font-weight:800;text-align:right}' +
      '.ec-ok{display:block;width:100%;margin-top:18px;background:var(--ec-a);color:#fff;border:0;border-radius:12px;padding:15px;font:800 17px/1 inherit;font-family:inherit;cursor:pointer}.ec-ok:disabled{opacity:.6}' +
      '.ec-aviso{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:70;background:#1A1A40;color:#fff;border-radius:12px;padding:12px 16px;font-weight:600;max-width:calc(100% - 32px);box-shadow:0 6px 18px rgba(0,0,0,.25)}' +
      '@media(min-width:620px){.ec-kpis{grid-template-columns:repeat(3,1fr)}.ec-kpi.ec-grande{grid-column:auto}.ec-modal{align-items:center}.ec-hoja{border-radius:18px}}' +
      '@media(min-width:900px){.ec-fab{bottom:24px}.ec-aviso{bottom:90px}.ec-main{padding-bottom:60px}}';
  }

  /* ---------- utilidades de pintado ---------- */
  function signo(n) { return n == null ? '' : n > 0 ? 'ec-pos' : n < 0 ? 'ec-neg' : ''; }
  function cargando(msg) { return '<div class="ec-cargando"><div class="ec-giro"></div>' + esc(msg || 'Cargando…') + '</div>'; }
  function errorHtml(e) { return '<div class="ec-error" role="alert">' + esc(e && e.message || e) + '</div>'; }
  function barra(pct, mal) { var p = Math.max(0, Math.min(1, pct || 0)) * 100; return '<div class="ec-barra"><i' + (mal ? ' class="ec-mal"' : '') + ' style="width:' + p.toFixed(1) + '%"></i></div>'; }
  function $(s) { return S.el && S.el.querySelector(s); }
  /** 1234.5 → «1.235 €» (sin decimales, con punto de miles siempre). */
  function eur(n) { return String(Math.round(Math.abs(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }
  /** Cómo va una partida frente a su presupuesto, en palabras y con color. */
  function estado(sec, presN, realN) {
    var p = presN || 0, r = realN || 0;
    if (!p && !r) return { t: '', c: '', mal: false };
    if (sec === 'GASTOS') {
      if (!p) return { t: 'Sin presupuesto', c: 'ec-neg', mal: true };
      if (r > p + 0.5) return { t: 'Te has pasado ' + eur(r - p), c: 'ec-neg', mal: true };
      return { t: 'Quedan ' + eur(p - r), c: 'ec-pos', mal: false };
    }
    if (!p) return { t: '+' + eur(r) + ' sin prever', c: 'ec-pos', mal: false };
    if (r + 0.5 < p) return { t: 'Faltan ' + eur(p - r), c: 'ec-neg', mal: true };
    return { t: (r - p >= 0.5 ? '+' + eur(r - p) + ' más de lo previsto' : 'Cobrado todo'), c: 'ec-pos', mal: false };
  }
  /** «26-27 | LIGA - LAS FENOMENAS» → «LAS FENOMENAS». */
  function nombreEquipo(eq, comp) {
    eq = String(eq || '').trim(); if (!eq) return '';
    if (comp && eq.indexOf(comp + ' - ') === 0) return eq.slice(comp.length + 3);
    return eq.replace(/^\d\d-\d\d \| .*? - /, '');
  }

  /** Pide un dato (con memoria): clave → promesa. */
  function dato(clave, fn, args, forzar) {
    if (!forzar && S.datos[clave]) return Promise.resolve(S.datos[clave]);
    return llamar(fn, args).then(function (r) { S.datos[clave] = r; return r; });
  }

  /* ---------- armazón ---------- */
  var TABS = [['resumen', 'Resumen'], ['caja', 'Caja'], ['ligas', 'Ligas'], ['presupuesto', 'Presupuesto'], ['pendientes', 'Pendientes']];

  function abrir(el) {
    S.el = el;
    var pend = S.datos.pendientes ? S.datos.pendientes.lista.length : 0;
    el.innerHTML = '<div class="ec"><style>' + css() + '</style>' +
      '<header class="ec-cab"><h1>ECONOMÍA<small id="ec-hora"></small><button class="ec-re" id="ec-re" type="button" aria-label="Actualizar" title="Actualizar">↻</button></h1>' +
      '<nav class="ec-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-ec-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] +
          (t[0] === 'pendientes' ? '<span class="ec-n" id="ec-npend"' + (pend ? '' : ' hidden') + '>' + pend + '</span>' : '') + '</button>';
      }).join('') + '</nav></header>' +
      '<main class="ec-main" id="ec-main"></main>' +
      '<button type="button" class="ec-fab" id="ec-fab">+ Apuntar</button></div>';
    el.querySelector('.ec-tabs').onclick = function (e) {
      var b = e.target.closest('[data-ec-tab]'); if (!b) return;
      S.tab = b.getAttribute('data-ec-tab');
      [].forEach.call(el.querySelectorAll('[data-ec-tab]'), function (x) { x.setAttribute('aria-selected', x === b); });
      pintar();
    };
    $('#ec-re').onclick = function () { pintar(true); };
    $('#ec-fab').onclick = formulario;
    pintar();
    // El contador de pendientes, en segundo plano.
    if (!S.datos.pendientes) dato('pendientes', 'economiaPendientes').then(contadorPendientes, function () {});
  }

  function contadorPendientes(p) {
    var n = $('#ec-npend'); if (!n || !p) return;
    n.textContent = p.lista.length; n.hidden = !p.lista.length;
  }

  function hora(h) { var x = $('#ec-hora'); if (x) x.textContent = h ? 'Datos de las ' + String(h).slice(-5) : ''; }

  function pintar(forzar) {
    var main = $('#ec-main'); if (!main) return;
    var tab = S.tab, re = $('#ec-re');
    var p = ({ resumen: pResumen, caja: pCaja, ligas: pLigas, presupuesto: pPresupuesto, pendientes: pPendientes })[tab];
    if (re) re.disabled = true;
    var listo = p(main, !!forzar);
    Promise.resolve(listo).then(function () { if (re) re.disabled = false; }, function () { if (re) re.disabled = false; });
  }

  function cuando(main, clave, fn, args, forzar, msg, pinta) {
    var tab = S.tab;
    if (forzar || !S.datos[clave]) main.innerHTML = cargando(msg);
    return dato(clave, fn, args, forzar).then(function (r) {
      if (S.tab !== tab || !document.body.contains(main)) return;
      hora(r.hora); pinta(r);
    }, function (e) {
      if (S.tab === tab) main.innerHTML = errorHtml(e) + '<p style="text-align:center"><button class="ec-chip" type="button" onclick="this.closest(\'.ec\').querySelector(\'#ec-re\').click()">Reintentar</button></p>';
    });
  }

  /* ---------- RESUMEN ---------- */
  function pResumen(main, forzar) {
    var k = 'res_' + S.temp + '_' + S.comp;
    return cuando(main, k, 'economiaResumen', [S.temp, S.comp], forzar, 'Cargando la temporada…', function (r) {
      S.temp = r.temporada; S.comp = r.competicion || 'TODAS';
      S.datos['res_' + S.temp + '_' + S.comp] = r;
      var K = r.kpis, opT = (r.temporadas || [r.temporada]).map(function (t) { return '<option' + (t === r.temporada ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
      var opC = (r.competiciones || ['TODAS']).map(function (c) { return '<option value="' + esc(c) + '"' + (c === S.comp ? ' selected' : '') + '>' + esc(c === 'TODAS' ? 'Todas las competiciones' : c.slice(8)) + '</option>'; }).join('');
      var h = '<div class="ec-fila"><select class="ec-sel" id="ec-temp" aria-label="Temporada">' + opT + '</select>' +
        '<select class="ec-sel" id="ec-comp" aria-label="Competición">' + opC + '</select></div>';
      if (r.avance != null) {
        var avc = S.comp === 'TODAS' ? (r.avanceComp || []) : [];
        var cab = '<div class="ec-av-t"><span>' + (avc.length ? '<span class="ec-flecha" aria-hidden="true">›</span> ' : '') + 'Avance · ' + esc(r.avanceTxt) + '</span><span>' + esc(r.partidosTxt) + '</span></div>' + barra(r.avance);
        h += avc.length ? '<details class="ec-av ec-avd" id="ec-avd"' + (abiertos.avc ? ' open' : '') + '><summary>' + cab + '</summary>' + avc.map(function (c) {
          var p = c.total ? c.jugados / c.total : 0;
          return '<div class="ec-avc"><div class="ec-av-t"><span>' + esc(c.comp.slice(8).trim()) + (c.total ? ' · ' + Math.round(p * 100) + '%' : '') + '</span><span>' +
            (c.total ? c.jugados + ' de ' + c.total + ' partidos' : 'sin calendario en DB_JORNADAS') + '</span></div>' + (c.total ? barra(p) : '') + '</div>';
        }).join('') + '</details>' : '<div class="ec-av">' + cab + '</div>';
      }
      h += '<div class="ec-kpis">' +
        '<div class="ec-kpi ec-grande"><b>Beneficio</b><span class="ec-val">' + esc(K.resultado.t) + '</span>' +
        '<span class="ec-sub">Presupuesto ' + esc(K.presupuesto.t) + ' · ' + (K.desviacion.n == null ? '' : eur(K.desviacion.n) + (K.desviacion.n >= 0 ? ' mejor' : ' peor') + ' de lo previsto') + '</span></div>' +
        '<div class="ec-kpi"><b>Ingresos</b><span class="ec-val ec-pos">' + esc(K.ingresos.t) + '</span>' + (r.totalIngresos ? '<span class="ec-sub">de ' + esc(r.totalIngresos.pres) + ' previstos</span>' : '') + '</div>' +
        '<div class="ec-kpi"><b>Gastos</b><span class="ec-val">' + esc(K.gastos.t) + '</span>' + (r.totalGastos ? '<span class="ec-sub">de ' + esc(r.totalGastos.pres) + ' previstos</span>' : '') + '</div></div>' +
        '<div class="ec-mini"><div><b>' + esc(K.equipos.t) + '</b><small>Equipos</small></div><div><b>' + esc(K.partidos.t) + '</b><small>Partidos</small></div>' +
        '<button type="button" id="ec-irpend"' + (K.pendientes.n ? ' class="ec-alerta"' : '') + '><b>' + esc(K.pendientes.t) + '</b><small>Por revisar ›</small></button></div>';
      h += repartoHtml(r);
      ['INGRESOS', 'GASTOS'].forEach(function (sec) {
        var gs = (r.grupos || []).filter(function (g) { return g.seccion === sec; });
        if (!gs.length) return;
        h += '<h2 class="ec-h2">' + (sec === 'INGRESOS' ? 'Ingresos' : 'Gastos') + ' · real frente a presupuesto</h2><div class="ec-card">';
        gs.forEach(function (g, i) {
          var id = sec + '_' + i, ab = !!abiertos[id], lin = (g.lineas || []).filter(function (l) { return !vacio(l.real) || !vacio(l.pres); });
          var pct = g.presN ? (g.realN || 0) / g.presN : (g.realN ? 1 : 0);
          var est = estado(sec, g.presN, g.realN), mal = sec === 'GASTOS' && est.mal;
          h += '<div class="ec-grupo"><button type="button" class="ec-gb" data-ec-g="' + id + '" aria-expanded="' + ab + '"' + (lin.length ? '' : ' disabled') + '>' +
            '<div class="ec-gl"><b>' + (lin.length ? '<span class="ec-flecha" aria-hidden="true">›</span>' : '') + esc(g.n) + '</b><span class="ec-num">' + esc(vacio(g.real) ? '0 €' : g.real) + '</span></div>' +
            barra(pct, mal) +
            '<div class="ec-gs"><span>Presupuesto ' + esc(vacio(g.pres) ? '—' : g.pres) + (g.pct ? ' · ' + esc(g.pct) : '') + '</span>' +
            '<span class="' + est.c + '"><b>' + esc(est.t) + '</b></span></div></button>' +
            (lin.length ? '<div class="ec-lineas"' + (ab ? '' : ' hidden') + ' id="ec-l-' + id + '">' + lin.map(function (l) {
              var e = estado(sec, l.presN, l.realN), lp = l.presN ? (l.realN || 0) / l.presN : (l.realN ? 1 : 0);
              return '<div class="ec-linea"><div class="ec-gl"><b>' + esc(l.n) + '</b><span class="ec-num">' + esc(vacio(l.real) ? '0 €' : l.real) + '</span></div>' +
                barra(lp, sec === 'GASTOS' && e.mal) +
                '<div class="ec-gs"><span>' + (vacio(l.pres) ? 'Sin presupuesto' : 'de ' + esc(l.pres) + (l.pct ? ' · ' + esc(l.pct) : '')) + '</span>' +
                '<span class="' + e.c + '"><b>' + esc(e.t) + '</b></span></div></div>';
            }).join('') + '</div>' : '') + '</div>';
        });
        h += '</div>';
      });
      if ((r.porCompeticion || []).length && S.comp === 'TODAS') {
        h += '<h2 class="ec-h2">Por competición</h2><div class="ec-card"><ul class="ec-lista">' + r.porCompeticion.map(function (c) {
          return '<li class="ec-item"><div><div class="ec-t">' + esc(c.n.slice(8) === '--' ? 'Gastos generales' : c.n.slice(8)) + '</div>' +
            '<div class="ec-s">' + esc(c.equipos) + ' equipos · ' + esc(c.partidos) + ' partidos · ingresos ' + esc(c.ingresos) + ' · gastos ' + esc(c.gastos) + '</div></div>' +
            '<div class="ec-d"><span class="' + signo(c.resultadoN) + '">' + esc(c.resultado) + '</span><div class="ec-s ' + signo(c.desvN) + '">' + (vacio(c.desv) ? '' : (c.desvN > 0 ? '+' : '') + esc(c.desv) + ' vs presup.') + '</div></div></li>';
        }).join('') + '</ul></div>';
      }
      var sinCat = (r.resultado || []).filter(function (x) { return /Sin categor/.test(x.n); })[0];
      if (sinCat && !/^0 /.test(sinCat.extra)) h += '<p class="ec-s" style="color:var(--ec-a);margin-top:12px">⚠️ ' + esc(sinCat.extra) + ' sin categoría no salen en estas cuentas.</p>';
      main.innerHTML = h;
      $('#ec-temp').onchange = function () { S.temp = this.value; S.comp = 'TODAS'; pintar(); };
      $('#ec-comp').onchange = function () { S.comp = this.value; pintar(); };
      $('#ec-irpend').onclick = function () { var b = S.el.querySelector('[data-ec-tab=pendientes]'); if (b) b.click(); };
      var rp = $('#ec-rep'); if (rp) rp.ontoggle = function () { abiertos.rep = rp.open; };
      var ad = $('#ec-avd'); if (ad) ad.ontoggle = function () { abiertos.avc = ad.open; };
      [].forEach.call(main.querySelectorAll('[data-ec-g]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-ec-g'), l = $('#ec-l-' + id); if (!l) return;
          abiertos[id] = !abiertos[id]; l.hidden = !abiertos[id]; b.setAttribute('aria-expanded', abiertos[id]);
        };
      });
    });
  }

  /* ---------- REPARTO A SOCIOS ---------- */
  function idxR(lista, re) { for (var i = 0; i < lista.length; i++) if (re.test(lista[i].n)) return i; return -1; }

  /** Desplegable «Beneficio y reparto» de la temporada elegida (hoja TEMPORADA): beneficio → reparto a socios → resultado. */
  function repartoHtml(r) {
    var res = r.resultado || [], i0 = idxR(res, /^Reparto a socios/), i1 = idxR(res, /^Resultado tras reparto/);
    if (i0 < 0) return '';
    var tot = res[i0], socios = res.slice(i0 + 1, i1 > i0 ? i1 : i0 + 1).filter(function (x) { return !vacio(x.real); });
    var tras = i1 >= 0 ? res[i1] : null, repN = tot.realN || 0;
    var queda = tras && !vacio(tras.real) ? tras.real : r.kpis.resultado.t;
    return '<details class="ec-card ec-rep" id="ec-rep"' + (abiertos.rep ? ' open' : '') + '><summary><b><span class="ec-flecha" aria-hidden="true">›</span> Beneficio y reparto</b>' +
      '<span>' + (repN ? 'repartido ' + eur(repN) : 'sin reparto') + '</span></summary>' +
      '<div class="ec-rf"><span>Beneficio<small>Ingresos − gastos de la ' + esc(r.temporada) + '</small></span><span>' + esc(r.kpis.resultado.t) + '</span></div>' +
      '<div class="ec-rf"><span>Reparto a socios</span><span>' + (repN ? '− ' + eur(repN) : '0 €') + '</span></div>' +
      socios.map(function (x) { return '<div class="ec-socio"><span>' + esc(x.n) + '</span><span>' + esc(x.real) + '</span></div>'; }).join('') +
      '<div class="ec-rf ec-tot"><span>Resultado<small>Lo que queda en Konami</small></span><span>' + esc(queda) + '</span></div></details>';
  }

  /* ---------- PRESUPUESTO (T0134): avisos para afinarlo y de dónde sale cada partida ---------- */
  function pPresupuesto(main, forzar) {
    var k = 'res_' + S.temp + '_TODAS', tab = S.tab;
    if (forzar || !S.datos[k] || !S.datos.hist) main.innerHTML = cargando('Repasando el presupuesto…');
    return Promise.all([dato(k, 'economiaResumen', [S.temp, 'TODAS'], forzar), dato('hist', 'economiaHistorico', [], forzar)]).then(function (x) {
      if (S.tab !== tab || !document.body.contains(main)) return;
      var r = x[0], H = x[1];
      S.temp = r.temporada; S.datos['res_' + r.temporada + '_TODAS'] = r;
      hora(r.hora); main.innerHTML = presupuestoHtml(r, H);
      $('#ec-ptemp').onchange = function () { S.temp = this.value; S.comp = 'TODAS'; pintar(); };
    }, function (e) {
      if (S.tab === tab) main.innerHTML = errorHtml(e);
    });
  }

  function presupuestoHtml(r, H) {
    var j = H.temporadas.indexOf(r.temporada), jp = j - 1, prev = jp >= 0 ? H.temporadas[jp] : '';
    var fila = function (n) { for (var i = 0; i < H.filas.length; i++) if (H.filas[i].n === n) return H.filas[i]; return null; };
    var val = function (n, jj) { var f = fila(n); return f && jj >= 0 ? f.v[jj] : null; };
    var org = {}; (H.origen || []).forEach(function (o) { org[o.n] = o; });
    var E = H.enlaces || {};
    var eqA = r.kpis.equipos.n, eqP = val('Equipos', jp);
    var ptA = Number(String(r.partidosTxt || '').replace(/\./g, '').replace(/^.*?de\s+(\d+).*$/, '$1')) || 0, ptP = val('Partidos', jp);
    var lineas = [];
    (r.grupos || []).forEach(function (g) { (g.lineas || []).forEach(function (l) { lineas.push({ l: l, sec: g.seccion, grupo: g.n }); }); });

    var tipoDe = function (o) {
      var s = String(o && o.origen || '');
      if (/^DB_COMPETICIONES\[/.test(s)) return { t: 'mano', col: s.replace(/^DB_COMPETICIONES\[(.*)\]$/, '$1') };
      if (/^DB_JORNADAS/.test(s)) return { t: 'calendario' };
      if (/^PARTIDOS/.test(s)) return { t: 'partidos' };
      if (/^EQUIPOS/.test(s)) return { t: 'equipos' };
      return { t: 'sin' };
    };
    var link = function (u, t) { return u ? '<a class="ec-a" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + ' ↗</a>' : ''; };
    var donde = function (tp, n) {
      if (tp.t === 'mano') return { txt: 'Se pone a mano en GESTION › DB_COMPETICIONES, columna «' + tp.col + '», en cada competición (los gastos fijos van en la fila «' + r.temporada + ' | --»).', a: link(E.competiciones, 'Abrir DB_COMPETICIONES') };
      if (tp.t === 'calendario') return { txt: /^CAMPOS/.test(n) ? 'Sale solo: suma del PRECIO CAMPO de cada partido de DB_JORNADAS en ese colegio. Se afina revisando que estén todas las jornadas y el precio por partido de cada instalación.' : 'Sale solo: suma del PRECIO ARBIT de cada partido de DB_JORNADAS. Se afina revisando las jornadas y el precio de árbitro.', a: link(E.jornadas, 'Abrir DB_JORNADAS') + (/^CAMPOS/.test(n) ? ' ' + link(E.precios, 'Precios de instalaciones') : '') };
      if (tp.t === 'partidos') return { txt: 'Sale solo: partidos de DB_JORNADAS (sin campo libre, anulados ni aplazados jugados) × gestión por partido, que está en CONFIG de ECONOMIA.', a: link(E.jornadas, 'Abrir DB_JORNADAS') + ' ' + link(E.config, 'CONFIG de ECONOMIA') };
      if (tp.t === 'equipos') return { txt: 'Sale solo: equipos de DB_LIGAS × precio de inscripción de DB_COMPETICIONES (la P.S por equipo está en CONFIG de ECONOMIA).', a: link(E.ligas, 'Abrir DB_LIGAS') + ' ' + link(E.competiciones, 'Precios en DB_COMPETICIONES') };
      return { txt: 'No tiene presupuesto: en CONFIG su ORIGEN DEL PRESUPUESTO es «—».', a: '' };
    };

    var avisos = [], filasHtml = { calendario: [], partidos: [], equipos: [], mano: [], sin: [] };
    lineas.forEach(function (x) {
      var l = x.l, o = org[l.n], tp = tipoDe(o), pres = l.presN || 0, real = l.realN || 0, pas = val(l.n, jp), gasto = x.sec === 'GASTOS';
      var sug = null, sugTxt = '';
      if (tp.t === 'mano' && pas) {
        if (x.grupo === 'Competición' && eqA && eqP) { sug = pas / eqP * eqA; sugTxt = eur(pas) + ' la ' + prev + ' con ' + eqP + ' equipos → ' + eur(sug) + ' con ' + eqA; }
        else { sug = pas; sugTxt = 'lo de la ' + prev; }
      }
      var d = donde(tp, l.n);
      if (gasto && real > pres + 0.5 && tp.t !== 'sin') {
        avisos.push({ p: 1, c: '', n: l.n, t: pres ? 'Ya te has pasado: llevas ' + eur(real) + ' de ' + eur(pres) + ' (' + eur(real - pres) + ' más).' : 'Hay ' + eur(real) + ' gastados y no tiene presupuesto.',
          s: (tp.t === 'mano' ? 'Súbelo al menos a ' + eur(Math.max(real, sug || 0)) + (sug && sug > real ? ' (' + sugTxt + ')' : '') + ', o revisa si algún gasto está en la categoría equivocada.' : 'Revisa los precios o las jornadas de donde sale.'), a: d.a });
      } else if (!pres && tp.t !== 'sin' && pas && pas > 50) {
        avisos.push({ p: 2, c: ' ec-amb', n: l.n, t: 'Sin presupuesto, y la ' + prev + ' fueron ' + eur(pas) + '.', s: tp.t === 'mano' ? 'Si se repite, ponle unos ' + eur(sug || pas) + (sugTxt ? ' (' + sugTxt + ')' : '') + '.' : 'Revisa que estén las jornadas o equipos de donde sale.', a: d.a });
      } else if (tp.t === 'mano' && pres && sug && sug > 200 && Math.abs(pres - sug) / sug > 0.35) {
        avisos.push({ p: 3, c: ' ec-amb', n: l.n, t: 'Presupuesto ' + eur(pres) + ', muy ' + (pres > sug ? 'por encima' : 'por debajo') + ' de lo esperado: ' + eur(sug) + '.', s: 'Esperado = ' + sugTxt + '. Si hay un motivo (precios, cambios), déjalo así.', a: d.a });
      } else if ((tp.t === 'calendario' || tp.t === 'partidos') && pres && pas && ptA && ptP) {
        var a1 = pres / ptA, a0 = pas / ptP;
        if (Math.abs(a1 - a0) / a0 > 0.15) avisos.push({ p: 3, c: ' ec-amb', n: l.n, t: 'Sale a ' + eur(a1).replace(' €', '') + ' €/partido; la ' + prev + ' fue ' + eur(a0).replace(' €', '') + ' €/partido.', s: 'Revisa los precios por partido de DB_JORNADAS.', a: d.a });
      } else if (tp.t === 'sin' && gasto && real > 0) {
        avisos.push({ p: 4, c: ' ec-inf', n: l.n, t: 'Lleva ' + eur(real) + ' y no tiene presupuesto posible.', s: 'Si va a ser habitual, añade una columna en DB_COMPETICIONES y ponle su origen en CONFIG.', a: link(E.config, 'CONFIG de ECONOMIA') });
      }
      filasHtml[tp.t].push('<div class="ec-pl"><div class="ec-gl"><b>' + esc(l.n) + '</b><span class="ec-num">' + (pres ? eur(pres) : '—') + '</span></div>' +
        '<div class="ec-gs"><span>' + (pas != null ? 'La ' + esc(prev) + ': ' + eur(pas) : 'Sin dato de la ' + esc(prev || 'pasada')) + (sug && tp.t === 'mano' && Math.abs(sug - pas) > 1 ? ' · esperado ' + eur(sug) : '') + '</span>' +
        '<span>Llevamos ' + eur(real) + '</span></div><div class="ec-org">' + esc(d.txt) + (d.a ? '<br>' + d.a : '') + '</div></div>');
    });
    var cal = '';
    if (ptA && ptP && ptA < ptP * 0.9) cal = '<div class="ec-av2 ec-amb"><b>Calendario</b><p>DB_JORNADAS tiene ' + ptA + ' partidos esta temporada; la ' + esc(prev) + ' se jugaron ' + Math.round(ptP) + '. Si faltan jornadas por crear (copas, eliminatorias…), campos, árbitros y gestión saldrán cortos.</p>' + link(E.jornadas, 'Abrir DB_JORNADAS') + '</div>';
    avisos.sort(function (a, b) { return a.p - b.p; });
    var opT = (r.temporadas || [r.temporada]).map(function (t) { return '<option' + (t === r.temporada ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
    var h = '<div class="ec-fila"><select class="ec-sel" id="ec-ptemp" aria-label="Temporada">' + opT + '</select></div>' +
      '<p class="ec-s" style="margin:10px 2px 0;color:var(--ec-g);font-size:13px">Qué partidas mirar para afinar el presupuesto de la ' + esc(r.temporada) + ', comparado con la ' + esc(prev || 'temporada anterior') +
      (eqA && eqP ? ' (' + eqA + ' equipos ahora, ' + eqP + ' entonces)' : '') + ', y dónde se cambia cada una. El presupuesto se cambia en GESTION; aquí solo se mira.</p>';
    h += '<h2 class="ec-h2">Avisos · ' + (avisos.length + (cal ? 1 : 0)) + '</h2>' + cal + (avisos.length ? avisos.map(function (a) {
      return '<div class="ec-av2' + a.c + '"><b>' + esc(a.n) + '</b><p>' + esc(a.t) + '</p><p style="color:var(--ec-g)">' + esc(a.s) + '</p>' + (a.a || '') + '</div>';
    }).join('') : (cal ? '' : '<div class="ec-card ec-vacio">👌 Nada que afinar ahora mismo.</div>'));
    var bloques = [['calendario', 'Se calculan solas con el calendario (DB_JORNADAS)'], ['partidos', 'Se calcula sola con los partidos'], ['equipos', 'Se calculan solas con los equipos'],
      ['mano', 'Se ponen a mano (DB_COMPETICIONES)'], ['sin', 'Sin presupuesto']];
    bloques.forEach(function (b) {
      if (!filasHtml[b[0]].length) return;
      h += '<h2 class="ec-h2">' + esc(b[1]) + '</h2><div class="ec-card">' + filasHtml[b[0]].join('') + '</div>';
    });
    return h;
  }

  /* ---------- CAJA ---------- */
  function pCaja(main, forzar) {
    var p = S.cajaPersona;
    if (!p) {
      return cuando(main, 'caja_KONAMI', 'economiaCaja', ['KONAMI'], forzar, 'Mirando quién tiene el dinero…', function (r) {
        var h = '<p class="ec-s" style="margin:0 2px;color:var(--ec-g);font-size:13px">Dinero de Konami que tiene cada persona. Toca una para ver lo recibido, lo pagado y sus movimientos.</p>';
        if (r.estado) h += '<p style="margin:10px 2px 0;font-size:13.5px">' + esc(r.estado) + '</p>';
        h += '<div class="ec-card"><div class="ec-lista">' + r.personas.map(function (x) {
          return '<button type="button" class="ec-item" data-ec-p="' + esc(x.n) + '"><div><div class="ec-t">' + esc(x.n) + '</div></div>' +
            '<div class="ec-d ' + signo(x.saldoN) + '">' + esc(x.saldo) + ' ›</div></button>';
        }).join('') + '</div></div>';
        if (r.externos) h += '<p class="ec-s" style="margin:12px 2px;color:var(--ec-g);font-size:12.5px">' + esc(r.externos) + '</p>';
        main.innerHTML = h;
        [].forEach.call(main.querySelectorAll('[data-ec-p]'), function (b) {
          b.onclick = function () { S.cajaPersona = b.getAttribute('data-ec-p'); pintar(); };
        });
      });
    }
    return cuando(main, 'caja_' + p, 'economiaCaja', [p], forzar, 'Cargando los movimientos de ' + p + '…', function (r) {
      var yo = (r.personas || []).filter(function (x) { return x.n === p; })[0];
      var h = '<button type="button" class="ec-volver" id="ec-volver">‹ Todas las personas</button>' +
        '<div class="ec-kpis" style="margin-top:8px"><div class="ec-kpi ec-grande"><b>' + esc(p) + ' · saldo</b><span class="ec-val">' + esc(yo ? yo.saldo : '—') + '</span>' +
        (yo ? '<span class="ec-sub">Recibido ' + esc(yo.recibido) + ' · pagado ' + esc(yo.pagado) + '</span>' : '') + '</div></div>' +
        '<h2 class="ec-h2">Movimientos · más reciente arriba</h2><div class="ec-card">';
      h += r.detalle.length ? '<ul class="ec-lista">' + r.detalle.map(function (m) {
        var eq = /^INSCRIPCION/i.test(m.categoria) ? nombreEquipo(m.equipo, m.comp) : '';
        var tipoIns = /P\.?\s*S\.?$/i.test(m.categoria) ? 'Paga y señal' : 'Inscripción';
        return '<li class="ec-item"><div><div class="ec-t">' + esc(eq || m.concepto || m.categoria) + '</div>' +
          '<div class="ec-s">' + (eq ? esc(tipoIns) + ' · ' : '') + esc(m.fecha) + ' · ' + esc(m.deA) + (m.comp ? ' · ' + esc(/^\d\d-\d\d \| /.test(m.comp) ? (m.comp.slice(8) === '--' ? 'General' : m.comp.slice(8)) : m.comp) : '') + '</div></div>' +
          '<div class="ec-d"><span class="' + signo(m.importeN) + '">' + esc(m.importe) + '</span><div class="ec-s">saldo ' + esc(m.saldo) + '</div></div></li>';
      }).join('') + '</ul>' + (r.detalle.length >= 150 ? '<p class="ec-s" style="color:var(--ec-g)">Se ven los 150 últimos.</p>' : '') : '<div class="ec-vacio">Sin movimientos.</div>';
      main.innerHTML = h + '</div>';
      $('#ec-volver').onclick = function () { S.cajaPersona = ''; pintar(); };
    });
  }

  /* ---------- LIGAS (rentabilidad) ---------- */
  function pLigas(main, forzar) {
    return cuando(main, 'ligas', 'economiaRentabilidad', [], forzar, 'Calculando lo que deja cada liga…', function (r) {
      if (!r.temporadas.length) { main.innerHTML = '<div class="ec-vacio">Todavía no hay datos de rentabilidad.</div>'; return; }
      var ts = r.temporadas.map(function (t) { return t.temporada; });
      if (ts.indexOf(S.ligasTemp) < 0) S.ligasTemp = ts[0];
      var t = r.temporadas[ts.indexOf(S.ligasTemp)], T = t.total;
      var h = '<div class="ec-fila"><select class="ec-sel" id="ec-ltemp" aria-label="Temporada">' + ts.map(function (x) { return '<option' + (x === S.ligasTemp ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="ec-kpis"><div class="ec-kpi ec-grande"><b>' + esc(T.liga) + '</b><span class="ec-val">' + esc(T.resultado) + '</span>' +
        '<span class="ec-sub">' + esc(T.resultadoEq) + ' por equipo · margen ' + esc(T.pct) + '</span></div>' +
        '<div class="ec-kpi"><b>Ingresos</b><span class="ec-val">' + esc(T.ingresos) + '</span><span class="ec-sub">' + esc(T.equipos) + ' equipos · ' + esc(T.partidos) + ' partidos</span></div>' +
        '<div class="ec-kpi"><b>Margen directo</b><span class="ec-val">' + esc(T.margen) + '</span><span class="ec-sub">tras campos ' + esc(T.campos) + ', árbitros ' + esc(T.arbitros) + ' y gestión ' + esc(T.gestion) + '</span></div></div>' +
        '<h2 class="ec-h2">Cada liga · de más a menos rentable por equipo</h2><div class="ec-card">';
      var ligas = t.ligas.filter(function (l) { return !vacio(l.ingresos) || !vacio(l.resultado); });
      var sin = t.ligas.length - ligas.length;
      h += ligas.map(function (l, i) {
        return '<div class="ec-grupo ec-liga" style="padding:11px 0"><div class="ec-gl"><b>' + esc(l.liga) + '</b><span class="ec-num ' + signo(l.resultadoEqN) + '">' + esc(l.resultadoEq) + ' / equipo</span></div>' +
          '<div class="ec-gs"><span>' + esc(l.comp) + ' · ' + esc(l.dia) + '</span><span>margen ' + esc(l.pct) + '</span></div>' +
          barra(l.pctN, l.pctN != null && l.pctN < 0) +
          '<div class="ec-cifras"><div><b>' + esc(l.equipos) + '</b>equipos</div><div><b>' + esc(l.ingresos) + '</b>ingresos</div>' +
          '<div><b>' + esc(l.margen) + '</b>margen directo</div><div><b class="' + signo(l.resultadoN) + '">' + esc(l.resultado) + '</b>resultado</div></div></div>';
      }).join('');
      h += '</div>' + (sin ? '<p class="ec-s" style="margin:10px 2px;color:var(--ec-g);font-size:12.5px">' + sin + (sin === 1 ? ' liga aún sin datos.' : ' ligas aún sin datos.') + '</p>' : '') +
        '<p class="ec-s" style="margin:10px 2px;color:var(--ec-g);font-size:12.5px">Margen directo = ingresos − campos, árbitros y gestión. El resultado reparte además el resto de gastos de la competición y los generales. Se recalcula cada hora.</p>';
      main.innerHTML = h;
      $('#ec-ltemp').onchange = function () { S.ligasTemp = this.value; pintar(); };
    });
  }

  /* ---------- PENDIENTES ---------- */
  function pPendientes(main, forzar) {
    return cuando(main, 'pendientes', 'economiaPendientes', [], forzar, 'Buscando lo que falta…', function (r) {
      contadorPendientes(r);
      if (!r.lista.length) { main.innerHTML = '<div class="ec-vacio" style="font-size:17px">🎉 No hay nada pendiente.</div>'; return; }
      var conts = r.contadores.filter(function (c) { return c.c > 0 && !/^TOTAL$/i.test(c.n); });
      var clave = function (n) { return norm(n).replace(/^SIN\s+/, '').split('/')[0].trim(); };
      var f = S.pendFiltro;
      var lista = r.lista.filter(function (x) { return !f || norm(x.falta).indexOf(f) >= 0; });
      var h = '<p class="ec-s" style="margin:0 2px;color:var(--ec-g);font-size:13px">Movimientos con algún dato por completar. Se corrigen en el Excel; al guardar, desaparecen de aquí.</p>' +
        '<div class="ec-chips" style="margin-top:10px"><button type="button" class="ec-chip" data-ec-f="" aria-pressed="' + !f + '">Todos · ' + r.lista.length + '</button>' +
        conts.map(function (c) { var k = clave(c.n); return '<button type="button" class="ec-chip" data-ec-f="' + esc(k) + '" aria-pressed="' + (f === k) + '">' + esc((c.n.charAt(0) + c.n.slice(1).toLowerCase()).replace(/\biva\b/, 'IVA')) + ' · ' + c.c + '</button>'; }).join('') + '</div>' +
        '<div class="ec-card"><ul class="ec-lista">' + (lista.length ? lista.map(function (x) {
          return '<li class="ec-item"><div style="min-width:0"><div class="ec-t">' + esc(x.concepto) + '</div>' +
            '<div class="ec-s">' + esc(x.fecha) + ' · ' + esc(x.comp) + (x.categoria ? ' · ' + esc(x.categoria) : '') + ' · ' + esc(x.emite) + ' → ' + esc(x.recibe) + '</div>' +
            '<div style="margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="ec-tag">Falta: ' + esc(x.falta) + '</span>' +
            (x.url ? '<a class="ec-a" href="' + esc(x.url) + '" target="_blank" rel="noopener">Corregir en el Excel ↗</a>' : '') + '</div></div>' +
            '<div class="ec-d ' + (/^-/.test(x.importe) ? 'ec-neg' : 'ec-pos') + '">' + esc(x.importe) + '<div class="ec-s">ID ' + esc(x.id) + '</div></div></li>';
        }).join('') : '<li class="ec-vacio">Nada con este filtro.</li>') + '</ul></div>';
      main.innerHTML = h;
      [].forEach.call(main.querySelectorAll('[data-ec-f]'), function (b) {
        b.onclick = function () { S.pendFiltro = b.getAttribute('data-ec-f'); pintar(); };
      });
    });
  }

  /* ---------- APUNTAR un movimiento ---------- */
  function aviso(t) {
    var a = document.createElement('div'); a.className = 'ec-aviso'; a.setAttribute('role', 'status'); a.textContent = t;
    (S.el.querySelector('.ec') || document.body).appendChild(a);
    setTimeout(function () { a.remove(); }, 4500);
  }

  function formulario() {
    var raiz = S.el.querySelector('.ec');
    var m = document.createElement('div'); m.className = 'ec-modal';
    m.innerHTML = '<div class="ec-hoja" role="dialog" aria-modal="true" aria-labelledby="ec-ft"><h2 id="ec-ft">Apuntar un movimiento<button type="button" class="ec-x" aria-label="Cerrar">×</button></h2>' + cargando('Preparando el formulario…') + '</div>';
    raiz.appendChild(m);
    var cerrar = function () { m.remove(); document.removeEventListener('keydown', esc_); };
    var esc_ = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', esc_);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.ec-x')) cerrar(); });
    var opc = S.opciones ? Promise.resolve(S.opciones) : llamar('economiaOpciones').then(function (o) { S.opciones = o; return o; });
    opc.then(function (o) { pintaFormulario(m.querySelector('.ec-hoja'), o, cerrar); }, function (e) {
      m.querySelector('.ec-hoja').insertAdjacentHTML('beforeend', errorHtml(e)); var c = m.querySelector('.ec-cargando'); if (c) c.remove();
    });
  }

  function pintaFormulario(hoja, o, cerrar) {
    var st = { entra: false, ivaTocado: false };
    var temp = o.temporada;
    var compDef = function () {
      var pref = st.entra ? temp + ' | LIGA' : temp + ' | --';
      return o.competiciones.indexOf(pref) >= 0 ? pref : (o.competiciones.filter(function (c) { return c.slice(0, 5) === temp; })[0] || o.competiciones[0] || '');
    };
    var ops = function (lista, sel, vacia) {
      return (vacia ? '<option value="">' + esc(vacia) + '</option>' : '') + lista.map(function (x) {
        var v = typeof x === 'string' ? x : x.v, t = typeof x === 'string' ? x : x.t;
        return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
    };
    hoja.innerHTML = '<h2 id="ec-ft">Apuntar un movimiento<button type="button" class="ec-x" aria-label="Cerrar">×</button></h2>' +
      '<form id="ec-form" novalidate><div class="ec-sw" role="group" aria-label="Tipo"><button type="button" class="ec-in" data-ec-t="1" aria-pressed="false">↓ Entra dinero</button><button type="button" class="ec-out" data-ec-t="0" aria-pressed="true">↑ Sale dinero</button></div>' +
      '<label class="ec-campo">Importe (€)<input id="ec-imp" class="ec-imp" inputmode="decimal" autocomplete="off" placeholder="0,00" required></label>' +
      '<label class="ec-campo">Descripción<input id="ec-desc" type="text" maxlength="200" placeholder="Ej.: pago campo lunes, inscripción Las Fenómenas…" required></label>' +
      '<div class="ec-dos"><label class="ec-campo">Fecha<input id="ec-fecha" type="date" value="' + esc(o.hoy) + '" required></label>' +
      '<label class="ec-campo">IVA<select id="ec-iva"><option value="0,21">21 %</option><option value="0,10">10 %</option><option value="0">Sin IVA</option></select></label></div>' +
      '<label class="ec-campo">Competición<select id="ec-comp"></select></label>' +
      '<label class="ec-campo" id="ec-cat-l">Categoría<select id="ec-cat"></select></label>' +
      '<div class="ec-dos"><label class="ec-campo">Quién paga<select id="ec-emite">' + ops(o.personas, 'KONAMI') + '</select></label>' +
      '<label class="ec-campo">Quién cobra<select id="ec-recibe">' + ops(o.personas, 'EXTERNO') + '</select></label></div>' +
      '<label class="ec-campo" id="ec-eq-l">Equipo (opcional)<select id="ec-eq"></select></label>' +
      '<label class="ec-check"><input type="checkbox" id="ec-cash"> En efectivo</label>' +
      '<label class="ec-check"><input type="checkbox" id="ec-int"> Traspaso entre nosotros (no es ingreso ni gasto)</label>' +
      '<p class="ec-error" id="ec-ferr" hidden role="alert"></p>' +
      '<button type="submit" class="ec-ok" id="ec-ok">Apuntar</button>' +
      '<p class="ec-s" style="color:var(--ec-g);font-size:12px;margin:10px 0 0;text-align:center">Se guarda en MOVIMIENTOS de ECONOMIA v2 como validado. La factura se adjunta en el Excel.</p></form>';
    var q = function (s) { return hoja.querySelector(s); };
    var pintaComp = function () { q('#ec-comp').innerHTML = ops(o.competiciones, compDef()); };
    var pintaCat = function () {
      var tipo = st.entra ? 'INGRESO' : 'GASTO', grupos = {}, orden = [];
      o.categorias.filter(function (c) { return !c.tipo || c.tipo === tipo; }).forEach(function (c) {
        var g = c.grupo || 'Otras'; if (!grupos[g]) { grupos[g] = []; orden.push(g); } grupos[g].push(c.n);
      });
      var actual = q('#ec-cat').value;
      q('#ec-cat').innerHTML = '<option value="">Elige la categoría…</option>' + orden.map(function (g) {
        return '<optgroup label="' + esc(g) + '">' + grupos[g].map(function (n) { return '<option' + (n === actual ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</optgroup>';
      }).join('');
    };
    var pintaEq = function () {
      var c = q('#ec-comp').value, eqs = o.equipos.filter(function (e) { return e.indexOf(c + ' - ') === 0; });
      q('#ec-eq').innerHTML = ops(eqs.map(function (e) { return { v: e, t: e.slice(c.length + 3) }; }), '', 'Sin equipo');
      q('#ec-eq-l').hidden = !eqs.length;
    };
    var pintaIva = function () { if (!st.ivaTocado) q('#ec-iva').value = q('#ec-cash').checked || q('#ec-int').checked ? '0' : '0,21'; };
    var tipo = function (entra) {
      st.entra = entra;
      [].forEach.call(hoja.querySelectorAll('[data-ec-t]'), function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-ec-t') === '1') === entra); });
      q('#ec-emite').value = entra ? 'EXTERNO' : 'KONAMI';
      q('#ec-recibe').value = entra ? 'KONAMI' : 'EXTERNO';
      pintaComp(); pintaCat(); pintaEq();
    };
    hoja.querySelector('.ec-sw').onclick = function (e) { var b = e.target.closest('[data-ec-t]'); if (b) tipo(b.getAttribute('data-ec-t') === '1'); };
    q('#ec-comp').onchange = pintaEq;
    q('#ec-iva').onchange = function () { st.ivaTocado = true; };
    q('#ec-cash').onchange = pintaIva;
    q('#ec-int').onchange = function () { q('#ec-cat-l').hidden = this.checked; pintaIva(); };
    tipo(false); pintaIva();
    setTimeout(function () { q('#ec-imp').focus(); }, 50);
    q('#ec-form').onsubmit = function (ev) {
      ev.preventDefault();
      var err = q('#ec-ferr'), ok = q('#ec-ok');
      var tx = String(q('#ec-imp').value).replace(/[^\d.,]/g, '');
      var imp = Number(tx.indexOf(',') >= 0 ? tx.replace(/\./g, '').replace(',', '.') : tx); // «1.415,70», «120,5» o «120.50»
      var mov = {
        entra: st.entra, importe: imp, descripcion: q('#ec-desc').value.trim(), fecha: q('#ec-fecha').value,
        competicion: q('#ec-comp').value, categoria: q('#ec-cat').value, emite: q('#ec-emite').value, recibe: q('#ec-recibe').value,
        equipo: q('#ec-eq').value, efectivo: q('#ec-cash').checked, iva: q('#ec-iva').value, interno: q('#ec-int').checked
      };
      var falta = !imp ? ['el importe', '#ec-imp'] : !mov.descripcion ? ['una descripción', '#ec-desc'] : !mov.fecha ? ['la fecha', '#ec-fecha'] :
        !mov.interno && !mov.categoria ? ['la categoría', '#ec-cat'] : mov.emite === mov.recibe ? ['quién paga y quién cobra distintos', '#ec-recibe'] : null;
      if (falta) { err.textContent = 'Falta ' + falta[0] + '.'; err.hidden = false; q(falta[1]).focus(); return; }
      err.hidden = true; ok.disabled = true; ok.textContent = 'Apuntando…';
      llamar('economiaApuntar', [mov]).then(function (r) {
        cerrar();
        S.datos = {}; // todo lo cargado puede haber cambiado
        aviso('Apuntado con el ID ' + r.id + (r.estado && !/✅/.test(r.estado) ? ' · ' + r.estado : ' ✅'));
        pintar();
        dato('pendientes', 'economiaPendientes').then(contadorPendientes, function () {});
      }, function (e) {
        ok.disabled = false; ok.textContent = 'Apuntar';
        err.textContent = e.message; err.hidden = false;
      });
    };
  }

  M.ECONOMIA = { abrir: abrir };
})();
