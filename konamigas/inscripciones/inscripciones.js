/*
 * web/konamigas/inscripciones/inscripciones.js · T0335 · La página pública de inscripciones de Konamigas
 *
 * Sin entrar con Google: habla con las funciones públicas del motor (clientes/konamigas/modulos/inscripciones), que trabajan
 * con la llave del robot. Cuatro pantallas, con su dirección para poder volver atrás y compartirlas:
 * - portada (sin nada): para la capitana, que entra a inscribir a su equipo (Javi; las jugadoras llegan con el enlace que
 *   ella les pasa): cada competición abierta en su tarjeta (precio, lo que incluye, días y sedes con sus plazas) con su
 *   botón; el banco; las dudas frecuentes y el contacto; abajo, pequeño, el enlace para la jugadora;
 * - ?f=equipo (&c=COM…): la capitana inscribe al equipo; al acabar, el enlace para sus jugadoras;
 * - ?f=jugadora (&c=COM…&e=IE…: el enlace de la capitana, que ya trae el equipo; &i=IE…: «Me interesa» del banco): cada
 *   jugadora en su equipo, o «busco equipo» (el formulario corto);
 * - ?f=banco: equipos que buscan jugadoras y jugadoras que buscan equipo (sin nada que las identifique).
 * Idiomas (Javi): castellano, catalán e inglés; los textos, en textos.js (window.INS_TEXTOS). El elegido se guarda en el
 * dispositivo (o ?lang=ca). Lo que se escribe se guarda en el dispositivo como borrador hasta que se envía.
 * En el ordenador, el formulario va con un resumen fijo al lado (cada línea lleva a su campo); en el móvil, una barra abajo
 * dice cuánto falta. El motor lo vuelve a comprobar todo: aquí solo se avisa antes.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var TT = window.INS_TEXTOS || {};
  var raiz = document.getElementById('ins');
  var datos = null, dorsales = {}, enviando = false;
  var EMAIL = /^[^@\s"'<>()[\],;:]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/; // la misma que el motor
  var EDAD_MIN = 15; // años cumplidos (Javi); el motor lo vuelve a mirar

  /* ---------- idioma ---------- */

  function guardado(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  var LANG = (function () {
    var q = (/[?&]lang=(es|ca|en)\b/.exec(location.search) || [])[1];
    if (q) { guardado('ins_lang', q); return q; }
    var g = guardado('ins_lang');
    if (g && TT[g]) return g;
    var n = String(navigator.language || '').slice(0, 2);
    return TT[n] ? n : 'es';
  })();
  /** El texto de una clave ('jugadora.boton') en el idioma elegido; si falta, en castellano. vars: { N: 3 } rellena {N}. */
  function t(clave, vars) {
    var de = function (o) { return clave.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); };
    var v = de(TT[LANG]);
    if (v == null) v = de(TT.es);
    if (v == null) v = clave;
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
    return v;
  }
  function dia(d) { var x = t('dias.' + d); return x === 'dias.' + d ? d : x; }
  /** «Lunes · SCS» en el idioma: el día traducido, la sede tal cual. */
  function opcionTxt(o) { var x = String(o).split(' · '); return dia(x[0]) + (x[1] ? ' · ' + x[1] : ''); }

  /* ---------- utilidades ---------- */

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function llamar(fn, args) {
    return fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args || [] }) })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (!r.ok) throw new Error(r.error || 'No se ha podido.'); return r.r; });
  }
  /** El mensaje del motor, sin su etiqueta («VALIDAR: falta…» → «Falta…»). Los del motor van en castellano. */
  function mensaje(e) {
    var m = String((e && e.message) || e || '').replace(/^(VALIDAR|PUBLICO|ACCESO):\s*/, '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('general.sinConexion');
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  function parametros() {
    var p = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (x) { var kv = x.split('='); if (kv[0]) p[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    return p;
  }
  function ir(q) {
    history.pushState(null, '', q ? '?' + q : location.pathname);
    pintar();
    window.scrollTo(0, 0);
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function comp(id) { return (datos.competiciones || []).filter(function (c) { return c.id === id; })[0] || null; }
  function euros(n) { return n == null || !isFinite(n) ? '' : Number(n).toLocaleString(LANG === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
  function precio(p) { return p ? euros(p.importe) + (p.iva && p.iva !== '0%' ? ' ' + t('general.iva') : '') + ' ' + t('general.porEquipo') : ''; }
  /** ¿Es de un día o un fin de semana (Kopa, torneo)? Entonces no tiene «días de la semana» ni horarios rotativos (revisión, 22). */
  function corta(c) {
    if (!c || !c.inicio || !c.fin || c.tipo === 'Liga') return false;
    return (new Date(c.fin) - new Date(c.inicio)) / 86400000 <= 7;
  }
  function fechasCorta(c) { return c.inicio === c.fin ? fechaLarga(c.inicio) : t('detalle.del', { A: fechaLarga(c.inicio), B: fechaLarga(c.fin) }); }
  /** Una lista de días como se escribe: «Lunes, martes y jueves». */
  function listaTxt(xs) {
    xs = xs.map(function (x, i) { return i ? x.charAt(0).toLowerCase() + x.slice(1) : x; });
    return xs.length > 1 ? xs.slice(0, -1).join(', ') + ' ' + t('general.y') + ' ' + xs[xs.length - 1] : xs.join('');
  }
  /** Un teléfono para leerlo: «+34 611 000 041» (revisión, 41). */
  function telTxt(x) {
    var d = String(x || '').replace(/\D/g, '').replace(/^00/, '');
    if (d.length === 9) d = '34' + d;
    return d.slice(0, 2) === '34' && d.length === 11 ? '+34 ' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8) : '+' + d;
  }
  function horario(c) {
    if (c && corta(c)) return '';
    var h = c && c.horas, rango = h ? (h.desde === h.hasta ? t('horasA', { A: h.desde }) : t('horasEntre', { A: h.desde, B: h.hasta })) : '';
    return t('horarios', { HORAS: rango });
  }
  function fechaLarga(f) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || '');
    if (!m) return '';
    var mes = t('meses')[Number(m[2]) - 1];
    if (LANG === 'en') return Number(m[3]) + ' ' + mes + ' ' + m[1];
    return Number(m[3]) + (LANG === 'ca' && /^[aeiou]/.test(mes) ? " d'" : ' de ') + mes + ' de ' + m[1];
  }
  function ficha(tipo, nombre, valor, texto, marcada, extra) {
    return '<label class="ins-ficha"><input type="' + tipo + '" name="' + nombre + '" value="' + esc(valor) + '"' + (marcada ? ' checked' : '') + (extra || '') + '><span>' + texto + '</span></label>';
  }
  function campo(id, etiqueta, control, ayuda, opcional) {
    return '<div class="ins-campo" data-campo="' + id + '"><label for="' + id + '">' + esc(etiqueta) + (opcional ? ' <span class="opc">(' + esc(t('general.opcional')) + ')</span>' : '') + '</label>' +
      (ayuda ? '<p class="ins-ayuda">' + esc(ayuda) + '</p>' : '') + control + '</div>';
  }
  function grupo(id, etiqueta, control, ayuda) {
    return '<fieldset class="ins-campo" data-campo="' + id + '"><legend>' + esc(etiqueta) + '</legend>' + (ayuda ? '<p class="ins-ayuda">' + esc(ayuda) + '</p>' : '') + control + '</fieldset>';
  }
  function texto(id, tipo, extra) { return '<input id="' + id + '" name="' + id + '" type="' + (tipo || 'text') + '"' + (extra || '') + '>'; }
  function valor(f, n) { var x = f.elements[n]; return x && x.value !== undefined ? String(x.value || '').trim() : ''; }
  function marcadas(f, n) { return Array.prototype.slice.call(f.querySelectorAll('input[name="' + n + '"]:checked')).map(function (x) { return x.value; }); }
  function boton(href, txt, clase, extra) { return '<a class="ins-boton ' + (clase || '') + '" href="' + esc(href) + '"' + (extra || '') + '>' + esc(txt) + '</a>'; }
  /** Enlace de WhatsApp a un número (los de 9 cifras, guardados antes sin prefijo, son de España: el 34 delante). */
  function wa(numero, msg) {
    var n = String(numero || '').replace(/\D/g, '').replace(/^00/, '');
    if (n.length === 9) n = '34' + n;
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  }
  function volver() { return '<button type="button" class="ins-volver" data-ir=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' + esc(t('general.volver')) + '</button>'; }

  /** Años cumplidos hoy de una fecha 'aaaa-mm-dd' (o NaN). */
  function edad(nac) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nac || ''), h = new Date();
    if (!m) return NaN;
    var e = h.getFullYear() - Number(m[1]);
    return (h.getMonth() + 1) * 100 + h.getDate() < Number(m[2]) * 100 + Number(m[3]) ? e - 1 : e;
  }

  /* ---------- teléfono, documento y fecha ---------- */

  var PREFIJOS = [['34', 'España +34'], ['33', 'France +33'], ['351', 'Portugal +351'], ['39', 'Italia +39'], ['49', 'Deutschland +49'], ['44', 'UK +44'],
    ['31', 'Nederland +31'], ['32', 'Belgique +32'], ['353', 'Ireland +353'], ['41', 'Schweiz +41'], ['1', 'USA / Canada +1'], ['52', 'México +52'], ['54', 'Argentina +54'],
    ['57', 'Colombia +57'], ['56', 'Chile +56'], ['58', 'Venezuela +58'], ['55', 'Brasil +55']];
  /** El teléfono como lo guarda el motor («+34612345678»), o '' si no vale: la misma regla que insTelefono_. */
  function telefono(p, n) {
    n = String(n || '').trim(); p = String(p || '34');
    if (/^(\+|00)/.test(n.replace(/[\s().-]/g, ''))) {
      var x = n.replace(/\D/g, '').replace(/^00/, '');
      if (x.slice(0, 2) === '34') { p = '34'; n = x.slice(2); } else return /^\d{8,15}$/.test(x) ? '+' + x : '';
    }
    n = n.replace(/\D/g, '');
    if (p === '34') return /^[6789]\d{8}$/.test(n) ? '+34' + n : '';
    return /^\d{6,12}$/.test(n) ? '+' + p + n : '';
  }
  function campoTelefono(id, etiqueta) {
    return '<div class="ins-campo" data-campo="' + id + '"><label for="' + id + '">' + esc(etiqueta) + '</label><div class="ins-tel">' +
      '<select name="PREFIJO_' + id + '" aria-label="+">' + PREFIJOS.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select>' +
      texto(id, 'tel', ' autocomplete="tel-national" inputmode="tel" placeholder="612 345 678"') + '</div><p class="ins-nota-mal" id="nota-' + id + '" hidden></p></div>';
  }
  function revisarTelefono(f, id, alSalir) {
    // Si escribe el número con su prefijo (+33 …, 0034 …), el desplegable se pone en ese país (revisión, 17).
    var crudo = valor(f, id).replace(/[\s().-]/g, ''), sel = f.elements['PREFIJO_' + id];
    if (sel && /^(\+|00)\d/.test(crudo)) {
      var dig = crudo.replace(/^\+|^00/, ''), pre = PREFIJOS.map(function (x) { return x[0]; }).filter(function (x) { return dig.indexOf(x) === 0; }).sort(function (a, b) { return b.length - a.length; })[0];
      if (pre && sel.value !== pre) sel.value = pre;
    }
    var tl = telefono(valor(f, 'PREFIJO_' + id), valor(f, id)), escrito = valor(f, id), n = document.getElementById('nota-' + id);
    // Con borde rojo y su texto (revisión, 33), pero no mientras aún se está escribiendo (menos de 9 cifras).
    var malo = !!escrito && !tl && (alSalir || escrito.replace(/\D/g, '').length >= 9), c = f.querySelector('[data-campo="' + id + '"]');
    if (c) c.classList.toggle('mal', malo);
    if (n) { n.textContent = malo ? t(valor(f, 'PREFIJO_' + id) === '34' ? 'jugadora.errores.telEs' : 'jugadora.errores.telOtro') : ''; n.hidden = !malo; }
    return tl;
  }
  /** En qué idioma quiere que le escribamos (Javi): marcado el de la página. */
  function campoIdioma() {
    return grupo('IDIOMA', t('general.idiomaPregunta'), '<div class="ins-opciones">' + Object.keys(TT.idiomas).map(function (k) { return ficha('radio', 'IDIOMA', k, esc(TT.idiomas[k]), k === LANG); }).join('') + '</div>');
  }
  /** El documento: '' si vale o el problema (la misma regla que insDocMal_: la letra del DNI y del NIE). */
  function docMal(doc) {
    doc = String(doc || '').toUpperCase().replace(/[\s.-]/g, '');
    var L = 'TRWAGMYFPDXBNJZSQVHLCKE', m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(doc);
    if (!doc) return '';
    if (/^\d{8}$/.test(doc)) return t('jugadora.errores.docSinLetra');
    if (m && ((!m[1] && m[2].length === 8) || (m[1] && m[2].length === 7))) {
      var n = Number((m[1] ? String('XYZ'.indexOf(m[1])) : '') + m[2]);
      return L.charAt(n % 23) === m[3] ? '' : t('jugadora.errores.docLetra', { T: m[1] ? 'NIE' : 'DNI' });
    }
    return /^[A-Z0-9]{5,15}$/.test(doc) ? '' : t('jugadora.errores.doc');
  }
  /** La fecha de nacimiento en tres desplegables (día, mes, año): en el móvil es mucho más rápido que el calendario. */
  function campoFecha(id, etiqueta) {
    var y = new Date().getFullYear(), anos = [], dias = [];
    for (var a = y - EDAD_MIN; a >= y - 75; a--) anos.push(a);
    for (var d = 1; d <= 31; d++) dias.push(d);
    var sel = function (n, et, ops) { return '<select name="' + n + '" aria-label="' + esc(et) + '"><option value="">' + esc(et) + '</option>' + ops.join('') + '</select>'; };
    return '<div class="ins-campo" data-campo="' + id + '"><label>' + esc(etiqueta) + '</label><div class="ins-fecha">' +
      sel(id + '_D', t('general.dia'), dias.map(function (x) { return '<option value="' + String(x).padStart(2, '0') + '">' + x + '</option>'; })) +
      sel(id + '_M', t('general.mes'), t('meses').map(function (x, i) { return '<option value="' + String(i + 1).padStart(2, '0') + '">' + esc(x) + '</option>'; })) +
      sel(id + '_A', t('general.ano'), anos.map(function (x) { return '<option>' + x + '</option>'; })) +
      '</div><p class="ins-nota-mal" id="nota-' + id + '" hidden></p></div>';
  }
  function fechaDe(f, id) {
    var d = valor(f, id + '_D'), m = valor(f, id + '_M'), a = valor(f, id + '_A');
    if (!d || !m || !a) return '';
    var x = new Date(Number(a), Number(m) - 1, Number(d));
    return x.getDate() === Number(d) ? a + '-' + m + '-' + d : 'mal';
  }

  /* ---------- borrador (en el dispositivo) ---------- */

  /**
   * Lo escrito se guarda en el dispositivo mientras se rellena (Javi: que no se pierda si se cierra la página). Revisión (1 y 6):
   * lo que dice la dirección (la competición, el equipo del enlace) manda sobre el borrador (fijos: nombres que no se ponen);
   * el borrador es de esa dirección (clave); no se guarda hasta que hay algo escrito, y al enviar se para y se borra.
   */
  function borrador(f, clave, fijos) {
    var K = 'ins_borrador_' + clave, puesto = {}, espera = null, leido = null, parado = false;
    (fijos || []).forEach(function (n) { puesto[n] = true; });
    try { leido = JSON.parse(guardado(K) || 'null'); } catch (e) { leido = null; }
    function algoEscrito(o) { return Object.keys(o).some(function (n) { var x = f.querySelector('[name="' + n + '"]'); return x && (/^(text|tel|email|number)$/.test(x.type) || x.tagName === 'TEXTAREA'); }); }
    function apuntar() { if (parado) return; var o = foto(); if (algoEscrito(o)) guardado(K, JSON.stringify(o)); }
    function foto() {
      var o = {};
      Array.prototype.forEach.call(f.elements, function (x) {
        if (!x.name || x.name === 'web' || x.type === 'search') return;
        if (x.type === 'radio' || x.type === 'checkbox') { if (x.checked) (o[x.name] = o[x.name] || []).push(x.value); }
        else if (x.value) o[x.name] = x.value;
      });
      return o;
    }
    f.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(apuntar, 400); });
    f.addEventListener('change', apuntar);
    return {
      hay: !!(leido && Object.keys(leido).some(function (n) { return n !== 'ID_COMPETICION' && n !== 'TIENE' && n !== 'IDIOMA' && !/^PREFIJO_/.test(n); })),
      /** Pone lo guardado en los campos que hay ahora (se vuelve a llamar al pintar las partes que dependen de otras). */
      poner: function () {
        if (!leido) return;
        Object.keys(leido).forEach(function (n) {
          if (puesto[n]) return;
          var xs = f.querySelectorAll('[name="' + n + '"]');
          if (!xs.length) return;
          puesto[n] = true;
          Array.prototype.forEach.call(xs, function (x) {
            if (x.type === 'radio' || x.type === 'checkbox') x.checked = [].concat(leido[n]).indexOf(x.value) >= 0;
            else x.value = leido[n];
          });
        });
      },
      borrar: function () { clearTimeout(espera); parado = true; guardado(K, null); leido = null; },
      /** Mientras se envía no se guarda; si falla, se vuelve a guardar. */
      parar: function (si) { clearTimeout(espera); parado = si; if (!si) apuntar(); }
    };
  }
  function avisoBorrador(b) {
    return b.hay ? '<div class="ins-borrador"><span>' + esc(t('general.borrador')) + '</span><button type="button" id="ins-de-cero">' + esc(t('general.deCero')) + '</button></div>' : '';
  }

  /* ---------- marco: idioma, formulario con resumen al lado y barra en el móvil ---------- */

  function cabecera() {
    var sel = document.getElementById('ins-idioma');
    if (!sel) return;
    sel.innerHTML = Object.keys(TT.idiomas || {}).filter(function (k) { return TT[k]; }).map(function (k) {
      return '<button type="button" data-lang="' + k + '" aria-pressed="' + (k === LANG) + '" title="' + esc(TT.idiomas[k]) + '">' + k.toUpperCase() + '</button>';
    }).join('');
    document.documentElement.lang = LANG;
    var q = document.querySelector('.ins-cab-que');
    if (q) q.textContent = t('general.cabecera');
  }
  function conResumen(titulo, para, form) {
    return volver() + '<div class="ins-dos-col"><div class="ins-col-form"><h1>' + esc(titulo) + '</h1>' + para + form + '</div>' +
      '<aside class="ins-resumen" aria-label="' + esc(t('general.resumen')) + '"><h3>' + esc(t('general.resumen')) + '</h3><ol id="ins-pasos"></ol></aside></div>' +
      '<div class="ins-barra" id="ins-barra" hidden></div>';
  }
  /**
   * El resumen: [[etiqueta, valor o '', obligatorio (false: opcional), campo]]. En el ordenador, cada línea lleva a su campo;
   * en el móvil, la barra de abajo dice cuántos faltan y lleva al primero (Javi).
   */
  function resumen(filas) {
    var ol = document.getElementById('ins-pasos'), barra = document.getElementById('ins-barra');
    if (ol) ol.innerHTML = filas.map(function (x) {
      var hecho = !!x[1], dentro = '<span>' + esc(x[0]) + '</span><b>' + (hecho ? esc(x[1]) : x[2] === false ? '—' : esc(t('general.falta'))) + '</b>';
      return '<li class="' + (hecho ? 'hecho' : x[2] === false ? 'opcional' : '') + '">' + (x[3] ? '<button type="button" data-a-campo="' + esc(x[3]) + '">' + dentro + '</button>' : dentro) + '</li>';
    }).join('');
    if (barra) {
      var faltan = filas.filter(function (x) { return !x[1] && x[2] !== false; });
      barra.hidden = false;
      barra.className = 'ins-barra' + (faltan.length ? '' : ' listo');
      barra.innerHTML = faltan.length ? '<span>' + esc(faltan.length === 1 ? t('general.faltaUno') : t('general.faltan', { N: faltan.length })) + ': ' + esc(faltan[0][0]) + '</span>' +
        '<button type="button" data-a-campo="' + esc(faltan[0][3] || '') + '">' + esc(t('general.ver')) + ' ›</button>'
        : '<span>' + esc(t('general.listo')) + '</span><button type="button" data-a-campo="ins-enviar">' + esc(t('general.ver')) + ' ›</button>';
    }
  }
  function irACampo(id) {
    var c = document.querySelector('[data-campo="' + id + '"]') || document.getElementById(id);
    if (!c) return;
    c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var i = c.matches && c.matches('button') ? c : c.querySelector('input:not([type=hidden]):not(:disabled),select,textarea');
    if (i) setTimeout(function () { i.focus({ preventScroll: true }); }, 350);
  }

  /* ---------- pantallas ---------- */

  function pintar() {
    if (!datos) return;
    cabecera();
    var p = parametros();
    if (p.f === 'equipo') return pintarEquipo(p);
    if (p.f === 'jugadora') return pintarJugadora(p);
    if (p.f === 'banco') return pintarBanco(p);
    if (p.f === 'privacidad') return pintarPrivacidad();
    pintarPortada();
  }

  function ESTADO(e) { return t('plazas.' + e); }
  /** Lo que incluye una competición, en el idioma (del motor llega qué es: partidos, copa, otra o equipación). */
  function incluye(c) {
    return (c.incluye || []).map(function (x) { return typeof x === 'string' ? x : t('incluye.' + x.que, { N: x.n, X: x.nombre }); });
  }

  /** Una competición, en su tarjeta: nombre, precio, lo que incluye, días y sedes (con sus plazas) y su botón. */
  function tarjetaCompeticion(c) {
    var dias = {}, sedes = {}, orden = { completo: 0, ultimas: 1, libre: 2 };
    (c.opciones || []).forEach(function (o) {
      var x = o.split(' · '), pl = (c.plazas || {})[o];
      if (!(x[0] in dias)) dias[x[0]] = '';
      if (pl && (!dias[x[0]] || orden[pl.estado] > orden[dias[x[0]]])) dias[x[0]] = pl.estado;
      if (x[1]) sedes[x[1]] = 1;
    });
    var nota = { ultimas: t('plazas.ultimasCorto'), completo: t('plazas.completoCorto') };
    var q = 'f=equipo&c=' + encodeURIComponent(c.id);
    var diasHtml = Object.keys(dias).map(function (d, i) { var x = dia(d); x = i ? x.charAt(0).toLowerCase() + x.slice(1) : x; return esc(x) + (nota[dias[d]] ? '<span class="ins-est es-' + dias[d] + '">' + esc(nota[dias[d]]) + '</span>' : ''); });
    diasHtml = diasHtml.length > 1 ? diasHtml.slice(0, -1).join(', ') + ' ' + esc(t('general.y')) + ' ' + diasHtml[diasHtml.length - 1] : diasHtml.join('');
    return '<article class="ins-comp"><h3>' + esc(c.nombre) + '</h3>' +
      '<p class="ins-precio">' + (c.precio ? esc(euros(c.precio.importe)) + '<small>' + esc((c.precio.iva && c.precio.iva !== '0%' ? t('general.iva') + ' ' : '') + t('general.porEquipo')) + '</small>' : '<small>' + esc(t('general.precioConfirmar')) + '</small>') + '</p>' +
      '<ul>' + incluye(c).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<p class="ins-comp-d">' + (corta(c) ? '<b>' + esc(fechasCorta(c)) + '</b>' : '<b>' + diasHtml + '</b>') +
        (Object.keys(sedes).length ? '<br>' + esc(Object.keys(sedes).join(', ')) : '') +
        (!corta(c) && c.inicio ? '<br>' + esc(t('detalle.del', { A: fechaLarga(c.inicio), B: c.fin ? fechaLarga(c.fin) : '…' })) : '') + '</p>' +
      '<a class="ins-boton" href="?' + q + '" data-ir="' + esc(q) + '">' + esc(t('portada.boton')) + '</a></article>';
  }

  function pintarPortada() {
    var cs = datos.competiciones || [];
    var tem = cs.map(function (c) { return c.temporada; }).filter(Boolean)[0] || '';
    var faq = t('portada.preguntas') || [];
    // La cabecera, solo con la marca (Javi: sin dibujos): la temporada en lima, el título y el logo grande y suave detrás.
    raiz.innerHTML = '<header class="ins-portada">' + (tem ? '<p class="ins-temp">' + esc(t('general.temporada', { T: tem })) + '</p>' : '') +
      '<h1>' + esc(t('portada.titulo')) + '</h1><p class="ins-sup">' + esc(t('portada.sup')) + '</p><p>' + esc(t('portada.para')) + '</p>' +
      '<img class="ins-logo-fondo" src="../icono-512.png" alt="" aria-hidden="true"></header>' +
      (cs.length ? '<div class="ins-comps">' + cs.map(tarjetaCompeticion).join('') + '</div><p class="ins-ayuda">' + esc(horario(null)) + '</p>'
        : '<p class="ins-aviso">' + esc(t('general.sinCompeticiones')) + '</p>') +
      '<section class="ins-banco-portada"><div><h2>' + esc(t('portada.banco')) + '</h2><p>' + esc(t('portada.bancoPara')) + '</p></div>' +
        '<a class="ins-boton secundario" href="?f=banco" data-ir="f=banco">' + esc(t('portada.bancoBoton')) + '</a></section>' +
      '<section class="ins-faq"><h2>' + esc(t('portada.faq')) + '</h2>' + faq.map(function (x) { return '<details><summary>' + esc(x[0]) + '</summary><p>' + esc(x[1]) + '</p></details>'; }).join('') +
        (TT.WHATSAPP ? '<div class="ins-contacto"><a class="ins-boton secundario" href="' + esc(wa(TT.WHATSAPP, '')) + '" target="_blank" rel="noopener">' + esc(t('general.contacto')) + '</a></div>' : '') + '</section>' +
      '<p class="ins-ya">' + esc(t('portada.jugadora')) + ' <a href="?f=jugadora" data-ir="f=jugadora">' + esc(t('portada.jugadoraBoton')) + ' ›</a></p>';
  }

  /** La competición: fichas (marcada la única si solo hay una) y, debajo, el detalle de la elegida. */
  function elegirCompeticion(sel, ayuda, sinPrecio) {
    var cs = datos.competiciones || [];
    if (cs.length === 1) sel = cs[0].id;
    return grupo('ID_COMPETICION', t('equipo.competicion'), '<div class="ins-opciones lista ins-rejilla">' + cs.map(function (c) {
      return ficha('radio', 'ID_COMPETICION', c.id, esc(c.nombre) + '<small>' + esc([c.temporada ? t('general.temporada', { T: c.temporada }) : '', !sinPrecio && c.precio ? precio(c.precio) : ''].filter(Boolean).join(' · ')) + '</small>', c.id === sel);
    }).join('') + '</div><div id="ins-detalle">' + detalleCompeticion(comp(sel), sinPrecio) + '</div>', ayuda);
  }
  /** Lo que conviene saber de una competición (también a las jugadoras): precio, lo que incluye, fechas, días y horario. */
  function detalleCompeticion(c, sinPrecio) {
    if (!c) return '';
    var dias = {};
    (c.opciones || []).forEach(function (o) {
      var x = o.split(' · '), pl = (c.plazas || {})[o];
      (dias[x[0]] = dias[x[0]] || []).push((x[1] || '') + (pl && pl.estado !== 'libre' ? ' (' + ESTADO(pl.estado).toLowerCase() + ')' : ''));
    });
    var fila = function (k, v) { return v ? '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>' : ''; };
    var et = t('detalle');
    return '<dl class="ins-detalle">' +
      (sinPrecio ? '' : fila(et.precio, c.precio ? '<b>' + esc(precio(c.precio)) + '</b>' : esc(t('general.precioConfirmar')))) +
      fila(et.incluye, incluye(c).map(esc).join('<br>')) +
      fila(et.fechas, c.inicio ? esc(corta(c) ? fechasCorta(c) : t('detalle.del', { A: fechaLarga(c.inicio), B: c.fin ? fechaLarga(c.fin) : '…' })) : '') +
      (corta(c) ? '' : fila(et.dias, Object.keys(dias).map(function (d) { return esc(dia(d) + (dias[d].join('') ? ': ' + dias[d].filter(Boolean).join(', ') : '')); }).join('<br>'))) +
      fila(et.horario, esc(horario(c))) + '</dl>';
  }

  /* ----- la capitana ----- */

  function pintarEquipo(p) {
    raiz.innerHTML = conResumen(t('equipo.titulo'), '<p>' + esc(t('equipo.para')) + '</p><div id="ins-aviso-borrador"></div>',
      '<form id="ins-form" novalidate>' + elegirCompeticion(p.c || '', t('equipo.competicionAyuda')) +
      grupo('jugado', t('equipo.jugado'), '<div class="ins-opciones">' + ficha('radio', 'jugado', 'si', esc(t('equipo.jugadoSi'))) + ficha('radio', 'jugado', 'no', esc(t('equipo.jugadoNo'))) + '</div>') +
      '<div id="ins-anterior" hidden>' + grupo('ID_EQUIPO', t('equipo.anterior'), '<input type="search" id="buscar-anterior" placeholder="' + esc(t('general.buscar')) + '" autocomplete="off">' +
        '<div class="ins-equipos ins-opciones lista" id="lista-anterior"></div>', t('equipo.anteriorAyuda')) + '</div>' +
      campo('NOMBRE_EQUIPO', t('equipo.nombre'), texto('NOMBRE_EQUIPO', 'text', ' maxlength="40" autocomplete="off" autocapitalize="characters"') + '<div class="ins-cuenta" id="cuenta-nombre">0 / 20</div><p class="ins-nota-mal" id="nota-NOMBRE_EQUIPO" hidden></p>', t('equipo.nombreAyuda')) +
      '<div class="ins-fila">' + campo('CAPITANA', t('equipo.capitana'), texto('CAPITANA', 'text', ' autocomplete="name"')) +
        campo('EMAIL', t('equipo.email'), texto('EMAIL', 'email', ' autocomplete="email" inputmode="email" autocapitalize="none"') + '<p class="ins-nota-mal" id="nota-EMAIL" hidden></p>', t('equipo.emailAyuda')) + '</div>' +
      campoTelefono('TELEFONO', t('equipo.telefono')) + campoIdioma() +
      campo('NUM_JUGADORAS', t('equipo.cuantas'), texto('NUM_JUGADORAS', 'number', ' min="1" max="40" inputmode="numeric" class="ins-corto"'), t('equipo.cuantasAyuda'), true) +
      grupo('NIVEL', t('equipo.nivel'), '<div class="ins-opciones ins-nivel">' + ['1', '2', '3', '4', '5'].map(function (n) { return ficha('radio', 'NIVEL', n, n); }).join('') +
        '</div><div class="ins-extremos"><span>' + esc(t('equipo.nivelExtremos')[0]) + '</span><span>' + esc(t('equipo.nivelExtremos')[1]) + '</span></div>', t('equipo.nivelAyuda')) +
      '<div id="ins-dep"></div>' +
      grupo('BUSCA_JUGADORAS', t('equipo.busca'), '<div class="ins-opciones">' + ficha('radio', 'BUSCA_JUGADORAS', 'si', esc(t('general.si'))) + ficha('radio', 'BUSCA_JUGADORAS', 'no', esc(t('general.no')), true) + '</div>' +
        '<div id="ins-cuantas-busca" hidden>' + campo('CUANTAS_BUSCA', t('equipo.buscaCuantas'), texto('CUANTAS_BUSCA', 'number', ' min="1" max="15" inputmode="numeric" class="ins-corto"')) + '</div>', t('equipo.buscaAyuda')) +
      grupo('FACTURA', t('equipo.factura'), '<div class="ins-opciones">' + ficha('radio', 'FACTURA', 'si', esc(t('general.si'))) + ficha('radio', 'FACTURA', 'no', esc(t('general.no')), true) + '</div>' +
        '<div id="ins-factura" hidden><div class="ins-fila">' + campo('FACTURA_NOMBRE', t('equipo.facturaNombre'), texto('FACTURA_NOMBRE', 'text', ' autocomplete="organization"')) +
        campo('FACTURA_NIF', t('equipo.facturaNif'), texto('FACTURA_NIF', 'text', ' autocapitalize="characters"') + '<p class="ins-nota-mal" id="nota-FACTURA_NIF" hidden></p>') + '</div>' +
        '<div class="ins-fila">' + campo('FACTURA_DIRECCION', t('equipo.facturaDireccion'), texto('FACTURA_DIRECCION', 'text', ' autocomplete="street-address"')) +
        campo('FACTURA_EMAIL', t('equipo.facturaEmail'), texto('FACTURA_EMAIL', 'email', ' inputmode="email" autocapitalize="none"')) + '</div></div>', t('equipo.facturaAyuda')) +
      campo('COMENTARIOS', t('equipo.comentarios'), '<textarea id="COMENTARIOS" name="COMENTARIOS" maxlength="1000"></textarea>', t('equipo.comentariosAyuda'), true) +
      '<div class="ins-trampa" aria-hidden="true"><label>Web <input name="web" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="ins-error"></div><button class="ins-boton" type="submit" id="ins-enviar">' + esc(t('equipo.boton')) + '</button></form>');
    var f = document.getElementById('ins-form'), b = borrador(f, 'equipo' + (p.c ? '_' + p.c : ''), p.c ? ['ID_COMPETICION'] : []);
    document.getElementById('ins-aviso-borrador').innerHTML = avisoBorrador(b);
    function elegida() { return comp(marcadas(f, 'ID_COMPETICION')[0] || ''); }
    function dep() {
      var c = elegida(), d = document.getElementById('ins-dep');
      if (!c) { d.innerHTML = ''; return; }
      var antes = marcadas(f, 'DISPONIBILIDAD');
      var completos = Object.keys(c.plazas || {}).some(function (k) { return c.plazas[k].estado === 'completo'; });
      d.innerHTML = grupo('DISPONIBILIDAD', t('equipo.dias'), cuadroDias(c.opciones, antes, c.plazas) + (completos ? '<p class="ins-ayuda">' + esc(t('equipo.esperaAyuda')) + '</p>' : ''), t('equipo.diasAyuda')) +
        '<p class="ins-aviso">' + esc(horario(c)) + ' ' + esc(t('equipo.horasAyuda')) + '</p>';
      b.poner();
    }
    /** Los días en filas y las instalaciones en columnas, cada casilla con sus plazas (Javi: más visual que una lista). */
    function cuadroDias(opciones, antes, plazas) {
      plazas = plazas || {};
      var dias = [], sedes = [], hay = {};
      opciones.forEach(function (o) {
        var x = o.split(' · '), d = x[0], sede = x[1] || '';
        if (dias.indexOf(d) < 0) dias.push(d);
        if (sedes.indexOf(sede) < 0) sedes.push(sede);
        hay[d + '|' + sede] = o;
      });
      return '<table class="ins-dias"><thead><tr><th></th>' + sedes.map(function (x) { return '<th scope="col">' + esc(x || t('equipo.disponible')) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        dias.map(function (d) {
          return '<tr><th scope="row">' + esc(dia(d)) + '</th>' + sedes.map(function (sede) {
            var o = hay[d + '|' + sede], pl = o && plazas[o], est = pl ? ESTADO(pl.estado) : null;
            // Toda la celda se puede tocar (revisión, 27), con su estado debajo de la casilla.
            return '<td' + (pl ? ' class="es-' + pl.estado + '"' : '') + '>' + (o ? '<label class="ins-casilla"><input type="checkbox" name="DISPONIBILIDAD" value="' + esc(o) + '"' + (antes.indexOf(o) >= 0 ? ' checked' : '') +
              ' aria-label="' + esc(dia(d) + (sede ? ' · ' + sede : '') + (est ? ': ' + est : '')) + '"><span></span>' + (est ? '<small>' + esc(est) + '</small>' : '') + '</label>' : '<span class="ins-no" aria-hidden="true">—</span>') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }
    function anteriores() {
      var q = norm(document.getElementById('buscar-anterior').value), sel = marcadas(f, 'ID_EQUIPO')[0], c = elegida();
      var lista = (datos.anteriores || []).filter(function (e) { return !q || norm(e.nombre).indexOf(q) >= 0 || e.id === sel; }).slice(0, 80);
      document.getElementById('lista-anterior').innerHTML = lista.map(function (e) {
        var ya = c && (e.en || []).indexOf(c.id) >= 0;
        var det = ya ? t('equipo.yaInscrito') : [e.temporada, e.liga].filter(Boolean).join(' · ') || t('equipo.sinTemporadas');
        return ficha('radio', 'ID_EQUIPO', e.id, esc(e.nombre) + '<small>' + esc(det) + '</small>', e.id === sel && !ya, ya ? ' disabled' : '');
      }).join('') || '<p class="ins-ayuda">' + esc(t('equipo.noAnterior')) + '</p>';
    }
    function contar() {
      var n = f.elements.NOMBRE_EQUIPO.value.length, c = document.getElementById('cuenta-nombre');
      c.textContent = n + ' / 20'; c.className = 'ins-cuenta' + (n > 20 ? ' pasa' : '');
    }
    function visibles() {
      document.getElementById('ins-anterior').hidden = marcadas(f, 'jugado')[0] !== 'si';
      document.getElementById('ins-cuantas-busca').hidden = marcadas(f, 'BUSCA_JUGADORAS')[0] !== 'si';
      document.getElementById('ins-factura').hidden = marcadas(f, 'FACTURA')[0] !== 'si';
    }
    /** El email, al salir del campo (revisión, 33: no mientras se escribe); al escribir solo se quita el aviso si ya vale. */
    function revisarEmail(alSalir) {
      var e = valor(f, 'EMAIL'), n = document.getElementById('nota-EMAIL'), malo = !!e && !EMAIL.test(e);
      if (!alSalir && malo) return false;
      f.querySelector('[data-campo="EMAIL"]').classList.toggle('mal', malo);
      n.textContent = malo ? t('jugadora.errores.email') : ''; n.hidden = !malo;
      return !malo && !!e;
    }
    /** El nombre: 20 caracteres como mucho y que no lo tenga ya otro equipo de la competición (revisión, 12 y 15), con su texto. */
    function revisarNombre() {
      var nm = valor(f, 'NOMBRE_EQUIPO'), c = elegida(), n = document.getElementById('nota-NOMBRE_EQUIPO'), m = '';
      if (nm.length > 20) m = t('equipo.errores.largo', { N: nm.length });
      else if (nm && c && (c.equipos || []).some(function (e) { return norm(e.nombre) === norm(nm); })) m = t('equipo.errores.yaInscrito', { E: nm });
      f.querySelector('[data-campo="NOMBRE_EQUIPO"]').classList.toggle('mal', !!m);
      n.textContent = m; n.hidden = !m;
      return !m && !!nm;
    }
    function revisarNif(alSalir) {
      var v0 = valor(f, 'FACTURA_NIF'), malo = !!v0 && !/^[A-Z0-9]{8,12}$/.test(v0.toUpperCase().replace(/[\s.-]/g, ''));
      var c = f.querySelector('[data-campo="FACTURA_NIF"]'), n = document.getElementById('nota-FACTURA_NIF');
      if (!alSalir && malo) return false;
      c.classList.toggle('mal', malo); n.textContent = malo ? t('equipo.errores.nif') : ''; n.hidden = !malo;
      return !malo && !!v0;
    }
    function alDia() {
      var c = elegida(), jug = marcadas(f, 'jugado')[0], ant = (datos.anteriores || []).filter(function (x) { return x.id === marcadas(f, 'ID_EQUIPO')[0]; })[0], R = 'equipo.resumen.';
      resumen([[t(R + 'competicion'), c ? c.nombre : '', true, 'ID_COMPETICION'], [t(R + 'otros'), jug === 'no' ? t(R + 'nuevas') : ant ? ant.nombre : '', true, jug === 'si' ? 'ID_EQUIPO' : 'jugado'],
        [t(R + 'nombre'), valor(f, 'NOMBRE_EQUIPO').length <= 20 && !f.querySelector('[data-campo="NOMBRE_EQUIPO"]').classList.contains('mal') ? valor(f, 'NOMBRE_EQUIPO') : '', true, 'NOMBRE_EQUIPO'], [t(R + 'capitana'), valor(f, 'CAPITANA').split(/\s+/).length > 1 ? valor(f, 'CAPITANA') : '', true, 'CAPITANA'],
        [t(R + 'email'), EMAIL.test(valor(f, 'EMAIL')) ? valor(f, 'EMAIL') : '', true, 'EMAIL'],
        [t(R + 'telefono'), telefono(valor(f, 'PREFIJO_TELEFONO'), valor(f, 'TELEFONO')), true, 'TELEFONO'], [t(R + 'nivel'), marcadas(f, 'NIVEL')[0] || '', true, 'NIVEL'],
        [t(R + 'dias'), marcadas(f, 'DISPONIBILIDAD').map(opcionTxt).join(', '), true, 'DISPONIBILIDAD']]
        .concat(marcadas(f, 'BUSCA_JUGADORAS')[0] === 'si' ? [[t(R + 'buscan'), valor(f, 'CUANTAS_BUSCA'), false, 'CUANTAS_BUSCA']] : [])
        .concat(marcadas(f, 'FACTURA')[0] === 'si' ? [[t(R + 'factura'), valor(f, 'FACTURA_NOMBRE') && valor(f, 'FACTURA_NIF') && valor(f, 'FACTURA_DIRECCION') && EMAIL.test(valor(f, 'FACTURA_EMAIL')) ? valor(f, 'FACTURA_NOMBRE') : '', true, 'FACTURA_NOMBRE']] : [])
        .concat([[t(R + 'precio'), c && c.precio ? precio(c.precio) : '', false]]));
    }
    f.addEventListener('change', function (ev) {
      var n = ev.target.name;
      if (n === 'ID_COMPETICION') { dep(); if (marcadas(f, 'jugado')[0] === 'si') anteriores(); document.getElementById('ins-detalle').innerHTML = detalleCompeticion(elegida()); }
      if (n === 'jugado' && ev.target.value === 'si') anteriores();
      if (n === 'ID_EQUIPO') { // el nombre del equipo de otros años, si no se ha escrito otro (revisión, 28)
        var e = (datos.anteriores || []).filter(function (x) { return x.id === ev.target.value; })[0], nm = f.elements.NOMBRE_EQUIPO;
        if (e && (!nm.value || nm.getAttribute('data-auto') === nm.value)) { nm.value = e.nombre.slice(0, 20); nm.setAttribute('data-auto', nm.value); contar(); quitarMal(nm); revisarNombre(); }
      }
      if (n === 'ID_COMPETICION' && valor(f, 'NOMBRE_EQUIPO')) revisarNombre();
      if (n === 'FACTURA_NIF') revisarNif(true);
      if (n === 'EMAIL') revisarEmail(true);
      if (n === 'TELEFONO') revisarTelefono(f, 'TELEFONO', true);
      visibles();
      if (['NOMBRE_EQUIPO', 'FACTURA_NIF', 'EMAIL', 'TELEFONO'].indexOf(n) < 0) quitarMal(ev.target);
      alDia();
    });
    f.addEventListener('input', function (ev) {
      if (ev.target.id === 'buscar-anterior') anteriores();
      avisar('');
      if (ev.target.name === 'NOMBRE_EQUIPO') { contar(); quitarMal(ev.target); revisarNombre(); }
      else quitarMal(ev.target);
      if (/TELEFONO/.test(ev.target.name)) revisarTelefono(f, 'TELEFONO');
      if (ev.target.name === 'EMAIL') revisarEmail();
      if (ev.target.name === 'FACTURA_NIF') revisarNif();
      alDia();
    });
    b.poner(); dep();
    if (marcadas(f, 'jugado')[0] === 'si') { anteriores(); b.poner(); }
    document.getElementById('ins-detalle').innerHTML = detalleCompeticion(elegida());
    contar(); visibles(); alDia();
    var deCero = document.getElementById('ins-de-cero');
    if (deCero) deCero.addEventListener('click', function () { b.borrar(); pintar(); });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = { ID_COMPETICION: marcadas(f, 'ID_COMPETICION')[0] || '', ID_EQUIPO: marcadas(f, 'jugado')[0] === 'si' ? marcadas(f, 'ID_EQUIPO')[0] || '' : '',
        NOMBRE_EQUIPO: valor(f, 'NOMBRE_EQUIPO'), CAPITANA: valor(f, 'CAPITANA'), EMAIL: valor(f, 'EMAIL'), PREFIJO: valor(f, 'PREFIJO_TELEFONO'), TELEFONO: valor(f, 'TELEFONO'),
        IDIOMA: marcadas(f, 'IDIOMA')[0] || LANG, NUM_JUGADORAS: valor(f, 'NUM_JUGADORAS'), NIVEL: marcadas(f, 'NIVEL')[0] || '', DISPONIBILIDAD: marcadas(f, 'DISPONIBILIDAD'),
        BUSCA_JUGADORAS: marcadas(f, 'BUSCA_JUGADORAS')[0] === 'si', CUANTAS_BUSCA: valor(f, 'CUANTAS_BUSCA'),
        FACTURA: marcadas(f, 'FACTURA')[0] === 'si', FACTURA_NOMBRE: valor(f, 'FACTURA_NOMBRE'), FACTURA_NIF: valor(f, 'FACTURA_NIF'), FACTURA_DIRECCION: valor(f, 'FACTURA_DIRECCION'), FACTURA_EMAIL: valor(f, 'FACTURA_EMAIL'),
        COMENTARIOS: valor(f, 'COMENTARIOS'), web: valor(f, 'web') };
      var mal = [];
      if (!v.ID_COMPETICION) mal.push('ID_COMPETICION');
      if (!marcadas(f, 'jugado').length) mal.push('jugado');
      if (marcadas(f, 'jugado')[0] === 'si' && !v.ID_EQUIPO) mal.push('ID_EQUIPO');
      if (!revisarNombre()) mal.push('NOMBRE_EQUIPO');
      if (v.CAPITANA.split(/\s+/).length < 2) mal.push('CAPITANA');
      if (!revisarEmail(true)) mal.push('EMAIL');
      if (!revisarTelefono(f, 'TELEFONO', true)) mal.push('TELEFONO');
      if (!v.NIVEL) mal.push('NIVEL');
      if (!v.DISPONIBILIDAD.length) mal.push('DISPONIBILIDAD');
      if (v.FACTURA) {
        if (!v.FACTURA_NOMBRE) mal.push('FACTURA_NOMBRE');
        if (!revisarNif(true)) mal.push('FACTURA_NIF');
        if (!v.FACTURA_DIRECCION) mal.push('FACTURA_DIRECCION');
        if (!EMAIL.test(v.FACTURA_EMAIL)) mal.push('FACTURA_EMAIL');
      }
      if (mal.length) return marcarMal(f, mal, t('general.revisa'), { CAPITANA: t('equipo.errores.capitana'), DISPONIBILIDAD: t('equipo.errores.dias'), ID_EQUIPO: t('equipo.errores.anterior'), jugado: t('equipo.errores.jugado'), NIVEL: t('equipo.errores.nivel') });
      enviar(f, t('general.enviando'), llamar('inscripcionesEquipo', [v]).then(function (r) { b.borrar(); hechoEquipo(r, v); }), b);
    });
  }

  function hechoEquipo(r, v) {
    var url = location.origin + location.pathname + '?f=jugadora&c=' + encodeURIComponent(v.ID_COMPETICION) + '&e=' + encodeURIComponent(r.id);
    // «Rellenar ahora la mía» con sus datos de capitana ya puestos (revisión, 29): se pasan por el dispositivo, una vez.
    var cap = v.CAPITANA.split(/\s+/);
    guardado('ins_rellenar', JSON.stringify({ NOMBRE: cap[0], APELLIDO_1: cap[1] || '', APELLIDO_2: cap.slice(2).join(' '), PREFIJO_TELEFONO: v.PREFIJO, TELEFONO: v.TELEFONO, EMAIL: v.EMAIL, EMAIL_2: v.EMAIL, IDIOMA: v.IDIOMA }));
    var espera = (r.espera || []).map(opcionTxt);
    raiz.innerHTML = '<div class="ins-hecho"><p class="ins-gracias">' + esc(t('equipo.gracias')) + '</p><h1>' + esc(t(r.soloEspera ? 'equipo.enEspera' : 'equipo.inscrito')) + '</h1><p class="ins-hecho-eq">' + esc(r.equipo) + '</p><p>' + esc(r.competicion) + '</p></div>' +
      '<div class="ins-estrecho">' + (espera.length ? '<p class="ins-aviso-ambar">' + esc(t(r.soloEspera ? 'equipo.esperaTodo' : 'equipo.esperaAlgunos', { D: espera.join(', ') })) + '</p>' : '') +
      '<p>' + esc(t(r.soloEspera ? 'equipo.graciasEspera' : 'equipo.graciasTexto', { SENAL: r.senal ? ' (' + euros(r.senal) + ')' : '' })) + '</p><div class="ins-aviso"><p><b>' + esc(t('equipo.siguiente')) + '</b></p>' +
      compartir(url, t('equipo.mensaje', { EQUIPO: r.equipo, URL: url })) + boton(url, t('equipo.laMia')) + '</div><p class="ins-hecho"><b>' + esc(t('despedida')) + '</b></p></div>';
    window.scrollTo(0, 0);
  }
  /** El enlace para pasar: copiarlo o enviarlo por WhatsApp. */
  function compartir(url, msg) {
    return '<div class="ins-enlace"><input readonly value="' + esc(url) + '" aria-label="URL" id="ins-url"><button type="button" id="ins-copiar">' + esc(t('general.copiar')) + '</button></div>' +
      '<a class="ins-boton secundario" href="' + esc('https://wa.me/?text=' + encodeURIComponent(msg)) + '" rel="noopener" target="_blank">' + esc(t('general.porWhatsapp')) + '</a>';
  }

  /* ----- cada jugadora ----- */

  function pintarJugadora(p) {
    var A = TT.es.acepta, oblig = Object.keys(A).filter(function (k) { return A[k].obligatoria; });
    var cp = comp(p.c);
    var enlace = p.e && cp && (cp.equipos || []).filter(function (e) { return e.id === p.e; })[0];
    // Los equipos del banco que le interesan (?i=IE1,IE2: Javi, varios de una vez); se pueden quitar aquí.
    var interes = String(p.i || '').split(',').map(function (id) { return cp && (cp.equipos || []).filter(function (e) { return e.id === id; })[0]; }).filter(Boolean);
    raiz.innerHTML = conResumen(t('jugadora.titulo'), '<p>' + esc(t('jugadora.para')) + ' <b>' + esc(t('jugadora.paga')) + '</b><br><span class="ins-ayuda">' + esc(t('jugadora.repetir')) + '</span></p><div id="ins-aviso-borrador"></div>',
      '<form id="ins-form" novalidate>' +
      (enlace ? '<div class="ins-enlace-eq" id="ins-enlace-eq"><p>' + esc(t('jugadora.teInscribes')) + '</p><b>' + esc(enlace.nombre) + '</b><small>' + esc(cp.nombre + (enlace.liga ? ' · ' + enlace.liga : '')) + '</small>' +
        '<button type="button" class="ins-enl" id="ins-cambiar">' + esc(t('jugadora.enlaceOtro')) + ' ' + esc(t('general.cambiar')) + '</button></div>' : '') +
      (interes.length ? '<div class="ins-interes" id="ins-interes"></div>' : '') +
      '<div id="ins-elegir"' + (enlace ? ' hidden' : '') + '>' + elegirCompeticion(p.c || '', t('jugadora.competicionAyuda'), true) + '<div id="ins-equipo"></div></div>' +
      '<h2>' + esc(t('jugadora.datos')) + '</h2>' +
      campo('NOMBRE', t('jugadora.nombre'), texto('NOMBRE', 'text', ' autocomplete="given-name"'), t('jugadora.nombreAyuda')) +
      '<div class="ins-fila">' + campo('APELLIDO_1', t('jugadora.apellido1'), texto('APELLIDO_1', 'text', ' autocomplete="family-name"')) +
        campo('APELLIDO_2', t('jugadora.apellido2'), texto('APELLIDO_2', 'text'), '', true) + '</div>' +
      '<div class="ins-fila">' + campoFecha('FECHA_NACIMIENTO', t('jugadora.nacimiento')) +
        '<div class="solo-equipo">' + campo('NUM_DOCUMENTO', t('jugadora.documento'), texto('NUM_DOCUMENTO', 'text', ' autocapitalize="characters" autocomplete="off"') + '<p class="ins-nota-mal" id="nota-NUM_DOCUMENTO" hidden></p>') + '</div></div>' +
      campoTelefono('TELEFONO', t('jugadora.telefono')) +
      '<div class="ins-fila">' + campo('EMAIL', t('jugadora.email'), texto('EMAIL', 'email', ' autocomplete="email" inputmode="email" autocapitalize="none"') + '<p class="ins-nota-mal" id="nota-EMAIL" hidden></p>', t('jugadora.emailAyuda')) +
        campo('EMAIL_2', t('jugadora.email2'), texto('EMAIL_2', 'email', ' autocomplete="off" inputmode="email" autocapitalize="none"') + '<p class="ins-nota-mal" id="nota-EMAIL_2" hidden></p>', t('jugadora.email2Ayuda')) + '</div>' +
      campoIdioma() +
      campo('INSTAGRAM', t('jugadora.instagram'), texto('INSTAGRAM', 'text', ' autocomplete="off" autocapitalize="none" placeholder="@"'), t('jugadora.instagramAyuda'), true) +
      '<div class="solo-equipo"><h2>' + esc(t('jugadora.camiseta')) + '</h2><div id="ins-camiseta"><p class="ins-ayuda">' + esc(t('jugadora.eligeEquipo')) + '</p></div></div>' +
      '<div class="solo-busco" id="ins-busco"></div>' +
      '<h2>' + esc(t('jugadora.derechos')) + '</h2>' +
      '<p class="solo-equipo"><button type="button" class="ins-boton secundario ins-todo" id="ins-aceptar-todo">' + esc(t('jugadora.aceptarTodo')) + '</button></p>' +
      Object.keys(A).map(function (k) {
        var a = function (x) { return t('acepta.' + k + '.' + x); };
        var norma = k === 'ACEPTA_NORMAS' ? '<details><summary>' + esc(a('leer')) + '</summary><p><b>' + esc(t('normativa.titulo')) + '</b></p><ol>' +
          t('normativa.puntos').map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol><p>' + esc(t('normativa.firma')) + '</p>' +
          '<p><a href="' + esc(A[k].enlace) + '" target="_blank" rel="noopener">' + esc(a('pdf')) + '</a></p></details>' : '';
        var seguro = k === 'ACEPTA_RESPONSABILIDAD' ? '<label class="ins-si ins-seguro"><input type="checkbox" name="INFO_SEGURO" value="si"> <span>' + esc(t('jugadora.seguro')) + '</span></label>' : '';
        return '<div class="ins-acepta' + (k === 'ACEPTA_DATOS' ? '' : ' solo-equipo') + '" data-campo="' + k + '"><h3>' + esc(a('titulo')) + (A[k].obligatoria ? '' : ' <span class="opc">(' + esc(t('general.opcional')) + ')</span>') + '</h3><p>' + esc(a('texto')) + '</p>' + norma +
          (k === 'ACEPTA_DATOS' ? '<p><a href="?f=privacidad" target="_blank" rel="noopener">' + esc(t('general.privacidad')) + ' ›</a></p>' : '') +
          '<label class="ins-si"><input type="checkbox" name="' + k + '" value="si"> <span>' + esc(a('si')) + '</span></label>' + (A[k].no ? '<p class="ins-ayuda">' + esc(a('no')) + '</p>' : '') + seguro + '</div>';
      }).join('') +
      '<h2>' + esc(t('jugadora.ultimo')) + '</h2>' +
      campo('COMO_NOS_CONOCIO', t('jugadora.conocio'), '<select id="COMO_NOS_CONOCIO" name="COMO_NOS_CONOCIO"><option value="">' + esc(t('jugadora.conocioElige')) + '</option>' +
        t('jugadora.conocioOpciones').map(function (x, i) { return '<option value="' + esc(TT.es.jugadora.conocioOpciones[i]) + '">' + esc(x) + '</option>'; }).join('') + '</select>', '', true) +
      campo('COMENTARIOS', t('jugadora.comentarios'), '<textarea id="COMENTARIOS" name="COMENTARIOS" maxlength="1000"></textarea>', t('jugadora.comentariosAyuda'), true) +
      '<div class="ins-trampa" aria-hidden="true"><label>Web <input name="web" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="ins-error"></div><button class="ins-boton" type="submit" id="ins-enviar">' + esc(t('jugadora.boton')) + '</button></form>');
    var f = document.getElementById('ins-form');
    var b = borrador(f, 'jugadora_' + [p.c, p.e, p.i].filter(Boolean).join('_'), (p.c ? ['ID_COMPETICION'] : []).concat(p.e || p.i ? ['ID_INSCRIPCION_EQUIPO', 'TIENE'] : []));
    document.getElementById('ins-aviso-borrador').innerHTML = avisoBorrador(b);
    var quiere = p.e || (interes.length ? 'SIN' : ''), verTodos = false;
    function pintarInteres() {
      var d = document.getElementById('ins-interes');
      if (!d) return;
      d.innerHTML = interes.length ? '<p>' + esc(t('jugadora.interesan')) + '</p><div class="ins-filtro">' + interes.map(function (e) {
        return '<span class="ins-chip" aria-pressed="true">' + esc(e.nombre) + ' <button type="button" data-quitar="' + esc(e.id) + '" aria-label="' + esc(t('jugadora.quitar') + ' ' + e.nombre) + '">×</button></span>';
      }).join('') + '</div>' : '';
    }
    pintarInteres();
    var di = document.getElementById('ins-interes');
    if (di) di.addEventListener('click', function (ev) {
      var q = ev.target.closest('[data-quitar]');
      if (!q) return;
      interes = interes.filter(function (e) { return e.id !== q.getAttribute('data-quitar'); });
      pintarInteres();
    });
    function elegida() { return comp(marcadas(f, 'ID_COMPETICION')[0] || ''); }
    function equipos() {
      var c = elegida(), d = document.getElementById('ins-equipo');
      if (!c) { d.innerHTML = ''; camiseta(); return; }
      var sel = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || quiere, tiene = marcadas(f, 'TIENE')[0] || (sel === 'SIN' ? 'no' : sel ? 'si' : '');
      // Primero, si tiene equipo o lo busca (Javi: «busco equipo» no puede quedar escondido al final de la lista).
      d.innerHTML = grupo('TIENE', t('jugadora.tienes'), '<div class="ins-opciones ins-dos-op">' +
          ficha('radio', 'TIENE', 'si', '<b>' + esc(t('jugadora.conEquipo')) + '</b><small>' + esc(t('jugadora.conEquipoAyuda')) + '</small>', tiene === 'si') +
          ficha('radio', 'TIENE', 'no', '<b>' + esc(t('jugadora.sinEquipo')) + '</b><small>' + esc(t('jugadora.sinEquipoAyuda')) + '</small>', tiene === 'no') + '</div>') +
        '<input type="radio" name="ID_INSCRIPCION_EQUIPO" value="SIN" hidden tabindex="-1"' + (tiene === 'no' ? ' checked' : '') + '>' +
        '<div id="ins-con-equipo"' + (tiene === 'si' ? '' : ' hidden') + '>' +
        grupo('ID_INSCRIPCION_EQUIPO', t('jugadora.equipo'), (c.equipos.length > 6 ? '<input type="search" id="buscar-equipo" placeholder="' + esc(t('general.buscar')) + '" autocomplete="off">' : '') +
          '<div class="ins-equipos ins-opciones lista" id="lista-equipos"></div>' +
          '<div class="ins-nosale"><p>' + esc(t('jugadora.noSale')) + '</p><a href="?f=equipo" data-ir="f=equipo">' + esc(t('jugadora.noSaleCapitana')) + ' ›</a></div>', t('jugadora.equipoAyuda')) + '</div>';
      listaEquipos(sel === 'SIN' ? '' : sel);
      b.poner();
      tieneEquipo(marcadas(f, 'TIENE')[0] || '');
    }
    /** Sin equipo, el formulario es corto (Javi): sin documento, camiseta ni normas; con su nivel, sus días, si es portera y el banco. */
    function busco() {
      var c = elegida(), d = document.getElementById('ins-busco'), antes = marcadas(f, 'DISPONIBILIDAD_SE'), nv = marcadas(f, 'NIVEL')[0];
      var dias = [];
      ((c && c.opciones) || []).forEach(function (o) { var x = o.split(' · ')[0]; if (dias.indexOf(x) < 0) dias.push(x); });
      d.innerHTML = '<h2>' + esc(t('jugadora.busco')) + '</h2><p class="ins-ayuda">' + esc(t('jugadora.buscoAyuda')) + '</p>' +
        grupo('NIVEL', t('jugadora.tuNivel'), '<div class="ins-opciones ins-nivel">' + ['1', '2', '3', '4', '5'].map(function (n) { return ficha('radio', 'NIVEL', n, n, n === nv); }).join('') +
          '</div><div class="ins-extremos"><span>' + esc(t('equipo.nivelExtremos')[0]) + '</span><span>' + esc(t('equipo.nivelExtremos')[1]) + '</span></div>') +
        (dias.length ? grupo('DISPONIBILIDAD_SE', t('jugadora.tusDias'), '<div class="ins-opciones">' + dias.map(function (x) { return ficha('checkbox', 'DISPONIBILIDAD_SE', x, esc(dia(x)), antes.indexOf(x) >= 0); }).join('') + '</div>') : '') +
        '<label class="ins-si"><input type="checkbox" name="PORTERA" value="si"> <span>' + esc(t('jugadora.portera')) + '</span></label>' +
        '<label class="ins-si"><input type="checkbox" name="EN_BANCO" value="si"> <span>' + esc(t('jugadora.enBanco')) + '</span></label>' +
        '<label class="ins-si ins-sub" id="ins-banco-tel"><input type="checkbox" name="BANCO_TELEFONO" value="si"> <span>' + esc(t('jugadora.bancoTelefono')) + '</span></label>';
      b.poner();
      document.getElementById('ins-banco-tel').hidden = !marcadas(f, 'EN_BANCO').length; // el teléfono, solo si sale en el banco
    }
    function tieneEquipo(v) {
      f.classList.toggle('es-sin', v === 'no');
      if (v === 'no') busco();
      var ce = document.getElementById('ins-con-equipo');
      if (ce) ce.hidden = v !== 'si';
      var sin = f.querySelector('input[name="ID_INSCRIPCION_EQUIPO"][value="SIN"]');
      if (sin && v === 'no') sin.checked = true;
      else if (sin && sin.checked) sin.checked = false;
      document.getElementById('ins-enviar').textContent = t(v === 'no' ? 'jugadora.botonBusco' : 'jugadora.boton');
      camiseta();
    }
    function listaEquipos(sel) {
      var c = elegida();
      var bq = document.getElementById('buscar-equipo'), q = bq ? norm(bq.value) : '';
      sel = sel || marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0];
      var todos = c.equipos.filter(function (e) { return !q || norm(e.nombre).indexOf(q) >= 0 || e.id === sel; });
      // Sin buscar, solo los primeros (revisión, 26: la lista no se queda con el scroll); «Ver todos» enseña el resto.
      var lista = q || verTodos || todos.length <= 8 ? todos : todos.slice(0, 8).concat(todos.slice(8).filter(function (e) { return e.id === sel; }));
      var l = document.getElementById('lista-equipos');
      l.innerHTML = lista.map(function (e) {
        return ficha('radio', 'ID_INSCRIPCION_EQUIPO', e.id, esc(e.nombre) + (e.liga ? '<small>' + esc(e.liga) + '</small>' : ''), e.id === sel);
      }).join('') + (lista.length < todos.length ? '<button type="button" class="ins-ver-todos" id="ins-ver-todos">' + esc(t('jugadora.verTodos', { N: todos.length })) + '</button>' : '') ||
        '<p class="ins-ayuda">' + esc(c.equipos.length ? t('general.nada') : t('jugadora.todaviaNadie')) + '</p>';
      var vt = document.getElementById('ins-ver-todos');
      if (vt) vt.addEventListener('click', function () { verTodos = true; listaEquipos(); });
    }
    /** Las ya inscritas en el equipo elegido (nombre, inicial y dorsal; la capitana, marcada), encima de los dorsales (Javi). */
    function plantilla(x) {
      var ins = (x && x.inscritas) || [];
      return '<div class="ins-plantilla"><p><b>' + esc(ins.length ? t('jugadora.inscritas', { N: ins.length }) : t('jugadora.primera')) + '</b></p>' +
        (ins.length ? '<ul>' + ins.map(function (j) { return '<li>' + (j.dorsal !== '' ? '<span class="ins-dorsal">' + esc(j.dorsal) + '</span>' : '') + esc(j.nombre) + (j.capitana ? ' <small>' + esc(t('jugadora.capitanaEt')) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }
    function camiseta() {
      var d = document.getElementById('ins-camiseta'), ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '';
      if (!ie || ie === 'SIN') { d.innerHTML = '<p class="ins-ayuda">' + esc(t('jugadora.eligeEquipo')) + '</p>'; alDia(); return; }
      var tallas = '<select id="TALLA" name="TALLA"><option value="">' + esc(t('jugadora.tallaElige')) + '</option>' + (datos.tallas || []).map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>';
      var x = dorsales[ie];
      if (!x) {
        d.innerHTML = '<div class="ins-carga" role="status"><span class="ins-punto"></span> ' + esc(t('jugadora.mirando')) + '</div>';
        llamar('inscripcionesDorsales', [ie]).then(function (r) { dorsales[ie] = r; if ((marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '') === ie) camiseta(); })
          .catch(function (e) { d.innerHTML = '<p class="ins-error">' + esc(mensaje(e)) + '</p>'; });
        return;
      }
      d.innerHTML = plantilla(x) + '<div class="ins-cam-fila"><figure class="ins-cam" id="ins-cam">' + dibujoCamiseta(x.color, '') + '<figcaption>' +
        esc(x.color ? (x.color.nombre || t('jugadora.tuColor')) : t('jugadora.sinColor')) + '</figcaption></figure><div class="ins-cam-elige">' +
        grupo('COMBINACION', t('jugadora.dorsal'), '<div class="ins-opciones">' + x.libres.map(function (l) {
          return ficha('radio', 'COMBINACION', l.DORSAL + '|' + l.TALLA, '<b>' + esc(l.DORSAL) + '</b> · ' + esc(t('jugadora.tallaEt', { T: l.TALLA })));
        }).join('') + ficha('radio', 'COMBINACION', 'OTRA', esc(t('jugadora.dorsalOtro'))) + '</div>', t('jugadora.dorsalAyuda')) +
        '<div id="ins-otra" hidden><p class="ins-aviso-ambar" id="nota-pack" hidden></p><p class="ins-aviso">' + esc(t('jugadora.dorsalOtroAyuda')) + (x.ocupados.length ? ' ' + esc(t('jugadora.cogidos', { L: x.ocupados.join(', ') })) : '') + '</p>' +
        '<div class="ins-fila">' + campo('DORSAL', t('jugadora.dorsalSolo'), texto('DORSAL', 'number', ' min="0" max="99" inputmode="numeric"') + '<p class="ins-nota-mal" id="nota-dorsal" hidden></p>') +
        campo('TALLA', t('jugadora.talla'), tallas) + '</div></div></div></div>';
      b.poner();
      document.getElementById('ins-otra').hidden = marcadas(f, 'COMBINACION')[0] !== 'OTRA';
      dorsalEnDibujo(); alDia();
    }
    /** En «otra combinación», una del pack que está libre no se paga (Javi): se marca arriba y se avisa. */
    function revisarPack() {
      var ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '', x = dorsales[ie], n = document.getElementById('nota-pack');
      if (!x || !n || marcadas(f, 'COMBINACION')[0] !== 'OTRA') { if (n) n.hidden = true; return; }
      var d = valor(f, 'DORSAL').replace(/^0+(?=\d)/, ''), tl = valor(f, 'TALLA'), pk = x.libres.filter(function (l) { return l.DORSAL === d; })[0], m = '';
      if (pk && tl === pk.TALLA) {
        var r = f.querySelector('input[name="COMBINACION"][value="' + d + '|' + tl + '"]');
        if (r) { r.checked = true; document.getElementById('ins-otra').hidden = true; }
        m = t('jugadora.packIncluida', { D: d, T: tl });
        var c = f.querySelector('[data-campo="COMBINACION"] .ins-ayuda');
        if (c) { var q = document.getElementById('nota-pack-arriba') || c.insertAdjacentElement('afterend', Object.assign(document.createElement('p'), { id: 'nota-pack-arriba', className: 'ins-nota-ok' })); q.textContent = m; q.hidden = false; }
        dorsalEnDibujo(); alDia();
        return;
      }
      if (pk && tl) m = t('jugadora.packOtraTalla', { D: d, T: pk.TALLA, U: tl });
      else if (d && tl && /^\d{1,2}$/.test(d) && x.ocupados.indexOf(d) < 0) m = t('jugadora.suplemento');
      n.textContent = m; n.hidden = !m; n.className = 'ins-aviso-ambar'; // el suplemento, en ámbar: no es «todo bien» (revisión, 16)
    }
    /** ¿La camiseta elegida va aparte (fuera del pack) y lleva el suplemento? (revisión, 16) */
    function personalizada() {
      var ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '', x = dorsales[ie], combo = marcadas(f, 'COMBINACION')[0] || '';
      if (combo !== 'OTRA' || !x) return false;
      var d = valor(f, 'DORSAL').replace(/^0+(?=\d)/, ''), tl = valor(f, 'TALLA');
      return !!d && !!tl && !x.libres.some(function (l) { return l.DORSAL === d && l.TALLA === tl; });
    }
    function dorsalEnDibujo() {
      var cam = document.getElementById('ins-cam'), ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '', x = dorsales[ie];
      if (!cam || !x) return;
      var v = lo(), d = /^\d{1,2}$/.test(v.DORSAL) ? String(Number(v.DORSAL)) : '';
      cam.querySelector('svg').outerHTML = dibujoCamiseta(x.color, d);
    }
    function lo() {
      var ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '', combo = marcadas(f, 'COMBINACION')[0] || '';
      var v = { ID_COMPETICION: marcadas(f, 'ID_COMPETICION')[0] || '', ID_INSCRIPCION_EQUIPO: ie === 'SIN' ? '' : ie, SIN_EQUIPO: ie === 'SIN', EQUIPOS_INTERES: interes.map(function (e) { return e.id; }),
        NOMBRE: valor(f, 'NOMBRE'), APELLIDO_1: valor(f, 'APELLIDO_1'), APELLIDO_2: valor(f, 'APELLIDO_2'), FECHA_NACIMIENTO: fechaDe(f, 'FECHA_NACIMIENTO'),
        NUM_DOCUMENTO: valor(f, 'NUM_DOCUMENTO'), PREFIJO: valor(f, 'PREFIJO_TELEFONO'), TELEFONO: valor(f, 'TELEFONO'), EMAIL: valor(f, 'EMAIL'), INSTAGRAM: valor(f, 'INSTAGRAM'),
        DORSAL: combo && combo !== 'OTRA' ? combo.split('|')[0] : valor(f, 'DORSAL'), TALLA: combo && combo !== 'OTRA' ? combo.split('|')[1] : valor(f, 'TALLA'),
        NIVEL: marcadas(f, 'NIVEL')[0] || '', DISPONIBILIDAD: marcadas(f, 'DISPONIBILIDAD_SE'), PORTERA: !!marcadas(f, 'PORTERA').length, EN_BANCO: !!marcadas(f, 'EN_BANCO').length, BANCO_TELEFONO: !!marcadas(f, 'EN_BANCO').length && !!marcadas(f, 'BANCO_TELEFONO').length,
        INFO_SEGURO: !!marcadas(f, 'INFO_SEGURO').length, IDIOMA: marcadas(f, 'IDIOMA')[0] || LANG, EMAIL_2: valor(f, 'EMAIL_2'), COMO_NOS_CONOCIO: valor(f, 'COMO_NOS_CONOCIO'), COMENTARIOS: valor(f, 'COMENTARIOS'), web: valor(f, 'web') };
      Object.keys(A).forEach(function (k) { v[k] = !!(f.elements[k] && f.elements[k].checked); });
      return v;
    }
    /** Lo que ya se sabe que no vale, campo a campo: { CAMPO: 'qué pasa' }. */
    function problemas(v) {
      var pr = {}, E = 'jugadora.errores.', ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '', x = dorsales[ie];
      var d = String(v.DORSAL || '').replace(/^0+(?=\d)/, '');
      if (marcadas(f, 'COMBINACION')[0] === 'OTRA' && d) {
        if (!/^\d{1,2}$/.test(d)) pr.DORSAL = t(E + 'dorsalNumero');
        else if (x && x.ocupados.indexOf(d) >= 0) pr.DORSAL = t(E + 'dorsalCogido', { D: d });
      }
      var e = edad(v.FECHA_NACIMIENTO);
      if (v.FECHA_NACIMIENTO === 'mal') pr.FECHA_NACIMIENTO = t(E + 'fechaNoExiste');
      else if (v.FECHA_NACIMIENTO && e > 90) pr.FECHA_NACIMIENTO = t(E + 'fecha');
      else if (v.FECHA_NACIMIENTO && e < EDAD_MIN) pr.FECHA_NACIMIENTO = t(E + 'edad', { N: EDAD_MIN });
      if (v.EMAIL && !EMAIL.test(v.EMAIL)) pr.EMAIL = t(E + 'email');
      else if (v.EMAIL_2 && v.EMAIL_2.toLowerCase() !== v.EMAIL.toLowerCase()) pr.EMAIL_2 = t(E + 'email2');
      if (!v.SIN_EQUIPO && docMal(v.NUM_DOCUMENTO)) pr.NUM_DOCUMENTO = docMal(v.NUM_DOCUMENTO);
      return pr;
    }
    function avisarCampos(v) {
      var pr = problemas(v);
      ['DORSAL', 'FECHA_NACIMIENTO', 'EMAIL', 'EMAIL_2', 'NUM_DOCUMENTO'].forEach(function (k) { var c = f.querySelector('[data-campo="' + k + '"]'); if (c) c.classList.toggle('mal', !!pr[k]); });
      [['nota-dorsal', pr.DORSAL], ['nota-FECHA_NACIMIENTO', pr.FECHA_NACIMIENTO], ['nota-EMAIL', pr.EMAIL], ['nota-EMAIL_2', pr.EMAIL_2], ['nota-NUM_DOCUMENTO', pr.NUM_DOCUMENTO]].forEach(function (x) {
        var n = document.getElementById(x[0]); if (n) { n.textContent = x[1] || ''; n.hidden = !x[1]; }
      });
      return pr;
    }
    function alDia() {
      var v = lo(), c = elegida(), e = c && (c.equipos || []).filter(function (x) { return x.id === v.ID_INSCRIPCION_EQUIPO; })[0], R = 'jugadora.resumen.';
      var ok = oblig.filter(function (k) { return v[k]; }).length, primeraSin = oblig.filter(function (k) { return !v[k]; })[0] || oblig[0];
      var tiene = marcadas(f, 'TIENE')[0] === 'si' ? 'ID_INSCRIPCION_EQUIPO' : 'TIENE';
      var pr = problemas(v), fecha = v.FECHA_NACIMIENTO && !pr.FECHA_NACIMIENTO ? v.FECHA_NACIMIENTO.split('-').reverse().join('/') : '';
      var filas = [[t(R + 'competicion'), c ? c.nombre : '', true, 'ID_COMPETICION'], [t(R + 'equipo'), v.SIN_EQUIPO ? t(R + 'busco') : e ? e.nombre : '', true, tiene],
        [t(R + 'nombre'), v.NOMBRE && v.APELLIDO_1 ? [v.NOMBRE, v.APELLIDO_1, v.APELLIDO_2].filter(Boolean).join(' ') : '', true, !v.NOMBRE ? 'NOMBRE' : 'APELLIDO_1'],
        [t(R + 'nacimiento'), fecha, true, 'FECHA_NACIMIENTO']];
      if (!v.SIN_EQUIPO) filas.push([t(R + 'documento'), v.NUM_DOCUMENTO && !pr.NUM_DOCUMENTO ? v.NUM_DOCUMENTO.toUpperCase() : '', true, 'NUM_DOCUMENTO']);
      filas.push([t(R + 'telefono'), telefono(v.PREFIJO, v.TELEFONO), true, 'TELEFONO'],
        [t(R + 'email'), EMAIL.test(v.EMAIL) && v.EMAIL_2.toLowerCase() === v.EMAIL.toLowerCase() ? v.EMAIL : '', true, 'EMAIL']);
      if (v.SIN_EQUIPO) filas.push([t(R + 'nivel'), v.NIVEL, true, 'NIVEL'], [t(R + 'dias'), v.DISPONIBILIDAD.map(dia).join(', '), true, 'DISPONIBILIDAD_SE'],
        [t(R + 'interesan'), interes.map(function (x) { return x.nombre; }).join(', '), false, 'ins-interes'], [t(R + 'datos'), v.ACEPTA_DATOS ? t(R + 'aceptado') : '', true, 'ACEPTA_DATOS']);
      else filas.push([t(R + 'camiseta'), v.DORSAL && v.TALLA && !pr.DORSAL ? t(R + 'camisetaV', { D: v.DORSAL, T: v.TALLA }) + (personalizada() ? ' (' + t(R + 'mas10') + ')' : '') : '', true, 'ins-camiseta'],
        [t(R + 'aceptado'), ok === oblig.length ? t(R + 'todo') : ok ? t(R + 'deN', { A: ok, B: oblig.length }) : '', true, primeraSin]);
      resumen(filas);
    }
    f.addEventListener('change', function (ev) {
      var n = ev.target.name;
      if (n === 'ID_COMPETICION') {
        quiere = ''; equipos(); document.getElementById('ins-detalle').innerHTML = detalleCompeticion(elegida(), true);
        // Los equipos del banco son de una competición: al cambiarla, fuera (revisión, 9).
        var cc = marcadas(f, 'ID_COMPETICION')[0];
        if (interes.length && interes.some(function (e) { return !(comp(cc) && comp(cc).equipos.some(function (x) { return x.id === e.id; })); })) { interes = []; pintarInteres(); }
      }
      if (n === 'ID_INSCRIPCION_EQUIPO') camiseta();
      if (n === 'TIENE') tieneEquipo(ev.target.value);
      if (n === 'EN_BANCO' || n === 'TIENE') { var bt = document.getElementById('ins-banco-tel'); if (bt) { bt.hidden = !marcadas(f, 'EN_BANCO').length; if (bt.hidden) f.elements.BANCO_TELEFONO.checked = false; } }
      if (n === 'COMBINACION') { document.getElementById('ins-otra').hidden = ev.target.value !== 'OTRA'; var q0 = document.getElementById('nota-pack-arriba'); if (q0 && ev.isTrusted) q0.hidden = true; }
      if (n === 'COMBINACION' || n === 'DORSAL') dorsalEnDibujo();
      if (n === 'DORSAL' || n === 'TALLA') revisarPack();
      if (n === 'TELEFONO') revisarTelefono(f, 'TELEFONO', true);
      if (['EMAIL', 'EMAIL_2', 'NUM_DOCUMENTO', 'TELEFONO'].indexOf(n) < 0) quitarMal(ev.target);
      avisarCampos(lo()); alDia();
    });
    f.addEventListener('input', function (ev) {
      if (ev.target.id === 'buscar-equipo') listaEquipos();
      quitarMal(ev.target);
      if (ev.target.name === 'DORSAL' || ((ev.target.name === 'EMAIL' || ev.target.name === 'EMAIL_2' || ev.target.name === 'NUM_DOCUMENTO') && f.querySelector('[data-campo="' + ev.target.name + '"].mal'))) avisarCampos(lo());
      if (/TELEFONO/.test(ev.target.name)) revisarTelefono(f, 'TELEFONO');
      if (ev.target.name === 'DORSAL') { dorsalEnDibujo(); revisarPack(); }
      alDia();
    });
    var bTodo = document.getElementById('ins-aceptar-todo');
    function estadoTodo() { var todo = oblig.every(function (k) { return f.elements[k] && f.elements[k].checked; }); bTodo.classList.toggle('hecho', todo); bTodo.textContent = todo ? '✓ ' + t('jugadora.aceptado') : t('jugadora.aceptarTodo'); }
    bTodo.addEventListener('click', function () {
      oblig.forEach(function (k) { if (f.elements[k]) { f.elements[k].checked = true; quitarMal(f.elements[k]); } });
      estadoTodo(); alDia();
    });
    f.addEventListener('change', function (ev) { if (/^ACEPTA_/.test(ev.target.name)) estadoTodo(); });
    var cambiar = document.getElementById('ins-cambiar');
    if (cambiar) cambiar.addEventListener('click', function () { document.getElementById('ins-elegir').hidden = false; document.getElementById('ins-enlace-eq').hidden = true; });
    var deCero = document.getElementById('ins-de-cero');
    if (deCero) deCero.addEventListener('click', function () { b.borrar(); pintar(); });
    b.poner(); equipos();
    // Si llega de «Rellenar ahora la mía», sus datos de capitana ya puestos (una vez).
    var rell = null;
    try { rell = JSON.parse(guardado('ins_rellenar') || 'null'); } catch (e) { rell = null; }
    if (rell && enlace) {
      guardado('ins_rellenar', null);
      Object.keys(rell).forEach(function (k) {
        var xs = f.querySelectorAll('[name="' + k + '"]');
        Array.prototype.forEach.call(xs, function (x) { if (x.type === 'radio') x.checked = x.value === rell[k]; else if (!x.value) x.value = rell[k] || ''; });
      });
    }
    alDia();
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = lo(), ie = marcadas(f, 'ID_INSCRIPCION_EQUIPO')[0] || '', combo = marcadas(f, 'COMBINACION')[0] || '';
      var mal = [];
      if (!v.ID_COMPETICION) mal.push('ID_COMPETICION');
      if (!ie) mal.push(marcadas(f, 'TIENE')[0] === 'si' ? 'ID_INSCRIPCION_EQUIPO' : 'TIENE');
      if (mal.length && document.getElementById('ins-elegir').hidden) { document.getElementById('ins-elegir').hidden = false; var ee = document.getElementById('ins-enlace-eq'); if (ee) ee.hidden = true; }
      ['NOMBRE', 'APELLIDO_1', 'FECHA_NACIMIENTO'].concat(v.SIN_EQUIPO ? [] : ['NUM_DOCUMENTO']).forEach(function (k) { if (!v[k]) mal.push(k); });
      if (!revisarTelefono(f, 'TELEFONO')) mal.push('TELEFONO');
      if (!v.EMAIL) mal.push('EMAIL');
      if (!v.EMAIL_2) mal.push('EMAIL_2');
      if (ie && ie !== 'SIN' && !combo) mal.push('COMBINACION');
      if (combo === 'OTRA' && !v.DORSAL) mal.push('DORSAL');
      if (ie && ie !== 'SIN' && !v.TALLA) mal.push('TALLA');
      Object.keys(avisarCampos(v)).forEach(function (k) { if (mal.indexOf(k) < 0) mal.push(k); });
      oblig.forEach(function (k) { if (!v[k] && (!v.SIN_EQUIPO || k === 'ACEPTA_DATOS')) mal.push(k); });
      if (v.SIN_EQUIPO && !v.NIVEL) mal.push('NIVEL');
      if (v.SIN_EQUIPO && !v.DISPONIBILIDAD.length) mal.push('DISPONIBILIDAD_SE');
      if (mal.length) return marcarMal(f, mal, mal.every(function (k) { return /^ACEPTA_/.test(k); })
        ? t(v.SIN_EQUIPO ? 'jugadora.errores.aceptaDatos' : 'jugadora.errores.acepta') : t('general.revisa'),
        { TIENE: t('jugadora.errores.tienes'), ID_INSCRIPCION_EQUIPO: t('jugadora.errores.equipo'), COMBINACION: t('jugadora.errores.combinacion'), NIVEL: t('jugadora.errores.nivel'),
          DISPONIBILIDAD_SE: t('jugadora.errores.dias'), ACEPTA_NORMAS: t('jugadora.errores.aceptaUna'), ACEPTA_DATOS: t('jugadora.errores.aceptaUna'), ACEPTA_RESPONSABILIDAD: t('jugadora.errores.aceptaUna') });
      v.EXTRA = personalizada();
      enviar(f, t('general.enviando'), llamar('inscripcionesJugadora', [v]).then(function (r) { b.borrar(); if (v.SIN_EQUIPO) elegidos(null); hechoJugadora(r, v); }), b);
    });
  }

  function hechoJugadora(r, v) {
    var url = location.origin + location.pathname + '?f=jugadora' + (v.ID_COMPETICION ? '&c=' + encodeURIComponent(v.ID_COMPETICION) : '') + (v.ID_INSCRIPCION_EQUIPO ? '&e=' + encodeURIComponent(v.ID_INSCRIPCION_EQUIPO) : '');
    var x = dorsales[v.ID_INSCRIPCION_EQUIPO];
    raiz.innerHTML = '<div class="ins-hecho"><p class="ins-gracias">' + esc(t('jugadora.gracias')) + '</p><h1>' + esc(r.sinEquipo ? t('jugadora.apuntadaTitulo') : t('jugadora.inscrita', { EQUIPO: r.equipo })) + '</h1>' +
      (r.sinEquipo ? '<p>' + esc(t('jugadora.apuntada')) + '</p>' : '') +
      (r.vuelve ? '<p>' + esc(t('jugadora.guardada')) + '</p>' : '') +
      (v.EXTRA ? '<p class="ins-aviso-ambar">' + esc(t('jugadora.suplementoHecho')) + '</p>' : '') +
      (r.sinEquipo ? '<p class="ins-ayuda">' + esc(t('banco.siEncuentras')) + ' <a href="?f=banco&t=jugadoras#salir">' + esc(t('banco.salir')) + '</a></p>' : '') +
      (!r.sinEquipo && x ? '<figure class="ins-cam ins-cam-grande">' + dibujoCamiseta(x.color, String(Number(v.DORSAL))) + '<figcaption>' + esc(t('jugadora.tuCamiseta', { D: v.DORSAL, T: v.TALLA })) + '</figcaption></figure>' : '') +
      '</div><div class="ins-estrecho">' +
      (!r.sinEquipo ? '<div class="ins-bloque"><h3>' + esc(t('jugadora.ahora')) + '</h3><ul>' + t('jugadora.ahoraTexto').map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="ins-aviso"><p><b>' + esc(t('jugadora.compartir')) + '</b></p>' + compartir(url, t('jugadora.mensaje', { EQUIPO: r.equipo, URL: url })) + '</div>' : '') +
      '<p class="ins-hecho"><b>' + esc(t('despedida')) + '</b></p>' + boton(url, t('jugadora.otra'), 'secundario') + '</div>';
    dorsales = {};
    window.scrollTo(0, 0);
  }

  /* ----- la política de privacidad (privacidad.js) ----- */

  function pintarPrivacidad() {
    var P = window.INS_PRIVACIDAD || {}, X = P[LANG] || P.es, D = P.DATOS || {};
    var hueco = function (s) { return esc(s).replace(/\{(\w+)\}/g, function (m, k) { return D[k] ? '<b>' + esc(D[k]) + '</b>' : m; }); };
    raiz.innerHTML = volver() + '<article class="ins-legal"><h1>' + esc(X.titulo) + '</h1><p class="ins-ayuda">' + esc(X.actualizada) + '</p>' +
      X.secciones.map(function (s, i) { return '<h2>' + (i + 1) + '. ' + esc(s[0]) + '</h2>' + s[1].map(function (x) { return '<p>' + hueco(x) + '</p>'; }).join(''); }).join('') + '</article>';
  }

  /* ----- el banco ----- */

  var banco = null, avisoOtraComp = false;
  /** Los equipos del banco que ha marcado («Me interesa»), en el dispositivo: { c: competición, ids: [IE…] }. null: los borra. */
  function elegidos(x) {
    if (x === null) { guardado('ins_interes', null); return null; }
    if (x) { guardado('ins_interes', JSON.stringify(x)); return x; }
    try { return JSON.parse(guardado('ins_interes') || 'null') || { c: '', ids: [] }; } catch (e) { return { c: '', ids: [] }; }
  }
  function pintarBanco(p) {
    raiz.innerHTML = volver() + '<h1>' + esc(t('banco.titulo')) + '</h1><p>' + esc(t('banco.para')) + '</p><div id="ins-banco"><div class="ins-carga" role="status"><span class="ins-punto"></span> ' + esc(t('general.cargando')) + '</div></div>';
    (banco ? Promise.resolve(banco) : llamar('inscripcionesBanco')).then(function (r) { banco = r; pintarBanco2(p); })
      .catch(function (e) { var d = document.getElementById('ins-banco'); if (d) d.innerHTML = '<p class="ins-error">' + esc(mensaje(e)) + '</p>'; });
  }
  function pintarBanco2(p) {
    var d = document.getElementById('ins-banco');
    if (!d) return;
    var tab = p.t === 'jugadoras' ? 'jugadoras' : 'equipos', cf = p.c || '', B = 'banco.';
    var nomC = function (id) { var c = banco.competiciones.filter(function (x) { return x.id === id; })[0]; return c ? c.nombre : ''; };
    var eqs = banco.equipos.filter(function (e) { return !cf || e.competicion === cf; }), jus = banco.jugadoras.filter(function (j) { return !cf || j.competicion === cf; });
    var diasTxt = function (s) { return String(s || '').split(/\s*,\s*/).filter(Boolean).map(dia).join(', '); };
    var q = function (tb, c) { return 'f=banco&t=' + tb + (c ? '&c=' + c : ''); };
    d.innerHTML = '<div class="ins-tabs" role="tablist">' + ['equipos', 'jugadoras'].map(function (k) {
        return '<a role="tab" href="?' + q(k, cf) + '" data-ir="' + q(k, cf) + '" aria-selected="' + (k === tab) + '">' + esc(t(B + k)) + ' <em>' + (k === 'equipos' ? eqs : jus).length + '</em></a>';
      }).join('') + '</div>' +
      (banco.competiciones.length > 1 ? '<div class="ins-filtro">' + [['', t(B + 'todas')]].concat(banco.competiciones.map(function (c) { return [c.id, c.nombre]; })).map(function (x) {
        return '<a class="ins-chip" href="?' + q(tab, x[0]) + '" data-ir="' + q(tab, x[0]) + '" aria-pressed="' + (x[0] === cf) + '">' + esc(x[1]) + '</a>';
      }).join('') + '</div>' +
        // En el móvil, un desplegable en lugar de cuatro líneas de botones (revisión, 11).
        '<select class="ins-filtro-movil" id="ins-filtro-movil" aria-label="' + esc(t(B + 'todas')) + '">' + [['', t(B + 'todas')]].concat(banco.competiciones.map(function (c) { return [c.id, c.nombre]; })).map(function (x) {
          return '<option value="' + esc(x[0]) + '"' + (x[0] === cf ? ' selected' : '') + '>' + esc(x[1]) + '</option>';
        }).join('') + '</select>' : '') +
      (tab === 'equipos'
        ? (eqs.length ? '<div class="ins-banco">' + eqs.map(function (e) {
            var marcado = elegidos().ids.indexOf(e.id) >= 0;
            return '<article class="ins-banco-c' + (marcado ? ' marcado' : '') + '"><h3>' + esc(e.nombre) + '</h3><p class="ins-banco-n">' + esc(e.buscan ? t(B + 'buscan', { N: e.buscan }) : t(B + 'buscanAlgunas')) + '</p>' +
              '<p class="ins-comp-d">' + esc([nomC(e.competicion), e.liga, diasTxt(e.dias), e.nivel ? t(B + 'nivel', { N: e.nivel }) : '', t(B + 'inscritas', { N: e.inscritas })].filter(Boolean).join(' · ')) + '</p>' +
              '<button type="button" class="ins-boton' + (marcado ? ' secundario' : '') + '" data-interes="' + esc(e.id) + '" data-comp="' + esc(e.competicion) + '" aria-pressed="' + marcado + '">' +
              esc(marcado ? '✓ ' + t(B + 'marcado') : t(B + 'meInteresa')) + '</button></article>';
          }).join('') + '</div>' : '<p class="ins-aviso">' + esc(t(B + 'sinEquipos')) + '</p>') +
          '<div class="ins-bloque"><h3>' + esc(t(B + 'equipoBusca')) + '</h3><p>' + esc(t(B + 'equipoBuscaTexto')) + '</p></div>'
        : (jus.length ? '<div class="ins-banco">' + jus.map(function (j) {
            // Lo que ella ha aceptado enseñar (Javi): nombre con la inicial, franja de edad y, si quiere, su teléfono para escribirle.
            var hace = j.desde ? Math.max(0, Math.round((Date.now() - new Date(j.desde + 'T12:00:00').getTime()) / 86400000)) : null;
            var acc;
            if (j.telefono) acc = '<a class="ins-boton" href="' + esc(wa(j.telefono, t(B + 'hola', { N: (j.nombre || '').split(' ')[0] }))) + '" target="_blank" rel="noopener">' + esc(t(B + 'escribirle')) + '</a>' +
              '<button type="button" class="ins-boton secundario" data-copiar="' + esc(telTxt(j.telefono)) + '">' + esc(t(B + 'copiarTel')) + ' · ' + esc(telTxt(j.telefono)) + '</button>';
            else {
              var msg = t(B + 'mensaje', { REF: j.ref + ' (' + j.nombre + ')', NIVEL: j.nivel || '?', DIAS: diasTxt(j.dias) || '-' });
              acc = TT.WHATSAPP ? '<a class="ins-boton secundario" href="' + esc(wa(TT.WHATSAPP, msg)) + '" target="_blank" rel="noopener">' + esc(t(B + 'pedirContacto')) + '</a>'
                : '<p class="ins-ayuda">' + esc(t(B + 'pedirContactoIg', { REF: j.ref })) + ' <a href="' + esc(TT.INSTAGRAM) + '" target="_blank" rel="noopener">@konamigasbarcelona</a></p>';
            }
            return '<article class="ins-banco-c"><h3>' + esc(j.nombre || j.ref) + (j.portera ? ' <span class="ins-est es-ultimas">' + esc(t(B + 'portera')) + '</span>' : '') + '</h3>' +
              '<p class="ins-banco-n">' + esc([j.edad ? t(B + 'anos', { N: j.edad }) : '', j.nivel ? t(B + 'nivel', { N: j.nivel }) : ''].filter(Boolean).join(' · ')) + '</p>' +
              '<p class="ins-comp-d">' + esc([nomC(j.competicion), diasTxt(j.dias) ? t(B + 'puede', { D: diasTxt(j.dias) }) : ''].filter(Boolean).join(' · ')) + '</p>' +
              (hace !== null ? '<p class="ins-comp-d">' + esc(hace === 0 ? t(B + 'desdeHoy') : hace === 1 ? t(B + 'desdeAyer') : t(B + 'desdeHace', { N: hace })) + '</p>' : '') + acc + '</article>';
          }).join('') + '</div>' : '<p class="ins-aviso">' + esc(t(B + 'sinJugadoras')) + '</p>') +
          '<div class="ins-bloque"><h3>' + esc(t(B + 'apuntate')) + '</h3>' + boton('?f=jugadora' + (cf ? '&c=' + cf : ''), t(B + 'apuntateBoton'), 'secundario', ' data-ir="f=jugadora' + (cf ? '&c=' + cf : '') + '"') + '</div>') +
      '<p class="ins-aviso-ambar" id="ins-otra-comp"' + (avisoOtraComp ? '' : ' hidden') + '>' + esc(t(B + 'otraComp')) + '</p>' +
      '<details class="ins-salir" id="salir"' + (location.hash === '#salir' ? ' open' : '') + '><summary>' + esc(t(B + 'salir')) + '</summary><p>' + esc(t(B + 'salirTexto')) + '</p>' +
        '<form id="ins-form-salir" novalidate>' + campoTelefono('TELEFONO', t('jugadora.telefono')) + campo('EMAIL', t('jugadora.email'), texto('EMAIL', 'email', ' autocomplete="email" inputmode="email" autocapitalize="none"')) +
        '<div id="ins-error"></div><button class="ins-boton secundario" type="submit" id="ins-enviar">' + esc(t(B + 'salirBoton')) + '</button></form></details>' +
      '<div class="ins-barra" id="ins-barra-banco" hidden></div>';
    barraBanco();
    var fm = document.getElementById('ins-filtro-movil');
    if (fm) fm.addEventListener('change', function () { ir(q(tab, fm.value)); });
    /* Salir del banco (Javi): con el teléfono y el email con que se apuntó, los dos a la vez. */
    var fs = document.getElementById('ins-form-salir');
    fs.addEventListener('input', function (ev) { if (/TELEFONO/.test(ev.target.name)) revisarTelefono(fs, 'TELEFONO'); });
    fs.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var mal = [];
      if (!revisarTelefono(fs, 'TELEFONO')) mal.push('TELEFONO');
      if (!EMAIL.test(valor(fs, 'EMAIL'))) mal.push('EMAIL');
      if (mal.length) return marcarMal(fs, mal, t('general.revisa'));
      enviar(fs, t('general.enviando'), llamar('inscripcionesSalirBanco', [{ PREFIJO: valor(fs, 'PREFIJO_TELEFONO'), TELEFONO: valor(fs, 'TELEFONO'), EMAIL: valor(fs, 'EMAIL') }]).then(function (r) {
        // Sale ya de la lista (revisión, 10): se vuelve a leer el banco y se pinta, con el aviso de que está hecho.
        var hecho = [r.jugadora ? t(B + 'salidaJugadora') : '', r.equipos ? t(B + 'salidaEquipo') : ''].filter(Boolean).join(' ');
        return llamar('inscripcionesBanco').then(function (x) {
          banco = x; pintarBanco2(parametros());
          var dd = document.getElementById('salir');
          if (dd) { dd.open = true; dd.querySelector('form').outerHTML = '<p class="ins-nota-ok">' + esc(hecho) + '</p>'; }
        });
      }));
    });
  }
  /** La barra de abajo del banco: cuántos equipos ha marcado y «Apuntarme» (un solo formulario para todos: Javi). */
  function barraBanco() {
    var bb = document.getElementById('ins-barra-banco'), x = elegidos();
    if (!bb) return;
    bb.hidden = !x.ids.length || parametros().t === 'jugadoras'; // en la pestaña de jugadoras no hace falta (revisión, 40)
    if (!x.ids.length) { bb.className = 'ins-barra'; return; }
    var q = 'f=jugadora&c=' + encodeURIComponent(x.c) + '&i=' + encodeURIComponent(x.ids.join(','));
    bb.className = 'ins-barra listo siempre';
    bb.innerHTML = '<span>' + esc(t(x.ids.length === 1 ? 'banco.teInteresaUno' : 'banco.teInteresan', { N: x.ids.length })) + '</span><a href="?' + esc(q) + '" data-ir="' + esc(q) + '">' + esc(t('banco.apuntarme')) + ' ›</a>';
  }

  /**
   * La camiseta dibujada por detrás, con el color del equipo y el dorsal (Javi). Sin color, en gris. El número, en blanco o en
   * azul marino según lo oscuro que sea el color.
   */
  function dibujoCamiseta(color, dorsal) {
    var hex = (color && color.hex) || '#D5DAE6', r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    var tinta = (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#020252' : '#FFFFFF';
    dorsal = String(dorsal || '');
    return '<svg viewBox="0 0 200 210" role="img" aria-label="' + esc((color && color.nombre ? color.nombre + ' ' : '') + dorsal) + '">' +
      '<path d="M62 14 L38 22 L6 58 L30 86 L46 72 L46 200 L154 200 L154 72 L170 86 L194 58 L162 22 L138 14 C130 30 70 30 62 14 Z" fill="' + hex + '" stroke="#020252" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M62 14 C70 30 130 30 138 14" fill="none" stroke="#020252" stroke-width="4"/>' +
      '<text x="100" y="132" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="' + (dorsal.length > 1 ? 70 : 78) + '" fill="' + tinta + '">' + esc(dorsal || '?') + '</text>' +
      '<text x="100" y="168" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="12" letter-spacing="1.5" fill="' + tinta + '">KONAMIGAS</text></svg>';
  }

  /* ---------- enviar y avisar ---------- */

  function avisar(m) { var e = document.getElementById('ins-error'); if (e) e.innerHTML = m ? '<p class="ins-error" role="alert">' + esc(m) + '</p>' : ''; }
  function quitarMal(el) {
    var c = el && el.closest && el.closest('[data-campo]');
    if (!c) return;
    c.classList.remove('mal');
    var n = c.querySelector(':scope > .ins-nota-campo'); if (n) n.remove();
  }
  /**
   * Marca en rojo lo que falta o está mal, cada campo con su texto debajo (revisión, 13: nada en rojo sin decir qué pasa;
   * notas: { CAMPO: 'texto' }, si no, «Falta este dato»), avisa abajo y baja hasta el primero que se ve (14).
   */
  function marcarMal(f, mal, m, notas) {
    f.querySelectorAll('.mal').forEach(function (x) { x.classList.remove('mal'); });
    f.querySelectorAll('.ins-nota-campo').forEach(function (x) { x.remove(); });
    mal.forEach(function (k) {
      var c = f.querySelector('[data-campo="' + k + '"]');
      if (!c) return;
      c.classList.add('mal');
      var propia = c.querySelector('.ins-nota-mal:not([hidden])');
      if (!propia) c.insertAdjacentHTML('beforeend', '<p class="ins-nota-campo">' + esc((notas && notas[k]) || t('general.faltaDato')) + '</p>');
    });
    avisar(m);
    var primero = Array.prototype.filter.call(f.querySelectorAll('.mal'), function (x) { return x.offsetParent !== null; })[0];
    if (primero) { primero.scrollIntoView({ behavior: 'smooth', block: 'center' }); var i = primero.querySelector('input:not([type=hidden]),select,textarea'); if (i) setTimeout(function () { i.focus({ preventScroll: true }); }, 300); }
  }
  /** Envía y, mientras tanto (Apps Script tarda unos segundos), lo dice en el botón con su indicador: que no le den dos veces. */
  function enviar(f, texto, promesa, b) {
    if (enviando) return;
    enviando = true;
    if (b) b.parar(true);
    var b = f.querySelector('#ins-enviar'), antes = b.textContent;
    b.disabled = true; b.innerHTML = '<span class="ins-punto"></span> ' + esc(texto); avisar('');
    promesa.catch(function (e) {
      if (b) b.parar(false);
      avisar(mensaje(e));
      document.getElementById('ins-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).then(function () { enviando = false; if (document.body.contains(b)) { b.disabled = false; b.textContent = antes; } });
  }

  /* ---------- arrancar ---------- */

  document.addEventListener('click', function (ev) {
    var lg = ev.target.closest && ev.target.closest('[data-lang]');
    if (lg) { LANG = lg.getAttribute('data-lang'); guardado('ins_lang', LANG); if (datos) pintar(); else cabecera(); return; }
    var ct = ev.target.closest && ev.target.closest('[data-copiar]');
    if (ct) { var tel = ct.getAttribute('data-copiar'); (navigator.clipboard ? navigator.clipboard.writeText(tel) : Promise.reject()).catch(function () {}); ct.textContent = t('general.copiado') + ' · ' + tel; return; }
    var cp = ev.target.closest && ev.target.closest('#ins-copiar');
    if (cp) {
      var i = document.getElementById('ins-url'); i.select();
      (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).catch(function () { document.execCommand('copy'); });
      cp.textContent = t('general.copiado');
      return;
    }
    var mi = ev.target.closest && ev.target.closest('[data-interes]');
    if (mi) { // «Me interesa» del banco: marca o desmarca, sin salir (Javi: varios equipos, un solo formulario)
      var x = elegidos(), id = mi.getAttribute('data-interes'), c = mi.getAttribute('data-comp'), aviso = document.getElementById('ins-otra-comp');
      avisoOtraComp = !!(x.c && x.c !== c && x.ids.length);
      if (avisoOtraComp) x = { c: c, ids: [] };
      x.c = c;
      x.ids = x.ids.indexOf(id) >= 0 ? x.ids.filter(function (y) { return y !== id; }) : x.ids.concat(id);
      elegidos(x.ids.length ? x : null);
      pintarBanco2(parametros());
      return;
    }
    var rc = ev.target.closest && ev.target.closest('[data-a-campo]');
    if (rc) { irACampo(rc.getAttribute('data-a-campo')); return; }
    var a = ev.target.closest && ev.target.closest('[data-ir]');
    if (!a || ev.metaKey || ev.ctrlKey) return;
    ev.preventDefault();
    ir(a.getAttribute('data-ir'));
  });
  window.addEventListener('popstate', pintar);

  cabecera();
  llamar('inscripcionesDatos').then(function (d) { datos = d; pintar(); }).catch(function (e) {
    var m = String((e && e.message) || '');
    raiz.innerHTML = '<p class="ins-aviso">' + esc(/^PUBLICO: esta página todavía no está abierta/.test(m) ? t('general.noAbierta') : mensaje(e)) + '</p>' +
      '<button class="ins-boton secundario" type="button" onclick="location.reload()">' + esc(t('general.reintentar')) + '</button>';
  });
})();
