/*
 * Sección Perfil base del núcleo · UTILO_CORE 5.0 (T0259) · motor/modulos/perfil de utilo-apps
 *
 * Lo tuyo en el negocio: quién eres y con qué perfil, tus tareas más urgentes (las vencidas primero) con el enlace a
 * todas en Tareas, las listas que el cliente activa en su configuración (tus partidos, tus pedidos…), lo que aportan otras
 * secciones (lo que te falta por cobrar…), cerrar sesión y, al final, las secciones que van dentro de Perfil (Pedir a
 * Utilo, T0269). Cómo se configura: docs/SECCION_PERFIL.md de utilo-apps.
 *
 * - Todo sale de una llamada al motor (perfilDatos), que lee con la capa de tablas y solo devuelve tus filas: las tablas
 *   enteras no llegan al navegador.
 * - Se pinta al momento con lo guardado en este dispositivo (la última vez que se abrió) y se pone al día por detrás.
 *   La primera vez, quién eres sale al momento y los bloques, en cuanto contesta el motor.
 * - No escribe en ninguna tabla.
 */
(function () {
  'use strict';
  var ESTADOS = { 'no iniciada': 'ni', 'en curso': 'ec', 'bloqueada': 'bl', 'pendiente de revisión': 'pr', 'completada': 'co' };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clave(ctx) { return 'nucleo_perfil_' + String(ctx.correo || ctx.persona || '').toLowerCase(); }
  function leer(ctx) { try { return JSON.parse(localStorage.getItem(clave(ctx)) || 'null'); } catch (e) { return null; } }
  function guardar(ctx, d) { try { localStorage.setItem(clave(ctx), JSON.stringify(d)); } catch (e) {} }

  /* ---------- formato español ---------- */

  function fecha(v) { var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(v || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] : '') : String(v || ''); }
  function importe(n) { return Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function valor(v, tipo) {
    if (v === '' || v == null) return '';
    if (tipo === 'fecha' || tipo === 'fecha_hora') return fecha(v);
    if (tipo === 'importe') return importe(v);
    if (tipo === 'numero') return Number(v).toLocaleString('es-ES');
    if (tipo === 'booleano') return v === true ? 'Sí' : v === false ? 'No' : String(v);
    return String(v);
  }
  function num(tipo) { return tipo === 'importe' || tipo === 'numero'; }
  function hora(ms) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  /* ---------- bloques ---------- */

  function htmlQuien(ctx) {
    var p = ctx.admin ? (ctx.perfil ? ctx.perfil + ' · administras el negocio' : 'Administras el negocio') : ctx.perfil;
    return '<div class="u-perfil-quien"><strong>' + texto(ctx.persona) + '</strong>' + (p ? '<span>' + texto(p) + '</span>' : '') + '</div>';
  }

  function cargando() { return '<div class="kz-centro pf-carga" role="status"><div class="u-carga"></div><span class="u-nota">Buscando lo tuyo…</span></div>'; }

  function htmlError(b) {
    return '<section class="pf-bloque"><h2 class="n-grupo">' + texto(b.titulo || 'Un bloque') + '</h2>' +
      '<p class="u-error">No se ha podido leer.</p><p class="u-nota">' + texto(b.error) + ' Vuelve a abrir Perfil para probar otra vez; si sigue, avisa a quien administra.</p></section>';
  }

  /** «Ver todas en Tareas ›» (T0269): abre la sección de TAREAS_VER con tus tareas, si la ves. */
  function htmlVerTareas(ctx) {
    var id = String((ctx.config || {}).TAREAS_VER || '').toUpperCase();
    var s = id && (ctx.secciones || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return '';
    return '<p class="pf-ver-todas"><a href="?s=' + encodeURIComponent(id.toLowerCase()) + '&amp;asignado=' + encodeURIComponent(ctx.persona || '') + '" data-sx="' + texto(id) + '">' +
      'Ver todas en ' + texto(s.titulo) + ' ›</a></p>';
  }

  function htmlTareas(t, hoy, ctx) {
    if (!t) return '';
    if (t.error) return htmlError(t);
    var resumen = t.abiertas ? [t.vencidas ? '<span class="pf-vencida">' + plural(t.vencidas, 'vencida', 'vencidas') + '</span>' : '']
      .concat(t.porEstado.map(function (e) { return '<span class="n-estado n-e-' + (ESTADOS[e.estado.toLowerCase()] || 'x') + '">' + texto(e.estado) + ' <span class="u-cifra">' + e.n + '</span></span>'; }))
      .filter(Boolean).join('') : '';
    var h = '<section class="pf-bloque"><h2 class="n-grupo">' + texto(t.titulo) + ' <span class="u-cifra">' + t.abiertas + '</span></h2>';
    if (!t.abiertas) return h + '<p class="u-vacio">No tienes tareas abiertas. Las que te asignen aparecen aquí.</p>' + htmlVerTareas(ctx) + '</section>';
    h += '<div class="pf-resumen">' + resumen + '</div>' +
      '<table class="u-tabla n-lista"><thead><tr><th>Tarea</th><th>Estado</th><th>Fecha límite</th></tr></thead><tbody>' +
      t.filas.map(function (f) {
        var vencida = f.DEADLINE && String(f.DEADLINE) < hoy;
        return '<tr><td class="u-tabla-t">' + texto(f.TITULO) + '<div class="u-nota">' + texto([f.ID, f.EPICA, f.P].filter(Boolean).join(' · ')) + '</div></td>' +
          '<td><span class="n-estado n-e-' + (ESTADOS[String(f.ESTADO || '').toLowerCase()] || 'x') + '">' + texto(f.ESTADO || 'Sin estado') + '</span></td>' +
          '<td class="pf-fecha' + (vencida ? ' pf-vencida' : '') + '">' + (f.DEADLINE ? texto(fecha(f.DEADLINE)) + (vencida ? ' · vencida' : '') : '<span class="u-tabla-s">Sin fecha</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
    if (t.abiertas > t.filas.length) h += '<p class="u-nota">Y ' + plural(t.abiertas - t.filas.length, 'tarea más', 'tareas más') + '.</p>';
    return h + htmlVerTareas(ctx) + '</section>';
  }

  /** La vista elegida de cada bloque con vistas (por su id), mientras la página está abierta. */
  var ELEGIDA = {};
  /**
   * Un bloque con vistas (T0255): { id, titulo, vista (la de por defecto), vistas: [{ id, grupo, titulo, …lo de un bloque }] }.
   * Arriba sale «Ver» con un desplegable (agrupado por grupo) y debajo, la vista elegida como un bloque más.
   */
  function htmlBloque(b, i) {
    if (b.error || !b.vistas || !b.vistas.length) return htmlUno(b, '', i);
    var k = b.id || b.titulo, sel = ELEGIDA[k] || b.vista;
    var v = b.vistas.filter(function (x) { return x.id === sel; })[0] || b.vistas[0], grupo = null, ops = '';
    b.vistas.forEach(function (x) {
      if ((x.grupo || '') !== grupo) { ops += (grupo !== null && grupo !== '' ? '</optgroup>' : '') + (x.grupo ? '<optgroup label="' + texto(x.grupo) + '">' : ''); grupo = x.grupo || ''; }
      ops += '<option value="' + texto(x.id) + '"' + (x === v ? ' selected' : '') + '>' + texto(x.titulo) + '</option>';
    });
    if (grupo) ops += '</optgroup>';
    var ver = '<label class="pf-ver"><span>Ver</span><select data-pfvista="' + i + '">' + ops + '</select></label>';
    return htmlUno(Object.assign({}, b, v, { titulo: b.titulo, vistas: null, _vista: v.id }), ver, i);
  }

  function htmlUno(b, ver, i) {
    if (b.error) return htmlError(b);
    var cols = b.columnas || [], filas = b.filas || [];
    var h = '<section class="pf-bloque" data-pfb="' + i + '"><div class="pf-cab"><h2 class="n-grupo">' + texto(b.titulo) + (b.cuantas != null ? ' <span class="u-cifra">' + b.cuantas + '</span>' : '') + '</h2>' + (ver || '') + '</div>';
    if (b.cifras && b.cifras.length) h += htmlCifras(b.cifras);
    if (b.nota) h += '<p class="u-nota">' + texto(b.nota) + '</p>';
    if (!filas.length) h += b.nota ? '' : '<p class="u-vacio">' + texto(b.vacio || 'No hay nada tuyo aquí por ahora.') + '</p>';
    else if (b.plegar) {
      // T0269: la tabla, plegada debajo de las cifras y el botón; se despliega al tocar «plegar» (p. ej. «Ver los partidos»).
      var k = 'tabla:' + (b.id || b.titulo);
      return h + htmlAccion(b.accion) + '<details class="pf-detalle" data-pfdet="' + texto(k) + '"' + (ABIERTO[k] ? ' open' : '') + '><summary>' + texto(b.plegar) +
        ' <span class="u-cifra">' + filas.length + '</span></summary>' + htmlTabla(cols, filas, b.sumar, b.total) + '</details>' +
        htmlDetalle(b.detalle, b._vista, b.id || b.titulo) + '</section>';
    } else {
      h += htmlTabla(cols, filas, b.sumar, b.total);
      if (b.cuantas > filas.length) h += '<p class="u-nota">Y ' + plural(b.cuantas - filas.length, 'más', 'más') + '.</p>';
    }
    return h + htmlAccion(b.accion) + htmlDetalle(b.detalle, b._vista, b.id || b.titulo) + '</section>';
  }

  /**
   * Una tabla de un bloque; con sumar (una columna o varias, T0269), el total debajo (total: un número o { COLUMNA: número }).
   * Una columna de tipo «marca» sale como una etiqueta (Pagado, Por cobrar…).
   * Si las filas llevan _grupo (T0269: Próximos, Jugados), cada grupo sale con su cabecera y cuántas tiene.
   * Si una fila lleva _detalle ([{ titulo, valor }], T0269), se puede tocar y debajo se despliega su detalle.
   */
  function htmlTabla(cols, filas, sumar, total) {
    var sumas = [].concat(sumar || []), tot = function (c) { return total != null && typeof total === 'object' ? total[c.nombre] : total; };
    var hayTotal = sumas.length && total != null && cols.some(function (c) { return sumas.indexOf(c.nombre) >= 0; });
    var grupo = null, enGrupo = {};
    filas.forEach(function (f) { if (f._grupo) enGrupo[f._grupo] = (enGrupo[f._grupo] || 0) + 1; });
    return '<table class="u-tabla n-lista"><thead><tr>' + cols.map(function (c) { return '<th' + (num(c.tipo) ? ' class="num"' : '') + '>' + texto(c.titulo) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function (f) {
        var cab = '';
        if (f._grupo && f._grupo !== grupo) {
          grupo = f._grupo;
          cab = '<tr class="pf-grupo"><th colspan="' + cols.length + '" scope="colgroup">' + texto(grupo) + ' <span class="u-cifra">' + enGrupo[grupo] + '</span></th></tr>';
        }
        var abre = f._detalle && f._detalle.length;
        return cab + (abre ? '<tr class="pf-fila-abre" tabindex="0" aria-expanded="false">' : '<tr>') + cols.map(function (c, i) {
          var v = valor(f[c.nombre], c.tipo);
          if (c.tipo === 'marca' && v) v = '<span class="pf-marca" data-m="' + texto(String(v).split(' ')[0].toLowerCase()) + '">' + texto(v) + '</span>';
          else v = v ? (num(c.tipo) && c.titulo ? '<span class="pf-et">' + texto(c.titulo) + ' </span>' : '') + texto(v) : ''; // en el móvil, «Arbitraje 18,00 €»
          var cl = [num(c.tipo) ? 'num' : i === 0 ? 'u-tabla-t' : '', v ? '' : 'pf-vacia'].filter(Boolean).join(' '); // vacía: en el móvil no sale
          return '<td' + (cl ? ' class="' + cl + '"' : '') + ' data-t="' + texto(c.titulo) + '">' + (v || (c.tipo === 'marca' ? '' : '<span class="u-tabla-s">—</span>')) + '</td>';
        }).join('') + '</tr>' + (abre ? '<tr class="pf-fila-detalle" hidden><td colspan="' + cols.length + '"><dl class="pf-dl">' + f._detalle.map(function (d) {
          return '<dt>' + texto(d.titulo) + '</dt><dd>' + texto(valor(d.valor, d.tipo)) + '</dd>';
        }).join('') + '</dl></td></tr>' : '');
      }).join('') + '</tbody>' +
      (hayTotal ? '<tfoot><tr>' + cols.map(function (c, i) {
        return sumas.indexOf(c.nombre) >= 0 ? '<td class="num" data-t="' + texto(c.titulo) + '">' + texto(valor(tot(c), c.tipo)) + '</td>' : '<td>' + (i === 0 ? 'Total' : '') + '</td>';
      }).join('') + '</tr></tfoot>' : '') +
      '</table>';
  }

  /** Lo que se despliega, abierto o no (por bloque), mientras la página está abierta. */
  var ABIERTO = {};
  /**
   * El detalle de un bloque, plegado debajo (T0255): { titulo, columnas, filas, nota }. Si las filas llevan _en (las vistas en
   * las que salen), solo las de la vista elegida.
   */
  function htmlDetalle(d, vista, k) {
    if (!d || !d.filas) return '';
    var filas = d.filas.filter(function (f) { return !f._en || !vista || f._en.indexOf(vista) >= 0; });
    if (!filas.length) return '';
    return '<details class="pf-detalle" data-pfdet="' + texto(k) + '"' + (ABIERTO[k] ? ' open' : '') + '><summary>' + texto(d.titulo || 'Ver el detalle') + ' <span class="u-cifra">' + filas.length + '</span></summary>' +
      (d.nota ? '<p class="u-nota">' + texto(d.nota) + '</p>' : '') + htmlTabla(d.columnas || [], filas) + '</details>';
  }


  /** Las cifras de un bloque, grandes y arriba: [{ titulo, valor, tipo, destacar }]. */
  function htmlCifras(cs) {
    return '<div class="pf-cifras">' + cs.map(function (c) {
      return '<div' + (c.destacar ? ' class="pf-destacar"' : '') + '><b class="u-cifra">' + texto(valor(c.valor, c.tipo) || '0') + '</b><span>' + texto(c.titulo) + '</span></div>';
    }).join('') + '</div>';
  }
  /** El botón de un bloque ({ texto, enlace }): un enlace https que se abre aparte (p. ej. un WhatsApp con el mensaje escrito). */
  function htmlAccion(a) {
    if (!a || !/^https:\/\//.test(String(a.enlace || ''))) return '';
    return '<div class="n-botones pf-accion"><a class="u-btn u-btn-accion" href="' + texto(a.enlace) + '" target="_blank" rel="noopener">' + texto(a.texto || 'Abrir') + '</a></div>';
  }

  function htmlCuenta(ctx) {
    var ves = (ctx.secciones || []).filter(function (s) { return s.id !== 'PERFIL' && !s.enPerfil; }).map(function (s) { return s.titulo; }).join(', ');
    return '<section class="pf-bloque u-perfil"><h2 class="n-grupo">Tu cuenta</h2><dl>' +
      '<dt>Cuenta</dt><dd>' + texto(ctx.correo || '') + '</dd>' +
      '<dt>Secciones</dt><dd>' + texto(ves || 'Solo Perfil') + '</dd>' +
      '<dt>Dispositivo</dt><dd>' + (ctx.como ? 'Viendo como ' + texto(ctx.persona) + ' desde la cuenta de ' + texto(ctx.como.persona) : 'Sesión guardada en este dispositivo') + '</dd></dl>' +
      // T0273: quien administra puede entrar como otra persona (el marco abre la ventana); viéndola, solo volver a su cuenta.
      (ctx.como ? '<button type="button" class="u-btn" data-n-volver>Volver a mi cuenta</button>' :
        '<div class="n-botones">' + (ctx.verComo ? '<button type="button" class="u-btn" data-n-como>Entrar como otra persona</button>' : '') +
        '<a class="u-btn" href="?salir">Cerrar sesión</a></div>' +
        '<p class="u-nota">Al cerrar la sesión tendrás que volver a entrar con tu cuenta de Google.</p>') + '</section>';
  }

  /** Las secciones que van dentro de Perfil («enPerfil», T0269: Pedir a Utilo), como botones al final. */
  function htmlDentro(ctx) {
    var ss = (ctx.secciones || []).filter(function (s) { return s.enPerfil; });
    if (!ss.length) return '';
    return '<section class="pf-bloque pf-dentro" aria-label="Más"><div class="n-botones">' + ss.map(function (s) {
      return '<a class="u-btn" href="?s=' + encodeURIComponent(s.id.toLowerCase()) + '" data-sx="' + texto(s.id) + '">' +
        (s.icono ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + s.icono + '</svg>' : '') + '<span>' + texto(s.titulo) + '</span></a>';
    }).join('') + '</div></section>';
  }

  window.UN.registrar('PERFIL', {
    abrir: function (el, ctx) {
      var visto = null; // lo que se está enseñando
      function bloques(d) { return (d.bloques || []).map(htmlBloque).join(''); }
      // Cambiar la vista de un bloque solo vuelve a pintar ese bloque.
      el.addEventListener('change', function (e) {
        var s = e.target.closest('[data-pfvista]');
        if (!s || !visto) return;
        var i = Number(s.getAttribute('data-pfvista')), b = (visto.bloques || [])[i], sec = s.closest('.pf-bloque');
        if (!b || !sec) return;
        ELEGIDA[b.id || b.titulo] = s.value;
        sec.outerHTML = htmlBloque(b, i);
        var n = el.querySelector('[data-pfvista="' + i + '"]'); if (n) n.focus();
      });
      // Una fila con detalle (T0269) lo despliega o lo pliega al tocarla, o con Intro o espacio.
      function abrirFila(tr) {
        var d = tr.nextElementSibling, ab = tr.getAttribute('aria-expanded') !== 'true';
        tr.setAttribute('aria-expanded', ab ? 'true' : 'false');
        if (d && d.classList.contains('pf-fila-detalle')) d.hidden = !ab;
      }
      el.addEventListener('click', function (e) { var tr = e.target.closest('tr.pf-fila-abre'); if (tr && el.contains(tr)) abrirFila(tr); });
      el.addEventListener('keydown', function (e) {
        var tr = e.target.closest && e.target.closest('tr.pf-fila-abre');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirFila(tr); }
      });
      // Si el detalle de un bloque está desplegado, sigue así al cambiar de vista o al ponerse al día.
      el.addEventListener('toggle', function (e) { var d = e.target; if (d.getAttribute && d.hasAttribute('data-pfdet')) ABIERTO[d.getAttribute('data-pfdet')] = d.open; }, true);
      function pintar(d) {
        visto = d;
        el.innerHTML = '<div class="pf">' + htmlQuien(ctx) +
          // Sin tareas abiertas, el bloque de tareas va después de lo demás: arriba, lo que hay que hacer.
          (d ? (d.tareas && !d.tareas.error && !d.tareas.abiertas ? bloques(d) + htmlTareas(d.tareas, d.hoy, ctx)
            : htmlTareas(d.tareas, d.hoy, ctx) + bloques(d)) : cargando()) +
          htmlCuenta(ctx) + htmlDentro(ctx) +
          '<p class="u-nota pf-hora" id="pf-hora">' + (d ? 'Al día a las ' + hora(d.leido) + '.' : '') + '</p></div>';
      }
      var guardado = leer(ctx);
      pintar(guardado); // al momento: lo de la última vez (o quién eres, si es la primera)
      if (guardado) el.querySelector('#pf-hora').textContent = 'Al día a las ' + hora(guardado.leido) + '. Poniéndolo al día…';
      ctx.llamar('perfilDatos').then(function (d) {
        guardar(ctx, d);
        if (ctx.abierta()) pintar(d);
      }, function (e) {
        if (!ctx.abierta()) return;
        var msg = String(e.message || e).replace(/^\w+:\s*/, '');
        if (guardado) { el.querySelector('#pf-hora').textContent = 'Al día a las ' + hora(guardado.leido) + '. No se ha podido poner al día: ' + msg; return; }
        var c = el.querySelector('.pf-carga');
        if (c) c.outerHTML = '<p class="u-error">No se han podido leer tus datos.</p><p class="u-nota">' + texto(msg) + ' Vuelve a abrir Perfil para probar otra vez.</p>';
      });
    }
  });
})();
