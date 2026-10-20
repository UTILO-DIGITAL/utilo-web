/*
 * Sección Economía de la app (T0133 · Konamigas). La carga kanban/app.js cuando el perfil tiene ECONOMIA.
 * Lee ECONOMIA v2 a través de la API del DAILY (funciones economia* del script fino, KANBAN_CORE v27)
 * y permite apuntar un movimiento. Contrato con app.js:
 *   window.SX_CTX = { api, persona, pin, clave, color, accion }
 *   window.SX_MOD.ECONOMIA.abrir(elemento)  → pinta la sección dentro del elemento.
 * Lo ya cargado se guarda en memoria: volver a la sección es instantáneo; ↻ vuelve a pedirlo.
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
      '.ec-lineas{padding:0 0 10px 14px}.ec-linea{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;padding:5px 0;border-top:1px dashed var(--ec-l)}' +
      '.ec-linea span:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}' +
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

  /** Pide un dato (con memoria): clave → promesa. */
  function dato(clave, fn, args, forzar) {
    if (!forzar && S.datos[clave]) return Promise.resolve(S.datos[clave]);
    return llamar(fn, args).then(function (r) { S.datos[clave] = r; return r; });
  }

  /* ---------- armazón ---------- */
  var TABS = [['resumen', 'Resumen'], ['caja', 'Caja'], ['ligas', 'Ligas'], ['pendientes', 'Pendientes']];

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
    var p = ({ resumen: pResumen, caja: pCaja, ligas: pLigas, pendientes: pPendientes })[tab];
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
      var esperado = (r.resultado || []).filter(function (x) { return /^Resultado esperado/.test(x.n); })[0];
      var h = '<div class="ec-fila"><select class="ec-sel" id="ec-temp" aria-label="Temporada">' + opT + '</select>' +
        '<select class="ec-sel" id="ec-comp" aria-label="Competición">' + opC + '</select></div>';
      if (r.avance != null) h += '<div class="ec-av"><div class="ec-av-t"><span>Avance de la temporada · ' + esc(r.avanceTxt) + '</span><span>' + esc(r.partidosTxt) + '</span></div>' + barra(r.avance) + '</div>';
      h += '<div class="ec-kpis">' +
        '<div class="ec-kpi ec-grande"><b>Resultado</b><span class="ec-val">' + esc(K.resultado.t) + '</span>' +
        '<span class="ec-sub">Presupuesto ' + esc(K.presupuesto.t) + ' · <span class="' + signo(K.desviacion.n) + '">' + (K.desviacion.n > 0 ? '+' : '') + esc(K.desviacion.t) + '</span></span></div>' +
        '<div class="ec-kpi"><b>Ingresos</b><span class="ec-val ec-pos">' + esc(K.ingresos.t) + '</span>' + (r.totalIngresos ? '<span class="ec-sub">de ' + esc(r.totalIngresos.pres) + ' previstos</span>' : '') + '</div>' +
        '<div class="ec-kpi"><b>Gastos</b><span class="ec-val">' + esc(K.gastos.t) + '</span>' + (r.totalGastos ? '<span class="ec-sub">de ' + esc(r.totalGastos.pres) + ' previstos</span>' : '') + '</div></div>' +
        '<div class="ec-mini"><div><b>' + esc(K.equipos.t) + '</b><small>Equipos</small></div><div><b>' + esc(K.partidos.t) + '</b><small>Partidos</small></div>' +
        '<button type="button" id="ec-irpend"' + (K.pendientes.n ? ' class="ec-alerta"' : '') + '><b>' + esc(K.pendientes.t) + '</b><small>Por revisar ›</small></button></div>';
      if (esperado) h += '<div class="ec-card"><div class="ec-gl"><b>Resultado esperado a hoy</b><span class="ec-num">' + esc(esperado.pres) + '</span></div>' +
        '<div class="ec-gs"><span>Según el avance de la temporada</span><span class="' + signo(esperado.difN) + '">' + (esperado.difN > 0 ? '+' : '') + esc(esperado.dif) + ' frente a lo real</span></div></div>';
      ['INGRESOS', 'GASTOS'].forEach(function (sec) {
        var gs = (r.grupos || []).filter(function (g) { return g.seccion === sec; });
        if (!gs.length) return;
        h += '<h2 class="ec-h2">' + (sec === 'INGRESOS' ? 'Ingresos' : 'Gastos') + ' · real frente a presupuesto</h2><div class="ec-card">';
        gs.forEach(function (g, i) {
          var id = sec + '_' + i, ab = !!abiertos[id], lin = (g.lineas || []).filter(function (l) { return !vacio(l.real) || !vacio(l.pres); });
          var pct = g.presN ? (g.realN || 0) / g.presN : (g.realN ? 1 : 0);
          var mal = sec === 'GASTOS' ? (pct > 1.0001 || (!g.presN && g.realN > 0)) : false;
          h += '<div class="ec-grupo"><button type="button" class="ec-gb" data-ec-g="' + id + '" aria-expanded="' + ab + '"' + (lin.length ? '' : ' disabled') + '>' +
            '<div class="ec-gl"><b>' + (lin.length ? '<span class="ec-flecha" aria-hidden="true">›</span>' : '') + esc(g.n) + '</b><span class="ec-num">' + esc(vacio(g.real) ? '0 €' : g.real) + '</span></div>' +
            barra(pct, mal) +
            '<div class="ec-gs"><span>Presupuesto ' + esc(vacio(g.pres) ? '—' : g.pres) + (g.pct ? ' · ' + esc(g.pct) : '') + '</span>' +
            '<span class="' + signo(g.difN) + '">' + (vacio(g.dif) ? '' : (g.difN > 0 ? '+' : '') + esc(g.dif)) + '</span></div></button>' +
            (lin.length ? '<div class="ec-lineas"' + (ab ? '' : ' hidden') + ' id="ec-l-' + id + '">' + lin.map(function (l) {
              return '<div class="ec-linea"><span>' + esc(l.n) + '</span><span>' + esc(vacio(l.real) ? '0 €' : l.real) + ' <span style="color:var(--ec-g)">/ ' + esc(vacio(l.pres) ? '—' : l.pres) + '</span></span></div>';
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
      [].forEach.call(main.querySelectorAll('[data-ec-g]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-ec-g'), l = $('#ec-l-' + id); if (!l) return;
          abiertos[id] = !abiertos[id]; l.hidden = !abiertos[id]; b.setAttribute('aria-expanded', abiertos[id]);
        };
      });
    });
  }

  /* ---------- CAJA ---------- */
  function pCaja(main, forzar) {
    var p = S.cajaPersona;
    if (!p) {
      return cuando(main, 'caja_KONAMI', 'economiaCaja', ['KONAMI'], forzar, 'Mirando quién tiene el dinero…', function (r) {
        var h = '<p class="ec-s" style="margin:0 2px;color:var(--ec-g);font-size:13px">Lo que cada persona ha recibido para Konami menos lo que ha pagado o entregado. Toca una persona para ver sus movimientos.</p>';
        if (r.estado) h += '<p style="margin:10px 2px 0;font-size:13.5px">' + esc(r.estado) + '</p>';
        h += '<div class="ec-card"><div class="ec-lista">' + r.personas.map(function (x) {
          return '<button type="button" class="ec-item" data-ec-p="' + esc(x.n) + '"><div><div class="ec-t">' + esc(x.n) + '</div>' +
            '<div class="ec-s">Recibido ' + esc(x.recibido) + ' · pagado ' + esc(x.pagado) + '</div></div>' +
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
        return '<li class="ec-item"><div><div class="ec-t">' + esc(m.concepto || m.categoria) + '</div>' +
          '<div class="ec-s">' + esc(m.fecha) + ' · ' + esc(m.deA) + (m.comp ? ' · ' + esc(m.comp) : '') + '</div></div>' +
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
