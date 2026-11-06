/*
 * Entregas de la gestión de Utilo · plataforma interna sobre Supabase (T0386) · clientes/utilo/modulos/entregas de utilo-apps
 *
 * Una tarjeta por entrega de las iniciativas que ve quien ha entrado, como la sección Entregas del kanban 4.x (T0399):
 * su nombre corto (U19), estado e iniciativa; las tareas entregadas de su total con una barra por estados; la fecha
 * prevista con los días que faltan (o la de entrega); qué incluye, el criterio de terminado y, al desplegar, sus tareas
 * por estado, que abren su ficha en Tareas. Filtros Ver (en marcha, aplazadas, entregadas, todas) e Iniciativa, guardados
 * en el dispositivo. Solo lee (ENTREGAS, INICIATIVAS y la vista TABLERO); lo que ve cada uno lo dicen sus roles.
 * Las tareas Descartadas no cuentan en el progreso. Estilos: estilos/kanban.css (.en-*), con los colores de base.css.
 */
(function () {
  'use strict';
  var TE = 'ENTREGAS', TI = 'INICIATIVAS', T = 'TABLERO';
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_RECARGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  var VER = ['En marcha', 'Aplazadas', 'Entregadas', 'Todas'];
  /** Los grupos de estados de las tareas: en la barra y su leyenda (de lo hecho a lo que falta) y al desplegar. */
  var GRUPOS = [
    { id: 'hecho', estados: ['Entregada'], cls: 's-co', una: 'entregada', varias: 'entregadas' },
    { id: 'revision', estados: ['Para revisar', 'Aprobada'], cls: 's-pr', una: 'en revisión', varias: 'en revisión' },
    { id: 'curso', estados: ['En curso'], cls: 's-ec', una: 'en curso', varias: 'en curso' },
    { id: 'atascada', estados: ['Necesita tu respuesta', 'Bloqueada'], cls: 's-bl', una: 'atascada', varias: 'atascadas' },
    { id: 'falta', estados: ['En cola', 'Esperando', 'Aplazada'], cls: 's-ni', una: 'por hacer', varias: 'por hacer' }
  ];
  var DESPLEGAR = ['En curso', 'Necesita tu respuesta', 'Bloqueada', 'Para revisar', 'Aprobada', 'En cola', 'Esperando', 'Aplazada', 'Entregada'];
  var CLS = { 'Esperando': 's-x', 'En cola': 's-ni', 'En curso': 's-ec', 'Necesita tu respuesta': 's-pr', 'Bloqueada': 's-bl', 'Para revisar': 's-pr',
    'Aprobada': 's-co', 'Entregada': 's-co', 'Aplazada': 's-x', 'Descartada': 's-x' };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fechaEs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  /** Días de hoy a esa fecha ('aaaa-mm-dd'): «faltan 9 días», «es hoy», «venció hace 2 días». */
  function cuanto(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || ''));
    if (!m) return null;
    var h = new Date(); h.setHours(0, 0, 0, 0);
    var n = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - h) / 864e5);
    return { n: n, txt: n === 0 ? 'es hoy' : n === 1 ? 'falta 1 día' : n > 1 ? 'faltan ' + n + ' días' : n === -1 ? 'venció ayer' : 'venció hace ' + (-n) + ' días' };
  }
  function grupoDe(e) { return e.ESTADO === 'Entregada' ? 'Entregadas' : e.ESTADO === 'Aplazada' ? 'Aplazadas' : e.ESTADO === 'Descartada' ? '' : 'En marcha'; }

  /** La hoja del tablero, una vez por página. Mientras llega, la sección no se ve (sin ella se pintaría sin estilos un momento). */
  function estilos(el) {
    var l = document.getElementById('kb-css');
    if (l && l.getAttribute('data-lista')) return;
    if (!l) {
      l = document.createElement('link');
      l.id = 'kb-css'; l.rel = 'stylesheet'; l.href = RAIZ + 'estilos/kanban.css?v=' + encodeURIComponent(VERSION);
      l.addEventListener('load', function () { l.setAttribute('data-lista', '1'); });
      document.head.appendChild(l);
    }
    el.style.visibility = 'hidden';
    var ver = function () { el.style.visibility = ''; };
    l.addEventListener('load', ver); l.addEventListener('error', ver);
    setTimeout(ver, 3000); // si tarda mucho, mejor sin estilos que en blanco
  }

  window.UN.registrar('ENTREGAS', {
    abrir: function (el, ctx) {
      estilos(el);
      var C = ctx.config || {};
      var CLAVE = 'en_' + String(ctx.correo || ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      var F = leerLocal(CLAVE + '_f', {});
      if (VER.indexOf(F.ver) < 0) F.ver = VER.indexOf(C.VER) >= 0 ? C.VER : 'En marcha';
      var leido = false;
      // Sin la clase «en»: en kanban.css es la vista de la 4.x, que solo se ve con body.ver-entregas.
      el.innerHTML = '<section class="en-nucleo"><div class="en-fil">' +
        '<label>Ver<select id="en-ver">' + VER.map(function (v) { return '<option' + (v === F.ver ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
        '<label id="en-lini">Iniciativa<select id="en-ini"></select></label>' +
        '<span class="act"><button id="en-rec" class="sec recarga" type="button" title="Traer lo último" aria-label="Traer lo último">' + ICO_RECARGAR + '</button></span>' +
        '</div><div id="en-lista" class="en-lista"></div></section>';
      var $ = function (id) { return el.querySelector('#' + id); };

      function tareasDe(id) { return ctx.tablas.filas(T).filter(function (t) { return t.ENTREGA === id; }); }
      function ini(id) { return ctx.tablas.fila(TI, id); }
      function cuantas(k, g) { return k + ' ' + (k === 1 ? g.una : g.varias); }

      function tarjeta(e) {
        var ts = tareasDe(e.ID), cuentan = ts.filter(function (t) { return t.ESTADO !== 'Descartada'; });
        var i = ini(e.INICIATIVA), corto = ((i && i.INICIAL) || '') + e.NUMERO;
        var n = {};
        GRUPOS.forEach(function (g) { n[g.id] = cuentan.filter(function (t) { return g.estados.indexOf(t.ESTADO) >= 0; }).length; });
        var total = cuentan.length, hechas = n.hecho, pct = total ? Math.round(100 * hechas / total) : 0;
        var h = '<article class="en-c' + (e.ESTADO === 'Aplazada' || e.ESTADO === 'Descartada' ? ' en-aplazada' : e.ESTADO === 'Entregada' ? ' en-entregada' : '') + '">' +
          '<div class="en-top"><span class="en-corto">' + texto(corto) + '</span><span class="en-est">' + texto(e.ESTADO) + '</span>' +
          (i && ctx.tablas.filas(TI).length > 1 ? '<span class="en-cli">' + texto(i.NOMBRE || i.ID) + '</span>' : '') + '</div>' +
          '<h3 class="en-t">' + texto(e.NOMBRE) + '</h3>' +
          '<div class="en-pct">' + (total ? '<b>' + hechas + ' de ' + total + '</b> ' + (total === 1 ? 'tarea entregada' : 'tareas entregadas') + '<span class="en-num">' + pct + ' %</span>' : 'Sin tareas todavía') + '</div>' +
          '<div class="en-barra" role="img" aria-label="' + texto(total ? pct + ' % entregado: ' + GRUPOS.filter(function (g) { return n[g.id]; }).map(function (g) { return cuantas(n[g.id], g); }).join(', ') : 'Sin tareas') + '">' +
            GRUPOS.map(function (g) { return n[g.id] ? '<span class="' + g.cls + '" style="flex-grow:' + n[g.id] + '" title="' + texto(cuantas(n[g.id], g)) + '"></span>' : ''; }).join('') + '</div>' +
          (total ? '<ul class="en-ley">' + GRUPOS.filter(function (g) { return n[g.id]; }).map(function (g) { return '<li class="' + g.cls + '">' + texto(cuantas(n[g.id], g)) + '</li>'; }).join('') + '</ul>' : '');
        var f = '', cf = '', q = cuanto(e.FECHA_PREVISTA);
        if (e.ESTADO === 'Entregada') f = e.FECHA_ENTREGA ? 'Entregada el ' + fechaEs(e.FECHA_ENTREGA) : 'Entregada';
        else if (e.ESTADO === 'Descartada') f = 'Descartada';
        else if (q) {
          f = (e.ESTADO === 'Aplazada' ? 'Aplazada; prevista el ' : 'Prevista el ') + fechaEs(e.FECHA_PREVISTA) + ' · ' + q.txt;
          if (e.ESTADO !== 'Aplazada') cf = q.n < 0 ? ' vencida' : q.n <= 7 ? ' pronto' : '';
        } else f = 'Sin fecha prevista';
        h += '<div class="en-fecha' + cf + '">' + texto(f) + '</div>';
        if (e.QUE_INCLUYE) h += '<p class="en-inc">' + texto(e.QUE_INCLUYE) + '</p>';
        if (e.CRITERIO) h += '<p class="en-inc"><b>Terminada cuando:</b> ' + texto(e.CRITERIO) + '</p>';
        if (e.RESUMEN) h += '<p class="en-inc en-res">' + texto(e.RESUMEN) + '</p>';
        if (ts.length) {
          var que = ts.length === 1 ? 'la tarea' : 'las ' + ts.length + ' tareas';
          h += '<details class="en-tareas"><summary data-que="' + texto(que) + '">Ver ' + texto(que) + '</summary>' +
            DESPLEGAR.concat(['Descartada']).map(function (s) {
              var de = ts.filter(function (t) { return t.ESTADO === s; });
              if (!de.length) return '';
              de.sort(function (a, b) { return s === 'Entregada' ? String(b.FECHA_CIERRE || '').localeCompare(String(a.FECHA_CIERRE || '')) : String(a.ID).localeCompare(String(b.ID)); });
              return '<h4 class="' + CLS[s] + '">' + texto(s) + ' · ' + de.length + '</h4><ul>' + de.map(function (t) {
                return '<li><a href="?s=tablero&amp;t=' + encodeURIComponent(t.ID) + '" data-sx="TABLERO"><span class="id">' + texto(t.ID) + '</span> ' + texto(t.TITULO) + '</a>' +
                  (t.EN_MANOS_NOMBRE ? '<span class="en-quien">' + texto(t.EN_MANOS_NOMBRE) + '</span>' : '') + '</li>';
              }).join('') + '</ul>';
            }).join('') + '</details>';
        }
        return h + '</article>';
      }

      function pintar() {
        var EL = ctx.tablas.filas(TE).slice(), IS = ctx.tablas.filas(TI);
        var sel = $('en-ini');
        if (F.ini && !ini(F.ini)) F.ini = '';
        sel.innerHTML = '<option value="">Todas</option>' + IS.map(function (i) { return '<option value="' + texto(i.ID) + '"' + (i.ID === F.ini ? ' selected' : '') + '>' + texto(i.NOMBRE || i.ID) + '</option>'; }).join('');
        $('en-lini').style.display = IS.length > 1 ? '' : 'none';
        var ls = EL.filter(function (e) { return (F.ver === 'Todas' || grupoDe(e) === F.ver) && (!F.ini || e.INICIATIVA === F.ini); });
        // Primero las que están en marcha, después las aplazadas, las entregadas y las descartadas. Las que aún se hacen, por
        // fecha prevista (la más cercana arriba); las cerradas, por número, de la última a la primera.
        var orden = { 'En marcha': 0, 'Aplazadas': 1, 'Entregadas': 2, '': 3 };
        ls.sort(function (a, b) {
          var ga = orden[grupoDe(a)], gb = orden[grupoDe(b)];
          if (ga !== gb) return ga - gb;
          if (ga >= 2) return String(a.INICIATIVA).localeCompare(String(b.INICIATIVA)) || Number(b.NUMERO) - Number(a.NUMERO);
          return String(a.FECHA_PREVISTA || '9999').localeCompare(String(b.FECHA_PREVISTA || '9999')) || Number(a.NUMERO) - Number(b.NUMERO);
        });
        var l = $('en-lista');
        if (!EL.length) l.innerHTML = '<div class="en-msg">' + (leido ? 'No ves ninguna entrega todavía.' : 'Cargando las entregas…') + '</div>';
        else if (!ls.length) l.innerHTML = '<div class="en-msg">Ninguna entrega con estos filtros.</div>';
        else l.innerHTML = ls.map(tarjeta).join('');
      }
      el.addEventListener('toggle', function (e) {
        var d = e.target, s = d && d.querySelector && d.querySelector('summary[data-que]');
        if (s) s.textContent = (d.open ? 'Ocultar ' : 'Ver ') + s.getAttribute('data-que');
      }, true);
      $('en-ver').onchange = function () { F.ver = this.value; guardarLocal(CLAVE + '_f', F); pintar(); };
      $('en-ini').onchange = function () { F.ini = this.value; guardarLocal(CLAVE + '_f', F); pintar(); };
      $('en-rec').onclick = function () {
        var b = this; b.disabled = true; b.classList.add('girando');
        ctx.tablas.refrescar([TE, TI, T], true).then(function () { if (ctx.abierta()) ctx.aviso('Entregas al día.'); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha podido actualizar: ' + String(e.message).replace(/^\w+:\s*/, ''));
        }).then(function () { b.disabled = false; b.classList.remove('girando'); });
      };
      ctx.alCambiar(function (t) { if ([TE, TI, T].indexOf(t) >= 0) pintar(); });
      pintar();
      ctx.tablas.leer([TE, TI, T]).then(function () { leido = true; if (ctx.abierta()) pintar(); }, function (e) {
        leido = true;
        $('en-lista').innerHTML = '<p class="u-error">No se han podido leer las entregas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Pulsa ↻ o vuelve a abrir la sección.</p>';
      });
    }
  });
})();
