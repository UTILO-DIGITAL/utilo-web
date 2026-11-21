  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function json(t) { try { return JSON.parse(t || 'null'); } catch (e) { return null; } }
  var ICONO_AJUSTAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  var ICONO_X = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICONO_INFO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';
  var ICONO_FILTRO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z"/></svg>';
  var ICONO_COPIAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
  var ICONO_OK = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  // T0679 · Los enlaces de una ficha, con el icono de lo que abren (sin la flecha ↗).
  var ICONO_WEB = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>';
  var ICONO_IG = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg>';
  var ICONO_MAIL = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>';
  var ICONO_TEL = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>';
  var ICONO_FOTO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
  /** La dirección de una web, corta y sin «https://www.» (ejemplo.com/casa). */
  function webCorta(v) { return String(v).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); }
  /** T0724 (R44) · En la tabla, solo el sitio («docs.google.com»): la dirección entera va al pasar por encima y en la ficha. */
  function webSitio(v) { return webCorta(v).replace(/[\/?#].*$/, ''); }
  var ICONO_FLECHA = '<svg class="u-icono li-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var ICONO_MAS = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var ICONO_MOVER = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="13" height="14" rx="2"/><path d="M3.5 9.5h13M7.5 3v4M12.5 3v4M15 15h6M18.5 12.5L21 15l-2.5 2.5"/></svg>';
  var ICONO_RELOJ = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
  var MENU = 'MENU'; // la fila de PREFERENCIAS con el orden del menú
  var teclaEsc = null, alMover = null, alSoltar = null, alCancelar = null, alDesplazar = null, alTocarFuera = null; // oyentes del documento, para quitarlos al cerrar

  window.UN.registrar('LISTADO', {
    // T0732 (R50): el marco pregunta aquí antes de volver a abrir la sección con atrás (true: ya está hecho).
    atras: function (st) { return atrasDe ? atrasDe(st) : false; },
    abrir: function (el, ctx) {
      // Las secciones a las que se puede ir (las que ve quien ha entrado), para los enlaces de lo relacionado.
      var veo = {}; (ctx.secciones || []).forEach(function (s) { veo[s.id] = s.titulo; });
      // T0692: las ventas (VENTAS y los campos con «venta»), solo para quien ve su sección (Pedidos).
      // T0717: con SOLO_LEER, sin nada que cambie.
      var T = ctx.tablas, cfg = soloMirar(sinVentas(sinOcultas(ctx.config || {}, ctx.ocultar), veo), { admin: !!ctx.admin, perfil: ctx.perfil }), PROHIB = cfg.PROHIBIDO === undefined ? PROHIB_DEFECTO : cfg.PROHIBIDO;
      var BASE = apartado(cfg, ctx.id, ctx.titulo), PREF = cfg.PREFERENCIAS || '';
      var puedePersonalizar = !!ctx.admin || (cfg.PERSONALIZAN || []).indexOf(ctx.perfil) >= 0;
      var K = 'li_' + ctx.id + '_';
      // T0689 · Mías / Todas: con MIAS y alguien más en el equipo (ctx.equipo, de ACCESOS y quien administra). Cada fila es de
      // quien dice su columna (su correo); la que no dice nada, de quien administra y de los perfiles de «sinNadie».
      var EQ = equipoLimpio(ctx.equipo), YO = { correo: String(ctx.correo || '').toLowerCase(), perfil: ctx.perfil || '', admin: !!ctx.admin };
      var MIAS = hayMias(BASE.mias, EQ, YO.correo) ? BASE.mias : null;
      var KM = K + 'mias_' + YO.correo;
      // T0625: los filtros (S.filtros) no se recuerdan: al volver a la sección, se ve todo.
      var S = { vista: guardado(K + 'vista'), q: '', aviso: '', filtros: {}, leido: false, menu: '', ctx: '', mas: {}, abre: {}, antes: {}, mias: guardado(KM) === 'todas' ? 'todas' : 'mias' };
      var url = new URLSearchParams(location.search), pedida = url.get('ficha');
      // T0642: si se llega desde otra ficha, su nombre se queda en esta entrada del historial: vale también al ir y volver.
      if (vueltaPendiente !== null) { try { history.replaceState(Object.assign({}, history.state, { deFicha: vueltaPendiente }), ''); } catch (e) {} vueltaPendiente = null; }
      var deFicha = (history.state && history.state.deFicha) || '';

      el.innerHTML = '<div id="li-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="li-velo"><div class="u-ventana li-ventana" role="dialog" aria-modal="true" aria-labelledby="li-vt"><div class="n-ventana" id="li-vent"></div></div></div>' +
        '<div class="u-aviso li-deshacer" id="li-deshacer" role="status" hidden><span></span><button type="button" data-deshacer>Deshacer</button></div>' +
        '<aside class="li-ctx" id="li-ctx" role="dialog" aria-labelledby="li-ctx-t" hidden></aside>';
      var cont = el.querySelector('#li-cont'), velo = el.querySelector('#li-velo'), vent = el.querySelector('#li-vent'), avDes = el.querySelector('#li-deshacer'), pCtx = el.querySelector('#li-ctx');
      // T0602: una foto que no se puede ver (un archivo de Drive que no es público ni de quien mira) no sale rota.
      // T0633: en su lugar, un aviso (en la ficha, con el porqué; el enlace «Ver foto ↗» sigue al lado), no un hueco.
      el.addEventListener('error', function (e) {
        var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-li-foto') || !t.parentNode) return;
        // T0691: en el muestrario, una foto que no se ve deja su fondo neutro, como una tela sin foto (sin «No se ve»).
        if (/\bli-gal-img\b/.test(t.className)) { t.parentNode.removeChild(t); return; }
        var grande = /\bli-foto\b/.test(t.className), s = document.createElement('span');
        s.className = 'li-nofoto' + (grande ? ' li-nofoto-g' : '') + (/\bli-t-img\b/.test(t.className) ? ' li-t-img' : '');
        s.textContent = grande ? SIN_FOTO.largo : SIN_FOTO.corto;
        if (!grande) s.title = SIN_FOTO.largo;
        t.parentNode.replaceChild(s, t);
      }, true);

      /* ---------- datos ---------- */
      var tablas = [BASE.tabla];
      BASE.relacionados.forEach(function (r) { [r].concat(lista(r.juntar)).forEach(function (j) { if (j.tabla && tablas.indexOf(j.tabla) < 0) tablas.push(j.tabla); }); });
      Object.keys(cfg.VALORES || {}).forEach(function (k) { var v = cfg.VALORES[k]; if (v && v.tabla && tablas.indexOf(v.tabla) < 0) tablas.push(v.tabla); });
      if (PREF && tablas.indexOf(PREF) < 0) tablas.push(PREF);
      // Las tablas a las que apuntan (los nombres de las fases, de las marcas…) y las de los campos con «de».
      Object.keys(BASE.refs).forEach(function (t) { if (tablas.indexOf(t) < 0) tablas.push(t); });
      Object.keys(BASE.campos).forEach(function (c) { var de = BASE.campos[c].de; if (de && de.tabla && tablas.indexOf(de.tabla) < 0) tablas.push(de.tabla); });
      // T0641: y las de los campos con «de» de lo relacionado (la composición de la alternativa de una comparativa).
      BASE.relacionados.forEach(function (r) { Object.keys(r.campos || {}).forEach(function (c) { var de = r.campos[c].de; if (de && de.tabla && tablas.indexOf(de.tabla) < 0) tablas.push(de.tabla); }); });
      // T0708: las de por medio de un «de» por una ruta (DISENOS, para las telas de un proveedor) y las del resumen.
      function ruta(de) { if (de && de.tabla) tablasDeRuta(BASE, de.tabla, de.campo).forEach(function (t) { if (tablas.indexOf(t) < 0) tablas.push(t); }); }
      Object.keys(BASE.campos).forEach(function (c) { ruta(BASE.campos[c].de); });
      BASE.relacionados.forEach(function (r) { Object.keys(r.campos || {}).forEach(function (c) { ruta(r.campos[c].de); }); });
      if (BASE.resumen) BASE.resumen.cifras.forEach(function (x) {
        if (tablas.indexOf(x.tabla) < 0) tablas.push(x.tabla);
        camposCond(x.si).forEach(function (c) { ruta({ tabla: x.tabla, campo: c }); }); // T0734: las de por medio de su «si»
      });
      BASE.arriba.forEach(function (x) { if (tablas.indexOf(x.tabla) < 0) tablas.push(x.tabla); }); // T0710
      // T0652: las del resumen de con quién es cada fila (la marca, sus necesidades, sus personas).
      if (BASE.contexto) Object.keys(BASE.contexto.de).forEach(function (c) {
        var d = BASE.contexto.de[c];
        [d.tabla].concat(d.lineas.map(function (l) { return l && l.tabla; })).forEach(function (t) { if (t && tablas.indexOf(t) < 0) tablas.push(t); });
      });
      function filas(t) { return T.filas(t) || []; }
      function filaDe(t, id) { return T.fila ? T.fila(t, id) : null; }
      var D = { filas: filas, fila: filaDe };
      /** Lo personalizado: de la tabla PREFERENCIAS (para todos) o, sin ella, del dispositivo. */
      function prefDe(clave) {
        var f = PREF ? filaDe(PREF, clave) : null;
        return json(f ? f.VALOR : guardado('li_pref_' + clave));
      }
      function ap() { var a = enriquecer(aplicar(BASE, prefDe(ctx.id)), D); return MIAS ? conEquipo(a, MIAS.campo, EQ) : a; }
      /** T0689 · La etiqueta de para quién es una fila que no es mía, en «Todas» («Alejandro»); la de nadie, de quien administra. */
      function etPara(f) {
        if (!MIAS || S.mias !== 'todas' || esMia(MIAS, f, YO)) return '';
        var v = String((f.__crudo || f)[MIAS.campo] || '').trim(), adm = EQ.filter(function (p) { return p.admin; })[0];
        var n = v ? nombrePara(EQ, v) : adm ? nombrePara(EQ, adm.correo) : '';
        return n ? ' <span class="li-para">' + texto(n) + '</span>' : '';
      }
      /** Las filas como se ven (nombres en vez de códigos, rutas, «de»); cada una con la de verdad en __crudo. */
      function vistas(a) { return preparar(a, filas(a.tabla), D, VAL); }
      function filaVista(a, id) { return vistas(a).filter(function (f) { return String(f[a.clave]) === String(id); })[0] || null; }
      function vistaActual(a) { var vs = vistasDe(a); return vs.filter(function (v) { return v.id === S.vista; })[0] || vs[0]; }
      var VAL = {};
      var errores = null, pintado = '', SOPORTE_YO = esSoporte(ctx.correo);

      /* ---------- T0692 · ventas (de Pedidos) ---------- */
      var VENTAS = cfg.VENTAS && cfg.VENTAS.seccion ? cfg.VENTAS : null, venSec = VENTAS ? String(VENTAS.seccion).toUpperCase() : '';
      /** «Sus ventas» de una fila (vacío si no tiene; «Mirando…» mientras no han llegado). */
      function htmlVentasDe(crudo, hoy) {
        return htmlVentas(D.ventas ? D.ventas[String(crudo[BASE.clave])] || null : undefined, { titulo: VENTAS.titulo, nombre: VENTAS.nombre, seccion: venSec, va: veo[venSec], max: VENTAS.max, hoy: hoy });
      }
      /** Las ventas de cada fila, de su sección (sin abrirla). Al llegar, la lista (Última venta) y la ficha abierta las enseñan. */
      function leerVentas() {
        if (!VENTAS || !window.UN.seccion) return;
        window.UN.seccion(venSec).then(function (s) {
          return s && s.def && typeof s.def.ventasDe === 'function' ? s.def.ventasDe(T, s.config, VENTAS.campo) : null;
        }).then(function (o) { ponerVentas(o || {}); }, function () { ponerVentas({}); });
      }
      function ponerVentas(o) {
        D.ventas = o;
        if (!ctx.abierta()) return;
        pintar();
        var sv = vent.querySelector('#li-ventas'), f = abierta && filaVista(ap(), abierta.id);
        if (sv && f) sv.innerHTML = htmlVentasDe(f.__crudo || {}, hoyIso());
      }

      /* ---------- pintar ---------- */
      /** conEnlaces: true en la ficha (enlaces y fotos); 'tabla' en la tabla del ordenador (T0724, R44: solo los enlaces, cortos). */
      function celda(a, c, f, conEnlaces, cliente) {
        var cp = campo(a, c), t = verTexto(cp, f, VAL, PROHIB), enTabla = conEnlaces === 'tabla';
        if (c === a.codigo && t) return '<span class="li-cod">' + texto(t) + '</span>';
        // T0731 (R67, R71): en una lista (no en los datos de la ficha), lo vacío con «siVacio» lo dice en palabras, en suave.
        if (t === '') return cp.siVacio && conEnlaces !== true ? '<span class="li-sinvalor">' + texto(cp.siVacio) + '</span>' : '<span class="li-nada">—</span>';
        // T0679: en la lista, lo de siempre («Tarea», «Pendiente») no se repite en cada fila: solo sale lo que es distinto.
        if (conEnlaces !== true && cp.comun && lista(cp.comun).indexOf(t) >= 0) return '<span class="li-nada li-comun"></span>';
        var v = f[c];
        if (cp.calculo && cp.envio && t.indexOf('Falta') === 0) return cliente ? 'Precio a consultar' : '<span class="u-mal">' + texto(t) + '</span>';
        if (cp.signo) { var sv = calcular(cp.calculo, f, VAL); return '<span class="' + (sv > 0.00001 ? 'li-signo-mas' : (sv < -0.00001 ? 'li-signo-menos' : '')) + '">' + texto(t) + '</span>'; }
        if (conEnlaces && !cp.calculo && !prohibido(v, PROHIB).length) {
          if (cp.tipo === 'enlace' && /^https?:\/\//i.test(String(v))) return '<a class="li-enl" href="' + texto(v) + '" target="_blank" rel="noopener"' + (enTabla ? ' title="' + texto(v) + '"' : '') + '>' + ICONO_WEB + '<span>' + texto(enTabla ? webSitio(v) : webCorta(v)) + '</span></a>';
          if (cp.tipo === 'instagram' && instagramUrl(v)) return '<a class="li-enl" href="' + texto(instagramUrl(v)) + '" target="_blank" rel="noopener">' + ICONO_IG + '<span>' + texto(cuentaInstagram(v)) + '</span></a>';
          if (cp.tipo === 'email' && /@/.test(String(v))) return '<a class="li-enl" href="mailto:' + texto(v) + '">' + ICONO_MAIL + '<span>' + texto(v) + '</span></a>';
          if (cp.tipo === 'telefono' && esTelefono(v)) return '<a class="li-enl" href="tel:' + texto(telDe(v)) + '">' + ICONO_TEL + '<span>' + texto(v) + '</span></a>';
          if (cp.tipo === 'foto' && imagen(v) && !enTabla) return '<img class="li-foto" src="' + texto(imagen(v)) + '" alt="" referrerpolicy="no-referrer" data-li-foto>' +
            (/^https?:/i.test(String(v)) ? ' <a class="li-enl li-verfoto" href="' + texto(v) + '" target="_blank" rel="noopener">' + ICONO_FOTO + '<span>Ver foto</span></a>' : '');
        }
        if (cp.tipo === 'foto') return imagen(v) ? '<img class="li-mini" src="' + texto(imagen(v)) + '" alt="" referrerpolicy="no-referrer" data-li-foto>' : texto(t);
        if (cp.tipo === 'estado' || cp.colores) {
          var col = (cp.colores || {})[String(v)] || '';
          return '<span class="u-chip li-estado' + (col ? ' li-' + texto(col) : '') + '">' + texto(t) + '</span>';
        }
        // T0679: primero cuándo, en palabras («hace 9 días»); debajo, el día, pequeño («mar 10/11»).
        if (cp.tipo === 'fecha') { var hy = hoyIso(), cu = cuando(v, hy); return cu ? '<span class="li-cuando-1">' + texto(cu.charAt(0).toUpperCase() + cu.slice(1)) + '</span><span class="u-nota li-fecha-d">' + texto(fechaDia(v, hy)) + '</span>' : texto(t); }
        return texto(t);
      }
      /**
       * T0641 · Lo relacionado como tarjetas cortas (la comparativa de una marca): el título, una línea con lo que se decide
       * («Hoy 32,00 €/m (Yutes) · BOR-004 a 21,41 €/m · Ahorra 32 %»), lo de debajo (el estado) y, al tocar «Ver detalle», el
       * cara a cara (una fila por dato, una columna por lado; sin la fila si los dos están vacíos) y el resto de sus datos.
       */
      function tarjetas(r, otro, rs, max) {
        var tj = r.tarjeta, cmp = tj.comparar || {}, tits = cmp.titulos || [];
        var nada = function (t) { return t.indexOf('class="li-nada"') >= 0; };
        return '<ul class="li-rt">' + rs.map(function (x, i) {
          var trozos = function (cs, cls) {
            var p = (cs || []).map(function (c) { var t = celda(otro, c, x, false); return nada(t) ? '' : '<span>' + t + '</span>'; }).join('');
            return p ? '<div class="' + cls + '">' + p + '</div>' : '';
          };
          var cara = (cmp.filas || []).map(function (fl) {
            var vs = (fl.campos || []).map(function (c) { return celda(otro, c, x, false); });
            return vs.every(nada) ? '' : '<span class="u-etiqueta">' + texto(fl.titulo || '') + '</span>' + vs.map(function (v) { return '<span>' + v + '</span>'; }).join('');
          }).join('');
          if (cara) cara = '<div class="li-cara" style="grid-template-columns:auto' + new Array(tits.length + 1).join(' 1fr') + '"><span></span>' +
            tits.map(function (t) { return '<span class="u-etiqueta li-cara-t">' + texto(t) + '</span>'; }).join('') + cara + '</div>';
          var det = (tj.detalle || []).map(function (c) {
            var cp = campo(otro, c), t = celda(otro, c, x, true);
            return nada(t) ? '' : '<div class="li-dato' + (cp.tipo === 'nota' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + t + '</span></div>';
          }).join('');
          var mas = cara || det ? '<details class="li-rt-mas"><summary>' + texto(tj.verMas || 'Ver detalle') + '</summary>' + cara + (det ? '<div class="u-campos">' + det + '</div>' : '') + '</details>' : '';
          return '<li class="li-rt-f"' + (max && i >= max ? ' hidden data-resto' : '') + '><div class="li-rt-t">' + celda(otro, tj.titulo || otro.nombre, x, false) + '</div>' + trozos(tj.linea, 'li-rt-l') + trozos(tj.debajo, 'li-rt-d') + mas + '</li>';
        }).join('') + '</ul>';
      }
      /** El nombre de una fila con su código delante (el de la tarea, para trabajarla en Claude). */
      function titulo2(a, f, cli, conCodigo) {
        // T0642: el código (S-0002, M-001) solo en la ficha, para trabajar esa fila en Claude; en la lista no dice nada a quien la usa (se sigue buscando por él).
        var cod = conCodigo && a.codigo && a.codigo !== a.nombre && !vacio(f[a.codigo]) ? '<span class="li-cod">' + texto(f[a.codigo]) + '</span> ' : '';
        return cod + celda(a, a.nombre, f, false, cli) + (conCodigo ? '' : etPara(f));
      }
      /** T0624 · Una fecha que hace saltar un aviso de vencido o pendiente, con su color (y su palabra: «hace 3 días», «hoy»). */
      function fechaAviso(a, c, h, avs) {
        var n = campo(a, c).tipo === 'fecha' ? nivelDeCampo(avs, c) : '';
        return n && h.indexOf('class="li-nada"') < 0 ? '<span class="li-fecha li-' + n + '">' + h + '</span>' : h;
      }
      function marcas(avs) { return avs.map(function (x) { return '<span class="li-aviso li-' + texto(x.nivel || 'medio') + '">' + texto(x.titulo) + '</span>'; }).join(''); }

