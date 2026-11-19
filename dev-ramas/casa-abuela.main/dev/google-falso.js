/*
 * El Google falso de Casa Abuela (T0479; compartido desde T0655): un Sheet en memoria y los servicios de Apps Script que
 * usa apps-script/Código.js, para ejecutarlo sin Google.
 *   - apps-script/probar.js (node): las pruebas, con su fecha fija.
 *   - dev/servidor.js (navegador): la web en la app «Utilo DEV» con datos inventados, nunca con el Sheet de la familia.
 *
 *   hoja(nombre, filas)            una pestaña: filas = [[títulos], [fila], …] (los valores, como el Sheet los da)
 *   contexto({ hojas, ... })       SpreadsheetApp, LockService, CacheService, ScriptApp, Utilities… sobre esas hojas.
 *                                  Opciones: formatDate (por defecto, el de verdad en la zona que se le pida).
 *   ejecutar(codigo, ctx, nombres) ejecuta Código.js con ese contexto y devuelve sus funciones por nombre.
 */
(function (raiz, hacer) {
  if (typeof module === 'object' && module.exports) module.exports = hacer();
  else raiz.GoogleFalso = hacer();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hoja(nombre, filas) {
    const h = { nombre, filas, validacion: null };
    const celda = (r, c) => { while (h.filas.length < r) h.filas.push([]); const f = h.filas[r - 1]; while (f.length < c) f.push(''); return f; };
    h.getLastRow = () => { let n = h.filas.length; while (n && h.filas[n - 1].every(v => v === '' || v == null)) n--; return n; };
    h.getMaxColumns = () => Math.max(...h.filas.map(f => f.length), 1);
    h.insertColumnsAfter = (c, n) => { h.filas.forEach(f => { while (f.length < c + n) f.push(''); }); };
    h.insertRowAfter = r => h.filas.splice(r, 0, []);
    h.deleteRow = r => h.filas.splice(r - 1, 1);
    h.setFrozenRows = () => {};
    h.getDataRange = () => h.getRange(1, 1, h.getLastRow(), h.getMaxColumns());
    h.getRange = (r, c, nr = 1, nc = 1) => ({
      getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) f.push(((h.filas[r - 1 + i] || [])[c - 1 + j]) ?? ''); o.push(f); } return o; },
      setValues: v => {
        // Como el Google de verdad: el ancho de los datos tiene que ser el del intervalo
        if (v.length !== nr || v.some(f => f.length !== nc)) throw new Error('El número de columnas de los datos no coincide con el del intervalo. Los datos tienen ' + (v[0] || []).length + ' y el intervalo, ' + nc + '.');
        v.forEach((f, i) => f.forEach((x, j) => { celda(r + i, c + j)[c - 1 + j] = x; })); h.formula && h.formula();
      },
      setValue: x => { celda(r, c)[c - 1] = x; h.formula && h.formula(); },
      getValue: () => ((h.filas[r - 1] || [])[c - 1]) ?? '',
      setNumberFormat: () => { if (h.tabla && nc > 1) throw new Error('Haz una selección en una sola columna para realizar acciones a nivel de columna.'); },
      getDataValidation: () => null,
      getSheet: () => h, getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
      copyTo: () => {},
    });
    return h;
  }

  /** Utilities.formatDate de verdad: la fecha en esa zona horaria con el patrón de Java que usa Código.js (yyyy, MM, dd, HH, H, mm, ss, 'literal'). */
  function formatDate(d, tz, patron) {
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(x => { p[x.type] = x.value; });
    const vale = { yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, H: String(Number(p.hour)), mm: p.minute, ss: p.second };
    return String(patron).replace(/'([^']*)'|yyyy|MM|dd|HH|H|mm|ss/g, (m, lit) => lit !== undefined ? lit : vale[m]);
  }

  function uuid() { return 'u' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

  /** Los servicios de Apps Script sobre esas hojas (cada uno se puede cambiar después: ctx.UrlFetchApp = …). */
  function contexto(o) {
    const hojas = o.hojas;
    const ss = { getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hoja(n, [])) };
    const props = {};
    return {
      SpreadsheetApp: { openById: () => ss, flush: () => {}, DataValidationCriteria: { VALUE_IN_LIST: 'L' } },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
      CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
      ScriptApp: { getService: () => ({ getUrl: () => '' }), getProjectTriggers: () => [], AuthMode: {} },
      PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
      // Sin red: lo que llamaría fuera (los avisos al móvil) falla como sin permiso.
      UrlFetchApp: { fetch: () => { throw new Error('Sin conexión fuera en el Google falso.'); } },
      Utilities: { getUuid: o.uuid || uuid, formatDate: o.formatDate || formatDate },
      ContentService: { createTextOutput: x => ({ setMimeType: () => JSON.parse(x) }), MimeType: { JSON: 'json' } },
      HtmlService: {}, console: o.console || console,
      ss,
    };
  }

  /**
   * Ejecuta Código.js con ese contexto y devuelve sus funciones (las de «nombres»). En node, con vm (como el Google de
   * verdad, cada proyecto con lo suyo); en el navegador, dentro de una función con esos servicios como parámetros, así
   * lo de Código.js no se mezcla con la web.
   */
  function ejecutar(codigo, ctx, nombres) {
    const lista = '{' + nombres.map(n => n + ': typeof ' + n + " === 'function' ? " + n + ' : undefined').join(', ') + '}';
    if (typeof module === 'object' && module.exports && typeof require === 'function') {
      // En node, en el contexto (los servicios se buscan al llamarlos: una prueba puede cambiar ctx.UrlFetchApp después).
      const vm = require('vm');
      vm.createContext(ctx);
      vm.runInContext(codigo + '\nthis.__ = ' + lista + ';', ctx);
      return ctx.__;
    }
    const fuera = '\n;return ' + lista + ';';
    const servicios = Object.keys(ctx).filter(k => k !== 'ss');
    // eslint-disable-next-line no-new-func
    return Function.apply(null, servicios.concat(codigo + fuera)).apply(null, servicios.map(k => ctx[k]));
  }

  return { hoja, contexto, ejecutar, formatDate };
});
