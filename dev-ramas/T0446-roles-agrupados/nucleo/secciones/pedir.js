/*
 * Pedir a Utilo · sección base del núcleo 5.0 (T0262) · motor/modulos/pedir de utilo-apps
 *
 * En la web de cualquier cliente: una persona escribe qué necesita, puede adjuntar una captura y ve en qué punto está todo
 * lo que ha pedido su negocio. La petición la recibe el motor de Utilo, que crea la tarea en su DAILY con el cliente.
 * - Al momento: la lista sale de la copia guardada en el dispositivo y se refresca por detrás (pedirListar). Al enviar, la
 *   petición aparece arriba con «Enviando» y el formulario queda libre; si Utilo dice que no, desaparece, el texto vuelve
 *   al formulario y se dice por qué.
 * - La captura se reduce aquí (como mucho 1600 px, JPG) antes de mandarla. Se puede elegir o pegar (Ctrl+V).
 * - Estados que ve el cliente: Recibida, En marcha, Hecha, Respondida, No la haremos y (T0427) Retirada, con el color del
 *   estado del kanban.
 * - T0427 · Debajo de cada petición, su conversación con Utilo y, según lo que se pueda: «Añadir algo» (o «Contestar», si lo
 *   último es de Utilo), con captura; «Cambiar» lo que se pidió mientras nadie la ha atendido; y «Retirar» (ya no hace
 *   falta). Lo dice la base (puede: escribir, cambiar, retirar); el motor llama a pedirEscribir, pedirCambiar y pedirRetirar.
 * - config: AYUDA (texto de arriba). SUPABASE_URL, SUPABASE_CLAVE y CORREO_UTILO los usa el motor.
 */
(function () {
  'use strict';
  var TIPOS = [
    { v: 'Cambio o mejora', ayuda: 'Algo nuevo o distinto' },
    { v: 'Algo no funciona', ayuda: 'Un fallo o algo raro' },
    { v: 'Duda', ayuda: 'Cómo se hace algo' }
  ];
  var MAX = 1000, LADO = 1600;
  var ESTADOS = {
    'Recibida': { c: 'ni', ayuda: 'La tenemos. La miraremos pronto.' },
    'En marcha': { c: 'ec', ayuda: 'Estamos en ello.' },
    'Hecha': { c: 'co', ayuda: 'Ya está hecha.' },
    'Respondida': { c: 'pr', ayuda: 'Te hemos contestado debajo.' },
    'No la haremos': { c: 'x', ayuda: 'Te contamos el motivo debajo.' },
    'Retirada': { c: 'x', ayuda: 'La retirasteis: ya no hacía falta.' }
  };
  /** T0427 · Cómo se lee cada mensaje de la conversación. */
  function cabMensaje(m) {
    if (m.de === 'Utilo') return m.tipo === 'Descartada' ? 'Por qué no la haremos' : 'Respuesta de Utilo';
    return m.tipo === 'Retirada' ? (m.quien || 'Vosotros') + ' la retira' : (m.quien || 'Vosotros') + ' añade';
  }
  /** ¿Lo último que se ve es de Utilo? Entonces se «contesta»; si no, se «añade algo». */
  function contesta(s) {
    var ms = s.mensajes || [];
    return ms.length ? ms[ms.length - 1].de === 'Utilo' : !!s.respuesta;
  }

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var CLAVE = 'un_pedir_' + location.pathname;
  function leerCopia() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
  function guardarCopia(o) { try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }

  /** Reduce la imagen a LADO px como mucho y la pasa a JPG: { tipo, datos (base64), url (para verla) }. */
  function reducir(file) {
    return new Promise(function (ok, ko) {
      if (!file || !/^image\//.test(file.type)) { ko(new Error('Elige una imagen (una captura de pantalla o una foto).')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        var g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); // una captura con transparencias, sobre blanco
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var d = cv.toDataURL('image/jpeg', 0.82);
        ok({ tipo: 'image/jpeg', datos: d.split(',')[1], url: d });
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('No se ha podido leer la imagen. Prueba con otra.')); };
      img.src = url;
    });
  }

  window.UN.registrar('PEDIR', {
    abrir: function (el, ctx) {
      var copia = leerCopia() || {};
      var L = copia.solicitudes || null, hora = copia.hora || '', pendientes = [], captura = null, n = 0;
      var abierto = { id: '', que: '' }, borrador = {}, capturaM = null, enviando = '';   // T0427: lo que se escribe en una petición

      el.innerHTML =
        '<div class="pd">' +
        '<section class="pd-form" aria-labelledby="pd-t1">' +
        ' <h2 id="pd-t1" class="pd-h">Qué necesitas</h2>' +
        (ctx.config.AYUDA ? ' <p class="u-nota n-ayuda">' + texto(ctx.config.AYUDA) + '</p>' : '') +
        ' <fieldset class="pd-tipos"><legend class="u-etiqueta">Qué es</legend>' +
        TIPOS.map(function (t, i) {
          return '<label class="pd-tipo"><input type="radio" name="pd-tipo" value="' + texto(t.v) + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span><b>' + texto(t.v) + '</b><small>' + texto(t.ayuda) + '</small></span></label>';
        }).join('') + '</fieldset>' +
        ' <label class="u-campo"><span class="u-etiqueta">Cuéntanoslo</span>' +
        '  <textarea id="pd-texto" rows="5" maxlength="' + MAX + '" placeholder="Qué quieres, dónde lo has visto o qué ha fallado. Si es un fallo, qué estabas haciendo."></textarea></label>' +
        ' <div class="pd-fila"><label class="pd-urg"><input type="checkbox" id="pd-urg"> Es urgente</label><span class="u-nota pd-cont" id="pd-cont">0 / ' + MAX + '</span></div>' +
        ' <div class="pd-captura" id="pd-captura">' +
        '  <label class="u-btn pd-elegir"><input type="file" id="pd-archivo" accept="image/*" class="u-oculto">Añadir una captura</label>' +
        '  <span class="u-nota">Opcional. También puedes pegarla en el texto.</span></div>' +
        ' <p class="u-nota pd-priv">No escribas contraseñas ni datos personales de tus clientes.</p>' +
        ' <p class="u-error pd-msg" id="pd-msg" role="alert" hidden></p>' +
        ' <button type="button" class="u-btn u-btn-accion pd-enviar" id="pd-enviar">Enviar la petición a Utilo</button>' +
        '</section>' +
        '<section class="pd-lista" aria-labelledby="pd-t2">' +
        ' <div class="pd-lcab"><h2 id="pd-t2" class="pd-h">Lo que habéis pedido</h2><span class="u-nota" id="pd-hora"></span>' +
        '  <button type="button" class="u-btn" id="pd-act">Actualizar la lista</button></div>' +
        ' <div id="pd-l"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '</section></div>';

      function $(id) { return el.querySelector('#' + id); }
      var ta = $('pd-texto'), msg = $('pd-msg');

      function aviso(t) { msg.textContent = t; msg.hidden = !t; }
      ta.addEventListener('input', function () { $('pd-cont').textContent = ta.value.length + ' / ' + MAX; aviso(''); });

      /* ---------- captura ---------- */
      function pintarCaptura() {
        var c = $('pd-captura');
        if (!captura) {
          c.innerHTML = '<label class="u-btn pd-elegir"><input type="file" id="pd-archivo" accept="image/*" class="u-oculto">Añadir una captura</label>' +
            '<span class="u-nota">Opcional. También puedes pegarla en el texto.</span>';
          $('pd-archivo').onchange = function () { if (this.files[0]) ponerCaptura(this.files[0]); };
          return;
        }
        c.innerHTML = '<img class="pd-mini" src="' + captura.url + '" alt="La captura que se enviará">' +
          '<button type="button" class="u-btn" id="pd-quitar">Quitar la captura</button>';
        $('pd-quitar').onclick = function () { captura = null; pintarCaptura(); };
      }
      function ponerCaptura(f) { reducir(f).then(function (c) { captura = c; aviso(''); pintarCaptura(); }, function (e) { aviso(e.message); }); }
      $('pd-archivo').onchange = function () { if (this.files[0]) ponerCaptura(this.files[0]); };
      ta.addEventListener('paste', function (e) {
        var it = [].filter.call((e.clipboardData && e.clipboardData.items) || [], function (x) { return /^image\//.test(x.type); })[0];
        if (it) { e.preventDefault(); ponerCaptura(it.getAsFile()); }
      });

      /* ---------- enviar: al momento en la lista, el motor por detrás ---------- */
      $('pd-enviar').onclick = function () {
        var tipo = (el.querySelector('input[name=pd-tipo]:checked') || {}).value || '';
        var o = { tipo: tipo, texto: ta.value.trim(), urgente: $('pd-urg').checked };
        if (!o.texto) { aviso('Escribe qué necesitas antes de enviarlo.'); ta.focus(); return; }
        var c = captura;
        if (c) o.captura = { tipo: c.tipo, datos: c.datos };
        var p = { id: '', _n: ++n, fecha: ahora(), persona: ctx.persona, tipo: tipo, urgente: o.urgente, texto: o.texto, captura: c ? c.url : '', estado: '', _enviando: true };
        pendientes.unshift(p);
        ta.value = ''; $('pd-cont').textContent = '0 / ' + MAX; $('pd-urg').checked = false; captura = null; pintarCaptura(); aviso('');
        pintar();
        ctx.llamar('pedirEnviar', [o]).then(function (r) {
          pendientes = pendientes.filter(function (x) { return x !== p; });
          L = [r].concat((L || []).filter(function (s) { return s.id !== r.id; }));
          guardarCopia({ solicitudes: L, hora: hora });
          if (ctx.abierta()) { pintar(); ctx.aviso('Petición enviada. La verás aquí con su estado.'); }
        }, function (e) {
          pendientes = pendientes.filter(function (x) { return x !== p; });
          var t = String((e && e.message) || e || '').replace(/^\w+:\s*/, '') || 'No se ha podido enviar.';
          if (!ctx.abierta()) { ctx.aviso('No se ha podido enviar tu petición a Utilo: ' + t); return; }
          pintar();
          if (!ta.value.trim()) { ta.value = p.texto; $('pd-cont').textContent = p.texto.length + ' / ' + MAX; $('pd-urg').checked = p.urgente; if (c) { captura = c; pintarCaptura(); } }
          aviso(t + ' Tu texto sigue aquí: vuelve a enviarlo cuando quieras.');
        });
      };
      function ahora() { var d = new Date(), z = function (x) { return (x < 10 ? '0' : '') + x; }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }

      /* ---------- la lista ---------- */
      function fila(s) {
        var E = ESTADOS[s.estado], meta = [texto(s.persona || '')];
        if (s.id) meta.push(texto(s.id));
        if (s.urgente) meta.push('<b>Urgente</b>');
        var enlace = s._enviando ? s.captura : s.enlace;
        if (enlace && (/^https:\/\//.test(enlace) || /^data:image\//.test(enlace))) meta.push(s._enviando ? 'Con captura' : '<a href="' + texto(enlace) + '" target="_blank" rel="noopener">Ver la captura</a>');
        var ms = s.mensajes || [];
        var conv = ms.length ? ms.map(function (m) {
          var ok = m.enlace && /^https:\/\//.test(m.enlace);
          return '<div class="pd-r' + (m.de === 'Cliente' ? ' pd-r-cli' : '') + '"><b>' + texto(cabMensaje(m)) + ' <span class="pd-rf">' + texto(m.fecha) + '</span></b>' +
            (m.texto ? texto(m.texto) : '') + (ok ? (m.texto ? ' · ' : '') + '<a href="' + texto(m.enlace) + '" target="_blank" rel="noopener">Ver la captura</a>' : '') + '</div>';
        }).join('') : (s.respuesta ? '<div class="pd-r"><b>' + (s.estado === 'No la haremos' ? 'Por qué no la haremos' : 'Respuesta de Utilo') + '</b>' + texto(s.respuesta) + '</div>' : '');
        return '<li class="pd-s' + (s._enviando ? ' pd-enviando' : '') + '" data-id="' + texto(s.id) + '">' +
          '<div class="pd-top">' + (s._enviando ? '<span class="u-chip">Enviando</span>' :
            E ? '<span class="pd-e pd-e-' + E.c + '" title="' + texto(E.ayuda) + '">' + texto(s.estado) + '</span>' : '') +
          '<b class="pd-tipo-t">' + texto(s.tipo) + '</b><span class="pd-f">' + texto(s.fecha) + '</span></div>' +
          '<p class="pd-txt">' + texto(s.texto) + '</p>' +
          '<div class="u-nota pd-m">' + meta.join(' · ') + '</div>' + conv + acciones(s) + '</li>';
      }
      /* ---------- T0427 · seguir una petición: añadir o contestar, cambiar y retirar ---------- */
      function acciones(s) {
        var P = s.puede || {};
        if (s._enviando || !s.id) return '';
        if (abierto.id === s.id) {
          var q = abierto.que, k = s.id + ':' + q, ocupado = enviando === s.id;
          if (q === 'retirar') return '<div class="pd-mform"><p class="pd-mq"><b>¿Retirar esta petición?</b> La damos por cerrada: ya no hace falta.</p>' +
            '<label class="u-campo"><span class="u-etiqueta">Por qué <span class="u-nota">(opcional)</span></span><textarea data-borrador="' + texto(k) + '" rows="2" maxlength="' + MAX + '">' + texto(borrador[k] || '') + '</textarea></label>' +
            '<div class="pd-mb"><button type="button" class="u-btn" data-cerrar>No, dejarla</button><button type="button" class="u-btn u-btn-accion" data-hecho' + (ocupado ? ' disabled' : '') + '>' + (ocupado ? 'Retirando…' : 'Sí, retirarla') + '</button></div></div>';
          var cambiar = q === 'cambiar';
          return '<div class="pd-mform"><label class="u-campo"><span class="u-etiqueta">' + (cambiar ? 'Lo que necesitas' : contesta(s) ? 'Tu respuesta' : 'Lo que quieres añadir') + '</span>' +
            '<textarea data-borrador="' + texto(k) + '" rows="3" maxlength="' + MAX + '">' + texto(borrador[k] != null ? borrador[k] : cambiar ? s.texto : '') + '</textarea></label>' +
            (cambiar ? '' : capturaM ? '<div class="pd-captura"><img class="pd-mini" src="' + capturaM.url + '" alt="La captura que se enviará"><button type="button" class="u-btn" data-quitar-captura>Quitar la captura</button></div>'
              : '<div class="pd-captura"><label class="u-btn pd-elegir"><input type="file" accept="image/*" class="u-oculto" data-captura>Añadir una captura</label></div>') +
            '<div class="pd-mb"><button type="button" class="u-btn" data-cerrar>Cancelar</button><button type="button" class="u-btn u-btn-accion" data-hecho' + (ocupado ? ' disabled' : '') + '>' +
            (ocupado ? 'Enviando…' : cambiar ? 'Guardar el cambio' : contesta(s) ? 'Contestar' : 'Añadir') + '</button></div></div>';
        }
        var b = [];
        if (P.escribir) b.push('<button type="button" class="u-btn" data-abrir="escribir">' + (contesta(s) ? 'Contestar' : 'Añadir algo') + '</button>');
        if (P.cambiar) b.push('<button type="button" class="u-btn" data-abrir="cambiar">Cambiar</button>');
        if (P.retirar) b.push('<button type="button" class="u-btn pd-retirar" data-abrir="retirar">Retirar</button>');
        return b.length ? '<div class="pd-acc">' + b.join('') + '</div>' : '';
      }
      function solicitud(id) { return (L || []).filter(function (s) { return s.id === id; })[0] || null; }
      $('pd-l').addEventListener('input', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-borrador'); if (k) borrador[k] = e.target.value; });
      $('pd-l').addEventListener('change', function (e) {
        if (e.target.hasAttribute && e.target.hasAttribute('data-captura') && e.target.files[0]) {
          reducir(e.target.files[0]).then(function (c) { capturaM = c; pintar(); }, function (er) { ctx.aviso(er.message); });
        }
      });
      $('pd-l').addEventListener('click', function (e) {
        var li = e.target.closest('li[data-id]'), id = li && li.getAttribute('data-id');
        if (!id) return;
        var a = e.target.closest('[data-abrir]');
        if (a) { abierto = { id: id, que: a.getAttribute('data-abrir') }; capturaM = null; pintar(); var t = el.querySelector('li[data-id="' + id + '"] textarea'); if (t) t.focus(); return; }
        if (e.target.closest('[data-cerrar]')) { abierto = { id: '', que: '' }; capturaM = null; pintar(); return; }
        if (e.target.closest('[data-quitar-captura]')) { capturaM = null; pintar(); return; }
        if (!e.target.closest('[data-hecho]') || enviando) return;
        var q = abierto.que, k = id + ':' + q, s0 = solicitud(id), txt = String(borrador[k] != null ? borrador[k] : q === 'cambiar' && s0 ? s0.texto : '').trim();
        var o = { solicitud: id }, fn = q === 'cambiar' ? 'pedirCambiar' : q === 'retirar' ? 'pedirRetirar' : 'pedirEscribir';
        if (q === 'retirar') o.motivo = txt;
        else {
          if (!txt && !(q === 'escribir' && capturaM)) { ctx.aviso(q === 'cambiar' ? 'Escribe qué necesitas.' : 'Escribe qué quieres añadir.'); return; }
          o.texto = txt;
          if (q === 'escribir' && capturaM) o.captura = { tipo: capturaM.tipo, datos: capturaM.datos };
        }
        enviando = id; pintar();
        ctx.llamar(fn, [o]).then(function (r) {
          enviando = ''; delete borrador[k]; abierto = { id: '', que: '' }; capturaM = null;
          if (r && r.id) L = (L || []).map(function (s) { return s.id === r.id ? r : s; });
          guardarCopia({ solicitudes: L, hora: hora });
          if (ctx.abierta()) { pintar(); ctx.aviso(q === 'retirar' ? 'Petición retirada.' : q === 'cambiar' ? 'Cambio guardado.' : 'Enviado a Utilo.'); }
        }, function (er) {
          enviando = '';
          if (ctx.abierta()) { pintar(); ctx.aviso('No se ha podido guardar: ' + String((er && er.message) || er || '').replace(/^\w+:\s*/, '')); }
        });
      });

      function pintar() {
        var l = $('pd-l');
        if (!l) return;
        $('pd-hora').textContent = hora ? 'Actualizada a las ' + hora : '';
        if (!L && !pendientes.length) return; // todavía cargando la primera vez
        var todas = pendientes.concat(L || []);
        if (!todas.length) { l.innerHTML = '<p class="u-vacio">Todavía no habéis pedido nada. Lo que pidáis saldrá aquí, con su estado y nuestra respuesta.</p>'; return; }
        l.innerHTML = '<ul class="pd-ul">' + todas.map(fila).join('') + '</ul>';
      }
      function cargar() {
        var b = $('pd-act');
        b.disabled = true; b.textContent = 'Actualizando…';
        ctx.llamar('pedirListar').then(function (r) {
          if (!ctx.abierta()) return;
          b.disabled = false; b.textContent = 'Actualizar la lista';
          L = (r && r.solicitudes) || []; hora = (r && r.hora) || '';
          guardarCopia({ solicitudes: L, hora: hora });
          pintar();
        }, function (e) {
          if (!ctx.abierta()) return;
          b.disabled = false; b.textContent = 'Actualizar la lista';
          var t = String((e && e.message) || e || '').replace(/^\w+:\s*/, '');
          if (L) { ctx.aviso('No se ha podido actualizar la lista: ' + t); return; }
          $('pd-l').innerHTML = '<p class="u-error">No se ha podido cargar lo que habéis pedido.</p><p class="u-nota">' + texto(t) + ' Pulsa «Actualizar la lista» para probar otra vez.</p>';
        });
      }
      $('pd-act').onclick = cargar;
      pintar();  // al momento, con lo guardado
      cargar();  // y por detrás, con Utilo
    }
  });
})();
