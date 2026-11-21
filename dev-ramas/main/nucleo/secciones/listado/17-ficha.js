      var abierta = null; // { id } de la ficha abierta, para «Copiar para Claude»
      function ficha(id, nueva, puesto) {
        var a = ap(), vista = vistaActual(a), fuera = ocultas(a, vista), f = nueva ? {} : filaVista(a, id), hoy = hoyIso(), cli = !!vista.cliente;
        if (!f) { ctx.aviso('Esa fila ya no está.'); return; }
        var crudo = f.__crudo || {}; // lo que de verdad hay (los códigos), para editar
        if (nueva) crudo = Object.assign(nuevaFila(a), puesto || {}); // T0642: lo que trae «+ Nueva tarea» (su marca)
        if (relDeFicha !== String(id)) { relAbiertas = {}; relDeFicha = String(id); } // T0651
        abierta = nueva ? null : { id: id };
        var llegada = nueva ? !!(puesto && url.get('nueva')) : !!pedida && String(id) === String(pedida); // la ficha que trae la dirección
        var ed = cli ? [] : editables(a).filter(function (c) { return fuera.indexOf(c) < 0 && (nueva || !campo(a, c).soloAlta); });
        // T0651: lo que se edita de una ruta («ID_DISENO.ANCHO», del diseño de la tela), con su valor de verdad al lado del resto.
        var crudoEd = mezclar(crudo, {});
        ed.filter(esRuta).forEach(function (c) { crudoEd[c] = nueva ? '' : seguirCrudo(a, D, a.tabla, crudo, c); });
        // T0651: en una ficha que ya está y guarda sola, cada campo se lee como texto y se edita tocándolo.
        var tocar = !nueva && !cli && a.guardar === 'solo';
        var grupos = a.ficha.length ? a.ficha : [{ titulo: '', campos: columnasDe(a, vista) }];
        var avs = nueva || cli ? [] : avisosDe(a, f, hoy);
        // T0706: los botones de ACCIONES que se recomiendan ahora; el aviso que dice lo mismo («recomendar».aviso) no sale dos veces.
        var acc = nueva || cli ? [] : accionesDe(a, f, hoy).filter(function (x) { return !x.ir || veo[String(x.ir).toUpperCase()]; });
        var accRec = acc.filter(function (x) { return !x.ir && recomendacionDe(x, f, hoy); });
        var yaDichos = accRec.map(function (x) { return recomendacionDe(x, f, hoy).aviso; }).filter(Boolean);
        avs = avs.filter(function (x) { return yaDichos.indexOf(x.id) < 0; });
        var tv = llegada ? textoVuelta(deFicha, ctx.desde) : ''; // T0642: a la ficha de la que vienes, si vienes de una
        var vuelta = tv ? '<button type="button" class="u-btn u-btn-texto li-volver" data-volver>' + texto(tv) + '</button>' : '';
        // T0651: con la ficha que se edita tocando, el nombre se cambia tocando el título (no sale abajo como un campo más).
        var nomTit = tocar && ed.indexOf(a.nombre) >= 0 && !campo(a, a.nombre).colores;
        var h = vuelta + '<div class="li-ficha-cab"><h2 id="li-vt">' + (nueva ? texto(a.alta && a.alta.titulo ? a.alta.titulo : 'Añadir · ' + a.titulo) : nomTit ? (a.codigo && a.codigo !== a.nombre && !vacio(f[a.codigo]) ? '<span class="li-cod">' + texto(f[a.codigo]) + '</span> ' : '') + datoTocar(a, a.nombre, f, cli) : titulo2(a, f, cli, true)) + '</h2>' +
          '<button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>';
        if (avs.length) h += '<div class="li-ficha-avisos">' + marcas(avs) + '</div>';
        // T0706: lo que cambia la fila y se recomienda ahora («Ya habéis tenido la reunión…» [Pasar a Clientes]), arriba y a
        // la vista, con su porqué; nunca lo hace sola. Los demás, en «Más». T0687: uno con «ir», solo si se ve esa sección.
        h += accRec.map(function (x) {
          return '<div class="li-recomienda" role="note"><p>' + texto(recomendacionDe(x, f, hoy).texto) + '</p><button type="button" class="u-btn" data-accion="' + acc.indexOf(x) + '">' + texto(x.titulo) + '</button></div>';
        }).join('');
        if (cli) h += '<p class="li-cliente">Ficha para enseñar a un cliente: sin datos privados.</p>';
        // T0643: arriba, cerrarla o pasarla en un toque (guardan solas, sin «Guardar»).
        if (!nueva && conRapidas(a, vista) && rapidaEn(a, f, hoy)) {
          var rr = a.rapidas, edr = editables(a);
          h += '<div class="li-rapidas">' + (rr.hecha && edr.indexOf(rr.hecha.campo) >= 0 ? '<button type="button" class="u-btn li-r-hecha" data-r-hecha>' + ICONO_OK + texto(rr.hecha.valor) + '</button>' : '') +
            (rr.pasar && edr.indexOf(rr.pasar) >= 0 ? opcionesPasar(hoy).map(function (o) { return '<button type="button" class="u-btn" data-r-pasar="' + o.fecha + '" title="' + texto(diaCorto(o.fecha)) + '">' + texto(o.corto) + '</button>'; }).join('') : '') + '</div>';
        }
        var puestos = [];
        // T0630: lo que tiene algo, cada uno en su sitio; lo vacío, junto en una línea al final de su apartado («Sin
        // rellenar: Formato, Notas»). Lo que se edita se abre al tocar su nombre (su campo ya está, escondido, en el form).
        var lleno = function (c) { return ed.indexOf(c) >= 0 ? !vacio(crudoEd[c]) : verTexto(campo(a, c), f, VAL, PROHIB) !== ''; };
        var apartadoFicha = function (titulo, cs) {
          if (!cs.length) return '';
          cs.forEach(function (c) { puestos.push(c); });
          var rp = nueva ? { ver: cs, vacios: [] } : repartir(cs, lleno, a.obligatorias);
          var cuerpo = rp.ver.map(function (c) {
            if (ed.indexOf(c) >= 0) return tocar && !campo(a, c).colores ? datoTocar(a, c, f, cli) : entrada(a, c, crudoEd);
            var cp = campo(a, c);
            // T0651: lo que no se edita en una ficha que sí: una palabra pequeña junto a su etiqueta («· calculado») y, si es de
            // otra fila que tiene su sección (el próximo paso, de su tarea), el dato entero lleva a ella, con una flecha suave.
            var suf = tocar && ed.length ? sufijoFijo(cp) : '';
            var irSec = tocar && cp.de && cp.ir ? cp.ir.seccion.toUpperCase() : '', irId = irSec && f.__de ? f.__de[c] : '';
            if (irId && veo[irSec]) return '<a class="li-dato li-va' + (cp.tipo === 'nota' ? ' u-ancho' : '') + '" href="?s=' + encodeURIComponent(irSec.toLowerCase()) + '&ficha=' + encodeURIComponent(irId) + '" data-sx="' + texto(irSec) + '">' +
              '<span class="u-etiqueta">' + texto(cp.titulo) + (suf ? '<span class="li-suf"> · ' + texto(suf) + '</span>' : '') + '</span><span class="li-valor">' + celda(a, c, f, false, cli) + '</span>' + ICONO_FLECHA.replace('li-flecha', 'li-flecha li-va-i') + '</a>';
            // T0641: un calculado con «desglose» lleva debajo sus cuentas (no para un cliente: enseñan el coste) y ocupa todo el ancho.
            var dg = cli ? '' : desglose(a, cp, f, VAL);
            return '<div class="li-dato' + (cp.tipo === 'nota' || cp.tipo === 'foto' || dg ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + (suf ? '<span class="li-suf"> · ' + texto(suf) + '</span>' : '') + '</span><span class="li-valor">' + celda(a, c, f, true, cli) + '</span>' +
              (dg ? '<span class="li-desglose">' + texto(dg) + '</span>' : '') +
              (cp.ayuda && !cli && !dg ? '<span class="u-nota">' + texto(cp.ayuda) + '</span>' : '') + '</div>';
          }).join('') + rp.vacios.filter(function (c) { return ed.indexOf(c) >= 0; }).map(function (c) {
            return entrada(a, c, crudoEd).replace(/^<div class="u-campo/, '<div hidden data-hueco="' + texto(c) + '" class="u-campo');
          }).join('');
          // T0642: en «Sin rellenar», solo lo que se puede rellenar aquí (lo demás, vacío, no sale: no se puede tocar).
          var aRellenar = rp.vacios.filter(function (c) { return ed.indexOf(c) >= 0; });
          var linea = aRellenar.length ? '<p class="li-vacios"><span class="u-etiqueta">Sin rellenar</span>' + aRellenar.map(function (c) {
            var t = texto(campo(a, c).titulo);
            return ed.indexOf(c) >= 0 ? '<button type="button" class="li-rellenar" data-rellenar="' + texto(c) + '" aria-label="Rellenar ' + t + '">' + t + '</button>' : '<span class="li-vacio">' + t + '</span>';
          }).join('') + '</p>' : '';
          // T0679: un apartado que solo trae la fase o el estado (un campo con colores que se edita) va arriba, sin tarjeta: su pastilla.
          if (titulo && rp.ver.length === 1 && !aRellenar.length && ed.indexOf(rp.ver[0]) >= 0 && campo(a, rp.ver[0]).colores) return '<section class="li-fgrupo li-f-pil">' + cuerpo + '</section>';
          return '<section class="li-fgrupo">' + (titulo ? '<h3 class="li-fg-t">' + texto(titulo) + '</h3>' : '') + (cuerpo ? '<div class="u-campos">' + cuerpo + '</div>' : '') + linea + '</section>';
        };
        var alta = nueva && a.alta;
        if (alta) {
          // T0643: el alta con lo que dice ALTA, en su orden (lo primero, qué hay que hacer); lo de «mas», plegado.
          var deEd = function (c) { var cp = campo(a, c); return cp.primero ? cp.primero.some(function (p) { return ed.indexOf(p) >= 0; }) : ed.indexOf(c) >= 0; };
          var mas = a.alta.mas.filter(function (c) { return fuera.indexOf(c) < 0 && deEd(c); });
          h += '<form id="li-form" class="li-form li-alta" novalidate><div class="u-campos">' + a.alta.campos.filter(function (c) { return fuera.indexOf(c) < 0 && deEd(c); }).map(function (c) { return a.alta.nuevo && c === a.alta.nuevo.campo ? altaConNuevo(a, c, crudo, ed, hoy) : entradaAlta(a, c, crudo, ed, hoy); }).join('') + '</div>' +
            (mas.length ? '<details class="li-mas"><summary>Más: ' + texto(mas.map(function (c) { return campo(a, c).titulo.toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' y $1')) + '</summary><div class="u-campos">' +
              mas.map(function (c) { return entradaAlta(a, c, crudo, ed, hoy); }).join('') + '</div></details>' : '');
        } else {
          h += '<form id="li-form" class="li-form" novalidate>' + grupos.map(function (g, gi) {
            // Para enseñar a un cliente, la ficha enseña solo lo que enseña su vista (ni marcas interesadas ni muestras).
            // T0731 (R68): detrás de cada apartado, su sitio para lo relacionado que va «tras» él (se rellena abajo).
            return apartadoFicha(g.titulo, (g.campos || []).filter(function (c) { return fuera.indexOf(c) < 0 && sinMias(c) && c !== a.codigo && !(nomTit && c === a.nombre) && (nueva ? ed.indexOf(c) >= 0 : true) && (!cli || columnasDe(a, vista).indexOf(c) >= 0); })) +
              (nueva || cli ? '' : '<!--li-tras-' + gi + '-->'); // T0731 (R68): el sitio de lo relacionado que va «tras» este apartado
          }).join('');
          // Lo que se edita y no está en ningún apartado de la ficha, al final.
          // T0642: lo que cambia un botón de ACCIONES («Pasar a Clientes») no sale como campo.
          var deAccion = []; a.acciones.forEach(function (x) { Object.keys(x.poner || {}).forEach(function (c) { deAccion.push(c); }); });
          h += apartadoFicha('', ed.filter(function (c) { return puestos.indexOf(c) < 0 && deAccion.indexOf(c) < 0 && !(nomTit && c === a.nombre); }));
        }
        // T0651: al dar de alta, el código que tendrá (M-220; BOR-004-04, según el diseño elegido).
        if (nueva && (a.nuevoId || a.prefijos[a.tabla])) h += '<p class="u-nota li-cod-nuevo" data-cod-nuevo aria-live="polite"></p>';
        h += '<p class="u-error" id="li-err" role="alert" hidden></p>';
        // T0679: Guardar y lo que se hace con la ficha, al final y fijos abajo (fuera del formulario: el botón lo nombra con form=).
        // T0689: con GUARDAR «solo» (de entrada), una ficha que ya está no tiene «Guardar»: cada campo se guarda al cambiarlo.
        // En el pie, solo lo que lleva a otra sección («Hacer una factura», «Calcular precio»; lleno, solo el de «principal»: T0732,
        // R45, así «Calcular precio» pesa igual en todas las fichas y no hay dos botones llenos con «Añadir»); lo que
        // cambia la fila («Pasar a Prospección»), dentro de «Más», lejos de lo del día a día.
        var solo = !nueva && a.guardar === 'solo';
        var conBoton = ed.length && !solo, accIr = acc.filter(function (x) { return x.ir; }), accPoner = acc.filter(function (x) { return !x.ir && accRec.indexOf(x) < 0; });
        var pie = '';
        if (conBoton || accIr.length) pie += '<div class="li-pie"><div class="n-botones">' + (conBoton ? '<button type="submit" form="li-form" class="u-btn u-btn-accion">' + (nueva ? 'Añadir' : 'Guardar') + '</button>' : '') +
          accIr.map(function (x) { return '<a class="u-btn' + (!conBoton && x.principal ? ' u-btn-accion' : '') + '" href="' + texto(irA(x, f.__crudo || f)) + '" data-sx="' + texto(String(x.ir).toUpperCase()) + '">' + texto(x.titulo) + '</a>'; }).join('') + '</div>' +
          accIr.filter(function (x) { return x.texto; }).map(function (x) { return '<p class="u-nota li-accion-t">' + texto(x.texto) + '</p>'; }).join('') + '</div>';
        var masAcc = accPoner.map(function (x) { return '<div class="li-mas-acc"><button type="button" class="u-btn" data-accion="' + acc.indexOf(x) + '">' + texto(x.titulo) + '</button>' + (x.texto ? '<span class="u-nota">' + texto(x.texto) + '</span>' : '') + '</div>'; }).join('');
        // T0651: borrar, lo último de «Más», con su confirmación debajo (o por qué no se puede y qué hacer en su lugar).
        var masBorrar = '';
        if (!nueva && !cli && a.borrar && T.borrar) masBorrar = '<div class="li-mas-acc li-borrar"><button type="button" class="u-btn li-btn-peligro" data-borrar>Borrar «' + texto(textoCorto(String(f[a.nombre] || f[a.clave] || ''), 40)) + '»</button></div><div data-borrar-sitio></div>';
        h += '</form>';
        // T0652: con quién es, ya abierto (sin la propia tarea: esa es la ficha).
        if (!nueva && !cli && a.contexto) { var rc = resumenDe(a, D, crudo, vistas(a), { hoy: hoy, prohib: PROHIB, sin: id }); if (rc) h += htmlResumen(rc, true); }
        // T0742: de una tabla que se lee por partes, la historia entera de esta fila (su seguimiento, lo último con quien es);
        // cuando llega, la ficha se rehace (una vez: después ya está en la copia).
        if (!nueva && !cli) historiaDe(a, crudo).then(function (nuevo) { if (nuevo && abierta && String(abierta.id) === String(id)) rehacer(); });
        // T0692: sus ventas (de Pedidos), antes de lo relacionado; si aún no han llegado, su sitio, que se rellena al llegar.
        if (!nueva && !cli && VENTAS) h += '<div id="li-ventas">' + htmlVentasDe(crudo, hoy) + '</div>';
        // Lo relacionado (el seguimiento de un cliente): cada fila lleva a su sección, con su ficha abierta.
        if (!nueva && !cli) a.relacionados.filter(function (r) { return veRelacionado(r, ctx); }).forEach(function (r) {
          if (r.juntar) { h += pintarJuntar(a, r, f); return; } // T0691: las marcas de una tela, de varias tablas, una vez cada una
          // T0641: con «tarjeta», sus filas se preparan como las de una sección (rutas, calculados, «de» y plantillas de sus «campos»).
          // T0708: también sin tarjeta, si alguna de sus columnas es uno de esos «campos» (los colores de cada diseño de un proveedor).
          var otroAp = r.tarjeta || conCamposPropios(r) ? apartado({ TABLA: r.tabla, CAMPOS: r.campos || {}, COLUMNAS: (r.columnas || []).concat(r.tarjeta ? camposTarjeta(r) : []), _refs: a.refs }) : null;
          var rs = relacionadas(r, f, otroAp ? preparar(otroAp, filas(r.tabla), D, VAL) : filas(r.tabla).map(function (x) {
            // T0642: una columna con ruta («ID_TELA.COLOR»: el color de la tela que le interesa) sigue las referencias.
            var y = conNombres(a, D, r.tabla, x);
            (r.columnas || []).forEach(function (c) { if (String(c).indexOf('.') > 0) y[c] = seguir(a, D, r.tabla, x, c); });
            return y;
          })), sec = ((seccionesRel(r)[0] || {}).id || '').toUpperCase(), va = sec && veo[sec];
          // T0724 (para R18): cada fila, a su sección (la primera de «seccion» que cumple y que se ve).
          var irA = function (x) { var sx = seccionDeFila(r, x, veo); return sx ? { sec: sx, va: veo[sx] } : null; };
          if (r.orden) rs = rs.slice().sort(comparar(r.orden));
          if (!rs.length && r.siHay && !r.nueva) return; // T0602: lo que casi nunca hay (a quién se compra a través de este), solo si hay
          var otro = { id: sec, titulo: r.titulo, tabla: r.tabla, refs: a.refs, clave: r.clave || 'ID', codigo: r.codigo || '', nombre: r.nombre || (r.columnas || [r.clave || 'ID'])[0], campos: r.campos || {} };
          var cols = (r.columnas || [otro.nombre]).filter(function (c) { return c !== otro.codigo; });
          // T0642: «+ Nueva tarea» lleva a su sección con una nueva ya puesta con esta (su marca).
          // T0688: «nueva.seccion», otra que la de sus filas (en Telas, la tarea nueva va a Hoy: el Historial no la enseña).
          var secN = r.nueva && r.nueva.seccion ? String(r.nueva.seccion).toUpperCase() : sec;
          var nv = r.nueva && secN && veo[secN] ? (function () {
            var q = '?s=' + encodeURIComponent(secN.toLowerCase()) + '&nueva=1';
            Object.keys(r.nueva.poner || {}).forEach(function (k) { q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent((f.__crudo || f)[r.nueva.poner[k]]); });
            return '<a class="u-btn u-btn-texto li-rel-nueva" href="' + texto(q) + '" data-sx="' + texto(secN) + '">+ ' + texto(r.nueva.titulo || 'Añadir') + '</a>';
          })() : '';
          var max = r.max || EN_FICHA, resto = rs.length - max; // T0690
          var cab = '<h3 class="li-fg-t">' + texto(r.titulo || r.tabla) + (r.datos ? '' : ' <span class="u-cifra">' + rs.length + '</span>') + '</h3>';
          var cuerpo;
          // T0651: lo de dentro que se edita, se añade o se quita desde la ficha (las personas de contacto de una marca).
          var ri = a.relacionados.indexOf(r), e = relEdicion(r, YO.admin), conEd = e.algo && !r.tarjeta && !!T.actualizar;
          // T0738: con «tarjeta», solo «+ Añadir comparativa» (sus tarjetas no se editan).
          var soloAlta = !!r.tarjeta && e.crear && !!T.crear;
          if (conEd || soloAlta) relAps[ri] = enriquecer(apartado({ TABLA: r.tabla, CLAVE: e.clave, CAMPOS: r.campos || {}, COLUMNAS: cols, _refs: a.refs }), D);
          var claveDe = function (x) { return (x.__crudo || x)[e.clave]; };
          if (!rs.length) cuerpo = '<p class="u-vacio">' + texto(r.vacio || 'Nada todavía.') + '</p>';
          else if (r.tarjeta) cuerpo = tarjetas(r, otro, rs, max);
          else if (conEd && r.datos) {
            // Cada fila como en la ficha; lo que se edita, leído y tocándolo; lo vacío que se edita, en «Sin rellenar».
            cuerpo = rs.map(function (x, i) {
              var k = claveDe(x), llenas = [], vacias = [];
              cols.forEach(function (c) {
                var t = celda(otro, c, x, true), vac = t.indexOf('class="li-nada"') >= 0;
                if (e.editar.indexOf(c) >= 0) (vac ? vacias : llenas).push(datoRel(ri, k, c, x));
                else if (!vac) { var cpo = campo(otro, c); llenas.push('<div class="li-dato' + (cpo.tipo === 'nota' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cpo.titulo) + '</span><span class="li-valor">' + t + '</span></div>'); }
              });
              var hs = vacias.map(function (hh) { return hh.replace('<div class="li-dato li-ed', '<div hidden data-rel-hueco class="li-dato li-ed'); });
              var linea = vacias.length ? '<p class="li-vacios"><span class="u-etiqueta">Sin rellenar</span>' + cols.filter(function (c) { return e.editar.indexOf(c) >= 0 && celda(otro, c, x, true).indexOf('class="li-nada"') >= 0; }).map(function (c) {
                return '<button type="button" class="li-rellenar" data-rel-rellenar="' + texto(c) + '">' + texto(campo(otro, c).titulo) + '</button>';
              }).join('') + '</p>' : '';
              return '<div class="li-rel-datos-ed" data-rel-fila="' + texto(k) + '"' + (i >= max ? ' hidden data-resto' : '') + '><div class="u-campos li-rel-datos">' + llenas.join('') + hs.join('') + '</div>' + linea +
                (e.quitar ? '<div class="li-rel-acc"><button type="button" class="u-btn u-btn-texto li-rel-quitar" data-rel-quitar>Quitar</button></div>' : '') + '</div>';
            }).join('');
          } else if (conEd) {
            // Cada fila: lo de siempre en una línea; con «editar», se abre debajo con sus datos para tocarlos (y «Abrir en …» y
            // «Quitar»); solo con «quitar», su ✕ al lado (y sigue llevando a su sección).
            cuerpo = '<ul class="li-rel li-rel-ed">' + rs.map(function (x, i) {
              var k = claveDe(x), kIr = (x.__crudo || x)[otro.clave], dentro = cols.map(function (c, j) { var t = celda(otro, c, x, false); return t.indexOf('class="li-nada"') >= 0 ? '' : '<span' + (j ? '' : ' class="li-rel-n"') + '>' + t + '</span>'; }).join('');
              var ix = irA(x), abre = !!relAbiertas[ri + '|' + k], ir = ix ? '<a class="li-rel-ir" href="?s=' + encodeURIComponent(ix.sec.toLowerCase()) + '&ficha=' + encodeURIComponent(kIr) + '" data-sx="' + texto(ix.sec) + '">Abrir en ' + texto(ix.va) + ' ›</a>' : '';
              var li;
              if (e.editar.length) li = '<button type="button" class="li-rel-f li-rel-abre" data-rel-abre aria-expanded="' + abre + '"><span class="li-rel-dentro">' + dentro + '</span>' + ICONO_FLECHA.replace('li-flecha', 'li-flecha li-rel-chev') + '</button>' +
                '<div class="li-rel-d"' + (abre ? '' : ' hidden') + '><div class="u-campos">' + e.editar.map(function (c) { return datoRel(ri, k, c, x); }).join('') + '</div>' +
                (ir || e.quitar ? '<div class="li-rel-acc">' + ir + (e.quitar ? '<button type="button" class="u-btn u-btn-texto li-rel-quitar" data-rel-quitar>Quitar</button>' : '') + '</div>' : '') + '</div>';
              else li = '<div class="li-rel-linea">' + (ix ? '<a class="li-rel-f" href="?s=' + encodeURIComponent(ix.sec.toLowerCase()) + '&ficha=' + encodeURIComponent(kIr) + '" data-sx="' + texto(ix.sec) + '">' + dentro + '<span class="li-ir">' + texto(ix.va) + ' ›</span></a>' : '<div class="li-rel-f">' + dentro + '</div>') +
                (e.quitar ? '<button type="button" class="u-btn u-btn-icono li-rel-x" data-rel-quitar aria-label="' + texto('Quitar ' + String(k)) + '">' + ICONO_X + '</button>' : '') + '</div>';
              return '<li data-rel-fila="' + texto(k) + '"' + (i >= max ? ' hidden data-resto' : '') + '>' + li + '</li>';
            }).join('') + '</ul>';
          }
          else if (r.datos) {
            // T0642: «datos»: cada fila como en la ficha, cada dato con su título («Material que buscan: 100 % lino»), no
            // seguidos con puntos. Lo vacío no sale.
            cuerpo = rs.map(function (x, i) {
              return '<div class="u-campos li-rel-datos"' + (i >= max ? ' hidden data-resto' : '') + '>' + cols.map(function (c) {
                var cpo = campo(otro, c), t = celda(otro, c, x, true);
                return t.indexOf('class="li-nada"') >= 0 ? '' : '<div class="li-dato' + (cpo.tipo === 'nota' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cpo.titulo) + '</span><span class="li-valor">' + t + '</span></div>';
              }).join('') + '</div>';
            }).join('');
          } else cuerpo = '<ul class="li-rel">' + rs.map(function (x, i) {
              var ix = irA(x), dentro = cols.map(function (c, k) { var t = celda(otro, c, x, !ix); return t.indexOf('class="li-nada"') >= 0 ? '' : '<span' + (k ? '' : ' class="li-rel-n"') + '>' + t + '</span>'; }).join('');
              return '<li' + (i >= max ? ' hidden data-resto' : '') + '>' + (ix ? '<a class="li-rel-f" href="?s=' + encodeURIComponent(ix.sec.toLowerCase()) + '&ficha=' + encodeURIComponent((x.__crudo || x)[otro.clave]) + '" data-sx="' + texto(ix.sec) + '">' + dentro + '<span class="li-ir">' + texto(ix.va) + ' ›</span></a>' : '<div class="li-rel-f">' + dentro + '</div>') + '</li>';
            }).join('') + '</ul>';
          // T0690: las primeras «max» (20 si no lo dice) y «Ver todo»: las demás van escondidas y salen al tocarlo.
          if (resto > 0) cuerpo += '<button type="button" class="li-vermas li-vertodo" data-ver-todo>Ver todo <span class="u-nota">· ' + num(rs.length) + ' en total</span></button>';
          // T0651: «+ Añadir persona de contacto» (o eligiendo: «+ Añadir tela que le interesa»), aquí mismo.
          var an = (conEd || soloAlta) && e.crear && !(e.clave === r.campo && rs.length) ? '<button type="button" class="li-rel-anadir" data-rel-nueva>+ Añadir ' + texto(e.filas[0]) + '</button>' : '';
          var secH = '<section class="li-fgrupo"' + (conEd || soloAlta ? ' data-rel="' + ri + '"' : '') + '>' + cab + cuerpo + an + nv + '</section>';
          // T0731 (R68): con «tras», justo detrás de ese apartado de la ficha («Su seguimiento», tras «En qué punto está»); si no
          // está (la vista para un cliente, un alta), en su sitio de siempre.
          var gTras = r.tras === undefined ? -1 : grupos.map(function (g) { return g.titulo; }).indexOf(r.tras), marca = '<!--li-tras-' + gTras + '-->';
          if (gTras >= 0 && h.indexOf(marca) >= 0) h = h.replace(marca, function () { return secH + marca; }); else h += secH;
        });
        h = h.replace(/<!--li-tras-\d+-->/g, '');
        // T0630: «Copiar para Claude», al final: arriba va lo que se decide. T0642: dentro de «Más», que no es para el día a día.
        // T0689: con lo que cambia la fila de ACCIONES («Pasar a Prospección»), también sin código.
        // T0651: borrar, lo último (lejos de lo del día a día).
        if (!nueva && !cli && (a.codigo || masAcc || masBorrar)) h += '<details class="li-mas"><summary>Más</summary>' + masAcc + (a.codigo ? '<div class="li-claude"><button type="button" class="u-btn" data-claude>' + ICONO_COPIAR + 'Copiar para Claude</button><span class="u-nota">Pégalo al empezar una sesión de Claude para trabajar ' + texto(vacio(f[a.codigo]) ? 'esta fila' : f[a.codigo]) + '.</span></div>' : '') + masBorrar + '</details>';
        h += pie;
        abrirVentana(h);
        partir(nueva ? '' : id);
        fichaVent = nueva ? '+' : String(id);
        if (!llegada) apuntarFicha(fichaVent); // T0732 (R50)
        // T0679: la pastilla de la fase o el estado cambia de color al elegir otro valor.
        [].forEach.call(vent.querySelectorAll('select[data-pil]'), function (sel) {
          sel.addEventListener('change', function () { var m = json(sel.getAttribute('data-pil')) || {}; sel.className = 'li-sel-pil li-estado li-' + (m[sel.value] || 'gris'); });
        });
