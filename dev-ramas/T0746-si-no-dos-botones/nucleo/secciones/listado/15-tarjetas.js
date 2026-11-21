      function tarjeta(a, f, det, cli, hoy, arrastrar, tituloGrupo, foto, plazo, rap, vista) {
        var avs = cli ? [] : avisosDe(a, f, hoy, vista), mar = sinMarcas(vista) ? [] : sinRepetir(avs, tituloGrupo, plazo);
        // T0652: con quién es, debajo de la tarjeta y aparte, para abrir su resumen (en el tablero, no: ahí se arrastra).
        var cx = !cli && !arrastrar && a.contexto && contextoCol(a, f.__crudo) ? a.contexto.campo : '';
        if (cx) det = det.filter(function (x) { return x !== cx; });
        // T0601: en la tarjeta, lo vacío no sale (una prospección sin estado ni nota no enseña «— —»).
        var dets = det.filter(function (x) { return x !== foto; }).map(function (x) { return fechaAviso(a, x, celda(a, x, f, false, cli), avs); }).filter(function (h) { return h.indexOf('class="li-nada"') < 0 && h.indexOf('class="li-sinvalor"') < 0; }) // T0731: «Sin nada pendiente», tampoco
          // T0677: lo que ya dice un aviso de la tarjeta no sale dos veces («Esperando respuesta» y «Esperando respuesta hace días»).
          .filter(function (h) { return !loDiceUnAviso(h.replace(/<[^>]*>/g, ''), mar); });
        // T0633: con foto, a la izquierda (sin foto, un hueco igual, para que los nombres caigan en línea).
        var src = foto && !prohibido(f[foto], PROHIB).length ? imagen(f[foto]) : '';
        var img = !foto ? '' : (src ? '<img class="li-mini li-t-img" src="' + texto(src) + '" alt="" referrerpolicy="no-referrer" loading="lazy" data-li-foto>' : '<span class="li-t-img li-t-vacia" aria-hidden="true"></span>');
        var cuerpo = '<strong>' + titulo2(a, f, cli) + '</strong>' +
          (dets.length ? '<span class="li-det">' + dets.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</span>' : '') +
          (mar.length ? '<span class="li-marcas">' + marcas(mar) + '</span>' : '');
        // T0643: con lo de un toque, el círculo a la izquierda y «Pasar» a la derecha, encima de la tarjeta (no dentro: un botón no va dentro de otro).
        var r = rap && rapidaEn(a, f, hoy), ci = r ? circulo(a, f) : '', pa = r ? botonPasar(a, f) : '';
        var bc = cx ? botonCtx(a, f, celda(a, cx, f, false, cli)) : '';
        return '<li' + (ci || pa || bc ? ' class="li-t-rap' + (ci ? ' li-t-ci' : '') + (pa ? ' li-t-pa' : '') + (bc ? ' li-t-ctx' : '') + '"' : '') + '>' + ci + '<button type="button" class="li-tarjeta' + (foto ? ' li-con-foto' : '') + (franja(avs) ? ' li-f-' + texto(franja(avs)) : '') + '" data-id="' + texto(f[a.clave]) + '"' + (arrastrar ? ' data-mover' : '') + '>' +
          (foto ? img + '<span class="li-t-txt">' + cuerpo + '</span>' : cuerpo) + '</button>' + pa + bc + '</li>';
      }
      /** T0610 · Los grupos de una vista. En el ordenador, UNA tabla: la cabecera una vez y cada grupo como una fila con su
       *  título, así las columnas caen igual en todos y se ajustan a lo que llevan. En el móvil, una lista de tarjetas por grupo. */
      function pintarGrupos(a, vista, gs, hoy) {
        // En una vista para clientes no salen los avisos (son para quien trabaja) y un precio que falta es «a consultar».
        var cli = !!vista.cliente, fuera = ocultas(a, vista), nom = a.nombre;
        var plazo = vista.agrupar && vista.agrupar.por === 'plazo' ? vista.agrupar.campo : '';
        // La columna por la que se agrupa ya la dice el título de cada grupo: no se repite en cada fila (salvo que sea el nombre).
        var delGrupo = columnaDelGrupo(vista);
        if (delGrupo && delGrupo !== nom && gs.length > 1) fuera = fuera.concat([delGrupo]);
        var cols = columnasDe(a, vista).filter(function (c) { return fuera.indexOf(c) < 0 && c !== a.codigo; });
        // En la tabla, el código va en su columna, la primera (en las tarjetas, delante del nombre).
        // T0724 (R20): sin las columnas que en todas sus filas dicen lo de siempre (el Tipo de Hoy, todo «Tarea»).
        var conCod = sinComunes(a, cols, [].concat.apply([], gs.map(function (g) { return g.filas; })), VAL, PROHIB); // T0642: sin la columna del código
        var det = (a.detalle.length ? a.detalle : cols.filter(function (c) { return c !== nom; }).slice(0, 2)).filter(function (c) { return fuera.indexOf(c) < 0 && c !== nom && (!cli || cols.indexOf(c) >= 0); });
        var num = function (cp) { return /importe|numero|porcentaje/.test(cp.tipo); };
        var cabG = function (g) { return '<h2 class="n-grupo">' + texto(g.titulo) + ' <span class="u-cifra">' + g.filas.length + '</span></h2>'; };
        // T0643: el círculo, delante del código; «Pasar», al final. Solo si alguna fila de la vista los lleva.
        var rap = conRapidas(a, vista), conCi = rap && !!a.rapidas.hecha, conPa = rap && !!a.rapidas.pasar;
        if (rap && !gs.some(function (g) { return g.filas.some(function (f) { return rapidaEn(a, f, hoy); }); })) conCi = conPa = false;
        var nCols = conCod.length + (conCi ? 1 : 0) + (conPa ? 1 : 0);
        // T0690: cada grupo, en trozos: lo pendiente (50 y «Ver más»), lo hecho plegado (50 y «Ver más») y lo de antes.
        var trozos = gs.map(function (g) { return trozosDe(vista, g, hoy); });
        var fila = function (f, g) {
          var avs = cli ? [] : avisosDe(a, f, hoy, vista), mar = sinMarcas(vista) ? [] : sinRepetir(avs, g.titulo, plazo), r = (conCi || conPa) && rapidaEn(a, f, hoy);
          // T0677: en la tabla, el estado tiene su columna: el aviso que solo lo repite («Esperando respuesta hace días») no sale
          // (la fecha ya va en rojo con «hace 9 días»). En la tarjeta del móvil es al revés: se queda el aviso y se quita la etiqueta.
          var vistos = conCod.filter(function (c) { return c !== nom; }).map(function (c) { return verTexto(campo(a, c), f, VAL, PROHIB); });
          mar = mar.filter(function (x) { return !vistos.some(function (t) { return loDiceUnAviso(t, [x]); }); });
          return '<tr tabindex="0" data-id="' + texto(f[a.clave]) + '"' + (franja(avs) ? ' class="li-con-aviso li-f-' + texto(franja(avs)) + '"' : '') + '>' +
            (conCi ? '<td class="li-td-ci">' + (r ? circulo(a, f) : '') + '</td>' : '') + conCod.map(function (c) {
            var cp = campo(a, c), principal = c === nom;
            // Fechas, cifras, estados y lo corto no se parten («273 / g/m²», «hace 9 / días»): lo que se estrecha es el texto largo.
            var h = fechaAviso(a, c, celda(a, c, f, 'tabla', cli), avs);
            if (!cli && a.contexto && c === a.contexto.campo) h = botonCtx(a, f, h);
            if (principal) h += etPara(f); // T0689: en «Todas», para quién es la que no es mía
            var corta = !principal && (num(cp) || /^(fecha|estado|sino)$/.test(cp.tipo) || h.replace(/<[^>]*>/g, '').length <= 14);
            return '<td class="' + (num(cp) ? 'num' : '') + (corta ? ' li-td-corta' : '') + (cp.tipo === 'fecha' ? ' li-td-fecha' : '') + (cp.tipo === 'estado' || cp.colores ? ' li-td-estado' : '') + (principal ? ' u-tabla-t' : '') + (c === a.codigo ? ' li-td-cod' : '') + '">' + h +
              (principal && mar.length ? '<div class="li-marcas">' + marcas(mar) + '</div>' : '') + '</td>';
          }).join('') + (conPa ? '<td class="li-td-pa">' + (r ? botonPasar(a, f) : '') + '</td>' : '') + '</tr>';
        };
        // T0690: el título de cada columna ordena al tocarlo (otra vez, al revés; a la tercera, el orden de la vista).
        var th = function (c) {
          var cp = campo(a, c), o = S.orden === c ? 'ascending' : (S.orden === '-' + c ? 'descending' : '');
          if (cp.tipo === 'foto') return '<th scope="col"><span class="u-oculto">' + texto(cp.titulo) + '</span></th>';
          return '<th scope="col"' + (num(cp) ? ' class="num"' : '') + (o ? ' aria-sort="' + o + '"' : '') + '><button type="button" class="li-ord' + (o ? ' li-ord-on' : '') + '" data-orden="' + texto(c) + '" title="Ordenar por ' + texto(cp.titulo.toLowerCase()) + '">' +
            texto(cp.titulo) + '<span class="li-ord-f" aria-hidden="true">' + (o === 'ascending' ? '↑' : (o === 'descending' ? '↓' : '↕')) + '</span></button></th>';
        };
        var filaMas = function (h) { return h ? '<tr class="li-mas-f"><td colspan="' + nCols + '">' + h + '</td></tr>' : ''; };
        var tabla = '<div class="u-solo-ancho li-tabla"><table class="u-tabla"><thead><tr>' + (conCi ? '<th scope="col" class="li-td-ci"><span class="u-oculto">' + texto(a.rapidas.hecha.valor) + '</span></th>' : '') + conCod.map(th).join('') +
          (conPa ? '<th scope="col" class="li-td-pa"><span class="u-oculto">Pasar a otro día</span></th>' : '') + '</tr></thead>' + gs.map(function (g, i) {
          var tz = trozos[i], filas = function (xs) { return xs.map(function (f) { return fila(f, g); }).join(''); };
          return '<tbody>' + (g.titulo ? '<tr class="li-g-cab' + (plazo && g.id === 'pasado' ? ' li-g-tarde' : '') + '"><th scope="colgroup" colspan="' + nCols + '">' + cabG(g) + '</th></tr>' : '') +
            filas(tz.abiertas) + filaMas(tz.masA) + filaMas(tz.plegar) + filas(tz.hechas) + filaMas(tz.masH) + filaMas(tz.antes) + '</tbody>';
        }).join('') + '</table></div>';
        var foto = fotoDeTarjeta(a, cols);
        var tarjetas = '<div class="u-solo-movil">' + gs.map(function (g, i) {
          var tz = trozos[i], lis = function (xs) { return xs.map(function (f) { return tarjeta(a, f, det, cli, hoy, false, g.titulo, foto, plazo, rap, vista); }).join(''); };
          var li = function (h) { return h ? '<li class="li-mas-f">' + h + '</li>' : ''; };
          return '<section class="li-grupo' + (plazo && g.id === 'pasado' ? ' li-g-tarde' : '') + '">' + (g.titulo ? cabG(g) : '') + '<ul class="li-tarjetas">' +
            lis(tz.abiertas) + li(tz.masA) + li(tz.plegar) + lis(tz.hechas) + li(tz.masH) + li(tz.antes) + '</ul></section>';
        }).join('') + '</div>';
        return tabla + tarjetas;
      }
      /**
       * T0742 · Con ANTIGUO y su tabla leída por partes (nucleo.partes), al final de la lista «Ver más», que trae lo cerrado de
       * antes de sus meses (una vez; después ya está en la lista, también al buscar y filtrar). Nunca en la vista para clientes.
       */
      function botonAntiguo(a, vista) {
        if (!a.antiguo || vista.cliente || !T.faltaAntiguo || !T.faltaAntiguo(a.tabla)) return '';
        var d = T.desdeAntiguo(a.tabla), m = /^(\d{4})-(\d\d)/.exec(d);
        var cuando = m ? MESES[+m[2] - 1] + ' de ' + m[1] : '';
        return '<p class="li-antiguo"><button type="button" class="li-vermas" data-antiguo' + (S.antiguo ? ' disabled aria-busy="true"' : '') + '>' +
          (S.antiguo ? 'Buscando lo de antes…' : 'Ver más') + (cuando && !S.antiguo ? ' <span class="u-nota">· lo de antes de ' + cuando + '</span>' : '') + '</button></p>';
      }
      /** T0690 · «Ver N más»: cuántas quedan y el botón que enseña otras tantas (data-mas con su clave en S.mas). */
      function botonMas(k, quedan, paso) {
        return '<button type="button" class="li-vermas" data-mas="' + texto(k) + '" data-paso="' + paso + '">Ver ' + (quedan > paso ? paso + ' más' : (quedan === 1 ? 'la que queda' : 'las ' + quedan + ' que quedan')) +
          (quedan > paso ? ' <span class="u-nota">· quedan ' + num(quedan) + '</span>' : '') + '</button>';
      }
      /** Las primeras de una lista (S.mas[k] o «paso») y su «Ver más». */
      function primeras(k, xs, paso) {
        var n = Math.min(xs.length, S.mas[k] || paso);
        return { filas: xs.slice(0, n), mas: xs.length > n ? botonMas(k, xs.length - n, paso) : '' };
      }
      /** Un grupo de la lista, en trozos: lo pendiente con su «Ver más», el botón de lo hecho plegado, lo hecho (si está
       *  abierto) con su «Ver más» y «Ver lo de antes». Buscando o filtrando, todo seguido (con su «Ver más»). */
      function trozosDe(vista, g, hoy) {
        var k = vista.id + '|' + (g.id || g.titulo || ''), p = vista.plegar || {};
        var pl = S.todo ? { abiertas: g.filas, hechas: [], antes: [] } : plegados(vista, g.filas, hoy);
        var a1 = primeras(k + '|a', pl.abiertas, POR_GRUPO), nh = pl.hechas.length + pl.antes.length, abre = !!S.abre[k];
        var r = { abiertas: a1.filas, masA: a1.mas, plegar: '', hechas: [], masH: '', antes: '' };
        if (!nh) return r;
        r.plegar = '<button type="button" class="li-plegar" data-plegar="' + texto(k) + '" aria-expanded="' + abre + '">' + ICONO_FLECHA +
          '<span>' + texto(p.titulo || 'Lo hecho') + '</span> <span class="u-cifra">' + num(nh) + '</span></button>';
        if (!abre) return r;
        var verAntes = !!S.antes[k] || !pl.hechas.length, xs = verAntes ? pl.hechas.concat(pl.antes) : pl.hechas, h1 = primeras(k + '|h', xs, POR_GRUPO);
        r.hechas = h1.filas; r.masH = h1.mas;
        if (!verAntes && pl.antes.length) r.antes = '<button type="button" class="li-vermas" data-antes="' + texto(k) + '">Ver lo de antes <span class="u-nota">· ' +
          (p.dias ? 'de hace más de ' + (p.dias % 30 === 0 ? (p.dias / 30) + ' meses' : p.dias + ' días') + ', ' : '') + num(pl.antes.length) + '</span></button>';
        return r;
      }
      /** T0691 · Muestrario: una cuadrícula de fotos grandes, cada una con su título, lo de debajo (el color) y su cifra (lo
       *  que cuesta). Sin foto, o con una que no se ve, un fondo neutro del mismo tamaño. Sin avisos: es para mirar y encontrar
       *  una tela por cómo es (los avisos siguen arriba, para filtrar). Con «agrupar», un título por grupo. */
      function pintarGaleria(a, vista, gs, hoy) {
        var cli = !!vista.cliente, gl = vista.galeria || {}, fuera = ocultas(a, vista);
        var vale = function (c) { return c && fuera.indexOf(c) < 0; };
        var foto = gl.foto || fotoDeTarjeta(a, columnasDe(a, vista)), tit = gl.titulo || a.nombre;
        var deb = lista(gl.debajo).filter(vale), cif = vale(gl.cifra) ? gl.cifra : '';
        var txt = function (c, f) { var h = celda(a, c, f, false, cli); return h.indexOf('class="li-nada') >= 0 ? '' : h; };
        // T0730 (R41): sin cifra, el aviso de «avisoSinCifra» con su color si la fila lo cumple («Falta el coste», en ocre:
        // le interesa a una marca); si no, «sinCifra» en gris («Sin coste aún»). En la vista para clientes, nunca el aviso.
        var avSin = cli || !gl.avisoSinCifra ? null : (a.avisos || []).filter(function (x) { return x.id === gl.avisoSinCifra; })[0];
        var sinCifra = function (f) {
          var av = avSin && avisosDe(a, f, hoy, vista).filter(function (x) { return x.id === avSin.id; })[0];
          if (av) return '<span class="li-gal-c li-gal-av li-' + texto(av.nivel || 'medio') + '">' + texto(av.titulo) + '</span>';
          return gl.sinCifra ? '<span class="li-gal-c li-gal-sin">' + texto(gl.sinCifra) + '</span>' : '';
        };
        var una = function (f) {
          var src = foto && !prohibido(f[foto], PROHIB).length ? imagen(f[foto]) : '';
          return '<li><button type="button" class="li-gal-t" data-id="' + texto(f[a.clave]) + '">' +
            '<span class="li-gal-foto">' + (src ? '<img class="li-gal-img" src="' + texto(src) + '" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" data-li-foto>' : '') + '</span>' +
            '<span class="li-gal-txt"><strong>' + txt(tit, f) + '</strong>' + deb.map(function (c) { var h = txt(c, f); return h ? '<span class="li-gal-d">' + h + '</span>' : ''; }).join('') +
            (cif ? (txt(cif, f) ? '<span class="li-gal-c">' + txt(cif, f) + '</span>' : sinCifra(f)) : '') + '</span></button></li>';
        };
        // T0690: 48 por grupo (ocho filas de seis) y «Ver más».
        return '<div class="li-galerias">' + gs.map(function (g) {
          var p = primeras(vista.id + '|' + (g.id || g.titulo || '') + '|g', g.filas, gl.max || 48);
          return '<section class="li-gal-g">' + (g.titulo ? '<h2 class="n-grupo">' + texto(g.titulo) + ' <span class="u-cifra">' + g.filas.length + '</span></h2>' : '') +
            '<ul class="li-galeria">' + p.filas.map(una).join('') + '</ul>' + (p.mas ? '<div class="li-mas-f">' + p.mas + '</div>' : '') + '</section>';
        }).join('') + '</div>';
      }
      /** Tablero: una columna por valor, con sus tarjetas; se arrastra de una a otra si ese campo se edita (y no es para clientes). */
      function pintarTablero(a, vista, fs, hoy) {
        var cli = !!vista.cliente, fuera = ocultas(a, vista), c = vista.tablero.campo, nom = a.nombre;
        var mueve = !cli && editables(a).indexOf(c) >= 0;
        var cp = campo(a, c), cols = columnasTablero(a, vista, fs), junta = cols.some(function (x) { return x.junta; });
        // T0642: en un tablero con columnas que juntan varios valores (el embudo), cada tarjeta dice el suyo (su fase); se
        // cambia en la ficha (a una columna así no se arrastra: no se sabría cuál de sus valores poner).
        var det = (a.detalle.length ? a.detalle : columnasDe(a, vista)).filter(function (x) { return fuera.indexOf(x) < 0 && x !== nom && (x !== c || junta) && x !== a.codigo; }).slice(0, 3);
        if (junta) mueve = false;
        return '<div class="li-tablero" data-campo="' + texto(c) + '">' + cols.map(function (col) {
          var color = col.junta ? '' : (cp.colores || {})[col.id] || '';
          // T0690: como mucho 20 tarjetas por columna (tablero.max) y «Ver N más».
          var p = primeras(vista.id + '|' + (col.id || col.titulo) + '|c', col.filas, vista.tablero.max || POR_COLUMNA);
          return '<section class="li-col' + (color ? ' li-' + texto(color) : '') + '" data-valor="' + texto(col.id) + '"' + (mueve ? ' data-soltar' : '') + '>' +
            '<h2 class="li-col-t">' + texto(col.titulo) + ' <span class="u-cifra">' + col.filas.length + '</span></h2>' +
            (col.filas.length ? '<ul class="li-tarjetas li-col-l">' + p.filas.map(function (f) { return tarjeta(a, f, det, cli, hoy, mueve, undefined, undefined, undefined, undefined, vista); }).join('') + (p.mas ? '<li class="li-mas-f">' + p.mas + '</li>' : '') + '</ul>' : '<p class="u-nota li-col-vacia">Nada todavía</p>') + '</section>';
        }).join('') + '</div>' + (mueve ? '<p class="u-nota li-col-ayuda">En el ordenador, arrastra una tarjeta a otra columna para cambiar su ' + texto(cp.titulo.toLowerCase()) + '. En el móvil, ábrela y cámbialo en su ficha.</p>' : '');
      }

      function pintarJuntar(a, r, f) {
        var rs = juntarDe(a, D, r, f, filas);
        if (!rs.length && r.siHay) return '';
        return '<section class="li-fgrupo"><h3 class="li-fg-t">' + texto(r.titulo || '') + ' <span class="u-cifra">' + rs.length + '</span></h3>' +
          (!rs.length ? '<p class="u-vacio">' + texto(r.vacio || 'Nada todavía.') + '</p>' : '<ul class="li-rel li-junta">' + rs.map(function (x) {
            return '<li><div class="li-rel-f"><span class="li-rel-n">' + texto(x.quien) + '</span>' +
              (x.estado ? '<span><span class="u-chip li-estado' + (x.color ? ' li-' + texto(x.color) : '') + '">' + texto(x.estado) + '</span></span>' : '') +
              (aFecha(x.cuando) ? '<span class="u-nota">' + texto(fechaCorta(x.cuando)) + '</span>' : '') + '</div></li>';
          }).join('') + '</ul>') + '</section>';
      }

      /* ---------- ficha ---------- */
      /** T0679 · En el ordenador, la ficha va a la derecha de la lista (vista partida): la lista sigue a la vista y otra fila
       *  abre su ficha sin cerrar nada; la fila abierta, marcada. Las demás ventanas (filtrar, pasar…) siguen encima de todo. */
      function partir(id) {
        var si = id !== undefined && id !== null;
        velo.classList.toggle('li-v-ficha', si);
        document.body.classList.toggle('li-partida', si);
        marcarAbierta(si ? id : null);
      }
      function marcarAbierta(id) {
        [].forEach.call(cont.querySelectorAll('tr[data-id],.li-gal-t[data-id]'), function (t) { t.classList.toggle('li-sel', id !== null && t.getAttribute('data-id') === String(id)); });
      }
