/*
 * Casa Abuela en la app «Utilo DEV» (T0655): la web de la rama con datos inventados, nunca con el Sheet de la familia.
 *
 * La carga la página de DEV antes que nada (la pone delante herramientas/dev-ramas.js de utilo-apps, con su guarda: la
 * página no puede llamar fuera de su sitio y su localStorage va aparte). Hace de servidor dentro del navegador:
 *   - un Sheet inventado (dev/google-falso.js, el mismo de apps-script/probar.js), con fechas alrededor de hoy;
 *   - el apps-script/Código.js de la rama, ejecutado sobre ese Sheet: la web lo usa por window.MESA_PREVIEW, como si
 *     fuera la API de Apps Script.
 * Lo que se cambia se queda en este dispositivo (cada rama, lo suyo) hasta abrirla con #datos-nuevos.
 * Quién eres: la app DEV la abre con #abuela, #carmen… (las personas de utilo.json · dev) y aquí se elige esa persona.
 */
(function () {
  'use strict';
  var GUARDADO = 'casa-abuela-dev-hojas', VERSION = 2;  // 2: con parentescos (lo de antes se vuelve a inventar)
  var aqui = (document.currentScript && document.currentScript.src) || location.href;
  var CODIGO = new URL('../apps-script/C%C3%B3digo.js', aqui).href;
  var FALSO = new URL('google-falso.js', aqui).href;
  // Las personas que la app DEV puede pedir (#id) → su Id en PERSONAS.
  var PERSONAS = { abuela: '(A) - Abuela', carmen: '(T) - Carmen', luis: '(T+1) - Luis', pablo: '(N) - Pablo', rosa: '(O) - Rosa' };

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  // Lo que pide el enlace (#carmen, #datos-nuevos), antes de que lo lea la web (que usa # para sus vistas).
  var pide = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (pide === 'datos-nuevos') { ls(GUARDADO, null); }
  if (PERSONAS[pide]) { ls('mesa-abuela-yo', PERSONAS[pide]); ls('mesa-abuela-datos', null); }
  if (pide === 'datos-nuevos' || PERSONAS[pide]) history.replaceState(null, '', location.pathname + location.search);
  // Con la página ya abierta, cambiar la dirección a #datos-nuevos o #pablo no la recarga: se hace aquí.
  window.addEventListener('hashchange', function () {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h === 'datos-nuevos' || PERSONAS[h]) location.reload();
  });

  /* ---------- los datos inventados ---------- */

  function dia(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
  function ddmm(n) { var d = dia(n); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function iso(n) { var d = dia(n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  /** El Sheet de partida: una familia inventada, con lo que pasa de verdad (quien viene, quien no, fijos, un evento). */
  function inventar(G) {
    var h = G.hoja;
    var hojas = {
      PERSONAS: h('PERSONAS', [['Id', 'Apodo', 'Jerarquia', 'Familia', 'Cama', 'Menu', 'Alergias', 'Cumple'],
        ['', 'Abuela', 'Abuelos', 'Abuelos', 'Su cuarto', '🌕 Entero', '', '15/03'],
        ['', 'Carmen', 'Tios', 'Ruiz', '', '🌕 Entero', '', '02/07'],
        ['', 'Luis', 'Tios +1', 'Ruiz', '', '🌗 Medio', '', ddmm(5)],  // su cumpleaños, el día del evento
        ['', 'Pablo', 'Nietos', 'Ruiz', '', '🌕 Entero', 'Frutos secos', '09/01'],
        ['', 'Lucía', 'Nietos', 'Ruiz', '', '🌕 Entero', '', ''],
        ['', 'Elena', 'Tios', 'Soler', '', '🌕 Entero', 'Sin gluten', '30/04'],
        ['', 'Marcos', 'Nietos', 'Soler', '', '🌕 Entero', '', ''],
        ['', 'Rosa', 'Otros', 'Servicio', '', '🌕 Entero', '', '']]),
      MESA_APUNTES: h('MESA_APUNTES', [['ID_APUNTE', 'FECHA', 'TURNO', 'PERSONA_ID', 'CREADO_EN', 'NOTA', 'ESTADO', 'NOTA_POR', 'NOTA_EN', 'ACOMPANANTES']]),
      MESA_FIJOS: h('MESA_FIJOS', [['ID_FIJO', 'PERSONA_ID', 'DIA_SEMANA', 'TURNO', 'DESDE', 'HASTA', 'NOTA', 'CREADO_POR', 'CREADO_EN'],
        ['f1', '(T) - Carmen', 3, 'COMIDA', iso(-60), '', '', 'Carmen', ''],
        ['f2', '(O) - Rosa', 1, 'DORMIR', iso(-60), '', '', 'Carmen', ''],
        ['f3', '(O) - Rosa', 2, 'DORMIR', iso(-60), '', '', 'Carmen', '']]),
      MESA_CONFIG: h('MESA_CONFIG', [['CLAVE', 'VALOR'], ['FECHA_INICIO', iso(-60)], ['EXCLUIR_IDS', '(A) - Abuela'], ['ADMIN_IDS', '(T) - Carmen']]),
      MESA_DIAS: h('MESA_DIAS', [['FECHA']]), MESA_CAMBIOS: h('MESA_CAMBIOS', [['CUANDO', 'QUIEN_ID', 'QUIEN', 'CAMBIO']]),
      MESA_ALIAS: h('MESA_ALIAS', [['ID_ANTIGUO', 'ID_NUEVO', 'NOTA']]),
    };
    // Los apuntes: de hace dos semanas a dentro de dos, unos sí y otros no (siempre los mismos para el mismo día).
    var quien = ['(T) - Carmen', '(T+1) - Luis', '(N) - Pablo', '(N) - Lucía', '(T) - Elena', '(N) - Marcos'], k = 0;
    for (var n = -14; n <= 14; n++) {
      quien.forEach(function (p, i) {
        var s = (n * 7 + i * 13 + 100) % 10;
        if (s < 3) hojas.MESA_APUNTES.filas.push(['a' + (++k), iso(n), 'COMIDA', p, iso(n - 2) + 'T10:00:00', '', '', '', '', '']);
        else if (s === 4) hojas.MESA_APUNTES.filas.push(['a' + (++k), iso(n), 'CENA', p, iso(n - 2) + 'T10:00:00', '', '', '', '', i === 0 ? 1 : '']);  // Carmen, con uno más
      });
    }
    // Pablo cena mañana y avisa de que llega tarde; Carmen no viene el próximo miércoles, el día de su comida fija.
    hojas.MESA_APUNTES.filas.push(['n1', iso(1), 'CENA', '(N) - Pablo', iso(0) + 'T09:00:00', 'Llego tarde', '', 'Pablo', iso(0) + 'T09:00:00', '']);
    for (var m = 1; m <= 7; m++) if (dia(m).getDay() === 3) { hojas.MESA_APUNTES.filas.push(['n2', iso(m), 'COMIDA', '(T) - Carmen', iso(0) + 'T09:00:00', '', 'NO', '', '', '']); break; }
    return hojas;
  }

  /** La columna A de PERSONAS es una fórmula: «(» + inicial de la jerarquía + «+1» si la lleva + «) - » + apodo. */
  function formula(hojas) {
    hojas.PERSONAS.formula = function () {
      hojas.PERSONAS.filas.slice(1).forEach(function (f) { if (f[1]) f[0] = '(' + String(f[2]).charAt(0) + (String(f[2]).indexOf('+1') !== -1 ? '+1' : '') + ') - ' + f[1]; });
    };
    hojas.PERSONAS.formula();
  }

  function guardar(hojas) {
    var o = {};
    Object.keys(hojas).forEach(function (n) { o[n] = hojas[n].filas; });
    ls(GUARDADO, JSON.stringify({ version: VERSION, hojas: o }));
  }
  function recuperar(G) {
    try {
      var g = JSON.parse(ls(GUARDADO) || 'null');
      if (!g || g.version !== VERSION) return null;
      var hojas = {};
      Object.keys(g.hojas).forEach(function (n) { hojas[n] = G.hoja(n, g.hojas[n]); });
      return hojas;
    } catch (e) { return null; }
  }

  /* ---------- el servidor ---------- */

  function cargar(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('No encuentro ' + url + ' (' + r.status + ').'); return r.text(); });
  }

  var listo = null;
  function arrancar() {
    if (listo) return listo;
    listo = Promise.all([cargar(FALSO), cargar(CODIGO)]).then(function (t) {
      var modulo = { exports: {} };
      // eslint-disable-next-line no-new-func
      new Function('module', 'self', t[0])(modulo, {});
      var G = modulo.exports;
      var nuevas = false, hojas = recuperar(G);
      if (!hojas) { hojas = inventar(G); nuevas = true; }
      formula(hojas);
      var api = G.ejecutar(t[1], G.contexto({ hojas: hojas }), ['api_']).api_;
      var llamar = function (fn, args) {
        var r = api(fn, args || [], '');
        if (!r || !r.ok) throw new Error((r && r.error) || 'Error del servidor de DEV.');
        return r.r;
      };
      if (nuevas) {
        // Con la API de la rama, como lo haría alguien desde la web: quién es quién, un evento de un día y una excursión.
        var V = { desde: iso(-7), hasta: iso(14), yo: '(T) - Carmen' };
        try {
          [['(A) - Abuela', { sexo: 'Mujer' }], ['(T+1) - Luis', { sexo: 'Hombre' }],
            ['(T) - Carmen', { sexo: 'Mujer', hijoDe: '(A) - Abuela', pareja: '(T+1) - Luis', casados: 'Sí' }],
            ['(T) - Elena', { sexo: 'Mujer', hijoDe: '(A) - Abuela' }], ['(N) - Pablo', { sexo: 'Hombre', hijoDe: '(T) - Carmen' }],
            ['(N) - Lucía', { sexo: 'Mujer', hijoDe: '(T) - Carmen' }], ['(N) - Marcos', { sexo: 'Hombre', hijoDe: '(T) - Elena' }],
            ['(O) - Rosa', { sexo: 'Mujer' }]].forEach(function (x) { llamar('guardarPersona', [x[0], x[1], '(T) - Carmen', V]); });
          llamar('guardarDia', [iso(5), { evento: 'Cumpleaños de Luis', eventoTurno: 'CENA', eventoTexto: 'Cada uno trae algo de postre' }, '(T) - Carmen', V]);
          var d = llamar('guardarEvento', [{ nombre: 'Excursión a la sierra', desde: iso(12), hasta: iso(13), cuando: 'DIA', texto: 'Salimos a las 9' }, '(T) - Carmen', V]);
          var ev = (d.eventos || []).filter(function (e) { return e.nombre === 'Excursión a la sierra'; })[0];
          if (ev) {
            llamar('apuntarEvento', [ev.id, '(T) - Carmen', true, '(T) - Carmen', V]);
            llamar('apuntarEvento', [ev.id, '(N) - Pablo', true, '(T) - Carmen', V]);
            llamar('apuntarEvento', [ev.id, '(T) - Elena', false, '(T) - Carmen', V]);
          }
        } catch (e) { console.warn('[DEV] No se han podido inventar los eventos:', e.message); }
      }
      guardar(hojas);
      return { llamar: llamar, hojas: hojas };
    });
    return listo;
  }

  window.MESA_PREVIEW = {
    dev: true,
    llamar: function (fn, args, clave) {
      return arrancar().then(function (s) {
        // Un poco de espera, como la API de verdad: así se ven los «Cargando…» y los botones ocupados.
        return new Promise(function (ok) { setTimeout(ok, 150); }).then(function () {
          var r = s.llamar(fn, args);
          guardar(s.hojas);
          return r;
        });
      });
    }
  };
})();
