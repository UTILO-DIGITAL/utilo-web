/*
 * Sección Perfil base del núcleo · UTILO_CORE 5.0 (T0259) · motor/modulos/perfil de utilo-apps
 *
 * Lo tuyo en el negocio: quién eres y con qué perfil, tus tareas abiertas (las vencidas primero), las listas que el
 * cliente activa en su configuración (tus partidos, tus pedidos…), lo que aportan otras secciones (lo que te falta por
 * cobrar…) y cerrar sesión. Cómo se configura: docs/SECCION_PERFIL.md de utilo-apps.
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

  function htmlTareas(t, hoy) {
    if (!t) return '';
    if (t.error) return htmlError(t);
    var resumen = t.abiertas ? [t.vencidas ? '<span class="pf-vencida">' + plural(t.vencidas, 'vencida', 'vencidas') + '</span>' : '']
      .concat(t.porEstado.map(function (e) { return '<span class="n-estado n-e-' + (ESTADOS[e.estado.toLowerCase()] || 'x') + '">' + texto(e.estado) + ' <span class="u-cifra">' + e.n + '</span></span>'; }))
      .filter(Boolean).join('') : '';
    var h = '<section class="pf-bloque"><h2 class="n-grupo">' + texto(t.titulo) + ' <span class="u-cifra">' + t.abiertas + '</span></h2>';
    if (!t.abiertas) return h + '<p class="u-vacio">No tienes tareas abiertas. Las que te asignen aparecen aquí.</p></section>';
    h += '<div class="pf-resumen">' + resumen + '</div>' +
      '<table class="u-tabla n-lista"><thead><tr><th>Tarea</th><th>Estado</th><th>Fecha límite</th></tr></thead><tbody>' +
      t.filas.map(function (f) {
        var vencida = f.DEADLINE && String(f.DEADLINE) < hoy;
        return '<tr><td class="u-tabla-t">' + texto(f.TITULO) + '<div class="u-nota">' + texto([f.ID, f.EPICA, f.P].filter(Boolean).join(' · ')) + '</div></td>' +
          '<td><span class="n-estado n-e-' + (ESTADOS[String(f.ESTADO || '').toLowerCase()] || 'x') + '">' + texto(f.ESTADO || 'Sin estado') + '</span></td>' +
          '<td class="pf-fecha' + (vencida ? ' pf-vencida' : '') + '">' + (f.DEADLINE ? texto(fecha(f.DEADLINE)) + (vencida ? ' · vencida' : '') : '<span class="u-tabla-s">Sin fecha</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
    if (t.abiertas > t.filas.length) h += '<p class="u-nota">Y ' + plural(t.abiertas - t.filas.length, 'tarea más', 'tareas más') + '.</p>';
    return h + '</section>';
  }

  function htmlBloque(b) {
    if (b.error) return htmlError(b);
    var cols = b.columnas || [], filas = b.filas || [];
    var h = '<section class="pf-bloque"><h2 class="n-grupo">' + texto(b.titulo) + (b.cuantas != null ? ' <span class="u-cifra">' + b.cuantas + '</span>' : '') + '</h2>';
    if (b.nota) h += '<p class="u-nota">' + texto(b.nota) + '</p>';
    if (!filas.length) return h + (b.nota ? '' : '<p class="u-vacio">' + texto(b.vacio || 'No hay nada tuyo aquí por ahora.') + '</p>') + '</section>';
    var suma = b.sumar ? cols.filter(function (c) { return c.nombre === b.sumar; })[0] : null;
    h += '<table class="u-tabla n-lista"><thead><tr>' + cols.map(function (c) { return '<th' + (num(c.tipo) ? ' class="num"' : '') + '>' + texto(c.titulo) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function (f) {
        return '<tr>' + cols.map(function (c, i) {
          var v = valor(f[c.nombre], c.tipo);
          return '<td' + (num(c.tipo) ? ' class="num"' : i === 0 ? ' class="u-tabla-t"' : '') + ' data-t="' + texto(c.titulo) + '">' + (v ? texto(v) : '<span class="u-tabla-s">—</span>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>' +
      (suma && b.total != null ? '<tfoot><tr>' + cols.map(function (c, i) {
        return c === suma ? '<td class="num" data-t="Total">' + texto(valor(b.total, suma.tipo)) + '</td>' : '<td>' + (i === 0 ? 'Total' : '') + '</td>';
      }).join('') + '</tr></tfoot>' : '') +
      '</table>';
    if (b.cuantas > filas.length) h += '<p class="u-nota">Y ' + plural(b.cuantas - filas.length, 'más', 'más') + '.</p>';
    return h + '</section>';
  }

  function htmlCuenta(ctx) {
    var ves = (ctx.secciones || []).filter(function (s) { return s.id !== 'PERFIL'; }).map(function (s) { return s.titulo; }).join(', ');
    return '<section class="pf-bloque u-perfil"><h2 class="n-grupo">Tu cuenta</h2><dl>' +
      '<dt>Cuenta</dt><dd>' + texto(ctx.correo || '') + '</dd>' +
      '<dt>Secciones</dt><dd>' + texto(ves || 'Solo Perfil') + '</dd>' +
      '<dt>Dispositivo</dt><dd>Sesión guardada en este dispositivo</dd></dl>' +
      '<a class="u-btn" href="?salir">Cerrar sesión</a>' +
      '<p class="u-nota">Al cerrar la sesión tendrás que volver a entrar con tu cuenta de Google.</p></section>';
  }

  window.UN.registrar('PERFIL', {
    abrir: function (el, ctx) {
      function pintar(d) {
        el.innerHTML = '<div class="pf">' + htmlQuien(ctx) +
          // Sin tareas abiertas, el bloque de tareas va después de lo demás: arriba, lo que hay que hacer.
          (d ? (d.tareas && !d.tareas.error && !d.tareas.abiertas ? (d.bloques || []).map(htmlBloque).join('') + htmlTareas(d.tareas, d.hoy)
            : htmlTareas(d.tareas, d.hoy) + (d.bloques || []).map(htmlBloque).join('')) : cargando()) +
          htmlCuenta(ctx) +
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
