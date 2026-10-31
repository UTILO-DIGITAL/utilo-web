/*
 * Sección Ajustes base del núcleo · UTILO_CORE 5.0 (T0292) · motor/modulos/ajustes de utilo-apps
 *
 * La configuración que se toca pocas veces al año, igual para todos los negocios y sin una pantalla por tabla: cada
 * cliente dice en su config.json (nucleo.secciones.ajustes.config.BLOQUES) qué tablas entran, en bloques con su título,
 * y de cada una qué columnas se ven y cuáles se editan. La lista y la ficha salen de su YAML, que montar.js manda en
 * config._tablas: tipo de cada columna, listas como desplegable, refs como desplegable con el nombre (no el ID),
 * obligatorias y unicas. Todo va por las tablas al momento (ctx.tablas): se ve al tocar «Guardar» y el motor lo escribe
 * por detrás, con su línea en el LOG; si dice que no, vuelve a como estaba y avisa.
 *
 *   Inicio   los bloques con sus tablas (cuántas filas tiene cada una) y las acciones del cliente.
 *   Tabla    lista con buscador, filtro por periodo (si la tabla llega a él por sus refs) y las dadas de baja aparte;
 *            «Añadir» abre una ficha vacía.
 *   Ficha    los campos que se editan, lo demás de solo lectura, sus tablas hijas (con su lista y su «Añadir»), el
 *            historial (LOG) y la baja: desactivar (ACTIVO o un ESTADO de baja, que se puede deshacer) o borrar, que solo
 *            se ofrece si ninguna fila de las tablas cargadas la usa (el motor lo vuelve a mirar en todas).
 *   Acción   el JS del cliente (ACCIONES), que se registra con UN.ajustes('ID', { abrir(el, ctx), cerrar() }) y
 *            recibe el ctx de la sección más volver() y raiz (la carpeta de la web).
 * Quien está en SOLO_LEER lo ve todo sin botones de cambiar (el motor tampoco le deja: soloLeer en los permisos).
 * Personalización y claves de cada tabla: docs/SECCION_AJUSTES.md.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  // Palabras de los nombres de columna y de tabla que se escriben con tilde o en mayúsculas.
  var PALABRAS = { competicion: 'competición', competiciones: 'competiciones', dia: 'día', abreviacion: 'abreviación', descripcion: 'descripción',
    ubicacion: 'ubicación', telefono: 'teléfono', numero: 'número', num: 'nº', codigo: 'código', instalacion: 'instalación', area: 'área',
    epica: 'épica', epicas: 'épicas', categoria: 'categoría', categorias: 'categorías', direccion: 'dirección', arbitro: 'árbitro',
    gestion: 'gestión', catalogo: 'catálogo', que: 'qué', url: 'URL', iva: 'IVA', hex: 'HEX', id: 'ID', email: 'email' };
  /** «ID_TEMPORADA» → «Temporada»; «DIA_SEMANA» → «Día semana»; «CATEGORIAS» → «Categorías». */
  function titulo(n) {
    if (n === 'ID') return 'Código'; // la clave que se escribe a mano (las épicas: LIG, COP…); con prefijo ni se ve
    var t = String(n || '').replace(/^ID_(?=.)/, '').toLowerCase().split('_').map(function (p) { return PALABRAS[p] || p; }).join(' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function tituloTabla(spec) { return spec.titulo || titulo(spec.tabla); }
  function etiqueta(spec, c) { return (spec && spec.titulos && spec.titulos[c]) || titulo(c); }
  function colDe(e, n) { for (var i = 0; i < e.columnas.length; i++) if (e.columnas[i].n === n) return e.columnas[i]; return null; }
  function vacio(v) { return v === '' || v === null || v === undefined; }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }

  /** ¿Está dada de baja? (la fila tiene lo que pone la baja: ACTIVO = false, ESTADO = Cerrada…) */
  function deBaja(spec, f) {
    var c = spec && spec.baja && spec.baja.cambios;
    if (!c || !f) return false;
    return Object.keys(c).every(function (k) { return String(f[k]) === String(c[k]); });
  }
  /** Una fila de una tabla que no es de Ajustes está apagada si tiene ACTIVO = false (para no ofrecerla en un desplegable). */
  function apagada(f) { return !!f && f.ACTIVO === false; }

  /**
   * El periodo de una fila siguiendo su camino de refs (["ID_COMPETICION", "ID_TEMPORADA"]): fila(tabla, id) da la fila
   * de cada tabla por la que pasa. '' si se corta.
   */
  function periodoDe(E, t, f, camino, fila) {
    var x = f;
    for (var i = 0; i < camino.length; i++) {
      var v = x ? x[camino[i]] : '';
      if (vacio(v)) return '';
      if (i === camino.length - 1) return String(v);
      var c = colDe(E[t], camino[i]);
      if (!c || !c.ref) return '';
      t = c.ref; x = fila(t, v);
    }
    return '';
  }

  /** Los periodos, del más reciente al más antiguo (FECHA_INICIO; si no, como vienen): [{ id, nombre, desde, hasta }]. */
  function periodos(E, t, filas) {
    var e = E[t];
    return filas.map(function (f) { return { id: String(f[e.clave]), nombre: String(f[e.nombre] || f[e.clave]), desde: String(f.FECHA_INICIO || ''), hasta: String(f.FECHA_FIN || '') }; })
      .sort(function (a, b) { return a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : 0; });
  }
  /** El periodo de hoy (hoy 'aaaa-mm-dd'): el que lo contiene; si no, el último que ya ha empezado; si no, el primero. */
  function periodoActual(lista, hoy) {
    var dentro = lista.filter(function (p) { return p.desde && p.desde <= hoy && (!p.hasta || p.hasta >= hoy); })[0];
    return dentro || lista.filter(function (p) { return p.desde && p.desde <= hoy; })[0] || lista[0] || null;
  }

  /** Texto de una celda para la lista y la ficha: refs con su nombre, fechas como dd/mm/aaaa, importes con €. */
  function verValor(c, v, nombreRef) {
    if (vacio(v)) return '';
    if (c.tipo === 'ref') return nombreRef(c.ref, v);
    if (c.tipo === 'booleano') return v === true ? 'Sí' : v === false ? 'No' : String(v);
    if (c.tipo === 'fecha') return /^\d{4}-\d\d-\d\d$/.test(v) ? v.split('-').reverse().join('/') : String(v);
    if (c.tipo === 'fecha_hora') { var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d:\d\d)$/.exec(v); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] : String(v); }
    if (c.tipo === 'importe') { var n = Number(v); return isFinite(n) ? n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €' : String(v); }
    if (c.tipo === 'numero') return String(v).replace('.', ',');
    return String(v);
  }

  /** Un punto del color si el valor es un color (#rrggbb: COLOR_HEX, ESTAMPADO…), o ''. */
  function muestra(v) {
    return /^#[0-9a-f]{6}$/i.test(String(v == null ? '' : v).trim()) ? '<i class="aj-color" style="background:' + String(v).trim() + '" aria-hidden="true"></i>' : '';
  }

  /** Lo escrito en un campo → el valor para la capa de tablas ('' vacío). Un número mal escrito se deja tal cual (lo dice problemas). */
  function leerValor(c, crudo) {
    if (c.tipo === 'booleano') return crudo === true;
    var s = String(crudo == null ? '' : crudo).trim();
    if (s === '') return '';
    if (c.tipo === 'numero' || c.tipo === 'importe') {
      var n = Number(s.replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      return isFinite(n) ? n : s;
    }
    return s;
  }

  /**
   * Lo que falta o está mal antes de guardar (lo mismo vuelve a mirar el motor): obligatorias, números, fechas y que no se
   * repita una columna única (unicas del YAML) con otra fila. v: los valores de la ficha; id: el de la fila ('' si es nueva).
   */
  function problemas(E, t, spec, v, filas, id) {
    var e = E[t], mal = [];
    Object.keys(v).forEach(function (n) {
      var c = colDe(e, n), x = v[n];
      if (!c) return;
      var et = etiqueta(spec, n);
      if (vacio(x)) { if (c.ob && !(n === e.clave && e.prefijo)) mal.push('Falta ' + et.toLowerCase() + '.'); return; }
      if ((c.tipo === 'numero' || c.tipo === 'importe') && typeof x !== 'number') mal.push(et + ': «' + x + '» no es un número.');
      if (c.tipo === 'fecha' && !/^\d{4}-\d\d-\d\d$/.test(x)) mal.push(et + ': no es una fecha.');
      if (c.tipo === 'hora' && !/^\d\d:\d\d$/.test(x)) mal.push(et + ': no es una hora (hh:mm).');
      if (c.tipo === 'lista' && (c.valores || []).indexOf(x) < 0) mal.push(et + ': «' + x + '» no está en la lista.');
    });
    if (!id && !e.prefijo && !vacio(v[e.clave]) && filas.some(function (f) { return String(f[e.clave]) === String(v[e.clave]); })) {
      mal.push('Ya hay una fila con ' + etiqueta(spec, e.clave).toLowerCase() + ' ' + v[e.clave] + '.');
    }
    (e.unicas || []).forEach(function (g) {
      var vals = g.map(function (n) { return n in v ? v[n] : ''; });
      if (vals.some(vacio)) return;
      var otra = filas.filter(function (f) {
        return String(f[e.clave]) !== String(id || '') && !f._nueva && g.every(function (n, i) { return norm(f[n]) === norm(vals[i]); });
      })[0];
      if (otra) mal.push(g.length === 1 ? etiqueta(spec, g[0]) + ': ya hay otra con «' + vals[0] + '».' :
        g.map(function (n, i) { return i ? etiqueta(spec, n).toLowerCase() : etiqueta(spec, n); }).join(' y ') + ': ya hay otra con los mismos.');
    });
    return mal;
  }

  var NOTAS = ['NOTAS', 'NOTA', 'DESCRIPCION', 'CONDICIONES'];
  /** Los textos de las columnas de notas de una fila que no se ven ya en la lista, recortados a 160 caracteres. */
  function notasDe(e, spec, f) {
    return NOTAS.filter(function (n) { var c = colDe(e, n); return c && c.tipo === 'texto' && spec.ver.indexOf(n) < 0 && !vacio(f[n]); })
      .map(function (n) { var x = String(f[n]).replace(/\s+/g, ' ').trim(); return x.length > 160 ? x.slice(0, 159) + '…' : x; });
  }

  /** 'hh:mm' → minutos desde las 00:00; fin: '00:00' es medianoche del final del día (24:00). null si no es una hora. */
  function minutos(h, fin) {
    var m = /^(\d\d):(\d\d)$/.exec(String(h == null ? '' : h));
    if (!m) return null;
    var x = Number(m[1]) * 60 + Number(m[2]);
    return fin && x === 0 ? 1440 : x;
  }
  /**
   * Inicio y fin (minutos) de una fila según su regla de solapes: { desde, hasta (columna) o minutos }. minutos es un número
   * o «REF.COLUMNA» (lo de cada liga): entonces lo da dura(fila). Sin duración, null (no se comprueba).
   */
  function tramo(regla, f, dura) {
    var a = minutos(f[regla.desde]);
    if (a === null) return null;
    var d = regla.hasta ? null : typeof regla.minutos === 'number' ? regla.minutos : dura ? Number(dura(f)) : NaN;
    var b = regla.hasta ? minutos(f[regla.hasta], true) : (d > 0 ? a + d : null);
    return b === null ? null : [a, b];
  }
  /**
   * T0292 · Las filas con las que choca v según la regla de solapes de su tabla: mismo grupo (campo y día), mismo periodo
   * si porPeriodo (perDe(fila) da el de cada una) y horas que se pisan. Sin contar la propia (id), las nuevas sin guardar
   * ni las dadas de baja. Devuelve { mal: 'texto' } si la hora de fin no es después de la de inicio.
   */
  function choques(regla, e, spec, v, filas, id, perDe, dura) {
    if (!regla) return [];
    var r = tramo(regla, v, dura);
    if (!r) return [];
    if (r[1] <= r[0]) return { mal: 'La hora de fin tiene que ser después de la de inicio.' };
    var p = regla.porPeriodo && perDe ? perDe(v) : '';
    return filas.filter(function (f) {
      if (String(f[e.clave]) === String(id || '') || f._nueva || deBaja(spec, f)) return false;
      if (!regla.grupo.every(function (c) { return String(f[c]) === String(v[c]); })) return false;
      if (p && perDe(f) !== p) return false;
      var x = tramo(regla, f, dura);
      return !!x && x[0] < r[1] && r[0] < x[1];
    });
  }

  /** Las columnas que han cambiado: { COLUMNA: nuevo }. */
  function cambios(f, v) {
    var c = {};
    Object.keys(v).forEach(function (k) { if (String(f[k] == null ? '' : f[k]) !== String(v[k] == null ? '' : v[k])) c[k] = v[k]; });
    return c;
  }

  /** Quién usa esa fila en las tablas cargadas: [{ tabla, col, filas }] (para no ofrecer borrarla). */
  function usos(E, t, id, filasDe) {
    var out = [];
    Object.keys(E).forEach(function (t2) {
      E[t2].columnas.forEach(function (c) {
        if (c.tipo !== 'ref' || c.ref !== t) return;
        var fs = filasDe(t2).filter(function (f) { return String(f[c.n]) === String(id); });
        if (fs.length) out.push({ tabla: t2, col: c.n, filas: fs });
      });
    });
    return out;
  }

  /** Filas de la lista de una tabla: por periodo, por texto (en las columnas que se ven) y sin las dadas de baja si no se piden. */
  function filtrar(filas, o) {
    var q = norm(o.q);
    return filas.filter(function (f) {
      if (!o.bajas && deBaja(o.spec, f)) return false;
      if (o.per && o.periodo && o.periodo(f) !== o.per) return false;
      if (q && !o.textos(f).some(function (s) { return norm(s).indexOf(q) >= 0; })) return false;
      return true;
    });
  }

  var CALC = { muestra: muestra, titulo: titulo, tituloTabla: tituloTabla, etiqueta: etiqueta, deBaja: deBaja, apagada: apagada, periodoDe: periodoDe, periodos: periodos, periodoActual: periodoActual,
    verValor: verValor, leerValor: leerValor, problemas: problemas, minutos: minutos, choques: choques, notasDe: notasDe, cambios: cambios, usos: usos, filtrar: filtrar };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  // La carpeta de la web (de donde se cargan las acciones del cliente): la de este JS sin nucleo/secciones/.
  var RAIZ = String((document.currentScript && document.currentScript.src) || '').replace(/nucleo\/secciones\/ajustes\.js.*$/, '');
  var ACC = {}, cargas = {};
  /** Las acciones del cliente se registran así: UN.ajustes('TEMPORADA', { abrir: function (el, ctx) {}, cerrar: function () {} }). */
  window.UN.ajustes = function (id, def) { ACC[String(id).toUpperCase()] = def; };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opciones(lista, sel, vacia) {
    return (vacia !== undefined ? '<option value="">' + texto(vacia) + '</option>' : '') + lista.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  var LARGO = /NOTAS|DESCRIPCION|OBSERVACIONES|TEXTO|MOTIVO|MENSAJE|DIRECCION/;

  function cargarAccion(a) {
    if (ACC[a.id]) return Promise.resolve(ACC[a.id]);
    if (cargas[a.id]) return cargas[a.id];
    cargas[a.id] = new Promise(function (ok, ko) {
      var sc = document.createElement('script');
      sc.src = RAIZ + a.web + '?v=' + encodeURIComponent(a.v || '1');
      sc.onload = function () { if (ACC[a.id]) ok(ACC[a.id]); else ko(new Error('La acción ' + a.id + ' no se ha registrado.')); };
      sc.onerror = function () { delete cargas[a.id]; ko(new Error('No se ha podido cargar la acción.')); };
      document.head.appendChild(sc);
    });
    return cargas[a.id];
  }

  var abiertaAccion = null, abiertaDef = null, teclaEsc = null;

  window.UN.registrar('AJUSTES', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {}, E = cfg._tablas || {}, B = cfg.BLOQUES || [], A = cfg.ACCIONES || [];
      var P = String(cfg.PERIODO || ''), nomPer = String(cfg.NOMBRE_PERIODO || 'Periodo');
      var puede = ctx.admin || (cfg.SOLO_LEER || []).indexOf(ctx.perfil) < 0;
      var CLAVE = 'aj_' + ctx.id + '_';
      var S = { vista: guardado(CLAVE + 'vista'), per: guardado(CLAVE + 'per'), q: '', bajas: false, leido: false };
      var nombres = Object.keys(E);

      el.innerHTML = '<div id="aj-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="aj-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="aj-vt"><div class="n-ventana" id="aj-vent"></div></div></div>';
      var cont = el.querySelector('#aj-cont'), velo = el.querySelector('#aj-velo'), vent = el.querySelector('#aj-vent');

      /* ---------- datos ---------- */

      var ix = {};
      function filas(t) { return T.filas(t) || []; }
      function fila(t, id) {
        if (!ix[t]) { ix[t] = {}; var k = E[t] ? E[t].clave : 'ID'; filas(t).forEach(function (f) { ix[t][String(f[k])] = f; }); }
        return ix[t][String(id)] || null;
      }
      /**
       * Nombre de una fila: su columna de nombre o, si la tabla no tiene, el de sus primeras refs («2026-2027 · Bar»).
       * sin: una tabla cuyas refs no se nombran (en la ficha de una temporada, sus campos son «Bar», no «2026-2027 · Bar»).
       */
      function nombreFila(t, f, hondo, sin) {
        var e = E[t];
        if (!e || !f) return '';
        var n = e.nombre !== e.clave ? f[e.nombre] : '';
        // Dos niveles como mucho: una franja es la de «2026-2027 · Jaula», que es la de su campo de la temporada.
        if (vacio(n) && (hondo || 0) < 2) {
          n = e.columnas.filter(function (c) { return c.tipo === 'ref' && E[c.ref] && c.ref !== sin && !vacio(f[c.n]); }).slice(0, 2)
            .map(function (c) { return nombreFila(c.ref, fila(c.ref, f[c.n]), (hondo || 0) + 1) || f[c.n]; }).join(' · ');
        }
        return String(vacio(n) ? f[e.clave] : n);
      }
      function nombreRef(t, id) { var f = fila(t, id); return f ? nombreFila(t, f) : String(id); }
      /** La tabla de la vista guardada: «b.t» (bloque y tabla), «A:ID» (una acción) o '' (inicio). */
      function specDe(v) { var m = /^(\d+)\.(\d+)$/.exec(v || ''); return m && B[+m[1]] && B[+m[1]].tablas[+m[2]] ? B[+m[1]].tablas[+m[2]] : null; }
      var listaPer = [], perAhora = null;
      function preparar() {
        ix = {};
        if (P && E[P]) {
          listaPer = periodos(E, P, filas(P));
          perAhora = periodoActual(listaPer, hoy());
          if (S.per !== '-' && !listaPer.some(function (p) { return p.id === S.per; })) S.per = perAhora ? perAhora.id : '';
        }
      }
      function vista(v) { S.vista = v; S.q = ''; S.bajas = false; guardado(CLAVE + 'vista', v); pintar(); window.scrollTo(0, 0); }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        var a = /^A:(.+)$/.exec(S.vista || '');
        if (a && A.some(function (x) { return x.id === a[1]; })) { if (abiertaAccion !== a[1]) pintarAccion(A.filter(function (x) { return x.id === a[1]; })[0]); return; }
        var spec = specDe(S.vista), modo = spec ? modoDe(spec) : '';
        // T0292: una tabla con vistas (el cuadrante, el calendario) enseña la elegida; si ya está abierta, no se toca.
        if (spec && modo !== 'LISTA') {
          var vv = spec.vistas.filter(function (x) { return x.id === modo; })[0];
          if (abiertaAccion !== 'V:' + spec.tabla + ':' + modo) pintarVista(spec, vv);
          return;
        }
        cerrarAccion();
        if (spec) pintarTabla(spec); else pintarInicio();
      }
      /** La vista elegida de una tabla (la última que se usó; si no, la primera) o 'LISTA'. */
      function modoDe(spec) {
        if (!spec.vistas || !spec.vistas.length) return 'LISTA';
        var g = guardado(CLAVE + 'modo_' + spec.tabla);
        return g === 'LISTA' || spec.vistas.some(function (x) { return x.id === g; }) ? g : spec.vistas[0].id;
      }
      function pestanasModo(spec) {
        if (!spec.vistas || !spec.vistas.length) return '';
        var m = modoDe(spec);
        return '<div class="u-pestanas aj-modos" role="tablist">' + spec.vistas.concat([{ id: 'LISTA', titulo: 'Lista' }]).map(function (x) {
          return '<button type="button" role="tab" data-modo="' + texto(x.id) + '" aria-selected="' + (x.id === m) + '">' + texto(x.titulo) + '</button>';
        }).join('') + '</div>';
      }

      function botonAccion(a) {
        return '<button type="button" class="aj-tabla aj-accion" data-accion="' + texto(a.id) + '"><strong>' + texto(a.titulo) + ' ›</strong>' +
          (a.texto ? '<small>' + texto(a.texto) + '</small>' : '') + '</button>';
      }
      function pintarInicio() {
        ctx.ponerTitulo(ctx.titulo);
        if (!B.length && !A.length) {
          cont.innerHTML = '<p class="u-vacio">Todavía no hay nada que configurar aquí. Quien administra la app dice qué tablas entran en Ajustes (config.json · nucleo.secciones.ajustes).</p>';
          return;
        }
        var sueltas = A.filter(function (a) { return !a.bloque; });
        cont.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
          (!puede ? '<p class="u-aviso">Puedes mirarlo todo, pero no cambiar nada.</p>' : '') +
          (sueltas.length ? '<div class="aj-lista">' + sueltas.map(botonAccion).join('') + '</div>' : '') +
          B.map(function (b, i) {
            var acc = A.filter(function (a) { return a.bloque === b.titulo; });
            return '<section class="aj-bloque"><h2 class="n-grupo">' + texto(b.titulo) + '</h2>' + (b.texto ? '<p class="u-nota">' + texto(b.texto) + '</p>' : '') +
              '<div class="aj-lista">' + b.tablas.map(function (t, j) {
                var fs = filas(t.tabla), activas = fs.filter(function (f) { return !deBaja(t, f); }).length;
                return '<button type="button" class="aj-tabla" data-vista="' + i + '.' + j + '"><strong>' + texto(tituloTabla(t)) + ' <span class="u-cifra">' + activas + '</span></strong>' +
                  (t.texto ? '<small>' + texto(t.texto) + '</small>' : '') + '</button>';
              }).join('') + acc.map(botonAccion).join('') + '</div></section>';
          }).join('');
      }

      function textosFila(t, spec, f) {
        return spec.ver.map(function (c) { var col = colDe(E[t], c); return col ? verValor(col, f[c], nombreRef) : ''; }).concat([nombreFila(t, f), String(f[E[t].clave])], notasDe(E[t], spec, f));
      }
      function ordenar(t, spec, fs) {
        var o = spec.orden ? String(spec.orden).replace(/^-/, '') : '', des = /^-/.test(spec.orden || '') ? -1 : 1;
        return fs.slice().sort(function (a, b) {
          var x = o ? a[o] : nombreFila(t, a), y = o ? b[o] : nombreFila(t, b);
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * des;
          return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'es', { numeric: true }) * des;
        });
      }
      function celdas(t, spec, f) {
        return spec.ver.map(function (c, i) {
          var col = colDe(E[t], c), v = col ? verValor(col, f[c], nombreRef) : '';
          if (i === 0 && c === E[t].clave && E[t].nombre === E[t].clave) v = nombreFila(t, f);
          var num = col && (col.tipo === 'numero' || col.tipo === 'importe');
          var enlace = col && col.tipo === 'texto' && /^https?:\/\//.test(String(v));
          return '<td' + (num ? ' class="num"' : i === 0 ? ' class="u-tabla-t"' : '') + '>' + (col && col.tipo !== 'ref' ? muestra(f[c]) : '') +
            (enlace ? '<a href="' + texto(v) + '" target="_blank" rel="noopener" data-enlace>Abrir ↗</a>' : texto(v)) +
            (i === 0 && deBaja(spec, f) ? ' <span class="u-chip">De baja</span>' : '') + (i === 0 && f._pendiente ? ' <span class="u-nota">Guardando…</span>' : '') +
            (i === 0 ? notasHtml(t, spec, f) : '') + '</td>';
        }).join('');
      }
      /** Las notas de una fila (NOTAS, NOTA, DESCRIPCION o CONDICIONES que no están ya en la lista), debajo de su nombre. */
      function notasHtml(t, spec, f) {
        var ns = notasDe(E[t], spec, f);
        return ns.length ? '<span class="u-nota aj-notas">' + texto(ns.join(' · ')) + '</span>' : '';
      }
      /** La lista de una tabla. mas (opcional): una columna más al final, { titulo, valor(fila) } (la temporada, si se ven todas). */
      function tablaHtml(t, spec, fs, attr, mas) {
        return '<div class="u-tabla-caja"><table class="u-tabla"><thead><tr>' + spec.ver.map(function (c) {
          var col = colDe(E[t], c);
          return '<th' + (col && (col.tipo === 'numero' || col.tipo === 'importe') ? ' class="num"' : '') + '>' + texto(etiqueta(spec, c)) + '</th>';
        }).join('') + (mas ? '<th>' + texto(mas.titulo) + '</th>' : '') + '</tr></thead><tbody>' + fs.map(function (f) {
          return '<tr tabindex="0" ' + attr + '="' + texto(f[E[t].clave]) + '">' + celdas(t, spec, f) + (mas ? '<td>' + texto(mas.valor(f)) + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
      }

      function pintarTabla(spec) {
        var t = spec.tabla, todas = filas(t);
        ctx.ponerTitulo(tituloTabla(spec));
        var conPer = P && spec.periodo && listaPer.length;
        var perDe = conPer ? function (f) { return periodoDe(E, t, f, spec.periodo, fila); } : null;
        var nBajas = todas.filter(function (f) { return deBaja(spec, f); }).length;
        var fs = ordenar(t, spec, filtrar(todas, { spec: spec, q: S.q, bajas: S.bajas, per: conPer && S.per !== '-' ? S.per : '', periodo: perDe, textos: function (f) { return textosFila(t, spec, f); } }));
        cont.innerHTML = '<p><button type="button" class="u-btn u-btn-texto" data-vista="">‹ ' + texto(ctx.titulo) + '</button></p>' +
          (spec.texto ? '<p class="u-nota n-ayuda">' + texto(spec.texto) + '</p>' : '') + pestanasModo(spec) +
          '<div class="u-filtros">' +
          '<label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" id="aj-q" value="' + texto(S.q) + '" placeholder="Escribe para buscar"></label>' +
          (conPer ? '<label class="u-campo"><span class="u-etiqueta">' + texto(nomPer) + '</span><select id="aj-per">' +
            opciones([['-', 'Todas']].concat(listaPer.map(function (p) { return [p.id, p.nombre]; })), S.per) + '</select></label>' : '') +
          (nBajas ? '<label class="u-check"><input type="checkbox" id="aj-bajas"' + (S.bajas ? ' checked' : '') + '> Ver también las de baja (' + nBajas + ')</label>' : '') +
          (spec.crear && puede ? '<button type="button" class="u-btn u-btn-accion" data-nueva>Añadir</button>' : '') +
          '</div>' +
          // Con todas las temporadas a la vez, cada fila dice de cuál es (LIGA o COPA LIGA hay una en cada una).
          (fs.length ? tablaHtml(t, spec, fs, 'data-fila', conPer && S.per === '-' ? { titulo: nomPer, valor: function (f) { var p = perDe(f); return p ? nombreRef(P, p) : ''; } } : null) + '<p class="u-nota">' + fs.length + (fs.length === 1 ? ' fila' : ' filas') + '</p>' :
            '<p class="u-vacio">' + (todas.length ? 'No hay nada con estos filtros.' : 'Todavía no hay nada.' + (spec.crear && puede ? ' Usa «Añadir».' : '')) + '</p>');
        var q = cont.querySelector('#aj-q');
        q.addEventListener('input', function () {
          S.q = q.value; var pos = q.selectionStart;
          pintar(); var q2 = cont.querySelector('#aj-q'); q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {}
        });
        var sp = cont.querySelector('#aj-per');
        if (sp) sp.onchange = function () { S.per = sp.value; guardado(CLAVE + 'per', S.per); pintar(); };
        var sb = cont.querySelector('#aj-bajas');
        if (sb) sb.onchange = function () { S.bajas = sb.checked; pintar(); };
        cont.dataset.tabla = t;
      }

      /* ---------- acciones del cliente ---------- */

      function pintarAccion(a) {
        cerrarAccion();
        ctx.ponerTitulo(a.titulo);
        cont.innerHTML = '<p><button type="button" class="u-btn u-btn-texto" data-vista="">‹ ' + texto(ctx.titulo) + '</button></p><div id="aj-accion"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>';
        abrirJs(a, a.id, {});
      }
      /** Una vista de una tabla: como una acción, pero debajo de las pestañas de la tabla (y recibe su tabla). */
      function pintarVista(spec, vv) {
        cerrarAccion();
        ctx.ponerTitulo(tituloTabla(spec));
        cont.innerHTML = '<p><button type="button" class="u-btn u-btn-texto" data-vista="">‹ ' + texto(ctx.titulo) + '</button></p>' +
          (spec.texto ? '<p class="u-nota n-ayuda">' + texto(spec.texto) + '</p>' : '') + pestanasModo(spec) +
          '<div id="aj-accion"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>';
        abrirJs(vv, 'V:' + spec.tabla + ':' + vv.id, { tabla: spec.tabla });
      }
      /** Carga el JS de una acción o una vista y lo abre en #aj-accion. clave: la de lo abierto (para no abrirlo dos veces). */
      function abrirJs(a, clave, mas) {
        abiertaAccion = clave;
        cargarAccion(a).then(function (def) {
          var caja = cont.querySelector('#aj-accion');
          if (!caja || abiertaAccion !== clave || !ctx.abierta()) return;
          caja.innerHTML = '';
          abiertaDef = def;
          def.abrir(caja, Object.assign({}, ctx, mas, { accion: a, raiz: RAIZ, soloLeer: !puede, volver: function () { vista(''); }, ajustes: paraAccion() }));
        }, function (e) {
          var caja = cont.querySelector('#aj-accion');
          if (caja) caja.innerHTML = '<p class="u-error">' + texto(e.message) + '</p><p class="u-nota">Comprueba la conexión y vuelve a abrirla.</p>';
        });
      }
      /**
       * Lo que una acción puede usar de Ajustes (ctx.ajustes): abrir la ficha de una fila o una nueva con valores de partida
       * (las de las tablas de los bloques, con sus reglas), el periodo que se está mirando y los nombres de las filas.
       */
      function paraAccion() {
        return {
          ficha: function (t, id) { var sp = specDeTabla(t); if (!sp) return false; pila = []; ficha(sp, String(id)); return true; },
          nueva: function (t, valores) { var sp = specDeTabla(t); if (!sp || !sp.crear || !puede) return false; pila = []; ficha(sp, '', null, valores || {}); return true; },
          puede: function (t) { var sp = specDeTabla(t); return !!(sp && sp.crear && puede); },
          periodo: function () { return S.per && S.per !== '-' ? S.per : (perAhora ? perAhora.id : ''); },
          ponerPeriodo: function (p) { S.per = p; guardado(CLAVE + 'per', p); },
          periodos: function () { return listaPer.slice(); },
          nombre: function (t, id) { return nombreRef(t, id); },
          periodoDe: function (t, f) { var sp = specDeTabla(t); return sp && sp.periodo ? periodoDe(E, t, f, sp.periodo, fila) : ''; },
          solapes: function (t) { var sp = specDeTabla(t); return sp && sp.solapes ? sp.solapes : null; },
          // Lo que dura una fila según su regla de solapes (un número fijo o lo de la fila a la que apunta), o 0.
          dura: function (t, f) { var sp = specDeTabla(t), r = sp && sp.solapes; if (!r) return 0; if (typeof r.minutos === 'number') return r.minutos; var d = duraDe(t, r); return d ? Number(d(f)) || 0 : 0; },
          // Sin ficha (arrastrar en una vista), con lo mismo que comprueba la ficha. Si algo no cuadra, la promesa falla
          // con el texto para la pantalla y no se toca nada.
          cambiar: function (t, id, c) {
            var sp = specDeTabla(t), f = sp && fila(t, id);
            if (!sp || !puede || !f) return Promise.reject(new Error('No se puede cambiar.'));
            var mal = comprobar(sp, f, c);
            return mal.length ? Promise.reject(new Error(mal.join(' '))) : T.actualizar(t, id, c);
          },
          crear: function (t, v) {
            var sp = specDeTabla(t);
            if (!sp || !sp.crear || !puede) return Promise.reject(new Error('No se puede añadir.'));
            var mal = comprobar(sp, null, v);
            return mal.length ? Promise.reject(new Error(mal.join(' '))) : T.crear(t, v);
          },
          // Solo en las tablas que se borran (sin ACTIVO ni ESTADO) y si nada la usa (lo mira el motor).
          quitar: function (t, id) {
            var sp = specDeTabla(t);
            if (!sp || !puede || !sp.baja || !sp.baja.borrar) return Promise.reject(new Error('No se puede quitar.'));
            return ctx.llamar('ajustesUsos', [t, String(id)]).then(function (r) {
              if (r && r.length) throw new Error('No se puede quitar: se usa en ' + r.map(function (u) { var x = specDeTabla(u.tabla); return x ? tituloTabla(x) : titulo(u.tabla); })
                .filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') + '.');
              return T.borrar(t, id);
            });
          }
        };
      }
      function cerrarAccion() {
        if (!abiertaAccion) return;
        var def = abiertaDef;
        abiertaAccion = null; abiertaDef = null;
        if (def && def.cerrar) { try { def.cerrar(); } catch (e) {} }
      }

      /* ---------- ventanas ---------- */

      var pila = []; // fichas abiertas, la de arriba es la que se ve (una hija se abre encima de su madre)
      function ventana(html, alAbrir) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        if (alAbrir) alAbrir();
        var p = vent.querySelector('[data-foco]') || vent.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
        if (p) p.focus();
      }
      function cerrar() { pila = []; velo.classList.remove('abierto'); vent.innerHTML = ''; }
      /** Cierra la ficha de arriba y vuelve a la de debajo (la madre), si la hay. */
      function atras() { pila.pop(); var x = pila.pop(); if (x) ficha(x.spec, x.id, x.madre, x.pre); else cerrar(); }
      function confirmar(b, t, f) { if (b.getAttribute('data-ok')) { f(); return; } b.setAttribute('data-ok', '1'); b.textContent = t; }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function dato(et, v) { return '<div class="eco-df"><span>' + texto(et) + '</span><span>' + (v === '' ? '—' : /^https?:\/\//.test(String(v)) ? '<a href="' + texto(v) + '" target="_blank" rel="noopener">Abrir ↗</a>' : muestra(v) + texto(v)) + '</span></div>'; }

      /** El campo de una columna para editarla. */
      function entrada(t, spec, c, v, nueva) {
        var id = 'aj-c-' + c.n, et = texto(etiqueta(spec, c.n)) + (c.ob ? '' : ' <span class="eco-opc">(opcional)</span>');
        var ancho = c.tipo === 'texto' && LARGO.test(c.n);
        var html;
        if (c.n === E[t].clave) html = '<input type="text" id="' + id + '" value="' + texto(v) + '" maxlength="40" placeholder="' + texto(c.d || '') + '">';
        else if (c.tipo === 'booleano') return '<label class="u-check"><input type="checkbox" id="' + id + '"' + (v === true ? ' checked' : '') + '> ' + texto(etiqueta(spec, c.n)) + '</label>';
        else if (c.tipo === 'lista') html = '<select id="' + id + '">' + opciones((c.valores || []).map(function (x) { return [x, x]; }), v, c.ob ? 'Elige' : 'Sin elegir') + '</select>';
        else if (c.tipo === 'ref') html = '<select id="' + id + '">' + opcRef(c, v) + '</select>';
        else if (c.tipo === 'numero' || c.tipo === 'importe') html = '<input type="text" inputmode="decimal" id="' + id + '" value="' + texto(vacio(v) ? '' : String(v).replace('.', ',')) + '"' + (c.tipo === 'importe' ? ' placeholder="0,00"' : '') + '>';
        else if (c.tipo === 'fecha') html = '<input type="date" id="' + id + '" value="' + texto(v) + '">';
        else if (c.tipo === 'fecha_hora') html = '<input type="datetime-local" id="' + id + '" value="' + texto(v) + '">';
        else if (c.tipo === 'hora') html = '<input type="time" id="' + id + '" value="' + texto(v) + '">';
        else if (spec.archivos && spec.archivos[c.n]) {
          // T0292: el enlace de un archivo (el diseño de un modelo): se pega, se sube a su carpeta o se elige de Drive.
          var ar = spec.archivos[c.n], hay = /^https?:\/\//.test(String(v || ''));
          html = '<input type="url" id="' + id + '" value="' + texto(v) + '" placeholder="Enlace del archivo">' +
            '<span class="aj-archivo">' + (hay ? '<a href="' + texto(v) + '" target="_blank" rel="noopener">Abrir ↗</a>' : '') +
            (puede && ar.carpeta ? '<label class="u-btn u-btn-texto"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden data-aj-subir="' + texto(c.n) + '">Subir PDF o imagen</label>' +
              '<button type="button" class="u-btn u-btn-texto" data-aj-elegir="' + texto(c.n) + '">Elegir de Drive</button>' :
              puede ? '<span class="u-nota">Para subirlo desde aquí falta la carpeta' + (ar.nombreCarpeta ? ' ' + texto(ar.nombreCarpeta) : '') + ' en Drive; mientras, pega el enlace.</span>' : '') +
            '<span class="u-nota" data-aj-estado="' + texto(c.n) + '"></span></span>';
          return '<div class="u-campo u-ancho"><label for="' + id + '" class="u-etiqueta">' + et + '</label>' + html + '</div>';
        }
        else if (ancho) html = '<textarea id="' + id + '" rows="2">' + texto(v) + '</textarea>';
        else html = '<input type="text" id="' + id + '" value="' + texto(v) + '">';
        return '<label class="u-campo' + (ancho ? ' u-ancho' : '') + '"' + (c.d ? ' title="' + texto(c.d) + '"' : '') + '><span class="u-etiqueta">' + et + '</span>' + html + '</label>';
      }
      /** Opciones de una ref: las filas de su tabla por su nombre, sin las apagadas y, si la tabla va por periodo, las del elegido (y siempre la que ya tiene). */
      function opcRef(c, v) {
        var e = E[c.ref];
        if (!e) return opciones(vacio(v) ? [] : [[v, v]], v, c.ob ? 'Elige' : 'Sin elegir');
        var cp = P && c.ref !== P ? e.columnas.filter(function (x) { return x.tipo === 'ref' && x.ref === P; })[0] : null;
        var per = cp && S.per && S.per !== '-' ? S.per : '';
        var fs = filas(c.ref).filter(function (f) {
          if (String(f[e.clave]) === String(v)) return true;
          if (f._nueva || apagada(f)) return false;
          return !per || String(f[cp.n]) === per;
        });
        var lista = fs.map(function (f) { return [f[e.clave], nombreFila(c.ref, f) + (per || !cp || vacio(f[cp.n]) ? '' : ' · ' + nombreRef(P, f[cp.n]))]; })
          .sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es', { numeric: true }); });
        return opciones(lista, v, c.ob ? 'Elige' : 'Sin elegir');
      }

      /**
       * Ficha de una fila (id) o de una nueva (id ''). madre: { spec, id } si es una hija (su «por» apunta a ella).
       * Lo que se edita va en campos; lo demás que se ve, de solo lectura; debajo, sus hijas y el historial.
       */
      function ficha(spec, id, madre, pre) {
        var t = spec.tabla, e = E[t], f = id ? fila(t, id) : null;
        if (id && !f) { var x = pila.pop(); if (x) ficha(x.spec, x.id, x.madre); else cerrar(); return; } // la han borrado mientras
        pila.push({ spec: spec, id: id, madre: madre, pre: pre });
        var nueva = !f, v = f || Object.assign({}, pre || {});
        if (nueva) {
          if (madre) v[spec.por] = madre.id;
          // Una tabla que va directa al periodo (ID_TEMPORADA) empieza con el que se está mirando.
          if (spec.periodo && spec.periodo.length === 1 && S.per && S.per !== '-') v[spec.periodo[0]] = S.per;
          e.columnas.forEach(function (c) { if (c.tipo === 'booleano' && c.n === 'ACTIVO') v[c.n] = true; });
        }
        var baja = !nueva && deBaja(spec, f);
        var edita = puede && (nueva || spec.editar.length > 0);
        var cols = e.columnas.filter(function (c) {
          return c.tipo !== 'log' && c.n !== spec.por && (spec.ver.indexOf(c.n) >= 0 || spec.editar.indexOf(c.n) >= 0 || c.n === spec.nombre);
        });
        var es = function (c) { return edita && spec.editar.indexOf(c.n) >= 0 && !(c.n === e.clave && !nueva); };
        var log = e.columnas.filter(function (c) { return c.tipo === 'log'; })[0];
        var us = nueva ? [] : usos(E, t, id, filas);
        var nomMadre = madre ? nombreFila(madre.spec.tabla, fila(madre.spec.tabla, madre.id)) : '';
        var ant = pila[pila.length - 2], nomAnt = !ant ? '' : ant.id ? nombreFila(ant.spec.tabla, fila(ant.spec.tabla, ant.id)) : 'Añadir · ' + tituloTabla(ant.spec);
        var html = (ant ? '<button type="button" class="u-btn u-btn-texto aj-volver" data-atras>‹ ' + texto(nomAnt) + '</button>' : '') +
          '<h2 id="aj-vt">' + (nueva ? 'Añadir · ' + texto(tituloTabla(spec)) : texto(nombreFila(t, f))) + '</h2>' +
          (madre && pila.length < 2 ? '<p class="u-nota">' + texto(tituloTabla(spec)) + ' de ' + texto(nomMadre) + '</p>' : '') +
          (baja ? '<p><span class="u-chip">De baja</span></p>' : '') +
          (f && f._pendiente ? '<p class="u-nota">Guardando en el Excel…</p>' : '') +
          '<div class="u-campos">' + cols.filter(es).map(function (c) { return entrada(t, spec, c, v[c.n], nueva); }).join('') + '</div>' +
          (cols.some(function (c) { return !es(c); }) ? '<div class="eco-dl">' + cols.filter(function (c) { return !es(c) && !(nueva && vacio(v[c.n])); }).map(function (c) {
            return dato(etiqueta(spec, c.n), c.n === e.clave && f && f._nueva ? 'Se pone al guardar' : verValor(c, v[c.n], nombreRef));
          }).join('') + '</div>' : '') +
          '<p class="u-error" role="alert" hidden></p>' +
          (spec.hijas && spec.hijas.length ? '<div id="aj-hijas"></div>' : '') +
          (log && f && f[log.n] ? '<details class="eco-hist"><summary>Historial de cambios</summary><pre>' + texto(f[log.n]) + '</pre></details>' : '') +
          '<div class="n-botones">' +
          (edita && !(f && f._nueva) ? '<button type="button" class="u-btn u-btn-accion" id="aj-guardar">' + (nueva ? 'Añadir' : 'Guardar') + '</button>' : '') +
          '<button type="button" class="u-btn" ' + (pila.length > 1 ? 'data-atras' : 'data-cerrar') + '>' + (edita ? 'Cancelar' : 'Cerrar') + '</button>' +
          (puede && !nueva && !f._nueva && spec.baja ? botonBaja(spec, baja, us) : '') +
          '</div>' + (!nueva && !f._nueva ? '<div id="aj-usos"></div>' : '');
        ventana(html, function () {
          pintarHijas(spec, f);
          archivosFicha(spec, f);
          if (!nueva && !f._nueva) usosDe(spec, f, us);
          var bg = vent.querySelector('#aj-guardar');
          if (bg) bg.onclick = function () { guardar(spec, f, madre, cols.filter(es)); };
          var bb = vent.querySelector('#aj-baja');
          if (bb) bb.onclick = function () {
            var dar = !baja;
            confirmar(bb, dar ? (spec.baja.borrar ? 'Sí, borrarla del Excel' : 'Sí, dar de baja') : 'Sí, volver a activarla', function () {
              var p = spec.baja.borrar ? T.borrar(t, id) : T.actualizar(t, id, dar ? spec.baja.cambios : spec.baja.volver);
              atras();
              p.then(function () { if (ctx.abierta()) ctx.aviso(spec.baja.borrar ? 'Borrada del Excel.' : dar ? 'Dada de baja.' : 'Activa otra vez.'); }, function () {});
            });
          };
        });
      }
      /**
       * Los botones de las columnas de archivos de la ficha: subir (el motor lo guarda en su carpeta, ajustesSubir) o
       * elegir de Drive. El enlace va al campo y, si la fila ya existe, se guarda en el momento (con su LOG).
       */
      function archivosFicha(spec, f) {
        if (!spec.archivos) return;
        var t = spec.tabla;
        Object.keys(spec.archivos).forEach(function (n) {
          var ar = spec.archivos[n], campo = vent.querySelector('#aj-c-' + n), est = vent.querySelector('[data-aj-estado="' + n + '"]');
          if (!campo) return;
          var poner = function (url, nombre) {
            if (!vent.contains(campo)) return;
            campo.value = url;
            if (f && !f._nueva) {
              var c = {}; c[n] = url;
              T.actualizar(t, f[E[t].clave], c).then(function () { if (ctx.abierta()) ctx.aviso(nombre + ' guardado en ' + etiqueta(spec, n).toLowerCase() + '.'); }, function () {});
              est.textContent = 'Guardado: ' + nombre;
            } else est.textContent = nombre + ': se guarda al añadirla.';
          };
          var fallo = function (e) { if (vent.contains(est)) est.textContent = String((e && e.message) || e).replace(/^\w+:\s*/, ''); };
          var sube = vent.querySelector('[data-aj-subir="' + n + '"]');
          if (sube) sube.onchange = function () {
            var file = sube.files && sube.files[0];
            if (!file) return;
            if (file.size > 15 * 1024 * 1024) { fallo('El archivo es demasiado grande (máximo 15 MB).'); return; }
            est.textContent = 'Subiendo ' + file.name + '…';
            var rd = new FileReader();
            rd.onload = function () {
              ctx.llamar('ajustesSubir', [t, n, { nombre: file.name, mime: file.type, datos: String(rd.result).split(',')[1] || '' }])
                .then(function (r) { poner(r.url, r.nombre); }, fallo);
            };
            rd.onerror = function () { fallo('No se ha podido leer el archivo.'); };
            rd.readAsDataURL(file);
          };
          var elige = vent.querySelector('[data-aj-elegir="' + n + '"]');
          if (elige) elige.onclick = function () {
            window.UG.elegir(ar.carpeta, 'Elige el archivo').then(function (d) { poner('https://drive.google.com/file/d/' + d.id + '/view', d.nombre); }, fallo);
          };
        });
      }
      function botonBaja(spec, baja, us) {
        // Borrar sale cuando el motor confirma que nada la usa, tampoco en las tablas que no son de Ajustes (usosDe).
        if (spec.baja.borrar) return us.length ? '' : '<button type="button" class="u-btn u-btn-texto" id="aj-baja" hidden>Borrar</button>';
        if (baja) return spec.baja.volver ? '<button type="button" class="u-btn u-btn-texto" id="aj-baja">Volver a activar</button>' : '';
        return '<button type="button" class="u-btn u-btn-texto" id="aj-baja">Dar de baja</button>';
      }
      /**
       * Una hija que no dice sus propias hijas se abre con las que tiene su tabla en su bloque: así se baja de la temporada
       * a una competición, de ella a una liga y de la liga a sus equipos.
       */
      function conSusHijas(h) {
        if (h.hijas) return h;
        var sp = specDeTabla(h.tabla);
        return sp && sp.hijas ? Object.assign({}, h, { hijas: sp.hijas }) : h;
      }
      /** Con minutos «ID_LIGA.MINUTOS_PARTIDO», lo que dura cada fila (lo de su liga); con un número, null (no hace falta). */
      function duraDe(t, regla) {
        if (!regla || typeof regla.minutos !== 'string') return null;
        var p = regla.minutos.split('.'), c = colDe(E[t], p[0]);
        return function (x) { var r = c && fila(c.ref, x[p[0]]); return r ? r[p[1]] : ''; };
      }
      /** La tabla de un bloque (no una hija) para abrir una fila de esa tabla, o null si no está en Ajustes. */
      function specDeTabla(t) {
        for (var i = 0; i < B.length; i++) for (var j = 0; j < B[i].tablas.length; j++) if (B[i].tablas[j].tabla === t) return B[i].tablas[j];
        return null;
      }

      /**
       * Si se puede borrar: lo que cuelga de la fila ya se ve en sus hijas; aquí solo se mira, en el motor (ajustesUsos),
       * si algo la usa en cualquier tabla, también en las que no son de Ajustes (partidos, movimientos…). «Borrar» sale
       * solo si nada la usa; si algo la usa, una línea dice dónde. Lo del motor se guarda un minuto.
       */
      var usosRemotos = {};
      function usosDe(spec, f, us) {
        if (!puede || !spec.baja || !spec.baja.borrar) return;
        var t = spec.tabla, id = String(f[E[t].clave]), k = t + '|' + id, caja = vent.querySelector('#aj-usos');
        function pintar(remoto) {
          if (!caja || !vent.contains(caja)) return;
          var bb = vent.querySelector('#aj-baja');
          // Sin respuesta del motor (sin conexión), vale lo cargado: el motor lo vuelve a mirar al borrar.
          var lista = remoto === null ? us.map(function (u) { return { tabla: u.tabla, n: u.filas.length }; }) : remoto || [];
          if (bb) bb.hidden = !(remoto !== undefined && !lista.length);
          // Corto: si tiene hijas, «tiene competiciones»; si no, la primera tabla que la usa y cuántas más.
          var ts = lista.map(function (u) { return u.tabla; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
          var hs = (spec.hijas || []).filter(function (h) { return ts.indexOf(h.tabla) >= 0; }).map(function (h) { return tituloTabla(h).toLowerCase(); });
          var nom = function (x) { var sp = specDeTabla(x); return sp ? tituloTabla(sp) : titulo(x); };
          caja.innerHTML = !ts.length ? '' : '<p class="u-nota">No se puede borrar: ' + texto(hs.length ? 'tiene ' + hs.join(' y ') + '.' :
            'se usa en ' + nom(ts[0]) + (ts.length > 1 ? ' y ' + (ts.length - 1) + (ts.length > 2 ? ' tablas más.' : ' tabla más.') : '.')) + '</p>';
        }
        var g = usosRemotos[k];
        if (g && Date.now() - g.t < 60000) { pintar(g.r); return; }
        pintar(undefined);
        ctx.llamar('ajustesUsos', [t, id]).then(function (r) { usosRemotos[k] = { t: Date.now(), r: r || [] }; pintar(r || []); }, function () { pintar(null); });
      }

      function pintarHijas(spec, f) {
        var caja = vent.querySelector('#aj-hijas');
        if (!caja) return;
        if (!f || f._nueva) { caja.innerHTML = '<p class="u-nota">' + (f ? 'Cuando acabe de guardarse' : 'Después de añadirla') + ' podrás añadir ' + spec.hijas.map(function (h) { return tituloTabla(h).toLowerCase(); }).join(' y ') + '.</p>'; return; }
        var id = f[E[spec.tabla].clave];
        caja.innerHTML = spec.hijas.map(function (h, i) {
          var fs = ordenar(h.tabla, h, filas(h.tabla).filter(function (x) { return String(x[h.por]) === String(id) && (!deBaja(h, x) || S.bajas); }));
          return '<section class="aj-hija"><h3 class="n-grupo">' + texto(tituloTabla(h)) + ' <span class="u-cifra">' + fs.length + '</span></h3>' +
            (fs.length ? tablaHtml(h.tabla, h, fs, 'data-hija="' + i + '" data-fila') : '<p class="u-vacio">Todavía no hay.</p>') +
            (h.crear && puede ? '<button type="button" class="u-btn" data-hija-nueva="' + i + '">Añadir</button>' : '') + '</section>';
        }).join('');
      }

      /** Lo que no deja guardar v (los cambios de f, o una fila nueva si no hay f): obligatorias, únicas y solapes. */
      function comprobar(spec, f, v) {
        var t = spec.tabla, e = E[t];
        var mal = problemas(E, t, spec, v, filas(t), f ? f[e.clave] : '');
        // T0292: que no se pise con otra del mismo campo y día (la regla está en la tabla de su bloque, vale también de hija).
        var base = specDeTabla(t) || spec, toda = Object.assign({}, f || {}, v);
        var ch = choques(base.solapes, e, base, toda, filas(t), f ? f[e.clave] : '',
          base.periodo ? function (x) { return periodoDe(E, t, x, base.periodo, fila); } : null, duraDe(t, base.solapes));
        if (ch.mal) mal.push(ch.mal);
        else if (ch.length) mal.push('Se pisa con ' + ch.slice(0, 3).map(function (x) {
          var r = base.solapes, h = x[r.desde] + (r.hasta ? '–' + x[r.hasta] : '');
          return nombreFila(t, x) + ' (' + h + ')';
        }).join(', ') + '. Cambia la hora.');
        return mal;
      }

      function guardar(spec, f, madre, cols) {
        var t = spec.tabla, e = E[t], v = {};
        cols.forEach(function (c) {
          var x = vent.querySelector('#aj-c-' + c.n);
          if (x) v[c.n] = leerValor(c, c.tipo === 'booleano' ? x.checked : x.value);
        });
        if (!f && madre) v[spec.por] = madre.id;
        if (!f) e.columnas.forEach(function (c) { if (c.n === 'ACTIVO' && c.tipo === 'booleano' && !(c.n in v)) v[c.n] = true; });
        var mal = comprobar(spec, f, v);
        if (mal.length) { verError(mal); return; }
        if (f) {
          var c = cambios(f, v);
          if (!Object.keys(c).length) { atras(); return; }
          atras();
          T.actualizar(t, f[e.clave], c).then(function () { if (ctx.abierta()) ctx.aviso('Guardado en el Excel.'); }, function () {});
          return;
        }
        var conHijas = spec.hijas && spec.hijas.length;
        atras();
        T.crear(t, v).then(function (r) {
          if (!ctx.abierta()) return;
          ctx.aviso('Añadida en el Excel.');
          // Con hijas, se abre su ficha para seguir con ellas (si no se ha abierto otra cosa mientras).
          if (conHijas && r && r.id && !velo.classList.contains('abierto')) { pila = []; ficha(spec, r.id, madre); }
        }, function () {});
      }

      /* ---------- clics ---------- */

      el.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-enlace]')) return; // un enlace de la lista (un archivo) se abre, sin abrir la ficha
        var x = ev.target.closest('[data-vista], [data-modo], [data-accion], [data-nueva], [data-fila], [data-hija-nueva], [data-atras], [data-cerrar]');
        if (!x || !el.contains(x)) return;
        if (x.hasAttribute('data-cerrar')) { cerrar(); return; }
        if (x.hasAttribute('data-atras')) { atras(); return; }
        if (x.hasAttribute('data-vista')) { vista(x.getAttribute('data-vista')); return; }
        if (x.hasAttribute('data-modo')) { var sm = specDe(S.vista); if (sm) { guardado(CLAVE + 'modo_' + sm.tabla, x.getAttribute('data-modo')); pintar(); } return; }
        if (x.hasAttribute('data-accion')) { vista('A:' + x.getAttribute('data-accion')); return; }
        var top = pila[pila.length - 1];
        if (x.hasAttribute('data-hija-nueva')) { ficha(conSusHijas(top.spec.hijas[+x.getAttribute('data-hija-nueva')]), '', { spec: top.spec, id: top.id }); return; }
        if (x.hasAttribute('data-hija')) { ficha(conSusHijas(top.spec.hijas[+x.getAttribute('data-hija')]), x.getAttribute('data-fila'), { spec: top.spec, id: top.id }); return; }
        var spec = specDe(S.vista);
        if (!spec) return;
        if (x.hasAttribute('data-nueva')) { pila = []; ficha(spec, ''); return; }
        if (x.hasAttribute('data-fila')) { pila = []; ficha(spec, x.getAttribute('data-fila')); }
      });
      el.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('tr[data-fila]')) { ev.preventDefault(); ev.target.click(); }
      });
      // Escape, en todo el documento: al repintar una ficha el foco puede quedarse fuera de la sección.
      if (teclaEsc) document.removeEventListener('keydown', teclaEsc);
      teclaEsc = function (ev) { if (ev.key === 'Escape' && ctx.abierta() && velo.classList.contains('abierto')) atras(); };
      document.addEventListener('keydown', teclaEsc);
      velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });

      ctx.alCambiar(function (t) {
        if (nombres.indexOf(t) < 0) return;
        usosRemotos = {};
        pintar();
        // En una ficha abierta solo se repinta la lista de sus hijas (lo que se está escribiendo no se toca).
        var top = pila[pila.length - 1];
        if (top && top.id && velo.classList.contains('abierto')) { ix = {}; pintarHijas(top.spec, fila(top.spec.tabla, top.id)); }
      });
      if (!nombres.length) { S.leido = true; pintar(); return; }
      T.leer(nombres).then(function () { S.leido = true; pintar(); }, function (e) {
        if (!S.leido) cont.innerHTML = '<p class="u-error">No se han podido leer las tablas: ' + texto(e && e.message) + '</p><p class="u-nota">Comprueba la conexión y vuelve a abrir la sección.</p>';
      });
    },
    cerrar: function () {
      if (teclaEsc) { document.removeEventListener('keydown', teclaEsc); teclaEsc = null; }
      if (!abiertaAccion) return;
      var def = abiertaDef;
      abiertaAccion = null; abiertaDef = null;
      if (def && def.cerrar) { try { def.cerrar(); } catch (e) {} }
    }
  });
})();
