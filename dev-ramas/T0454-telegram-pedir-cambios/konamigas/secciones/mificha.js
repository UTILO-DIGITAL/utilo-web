/*
 * Tu ficha · área de Konamigas sobre Supabase (T0391) · clientes/konamigas/modulos/mificha de utilo-apps
 *
 * La ficha de la jugadora que ha entrado con su código: la fila de JUGADORAS cuya PERSONA es ella (ctx.personaId). Entre
 * con el correo que entre, es la misma persona y la misma ficha. Las reglas por fila ya solo le dejan leer la suya; quien ve
 * más (Socio, admin) también ve solo la suya aquí. Sin ficha (staff que no juega, o una ficha duplicada que aún no se ha
 * juntado), lo dice. Los correos con los que entra se cambian en Perfil («Tus correos»). Solo lee. Provisional hasta el
 * área de jugadora de K7.
 */
(function () {
  'use strict';
  var T = 'JUGADORAS';

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fecha(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? +m[3] + '/' + +m[2] + '/' + m[1] : ''; }

  /** Sus fichas (normalmente una), por su persona. */
  function mias(filas, yo) { return yo ? (filas || []).filter(function (j) { return j.PERSONA === yo; }) : []; }

  function htmlFicha(j) {
    var nombre = [j.NOMBRE, j.APELLIDO_1, j.APELLIDO_2].filter(Boolean).join(' ');
    var datos = [
      ['Teléfono', j.TELEFONO], ['Correo', j.EMAIL], ['Instagram', j.INSTAGRAM ? '@' + j.INSTAGRAM : ''], ['Idioma', j.IDIOMA],
      ['Nacimiento', fecha(j.FECHA_NACIMIENTO)], ['Documento', [j.TIPO_DOCUMENTO, j.NUM_DOCUMENTO].filter(Boolean).join(' ')],
      ['Juegas desde', fecha(j.FECHA_ALTA)],
      ['Tu nombre en lo público', j.NOMBRE_PUBLICO ? 'Entero' : 'Nombre e inicial del apellido (' + [j.NOMBRE || '', String(j.APELLIDO_1 || '').trim() ? String(j.APELLIDO_1).trim().charAt(0).toUpperCase() + '.' : ''].filter(String).join(' ') + ')'] // T0395: «Berta E.», como nombres_jugadoras
    ].filter(function (d) { return d[1]; });
    return '<div class="u-perfil"><div class="u-perfil-quien"><strong>' + texto(nombre) + '</strong><span>Ficha ' + texto(j.ID) + '</span></div>' +
      '<dl>' + datos.map(function (d) { return '<dt>' + texto(d[0]) + '</dt><dd>' + texto(d[1]) + '</dd>'; }).join('') + '</dl></div>';
  }

  if (typeof window !== 'undefined' && window.UN) window.UN.registrar('MIFICHA', {
    abrir: function (el, ctx) {
      function pintar() {
        if (!ctx.abierta()) return;
        var fs = mias(ctx.tablas.filas(T), ctx.personaId);
        el.innerHTML = (fs.length ? fs.map(htmlFicha).join('') :
          '<p class="u-vacio">No hay ninguna ficha de jugadora con tu cuenta. Si juegas en Konamigas, pide que revisen que tu correo es el de tu ficha.</p>') +
          '<p class="u-nota">Entres con el correo que entres, es tu misma ficha. Los correos con los que entras, en <a href="?s=perfil" data-sx="PERFIL">Perfil</a>.</p>';
      }
      ctx.alCambiar(function (t) { if (t === T) pintar(); });
      if (ctx.tablas.filas(T).length) pintar();
      else el.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div></div>';
      ctx.tablas.leer([T]).then(pintar, function (e) { if (ctx.abierta()) el.innerHTML = '<p class="kz-aviso">' + texto(e.message) + '</p>'; });
    }
  });

  // Para las pruebas en node.
  if (typeof module !== 'undefined') module.exports = { mias: mias, htmlFicha: htmlFicha };
})();
