/*
 * Sección Listado base del núcleo · UTILO_CORE 5.0 (T0599) · motor/modulos/listado de utilo-apps
 *
 * Un listado con ficha y avisos que sirve para cualquier tabla de cualquier cliente, sin una pantalla a medida por tabla:
 * cada sección del menú (Seguimiento, Clientes, Proveedores…) es esta misma con su configuración (config.json ·
 * nucleo.secciones.<nombre>, con «modulo»: «listado»): qué tabla, qué columnas, la ficha, las vistas y los avisos. Lee y
 * escribe con la capa de tablas (ctx.tablas), con un Sheet o con Supabase: la sección no lo sabe.
 *
 *   Vistas     pestañas arriba: filtros guardados con su orden, sus grupos (por valor o por plazo) y lo que ocultan, o un
 *              tablero por columnas como el Kanban. Una vista «para enseñar a un cliente» (cliente: true) oculta siempre
 *              los campos privados (el proveedor), también en la ficha.
 *   Avisos     lo que no se puede escapar (fecha pasada, vence en unos días, sin hacer): arriba de la lista, en cada fila
 *              y en la ficha. Tocar uno filtra la lista.
 *   Código     cada fila con su identificador delante (T0012), como las tareas de Utilo; la ficha lo copia con sus datos
 *              («Copiar para Claude») para trabajar esa fila en una sesión de Claude.
 *   Ficha      sus apartados, en orden; lo relacionado de otra tabla (el seguimiento de un cliente), que lleva a su
 *              sección con la ficha abierta y «Volver a …»; y, si se puede, editar y añadir.
 *   Personalizar  quien está en PERSONALIZAN (y quien administra) cambia el orden del menú, qué vistas se ven y en qué
 *              orden, y qué avisos están encendidos y con cuántos días. Se guarda en la tabla PREFERENCIAS (para todos) o,
 *              sin ella, en este dispositivo.
 * Reglas que cumple sola: un campo calculado con «precio» nunca enseña un importe sin su envío; los datos de PROHIBIDO
 * (contraseñas, números de cuenta, DNI/NIE) no se guardan y, si ya están en la tabla, se enseñan tapados.
 * Claves de la configuración: docs/SECCION_LISTADO.md.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIA = 86400000;
  function vacio(v) { return v === '' || v === null || v === undefined; }
  /** T0736 · Sin tildes ni mayúsculas: la del núcleo (UN.plano; en Node, las pruebas, la de nucleo.js). */
  var UNT = null;
  function plano(s) { return (UNT || (UNT = typeof module !== 'undefined' && module.exports ? require('../nucleo.js') : window.UN)).plano(s); }
  function norm(s) { return plano(s).trim(); }
  function lista(v) { return v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }

  // Palabras de los nombres de columna que se escriben con tilde (como en Ajustes).
  var PALABRAS = { area: 'área', telefono: 'teléfono', direccion: 'dirección', proximo: 'próximo', via: 'vía', codigo: 'código',
    numero: 'número', tecnica: 'técnica', region: 'región', categoria: 'categoría', descripcion: 'descripción', prospeccion: 'prospección',
    quien: 'quién', que: 'qué', algodon: 'algodón', poliester: 'poliéster', acrilico: 'acrílico', minimo: 'mínimo', espana: 'España', n: 'nº', id: 'ID', email: 'email', eur: '€', inr: '₹' };
  /** «PROXIMO_PASO» → «Próximo paso». */
  function titulo(n) {
    var t = String(n || '').replace(/^ID_(?=.)/, '').toLowerCase().split('_').map(function (p) { return PALABRAS[p] || p; }).join(' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** Una fecha de la tabla (Date, «2026-11-17», «17/11/2026», con o sin hora) a medianoche de ese día; null si no lo es. */
  function aFecha(v) {
    if (vacio(v)) return null;
    if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var s = String(v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
    if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    return null;
  }
  /** Días de hoy a esa fecha (negativo, ya pasó); null si no es una fecha. */
  function diasHasta(v, hoy) {
    var f = aFecha(v), h = aFecha(hoy);
    return f && h ? Math.round((f - h) / DIA) : null;
  }
  /**
   * Un número de la tabla: 12.5, «12,5», «1.234,50 €», «50 %» (0,5). NaN si no lo es. Una coma con grupos de tres cifras
   * detrás («1,020», «1,020.50»: como se escribe en la India y en inglés) es de miles: 1020 (T0645).
   */
  function aNumero(v) {
    if (typeof v === 'number') return v;
    if (vacio(v)) return NaN;
    var s = String(v).trim(), pc = /%$/.test(s);
    s = s.replace(/[€₹%\s]/g, '');
    if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
    return pc ? n / 100 : n;
  }
  /**
   * T0714 · Un porcentaje se guarda como parte (0,48) y se escribe y se ve en % (48). Lo que ya viene en % (100, de un Excel
   * escrito así; T0686) se ve igual: más de 1 ya es %. pctVer: lo guardado → el %; pctEscrito: lo escrito («48», «48 %») → la parte.
   */
  function pctVer(v) { var n = aNumero(v); return isNaN(n) ? n : Math.round((Math.abs(n) > 1 ? n : n * 100) * 1e6) / 1e6; }
  function pctEscrito(v) { var n = aNumero(v); return isNaN(n) || /%\s*$/.test(String(v)) ? n : Math.round(n / 100 * 1e8) / 1e8; }
  /** T0714 · Lo escrito en un campo, como se guarda: un número, como número; un porcentaje, como parte; lo demás, tal cual. */
  function deEscrito(cp, s) {
    s = String(s == null ? '' : s).trim();
    if (s === '' || !/^(importe|numero|porcentaje)$/.test(cp.tipo || '')) return s;
    var n = cp.tipo === 'porcentaje' ? pctEscrito(s) : aNumero(s);
    return isNaN(n) ? s : n;
  }

  /**
   * ¿Es un teléfono («+91 98200 12345», «(93) 555-12-34», «+91 78699 57726 (WhatsApp)», «619 060 112 / 670 943 907»)? Lo
   * que va entre paréntesis con letras es una nota y no cuenta (T0656). «Formulario en la web» no: sale como texto, sin
   * enlace (T0645).
   */
  function sinNotas(v) { return String(v == null ? '' : v).replace(/\([^)]*[A-Za-zÀ-ÿ][^)]*\)/g, ' ').trim(); }
  function esTelefono(v) { var s = sinNotas(v); return /^\+?[\d\s().\-\/+]+$/.test(s) && s.replace(/\D/g, '').length >= 6; }
  /** El número al que llama el enlace: el primero si hay varios («… / …»), solo con sus cifras y el «+». */
  function telDe(v) { return sinNotas(v).split('/')[0].replace(/[^\d+]/g, ''); }

