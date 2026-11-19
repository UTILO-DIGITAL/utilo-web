/*
 * Uso · plataforma interna de Utilo sobre Supabase (T0682) · clientes/utilo/modulos/uso de utilo-apps
 *
 * Quién entra en la app de cada cliente y dónde se atasca, los últimos 14 días (la maqueta que aprobó Javi). Lo apunta la
 * app del cliente (nucleo/uso.js) en el Supabase de Utilo y aquí se lee con uso_apps() y uso_de() de la base, que solo se
 * lo dan a quien lleva la iniciativa de esa app (admin o responsable).
 * - Arriba, una pastilla por app (la última elegida se recuerda en el dispositivo).
 * - ¿La usan?: cada cuenta (por correo) con su nombre y perfil, la última vez en palabras, los días en cuadritos, cuántos de
 *   esos días entró y una frase con el aparato de siempre y lo que suele durar una visita.
 * - Qué usa: las secciones por días en que se abrieron y, si la configuración trae el menú de esa app (SECCIONES), las que
 *   nunca se han abierto.
 * - Dónde se atasca: los avisos en rojo y los errores, juntos por texto (cuántas veces, en cuántos días, la última) y las
 *   esperas largas (cuántas, la más larga y la mediana).
 * - Día a día: cada visita (de qué hora a qué hora, aparato, avisos y errores y la ruta de secciones); un día sin visitas
 *   entre dos con visitas, «No entró».
 * No cuentan los correos de NO_CUENTAN (los de Utilo). Los cálculos (CALC) son puros, con «ahora» de argumento: los prueba
 * herramientas/probar-plataforma.js y los usa herramientas/uso.js (el resumen y las señales para revisar el uso, T0683).
 * Estilos, los suyos (#uso-css, clases .us-*), con los colores de base.css y marca.css.
 */
(function () {
  'use strict';

  var DIA = 864e5;

  function n2(x) { return ('0' + x).slice(-2); }
  /** El día (local) de una hora: 'aaaa-mm-dd'. */
  function diaDe(t) { var d = new Date(t); return d.getFullYear() + '-' + n2(d.getMonth() + 1) + '-' + n2(d.getDate()); }
  function horaDe(t) { var d = new Date(t); return d.getHours() + ':' + n2(d.getMinutes()); }
  function ms(s) { var t = typeof s === 'number' ? s : Date.parse(s); return isNaN(t) ? null : t; }
  /** Los n días hasta hoy (incluido), del más antiguo al más reciente. */
  function diasHasta(ahora, n) {
    var r = [], d = new Date(ahora);
    for (var i = n - 1; i >= 0; i--) r.push(diaDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i, 12)));
    return r;
  }
  /** Días enteros entre dos días 'aaaa-mm-dd'. */
  function entre(a, b) {
    var x = a.split('-'), y = b.split('-');
    return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / DIA);
  }
  function mediana(xs) {
    var v = (xs || []).filter(function (x) { return typeof x === 'number' && !isNaN(x); }).sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  function uno(n, una, varias) { return n + ' ' + (n === 1 ? una : varias); }
  function bajo(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /** Cuánto dura algo, en palabras: «menos de un minuto», «unos 20 minutos», «1 hora y 10 minutos». */
  function duracion(x) {
    if (typeof x !== 'number' || isNaN(x) || x < 0) return '';
    if (x < 60000) return 'menos de un minuto';
    var m = Math.round(x / 60000);
    if (m < 60) return m === 1 ? 'un minuto' : 'unos ' + m + ' minutos';
    var h = Math.floor(m / 60), r = m % 60;
    return uno(h, 'hora', 'horas') + (r ? ' y ' + uno(r, 'minuto', 'minutos') : '');
  }
  /** Segundos con una cifra decimal a la española: «7 s», «3,5 s». */
  function segundos(x) { var s = Math.round(x / 100) / 10; return String(s).replace('.', ',') + ' s'; }
  /** La última vez en palabras: «Hoy, 9:12», «Ayer, 18:40», «Hace 9 días», «Hace 3 semanas». */
  function haceCuanto(t, ahora) {
    if (t == null) return '';
    var d = entre(diaDe(t), diaDe(ahora));
    if (d <= 0) return 'Hoy, ' + horaDe(t);
    if (d === 1) return 'Ayer, ' + horaDe(t);
    if (d < 14) return 'Hace ' + d + ' días';
    if (d < 60) return 'Hace ' + Math.round(d / 7) + ' semanas';
    return 'Hace ' + Math.round(d / 30) + ' meses';
  }
  var DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  /** El nombre de un día para «Día a día»: { cuando: «Hoy» | «Ayer» | «Martes 24», debajo: «jueves 26» (solo hoy y ayer) }. */
  function nombreDia(dia, ahora) {
    var p = dia.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2], 12), k = entre(dia, diaDe(ahora));
    var largo = DIAS_SEM[d.getDay()] + ' ' + d.getDate();
    if (k === 0) return { cuando: 'Hoy', debajo: largo };
    if (k === 1) return { cuando: 'Ayer', debajo: largo };
    return { cuando: largo.charAt(0).toUpperCase() + largo.slice(1), debajo: '' };
  }

  /** Los eventos que cuentan: con hora y sin los correos de NO_CUENTAN; del más antiguo al más reciente. */
  function filtrar(eventos, noCuentan) {
    var fuera = {};
    (noCuentan || []).forEach(function (c) { fuera[bajo(c)] = 1; });
    return (eventos || []).filter(function (e) { return e && ms(e.cuando) != null && e.correo && !fuera[bajo(e.correo)]; })
      .map(function (e) { var x = Object.assign({}, e); x.t = ms(e.cuando); x.correo = bajo(e.correo); return x; })
      .sort(function (a, b) { return a.t - b.t; });
  }

  /** El título de cada sección por su id (de los eventos «seccion», que llevan el título en que). */
  function titulos(ev) {
    var m = {};
    ev.forEach(function (e) { if (e.tipo === 'seccion' && e.seccion && e.que) m[e.seccion] = e.que; });
    return m;
  }

  /**
   * Cada visita (sesion): quién, aparato, de qué hora a qué hora, lo que duró (el mayor ms de sus «salir»; sin salir, del
   * primer al último evento), la ruta de secciones (sin repetir seguidas) y cuántos avisos y errores. La más antigua primero.
   */
  function visitas(ev) {
    var por = {}, orden = [];
    ev.forEach(function (e) {
      var k = e.correo + '|' + (e.sesion || '');
      var v = por[k];
      if (!v) { v = por[k] = { sesion: e.sesion || '', correo: e.correo, persona: '', perfil: '', aparato: null, inicio: e.t, ultimo: e.t, salir: null, ruta: [], avisos: 0, errores: 0, esperas: 0 }; orden.push(v); }
      if (e.persona) v.persona = e.persona;
      if (e.perfil) v.perfil = e.perfil;
      if (e.aparato) v.aparato = e.aparato;
      v.ultimo = Math.max(v.ultimo, e.t);
      if (e.tipo === 'salir' && typeof e.ms === 'number') v.salir = Math.max(v.salir || 0, e.ms);
      if (e.tipo === 'seccion') { var s = e.que || e.seccion || ''; if (s && v.ruta[v.ruta.length - 1] !== s) v.ruta.push(s); }
      if (e.tipo === 'aviso') v.avisos++;
      if (e.tipo === 'error') v.errores++;
      if (e.tipo === 'espera') v.esperas++;
    });
    return orden.map(function (v) {
      v.dura = v.salir != null ? v.salir : v.ultimo - v.inicio;
      v.fin = Math.max(v.ultimo, v.inicio + v.dura);
      v.dia = diaDe(v.inicio);
      return v;
    }).sort(function (a, b) { return a.inicio - b.inicio; });
  }

  /** Lo que más se repite de una lista (null si está vacía); a igualdad, lo último que salió. */
  function moda(xs) {
    var c = {}, mejor = null;
    xs.forEach(function (x) { if (x == null || x === '') return; c[x] = (c[x] || 0) + 1; if (mejor === null || c[x] >= c[mejor]) mejor = x; });
    return mejor;
  }

  /**
   * Cada cuenta (por correo), la que ha entrado más recientemente primero: nombre y perfil (los últimos), última vez,
   * los días en que entró (de los n), el aparato de siempre, lo que suele durar una visita (mediana) y su frase.
   */
  function personas(ev, ahora, n) {
    var vs = visitas(ev), dias = diasHasta(ahora, n), por = {}, orden = [];
    vs.forEach(function (v) {
      var p = por[v.correo];
      if (!p) { p = por[v.correo] = { correo: v.correo, persona: '', perfil: '', ultima: 0, dias: {}, visitas: [] }; orden.push(p); }
      if (v.persona) p.persona = v.persona;
      if (v.perfil) p.perfil = v.perfil;
      p.ultima = Math.max(p.ultima, v.ultimo);
      p.dias[v.dia] = 1;
      p.visitas.push(v);
    });
    return orden.map(function (p) {
      var aparatos = p.visitas.map(function (v) { return v.aparato; }).filter(Boolean);
      var habitual = moda(aparatos), cuantas = aparatos.filter(function (a) { return a === habitual; }).length;
      var x = {
        correo: p.correo, persona: p.persona || p.correo, perfil: p.perfil, ultima: p.ultima, visitas: p.visitas.length,
        cuadros: dias.map(function (d) { return !!p.dias[d]; }),
        diasN: dias.filter(function (d) { return p.dias[d]; }).length, de: n,
        aparato: habitual, siempre: aparatos.length ? cuantas / aparatos.length : 0,
        dura: mediana(p.visitas.map(function (v) { return v.dura; })),
        sinVenir: entre(diaDe(p.ultima), diaDe(ahora))
      };
      x.frase = frase(x);
      x.estado = x.sinVenir >= 7 ? 'aviso' : 'bien';
      x.cuando = haceCuanto(x.ultima, ahora);
      return x;
    }).sort(function (a, b) { return b.ultima - a.ultima; });
  }
  function desde(a) { return a === 'movil' ? 'desde el móvil' : a === 'ordenador' ? 'desde el ordenador' : ''; }
  /** «Casi siempre desde el móvil, unos 20 minutos cada vez.» · «Entró una vez desde el ordenador y no ha vuelto.» */
  function frase(p) {
    var dura = duracion(p.dura);
    if (p.visitas === 1) {
      var a = desde(p.aparato);
      return 'Entró una vez' + (a ? ' ' + a : '') + (p.sinVenir >= 2 ? ' y no ha vuelto.' : '.') + (dura ? ' Estuvo ' + dura + '.' : '');
    }
    var donde = !p.aparato ? '' : p.siempre >= 0.999 ? 'Siempre ' + desde(p.aparato) : p.siempre >= 0.7 ? 'Casi siempre ' + desde(p.aparato) : 'Desde el móvil y el ordenador';
    if (!donde) return dura ? 'Suele estar ' + dura + ' cada vez.' : '';
    return donde + (dura ? ', ' + dura + ' cada vez.' : '.');
  }

  /** Las secciones por días distintos en que se abrieron (y veces), y las del menú que nunca se han abierto. */
  function secciones(ev, n, menu) {
    var por = {}, orden = [];
    ev.forEach(function (e) {
      if (e.tipo !== 'seccion') return;
      var s = e.que || e.seccion;
      if (!s) return;
      var x = por[s];
      if (!x) { x = por[s] = { titulo: s, veces: 0, dias: {} }; orden.push(x); }
      x.veces++; x.dias[diaDe(e.t)] = 1;
    });
    var casi = Math.max(2, Math.round(n * 0.7));
    var usadas = orden.map(function (x) {
      var d = Object.keys(x.dias).length;
      return { titulo: x.titulo, veces: x.veces, dias: d, cuanto: d >= casi ? 'casi cada día' : uno(d, 'día', 'días') };
    }).sort(function (a, b) { return (b.dias - a.dias) || (b.veces - a.veces) || a.titulo.localeCompare(b.titulo); });
    var nunca = Array.isArray(menu) ? menu.filter(function (t) { return !por[t]; }) : null;
    return { usadas: usadas, nunca: nunca };
  }

  /** Avisos y errores juntos por tipo y texto (lo que más se repite primero), y las esperas largas. */
  function tropiezos(ev) {
    var tit = titulos(ev), por = {}, orden = [], esperas = [];
    ev.forEach(function (e) {
      if (e.tipo === 'espera' && typeof e.ms === 'number') { esperas.push(e); return; }
      if ((e.tipo !== 'aviso' && e.tipo !== 'error') || !e.que) return;
      var k = e.tipo + '|' + e.que, x = por[k];
      if (!x) { x = por[k] = { tipo: e.tipo, que: e.que, veces: 0, dias: {}, ultima: 0, secciones: [] }; orden.push(x); }
      x.veces++; x.dias[diaDe(e.t)] = 1; x.ultima = Math.max(x.ultima, e.t);
      if (e.seccion) x.secciones.push(tit[e.seccion] || e.seccion);
    });
    var lista = orden.map(function (x) {
      return { tipo: x.tipo, que: x.que, veces: x.veces, dias: Object.keys(x.dias).length, ultima: x.ultima, seccion: moda(x.secciones) || '' };
    }).sort(function (a, b) { return (b.veces - a.veces) || (b.ultima - a.ultima); });
    var max = esperas.reduce(function (m, e) { return !m || e.ms > m.ms ? e : m; }, null);
    return {
      lista: lista,
      esperas: {
        n: esperas.length, mediana: mediana(esperas.map(function (e) { return e.ms; })),
        max: max ? { ms: max.ms, seccion: tit[max.seccion] || max.seccion || '', que: max.que || '', cuando: max.t } : null
      }
    };
  }

  /** Los días con sus visitas (el más reciente primero), del último con visitas al primero; los de en medio sin visitas, vacíos. */
  function diaADia(ev, ahora) {
    var vs = visitas(ev);
    if (!vs.length) return [];
    var por = {};
    vs.forEach(function (v) { (por[v.dia] = por[v.dia] || []).push(v); });
    var ks = Object.keys(por).sort(), r = [];
    for (var d = ks[ks.length - 1]; ; ) {
      r.push({ dia: d, nombre: nombreDia(d, ahora), visitas: por[d] || [] });
      if (d === ks[0]) break;
      var p = d.split('-'); d = diaDe(new Date(+p[0], +p[1] - 1, +p[2] - 1, 12));
    }
    return r;
  }

  /**
   * Todo lo de una app para pintar o resumir: datos = lo que da uso_de(); o = { noCuentan, menu (los títulos de su menú) }.
   * ahora: la hora de referencia (ms).
   */
  function resumen(datos, ahora, o) {
    o = o || {};
    datos = datos || {};
    var n = Math.max(1, Math.min(90, +datos.dias || 14));
    var ev = filtrar(datos.eventos, o.noCuentan).filter(function (e) { return e.t > ahora - n * DIA - DIA; });
    return {
      app: datos.app || '', nombre: datos.nombre || datos.app || '', desde: datos.desde || '', dias: n, ahora: ahora,
      vacio: !ev.length, personas: personas(ev, ahora, n), secciones: secciones(ev, n, o.menu), tropiezos: tropiezos(ev), diaADia: diaADia(ev, ahora)
    };
  }

  function fechaEs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function nombreCuenta(p) { return p.persona + (p.perfil ? ' (' + p.perfil + ')' : ''); }

  /**
   * Lo que llama la atención, en frases: quien no entra desde hace 7 días o más, secciones nunca abiertas, avisos o errores
   * que se repiten 3 veces o más y esperas de más de 5 segundos. Vacío si no hay nada.
   */
  function senales(r) {
    var s = [];
    r.personas.forEach(function (p) { if (p.sinVenir >= 7) s.push(nombreCuenta(p) + ' no entra desde hace ' + p.sinVenir + ' días.'); });
    if (r.secciones.nunca && r.secciones.nunca.length) s.push('Nunca abiertas: ' + lista(r.secciones.nunca) + '.');
    r.tropiezos.lista.forEach(function (t) {
      if (t.veces >= 3) s.push((t.tipo === 'error' ? 'Error que se repite: «' : 'Aviso que se repite: «') + t.que + '», ' + t.veces + ' veces' + (t.seccion ? ' en ' + t.seccion : '') + '.');
    });
    var largas = r.tropiezos.esperas.max && r.tropiezos.esperas.max.ms > 5000;
    if (largas) {
      var m = r.tropiezos.esperas.max;
      s.push('Esperas de más de 5 segundos: la más larga, ' + segundos(m.ms) + (m.seccion ? ' en ' + m.seccion : '') + (m.que ? ' (' + m.que + ')' : '') + '.');
    }
    return s;
  }
  function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }

  /** El resumen escrito (herramientas/uso.js): md = true, en Markdown para una tarea del DAILY; si no, texto para la terminal. */
  function informe(r, md) {
    var h = function (t) { return md ? '### ' + t : t.toUpperCase(); }, b = function (t) { return md ? '**' + t + '**' : t; };
    var L = [];
    L.push(md ? '## Uso de ' + r.nombre + ' · los últimos ' + r.dias + ' días' : 'Uso de ' + r.nombre + ' · los últimos ' + r.dias + ' días');
    L.push('');
    if (r.vacio) { L.push('Aún no ha entrado nadie' + (r.desde ? ' desde el ' + fechaEs(r.desde) : '') + '.'); return L.join('\n'); }
    var s = senales(r);
    L.push(h('Señales'));
    (s.length ? s : ['Nada que destacar.']).forEach(function (x) { L.push('- ' + x); });
    L.push('');
    L.push(h('¿La usan?'));
    r.personas.forEach(function (p) {
      L.push('- ' + b(nombreCuenta(p)) + ' · ' + p.cuando + ' · entró ' + p.diasN + ' de ' + p.de + ' días. ' + p.frase);
    });
    L.push('');
    L.push(h('Qué usa'));
    r.secciones.usadas.forEach(function (x) { L.push('- ' + x.titulo + ': ' + x.cuanto + ' (' + uno(x.veces, 'vez', 'veces') + ')'); });
    if (!r.secciones.usadas.length) L.push('- Ninguna sección abierta.');
    if (r.secciones.nunca && r.secciones.nunca.length) L.push('- ' + b('Nunca abiertas') + ': ' + lista(r.secciones.nunca) + '.');
    L.push('');
    L.push(h('Dónde se atasca'));
    r.tropiezos.lista.forEach(function (t) {
      L.push('- ' + (t.tipo === 'error' ? 'Error: «' : '«') + t.que + '»' + (t.seccion ? ' · ' + t.seccion : '') + ' · ' + uno(t.veces, 'vez', 'veces') +
        (t.dias > 1 ? ' en ' + t.dias + ' días' : '') + ' · la última, ' + haceCuanto(t.ultima, r.ahora).toLowerCase());
    });
    var e = r.tropiezos.esperas;
    if (e.n) L.push('- Esperas de más de 3 segundos: ' + e.n + '; la más larga, ' + segundos(e.max.ms) + (e.max.seccion ? ' en ' + e.max.seccion : '') + (e.max.que ? ' (' + e.max.que + ')' : '') + '; la mediana, ' + segundos(e.mediana) + '.');
    if (!r.tropiezos.lista.length && !e.n) L.push('- Ningún aviso, error ni espera larga.');
    L.push('');
    L.push(h('Día a día'));
    r.diaADia.forEach(function (d) {
      var nom = d.nombre.cuando + (d.nombre.debajo ? ' (' + d.nombre.debajo + ')' : '');
      if (!d.visitas.length) { L.push('- ' + nom + ': no entró.'); return; }
      d.visitas.forEach(function (v) {
        L.push('- ' + nom + ' · ' + horaDe(v.inicio) + ' a ' + horaDe(v.fin) + (v.aparato ? ' · ' + (v.aparato === 'movil' ? 'móvil' : 'ordenador') : '') +
          ' · ' + v.persona + (v.ruta.length ? ' · ' + v.ruta.join(' → ') : '') +
          (v.avisos ? ' · ' + uno(v.avisos, 'aviso', 'avisos') : '') + (v.errores ? ' · ' + uno(v.errores, 'error', 'errores') : ''));
      });
    });
    return L.join('\n');
  }

  var CALC = {
    diaDe: diaDe, diasHasta: diasHasta, mediana: mediana, duracion: duracion, segundos: segundos, haceCuanto: haceCuanto, nombreDia: nombreDia,
    filtrar: filtrar, visitas: visitas, personas: personas, secciones: secciones, tropiezos: tropiezos, diaADia: diaADia,
    resumen: resumen, senales: senales, informe: informe
  };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var CSS = [
    '.us{display:flex;flex-direction:column;gap:18px;max-width:880px;margin:0 auto;min-width:0}',
    '.us-cab{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}',
    '.us-sub{margin:0;color:var(--color-suave)}',
    '.us-chips{display:flex;gap:6px;flex-wrap:wrap}',
    '.us-chip{border:1px solid var(--color-linea);background:var(--color-superficie);color:var(--color-texto);border-radius:999px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}',
    '.us-chip[aria-pressed="true"]{background:var(--color-principal);border-color:var(--color-principal);color:var(--color-sobre-principal)}',
    '.us-chip:focus-visible,.us-mas:focus-visible{outline:3px solid var(--color-destacado);outline-offset:2px}',
    '.us-b{background:var(--color-superficie);border:1px solid var(--color-linea);border-radius:var(--radio);padding:16px;min-width:0}',
    '.us-b h2{font-family:var(--fuente-titulos);font-weight:var(--peso-titulos);font-size:1.15rem;margin:0 0 12px}',
    '.us-pers{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:12px 0;border-top:1px solid var(--color-linea)}',
    '.us-pers:first-of-type{border-top:0;padding-top:0}',
    '.us-pers small{color:var(--color-suave);font-weight:600}',
    '.us-frase{grid-column:1/-1;margin:0;color:var(--color-suave)}',
    '.us-pill{font-weight:800;font-size:.82rem;border-radius:999px;padding:3px 10px;white-space:nowrap;align-self:start}',
    '.us-pill.bien{background:color-mix(in srgb,var(--color-bien) 12%,var(--color-superficie));color:var(--color-bien)}',
    '.us-pill.aviso{background:var(--color-pendiente-fondo);color:var(--color-pendiente)}',
    '.us-dias{grid-column:1/-1;display:flex;gap:4px;align-items:center;flex-wrap:wrap}',
    '.us-dia{width:18px;height:18px;border-radius:5px;background:var(--color-linea)}',
    '.us-dia.si{background:var(--color-principal)}',
    '.us-dia.hoy{outline:2px solid var(--color-texto);outline-offset:1px}',
    '.us-ley{color:var(--color-suave);font-size:.85rem;margin-left:6px}',
    '.us-barras{display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;gap:8px 12px;align-items:center}',
    '.us-barras .n{font-weight:700}',
    '.us-barra{height:12px;background:var(--color-linea);border-radius:6px;overflow:hidden}',
    '.us-barra i{display:block;height:100%;background:var(--color-principal);border-radius:6px}',
    '.us-barras .c{color:var(--color-suave);font-size:.88rem}',
    '.us-nunca{margin:14px 0 0;padding:10px 12px;background:var(--color-bloque);border-radius:var(--radio)}',
    '.us-tr{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}',
    '.us-tr li{display:grid;grid-template-columns:6px minmax(0,1fr);gap:12px}',
    '.us-tr li::before{content:"";border-radius:3px;background:var(--color-pendiente)}',
    '.us-tr li.error::before{background:var(--color-error)}',
    '.us-tr li.lento::before{background:var(--color-suave)}',
    '.us-tr .q{font-weight:700;overflow-wrap:anywhere}',
    '.us-tr .d{color:var(--color-suave);font-size:.9rem}',
    '.us-jor{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid var(--color-linea)}',
    '.us-jor:first-of-type{border-top:0;padding-top:0}',
    '.us-jor .cu{font-weight:800}',
    '.us-jor .cu small{display:block;color:var(--color-suave);font-weight:600}',
    '.us-vis+.us-vis{margin-top:6px}',
    '.us-ruta{color:var(--color-suave);font-size:.9rem;overflow-wrap:anywhere}',
    '.us-av{color:var(--color-pendiente);font-weight:700}',
    '.us-er{color:var(--color-error);font-weight:700}',
    '.us-vacio{color:var(--color-suave);margin:0}',
    '.us-nota{color:var(--color-suave);font-size:.85rem;margin:0}',
    '.us-mas{margin-top:10px}',
    '@media (max-width:600px){.us-jor{grid-template-columns:1fr;gap:4px}.us-barras{grid-template-columns:minmax(0,max-content) minmax(40px,1fr) max-content}}'
  ].join('\n');
  function estilos() {
    if (document.getElementById('uso-css')) return;
    var s = document.createElement('style');
    s.id = 'uso-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var DIAS_VISTA = 7;

  window.UN.registrar('USO', {
    abrir: function (el, ctx) {
      estilos();
      var cfg = ctx.config || {};
      var NO = Array.isArray(cfg.NO_CUENTAN) ? cfg.NO_CUENTAN : [];
      var MENUS = cfg.SECCIONES && typeof cfg.SECCIONES === 'object' ? cfg.SECCIONES : {};
      var CLAVE = 'uso_app_' + String(ctx.correo || '').toLowerCase().replace(/\W+/g, '');
      var apps = null, app = leerLocal(CLAVE), datos = null, fallo = '', todos = false, pidiendo = 0;
      el.innerHTML = '<section class="us"><div class="us-cab"><div><p class="us-sub">Quién entra en la app de cada cliente y dónde se atasca, los últimos 14 días.</p></div>' +
        '<div class="us-chips" role="group" aria-label="App" id="us-apps"></div></div><div id="us-cont" class="us"></div></section>';
      var $apps = el.querySelector('#us-apps'), $cont = el.querySelector('#us-cont');

      function carga() { return '<div class="kz-centro" role="status"><div class="u-carga"></div></div>'; }
      function error(m) {
        return '<section class="us-b"><p class="u-error">' + texto(m) + '</p><button type="button" class="u-btn" data-us-otra>Volver a intentarlo</button></section>';
      }
      function pintarApps() {
        $apps.innerHTML = (apps || []).map(function (a) {
          return '<button type="button" class="us-chip" data-us-app="' + texto(a.app) + '" aria-pressed="' + (a.app === app) + '">' + texto(a.nombre) + '</button>';
        }).join('');
      }

      function bloquePersonas(r) {
        return '<section class="us-b"><h2>¿La usan?</h2>' + r.personas.map(function (p) {
          var cuadros = p.cuadros.map(function (si, i) { return '<span class="us-dia' + (si ? ' si' : '') + (i === p.cuadros.length - 1 ? ' hoy' : '') + '"></span>'; }).join('');
          return '<div class="us-pers"><div><b>' + texto(p.persona) + '</b>' + (p.perfil ? ' <small>· ' + texto(p.perfil) + '</small>' : '') + '</div>' +
            '<span class="us-pill ' + p.estado + '">' + texto(p.cuando) + '</span>' +
            '<div class="us-dias" role="img" aria-label="Entró ' + p.diasN + ' de los últimos ' + p.de + ' días">' + cuadros +
            '<span class="us-ley">entró ' + p.diasN + ' de ' + p.de + ' días</span></div>' +
            (p.frase ? '<p class="us-frase">' + texto(p.frase) + '</p>' : '') + '</div>';
        }).join('') + '</section>';
      }
      function bloqueSecciones(r) {
        var u = r.secciones.usadas, max = u.length ? u[0].dias : 1;
        return '<section class="us-b"><h2>Qué usa</h2>' + (u.length ? '<div class="us-barras">' + u.map(function (x) {
          return '<span class="n">' + texto(x.titulo) + '</span><span class="us-barra"><i style="width:' + Math.max(4, Math.round(x.dias / max * 100)) + '%"></i></span><span class="c">' + texto(x.cuanto) + '</span>';
        }).join('') + '</div>' : '<p class="us-vacio">No ha abierto ninguna sección.</p>') +
          (r.secciones.nunca && r.secciones.nunca.length ? '<p class="us-nunca"><b>Nunca abiertas:</b> ' + texto(lista(r.secciones.nunca)) + '.</p>' : '') + '</section>';
      }
      function bloqueTropiezos(r) {
        var t = r.tropiezos, e = t.esperas;
        var li = t.lista.map(function (x) {
          var d = [x.seccion, uno(x.veces, 'vez', 'veces') + (x.dias > 1 ? ' en ' + x.dias + ' días' : ''), 'la última, ' + CALC.haceCuanto(x.ultima, r.ahora).toLowerCase()].filter(Boolean).join(' · ');
          return '<li class="' + x.tipo + '"><div><div class="q">' + (x.tipo === 'error' ? 'No se guardó: «' : '«') + texto(x.que) + '»</div><div class="d">' + texto(d) + '</div></div></li>';
        });
        if (e.n) {
          li.push('<li class="lento"><div><div class="q">Esperas largas: ' + texto(uno(e.n, 'de más de 3 segundos', 'de más de 3 segundos')) + '</div><div class="d">' +
            texto('La más larga, ' + CALC.segundos(e.max.ms) + (e.max.seccion ? ' en ' + e.max.seccion : '') + (e.max.que ? ' (' + e.max.que + ')' : '') + ' · la mediana, ' + CALC.segundos(e.mediana)) + '</div></div></li>');
        }
        return '<section class="us-b"><h2>Dónde se atasca</h2>' + (li.length ? '<ul class="us-tr">' + li.join('') + '</ul>' : '<p class="us-vacio">Ni avisos, ni errores, ni esperas largas.</p>') + '</section>';
      }
      function bloqueDias(r) {
        var ds = todos ? r.diaADia : r.diaADia.slice(0, DIAS_VISTA);
        return '<section class="us-b"><h2>Día a día</h2>' + ds.map(function (d) {
          var cu = '<div class="cu">' + texto(d.nombre.cuando) + (d.nombre.debajo ? '<small>' + texto(d.nombre.debajo) + '</small>' : '') + '</div>';
          if (!d.visitas.length) return '<div class="us-jor">' + cu + '<div class="us-vacio">No entró.</div></div>';
          var varias = r.personas.length > 1;
          return '<div class="us-jor">' + cu + '<div>' + d.visitas.map(function (v) {
            var hora = function (t) { var x = new Date(t); return x.getHours() + ':' + ('0' + x.getMinutes()).slice(-2); };
            return '<div class="us-vis"><b>' + hora(v.inicio) + ' a ' + hora(v.fin) + '</b>' + (v.aparato ? ' · ' + (v.aparato === 'movil' ? 'móvil' : 'ordenador') : '') +
              (varias ? ' · ' + texto(v.persona || v.correo) : '') +
              (v.avisos ? ' · <span class="us-av">' + uno(v.avisos, 'aviso', 'avisos') + '</span>' : '') +
              (v.errores ? ' · <span class="us-er">' + uno(v.errores, 'error', 'errores') + '</span>' : '') +
              (v.ruta.length ? '<div class="us-ruta">' + texto(v.ruta.join(' → ')) + '</div>' : '') + '</div>';
          }).join('') + '</div></div>';
        }).join('') + (!todos && r.diaADia.length > DIAS_VISTA ? '<button type="button" class="u-btn us-mas" data-us-todos>Ver los demás días</button>' : '') + '</section>';
      }

      function pintar() {
        if (!ctx.abierta()) return;
        pintarApps();
        if (fallo) { $cont.innerHTML = error(fallo); return; }
        if (apps === null || (app && datos === null)) { $cont.innerHTML = carga(); return; }
        if (!apps.length) { $cont.innerHTML = '<section class="us-b"><p class="us-vacio">Ninguna app apunta su uso todavía.</p></section>'; return; }
        var r = CALC.resumen(datos, Date.now(), { noCuentan: NO, menu: MENUS[app] });
        var desde = r.desde ? 'Se apunta desde el ' + fechaEs(r.desde) + '.' : '';
        if (r.vacio) {
          $cont.innerHTML = '<section class="us-b"><p class="us-vacio">Aún no ha entrado nadie' + (r.desde ? ' desde el ' + texto(fechaEs(r.desde)) : '') + '.</p></section>';
          return;
        }
        $cont.innerHTML = bloquePersonas(r) + bloqueSecciones(r) + bloqueTropiezos(r) + bloqueDias(r) +
          '<p class="us-nota">' + texto('No cuentan tus entradas con las cuentas de Utilo ni lo que veas «como» otra persona. ' + desde) + '</p>';
      }

      function leerApp() {
        var yo = ++pidiendo;
        datos = null; fallo = ''; pintar();
        return ctx.llamar('uso_de', [{ app: app, dias: 14 }]).then(function (d) {
          if (yo !== pidiendo) return;
          datos = d || { eventos: [] }; pintar();
        }, function (e) {
          if (yo !== pidiendo) return;
          fallo = 'No se ha podido leer el uso de esta app: ' + String((e && e.message) || e).replace(/^\w+:\s*/, ''); pintar();
        });
      }
      function leer() {
        fallo = ''; apps = null; pintar();
        return ctx.llamar('uso_apps', [{}]).then(function (r) {
          apps = Array.isArray(r) ? r : [];
          if (!apps.some(function (a) { return a.app === app; })) app = apps.length ? apps[0].app : '';
          if (app) return leerApp();
          pintar();
        }, function (e) {
          fallo = 'No se han podido leer las apps: ' + String((e && e.message) || e).replace(/^\w+:\s*/, ''); pintar();
        });
      }

      el.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-us-app], [data-us-otra], [data-us-todos]');
        if (!b) return;
        if (b.hasAttribute('data-us-todos')) { todos = true; pintar(); return; }
        if (b.hasAttribute('data-us-otra')) { if (apps === null || !app) leer(); else leerApp(); return; }
        var a = b.getAttribute('data-us-app');
        if (a === app) return;
        app = a; todos = false; guardarLocal(CLAVE, app); leerApp();
      });
      function alVolver() { if (document.visibilityState === 'visible' && ctx.abierta() && app) leerApp(); }
      document.addEventListener('visibilitychange', alVolver);
      this._fuera = function () { document.removeEventListener('visibilitychange', alVolver); };
      leer();
    },
    cerrar: function () { if (this._fuera) this._fuera(); this._fuera = null; }
  });

})();
