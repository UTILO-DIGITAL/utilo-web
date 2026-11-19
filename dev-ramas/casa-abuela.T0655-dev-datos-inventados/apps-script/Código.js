/**
 * Casa Abuela · Utilo (antes «La mesa de la abuela»)
 * Web para apuntarse a comer, cenar y dormir con la abuela, toda la semana.
 * Almacén: Sheet «Cuadrante Caldetas 2026».
 *   PERSONAS      lista de la familia (tabla). La web escribe Apodo, Jerarquia, Familia (B-D), Menu, Alergias y Cumple (F-H);
 *                 el Id (A) es una fórmula. Al cambiar apodo o jerarquía, la web añade el alias en MESA_ALIAS.
 *                 Baja (I, v4.9): fecha en que se quitó de la lista (por error o porque ha fallecido). Su fila se queda;
 *                 deja de salir para apuntarse y sus comidas pasadas siguen saliendo con su nombre.
 *                 Núcleos (J-M, v4.10): Apellido, Sexo (Hombre o Mujer), Pareja (Id, en los dos sentidos) e Hijo de (Id).
 *                 Los Ids siguen a MESA_ALIAS. La web arma con ellos el árbol de núcleos de cada familia.
 *                 Nombre (N, v4.11): el nombre de verdad; el Apodo (B) es como le llaman en casa y no se repite.
 *                 Casados (O, v4.12): Sí o No, en los dos de la pareja; se borra si cambia la pareja.
 *                 Falleció (P, v4.16): dd/mm/aaaa, 00/mm/aaaa o 00/00/aaaa (como se sepa); «Sí» si no se sabe cuándo (v4.20). El cumpleaños admite lo mismo.
 *                 Novios desde (Q) y Boda (R), v4.21: como se sepan, iguales en los dos de la pareja; se borran si la pareja se deshace.
 *   MESA_APUNTES  ID_APUNTE | FECHA | TURNO | PERSONA_ID | CREADO_EN | NOTA | ESTADO ('' va · 'NO' no va ese día aunque sea fijo) | NOTA_POR | NOTA_EN
 *   MESA_FIJOS    ID_FIJO | PERSONA_ID | DIA_SEMANA (0 domingo … 6 sábado) | TURNO | DESDE | HASTA | NOTA | CREADO_POR | CREADO_EN
 *   MESA_DIAS     FECHA | NOTA | SIN_TURNO | CAMBIADO_POR | CAMBIADO_EN | SIN_COMIDA | MOTIVO_COMIDA | SIN_CENA | MOTIVO_CENA | NOTA_SERVICIO | SIN_DORMIR | MOTIVO_DORMIR
 *                 | NOTA_POR | NOTA_EN | SERVICIO_POR | SERVICIO_EN | COMIDA_POR | COMIDA_EN | CENA_POR | CENA_EN | DORMIR_POR | DORMIR_EN
 *                 | FUERA | MOTIVO_FUERA | FUERA_POR | FUERA_EN | FUERA_COMIDA | FUERA_CENA | FUERA_DORMIR
 *                 (la abuela no está en esa comida, cena o noche; FUERA = las tres, de versiones anteriores)
 *   MESA_CAMBIOS  CUANDO | QUIEN_ID | QUIEN | CAMBIO   (registro de quién cambia qué)
 *   MESA_ALIAS    ID_ANTIGUO | ID_NUEVO | NOTA   (si a alguien se le cambia el apodo o la jerarquía en PERSONAS)
 *   MESA_VISITAS  PERSONA_ID | ULTIMA_VEZ | VECES (v4.58; se crea sola: quién abre la web, como mucho una vez por hora)
 *   MESA_ERRORES  CUANDO | QUIEN_ID | ACCION | ERROR | DETALLE (v5.32, T0591; se crea sola: lo que alguien intentó y no se guardó, para Control › Actividad;
 *                 ACCION «web»: un aviso de una ventana de la web, con la ventana en DETALLE)
 *   MESA_EVENTOS  ID | NOMBRE | DESDE | HASTA | CUANDO (DIA, COMIDA, CENA o DORMIR) | TEXTO | VAN | NO_VAN (Ids con «;») | CREADO_EN | BORRADO | LUGAR | HORA | TURNOS (v4.33: de cada día, los que se salta) (v4.28; se crea sola)
 *   MESA_CONFIG   CLAVE (v4.17: la clave de la familia; vacía, no se pide), PISTA (v4.18: se enseña al pedir la clave), ADMIN_IDS (v4.58: quién ve los Ajustes, Ids con «;»), NO_CUENTAN (v4.61: quién no cuenta en «Quién la usa»), FECHA_INICIO, EXCLUIR_IDS, HORA_COMIDA, HORA_CENA, HORA_DORMIR, AVISO_HORAS, URL_COMPARTIR
 *                 (EXCLUIR_IDS: no salen para apuntarse, pero pueden hacer cambios, como la abuela)
 * Turnos: COMIDA, CENA y DORMIR (quién pasa la noche en casa).
 * El servicio son las personas de PERSONAS con Familia = «Servicio»: cuentan para cocinar y no como compañía en comida y cena; para dormir, sí.
 * Las escrituras tocan solo las filas que cambian (nunca se borra y reescribe una pestaña entera).
 * Velocidad: cada pestaña se lee una sola vez por petición, y getDatos guarda 60 s una copia (CacheService)
 * que se invalida en cuanto alguien guarda algo.
 * La web se sirve desde GitHub Pages y habla con este script como API (doPost, JSON, sin cookies):
 * así funciona aunque el móvil tenga varias cuentas de Google. doGet sigue sirviendo la web antigua.
 * Despliegue: Ejecutar como «Yo», acceso «Cualquier usuario» (excepción acordada en T0471).
 *   MESA_AVISOS   TOKEN | PERSONA_ID | CREADO_EN | ULTIMO_ENVIO | ULTIMO_ERROR (v5.37, T0623; se crea sola: los móviles con avisos; MESA_CONFIG AVISOS_CALLA y AVISOS_HABLA, las horas sin avisos)
 * Versión 5.39.0
 */

const SPREADSHEET_ID = '1O5S1h0nlggV8ZBf7PifW2RcCg7tUP0n8WmSpvcmdSIY';
const TZ = 'Europe/Madrid';
const HOJA_PERSONAS = 'PERSONAS';
const HOJA_APUNTES = 'MESA_APUNTES';
const HOJA_FIJOS = 'MESA_FIJOS';
const HOJA_CONFIG = 'MESA_CONFIG';
const HOJA_DIAS = 'MESA_DIAS';
const HOJA_CAMBIOS = 'MESA_CAMBIOS';
const HOJA_ALIAS = 'MESA_ALIAS';
const HOJA_EVENTOS = 'MESA_EVENTOS';
const HOJA_ERRORES = 'MESA_ERRORES';  // v5.32 (T0591): CUANDO | QUIEN_ID | ACCION | ERROR | DETALLE
const MAX_ERRORES = 200, MAX_CAMBIOS_CONTROL = 1000, MAX_LEER_CONTROL = 6000, DIAS_CONTROL = 14;  // Control: al menos los 1000 últimos y todo lo de 14 días
// Dónde va «quién lo hace» en los argumentos de cada acción (getDatos lo lleva dentro, en .yo)
const QUIEN_EN_ = { guardarPersona: 2, guardarPersonas: 1, guardarDia: 2, guardarEvento: 1, getAjustes: 0, getPremios: 0, guardarAjustes: 1,
  borrarEvento: 1, apuntarEvento: 3, notaEvento: 3, guardarAusencia: 4, crearPersona: 1, darDeBaja: 1, avisoWeb: 0, activarAvisos: 1, quitarAvisos: 1 };
const HOJA_VISITAS = 'MESA_VISITAS';  // v4.58: PERSONA_ID | ULTIMA_VEZ | VECES (la última vez que cada uno abrió la web; como mucho, una vez por hora)  // v4.28: los eventos (castañada, PortAventura…) con quién va
const TURNOS = ['COMIDA', 'CENA', 'DORMIR'];
// v5.28 (T0586): las visitas, ir por la mañana o por la tarde sin comer ni cenar. Se apuntan como un turno más
// (MESA_APUNTES y MESA_FIJOS), pero no cuentan en la mesa, el servicio, los huecos, las medallas ni el informe:
// leerApuntes_ y leerFijos_ dan solo comida, cena y noche; las visitas, solo con leerApuntesTodos_ y leerFijosTodos_.
const VISITAS = ['MANANA', 'TARDE'];
const TODOS_TURNOS = ['MANANA', 'COMIDA', 'TARDE', 'CENA', 'DORMIR'];
const MENUS_BASE = ['\uD83C\uDF15 Entero', '\uD83C\uDF17 Medio', '\uD83C\uDF7C Nada'];  // luna llena, media luna y biberón, escritos así para que no se estropeen al copiar
const COL_MENU = 6;      // F en PERSONAS
const COL_ALERGIAS = 7;  // G en PERSONAS
const COL_CUMPLE = 8;    // H en PERSONAS, texto dd/mm o dd/mm/aaaa (con el año, v4.13)
const COL_BAJA = 9;      // I en PERSONAS, texto aaaa-mm-dd (v4.7)
const COL_APELLIDO = 10; // J (v4.10)
const COL_SEXO = 11;     // K: Hombre o Mujer
const COL_PAREJA = 12;   // L: Id de su pareja
const COL_HIJO_DE = 13;  // M: Id de su padre o su madre
const COL_NOMBRE = 14;   // N: nombre de verdad (v4.11)
const COL_CASADOS = 15;  // O: Sí o No (v4.12)
const COL_FALLECIO = 16; // P: fecha de fallecimiento, como se sepa (v4.16)
const COL_NOVIOS = 17;   // Q: cuándo empezaron a salir, como se sepa, en los dos de la pareja (v4.21)
const COL_BODA = 18;     // R: cuándo se casaron, como se sepa, en los dos de la pareja (v4.21)
const COL_FECHAS = 19;   // S: otras fechas que cada uno quiere recordar, «Bautizo: 12/05/1961; Primera comunión: 00/05/1969; Santo: 24/09» (v4.28)
const MAX_FECHAS = 10;
const TITULOS_EXTRA = { 9: 'Baja', 10: 'Apellido', 11: 'Sexo', 12: 'Pareja', 13: 'Hijo de', 14: 'Nombre', 15: 'Casados', 16: 'Falleció', 17: 'Novios desde', 18: 'Boda', 19: 'Otras fechas' };
const CAMPOS_NUCLEO = ['nombre', 'apellido', 'sexo', 'pareja', 'hijoDe', 'casados', 'fallecio', 'novios', 'boda'];
const CASADOS = ['Sí', 'No'];
const SEXOS = ['Hombre', 'Mujer'];
const COLS_APUNTES = 10;  // v4.15: J ACOMPANANTES (cuántos vienen con esa persona sin estar en la lista)
const COLS_FIJOS = 9;
const COLS_DIAS = 32;     // v4.15: AD EVENTO, AE EVENTO_TURNO, AF EVENTO_TEXTO
const TITULOS_DIAS_V415 = ['EVENTO', 'EVENTO_TURNO', 'EVENTO_TEXTO'];
const MAX_ACOMPANANTES = 20;
const MAX_EVENTO = 60, MAX_EVENTO_TEXTO = 500;
const COLS_EVENTOS = 15;  // ID | NOMBRE | DESDE | HASTA | CUANDO | TEXTO | VAN | NO_VAN | CREADO_EN | BORRADO | LUGAR | HORA | TURNOS | DIAS (v4.67) | NOTAS (v4.68)
const CUANDO_EVENTO = ['DIA', 'COMIDA', 'CENA', 'DORMIR'];
const MAX_DIAS_EVENTO = 31;
const MAX_ALERGIAS = 100;
const MAX_NOTA = 140;
const MAX_DIAS_RANGO = 400;

function doGet(e) {
  if (e && e.parameter && e.parameter.fn) return api_(e.parameter.fn, JSON.parse(e.parameter.args || '[]'), e.parameter.clave);
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Casa Abuela')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- API para la web de GitHub ---------- */

/** La web de GitHub manda { fn, args } en el cuerpo (texto plano, sin cookies) y recibe { ok, r } o { ok: false, error }. */
function doPost(e) {
  let peticion = {};
  try { peticion = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { peticion = {}; }
  return api_(peticion.fn, peticion.args || [], peticion.clave);
}

const API_ = {
  getDatos: function (a) { return getDatos(a[0]); },
  guardarPersona: function (a) { return guardarPersona(a[0], a[1], a[2], a[3]); },
  guardarPersonas: function (a) { return guardarPersonas(a[0], a[1], a[2]); },
  guardarDia: function (a) { return guardarDia(a[0], a[1], a[2], a[3]); },
  guardarEvento: function (a) { return guardarEvento(a[0], a[1], a[2]); },
  getAjustes: function (a) { return getAjustes(a[0], a[1]); },  // v4.91: a[1], la clave de administrador
  getPremios: function (a) { return getPremios(a[0], a[1]); },  // v4.85
  guardarAjustes: function (a) { return guardarAjustes(a[0], a[1], a[2], a[3]); },
  borrarEvento: function (a) { return borrarEvento(a[0], a[1], a[2]); },
  apuntarEvento: function (a) { return apuntarEvento(a[0], a[1], a[2], a[3], a[4], a[5]); },  // v4.67: a[5], los días
  notaEvento: function (a) { return notaEvento(a[0], a[1], a[2], a[3], a[4]); },  // v4.68
  misNumeros: function (a) { return misNumeros(a[0]); },  // v4.79
  guardarAusencia: function (a) { return guardarAusencia(a[0], a[1], a[2], a[3], a[4], a[5]); },
  crearPersona: function (a) { return crearPersona(a[0], a[1], a[2]); },
  darDeBaja: function (a) { return darDeBaja(a[0], a[1], a[2]); },
  avisoWeb: function (a) { return avisoWeb(a[0], a[1], a[2]); },  // v5.32 (T0591): lo que alguien hace mal en una ventana de la web
  activarAvisos: function (a) { return activarAvisos(a[0], a[1]); },  // v5.37 (T0623): avisos al móvil de la abuela
  quitarAvisos: function (a) { return quitarAvisos(a[0], a[1]); },
};

function api_(fn, args, clave) {
  let salida;
  try {
    comprobarClave_(clave);
    if (!Object.prototype.hasOwnProperty.call(API_, fn)) throw new Error('Acción no válida.');
    salida = { ok: true, r: API_[fn](Array.isArray(args) ? args : []) };
  } catch (err) {
    salida = { ok: false, error: String((err && err.message) || err) };
    apuntarError_(fn, args, salida.error);  // v5.32 (T0591)
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/** v5.32 (T0591): lo que alguien intentó y no se guardó, en MESA_ERRORES. Nunca rompe la respuesta: si no puede apuntarlo, lo deja. */
function apuntarError_(fn, args, error) {
  try {
    if (/^CLAVE/.test(error)) return;  // la clave de la familia (la web la pide sola) no es un error de uso
    if (fn === 'avisoWeb') return;  // un aviso de la web que no se pudo apuntar no se apunta otra vez
    args = Array.isArray(args) ? args : [];
    const i = QUIEN_EN_[fn];
    const quien = String(fn === 'getDatos' ? ((args[0] || {}).yo || '') : (i !== undefined ? args[i] || '' : '')).slice(0, 80);
    let detalle = '';
    try { detalle = JSON.stringify(fn === 'guardarPersona' || fn === 'guardarDia' ? [args[0], args[1]] : args.slice(0, 2)); } catch (e) { detalle = ''; }
    filaError_(quien, fn, error, detalle);
  } catch (e) { /* sin hoja de errores, no pasa nada */ }
}
/** v5.32 (T0591): lo que alguien hace mal en una ventana de la web (no llega a guardarse): el aviso que vio y en qué ventana */
function avisoWeb(quien, texto, donde) {
  const t = String(texto || '').trim();
  if (!t) throw new Error('Falta el aviso.');
  filaError_(String(quien || '').slice(0, 80), 'web', t, String(donde || ''));
  return true;
}
/** v5.32: cuándo fue el último error o aviso (MESA_ERRORES), o '' */
function ultimoError_(ss) {
  try {
    const h = ss.getSheetByName(HOJA_ERRORES);
    if (!h || h.getLastRow() < 2) return '';
    const v = h.getRange(h.getLastRow(), 1).getValue();
    return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(v || '');
  } catch (e) { return ''; }
}
function filaError_(quien, accion, error, detalle) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(HOJA_ERRORES) || crearHoja_(ss, HOJA_ERRORES, ['CUANDO', 'QUIEN_ID', 'ACCION', 'ERROR', 'DETALLE']);
    const rango = hoja.getRange(hoja.getLastRow() + 1, 1, 1, 5);
    comoTexto_(rango);
    rango.setValues([[ahora_(), String(quien || ''), String(accion || '').slice(0, 40), String(error).slice(0, 300), String(detalle || '').slice(0, 400)]]);
  } catch (e) { /* sin hoja de errores, no pasa nada */ }
}

/**
 * v4.17: la clave de la familia (MESA_CONFIG, CLAVE). Vacía, no se pide. Da igual mayúsculas y acentos.
 * Se guarda 5 minutos en la caché para no abrir el Excel en cada petición (si se cambia, tarda eso en valer).
 */
function comprobarClave_(clave) {
  const cache = CacheService.getScriptCache();
  let guardada = null;
  try { guardada = JSON.parse(cache.get('clave_familia_v2') || 'null'); } catch (e) { guardada = null; }
  if (!guardada) {
    const config = leerConfigSin_(SpreadsheetApp.openById(SPREADSHEET_ID));
    guardada = { clave: config.clave, pista: config.pista };
    try { cache.put('clave_familia_v2', JSON.stringify(guardada), 300); } catch (e) { /* sin caché, se lee cada vez */ }
  }
  const n = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  // v4.18: la pista (MESA_CONFIG, PISTA) va en el aviso, para quien aún no ha entrado
  if (guardada.clave && n(clave) !== n(guardada.clave)) throw new Error('CLAVE: hace falta la clave de la familia.' + (guardada.pista ? ' PISTA: ' + guardada.pista : ''));
}

/* ---------- Lectura ---------- */

/**
 * Lo que necesita la web para pintar.
 * p = { desde: 'aaaa-mm-dd', hasta: 'aaaa-mm-dd', yo: id de PERSONAS }
 */
function getDatos(p) {
  reiniciar_();
  p = p || {};
  const cache = CacheService.getScriptCache();
  const clave = 'd|' + versionCache_(cache) + '|' + (p.desde || '') + '|' + (p.hasta || '') + '|' + (p.yo || '');
  try { registrarVisita_(cache, p.yo); } catch (e) { /* si no se puede apuntar, no pasa nada */ }  // v4.58
  const guardado = cache.get(clave);
  if (guardado) return JSON.parse(guardado);
  const d = datos_(SpreadsheetApp.openById(SPREADSHEET_ID), p);
  try { cache.put(clave, JSON.stringify(d), 60); } catch (e) { /* demasiado grande para la caché: se sirve sin guardar */ }
  return d;
}

/* ---------- Memoria de la petición y caché ---------- */

let M = {};
function reiniciar_() { M = {}; }
function memo_(clave, fn) { if (!(clave in M)) M[clave] = fn(); return M[clave]; }
function olvidar_() { for (let i = 0; i < arguments.length; i++) delete M[arguments[i]]; }

function versionCache_(cache) {
  let v = cache.get('version');
  if (!v) { v = String(Date.now()); cache.put('version', v, 21600); }
  return v;
}
function invalidarCache_() {
  try { CacheService.getScriptCache().put('version', String(Date.now()), 21600); } catch (e) { /* sin caché, no pasa nada */ }
}

function datos_(ss, p) {
  const config = leerConfig_(ss);
  const personas = leerPersonas_(ss, config.excluir);
  const hoy = hoy_();
  let desde = esFecha_(p.desde) ? p.desde : lunesDe_(hoy);
  let hasta = esFecha_(p.hasta) ? p.hasta : sumarDias_(desde, 11);
  if (hasta < desde || diasEntre_(desde, hasta) > MAX_DIAS_RANGO) hasta = sumarDias_(desde, 11);
  const crudos = leerApuntesTodos_(ss);  // v5.28: con las visitas
  const fijos = leerFijosTodos_(ss);
  let url = config.urlCompartir;
  if (!url) { try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; } }
  return {
    hoy: hoy,
    url: url,
    config: { inicio: config.inicio, horaComida: config.horaComida, horaCena: config.horaCena, horaDormir: config.horaDormir, avisoHoras: config.avisoHoras, pista: config.pista || '' },  // v4.78: la pista (no la clave), para salir del modo sencillo
    personas: personas,
    editores: leerEditores_(ss, config.excluir),
    menus: opcionesMenu_(personas),
    listas: listas_(ss, personas),
    apuntes: efectivos_(crudos, fijos, desde, hasta, TODOS_TURNOS),  // v5.28: también las visitas (MANANA y TARDE)
    fijos: fijos.filter(function (f) { return !f.hasta || f.hasta >= hoy; }),
    dias: leerDias_(ss).filter(function (d) { return d.fecha >= desde && d.fecha <= hasta; }),
    admins: config.admins,  // v4.58: quién ve los Ajustes
    ultimoError: esAdmin_(config, p.yo) ? ultimoError_(ss) : '',  // v5.32 (T0591): para el punto rojo de Control (solo a quien lleva la web)
    eventos: leerEventos_(ss).filter(function (e) { return e.hasta >= (desde < sumarDias_(hoy, -60) ? desde : sumarDias_(hoy, -60)); }),  // v4.28
    yoTop10: p.yo ? enTop_(categorias_(ss, config, personas).puntos, p.yo) : false,  // v4.81: la etiqueta dorada; v4.83: del top 10 general
    misProximas: p.yo ? efectivos_(crudos, fijos, hoy, sumarDias_(hoy, 60)).filter(function (a) { return a.persona === p.yo; }).slice(0, 12) : [],
    bajas: leerBajas_(ss).map(function (b) { return { id: b.id, apodo: b.apodo, jerarquia: b.jerarquia, familia: b.familia, menu: b.menu, baja: b.baja }; }),
    huerfanos: huerfanos_(crudos, fijos, personas.concat(leerEditores_(ss, config.excluir), leerBajas_(ss)), hoy),
  };
}

/** v4.81: lo que ha ido cada uno desde que empezó el calendario hasta ayer (efectivos, también los fijos) */
function visitas_(ss, config) {
  return memo_('visitas', function () {
    const hoy = hoy_(), ayer = sumarDias_(hoy, -1);
    const inicio = esFecha_(config.inicio) ? config.inicio : sumarDias_(hoy, -365);
    return { ef: inicio <= ayer ? efectivos_(leerApuntes_(ss), leerFijos_(ss), inicio, ayer) : [], inicio: inicio };
  });
}
function horasDe_(config) { return { COMIDA: config.horaComida || '14:00', CENA: config.horaCena || '21:00', DORMIR: config.horaDormir || '22:30' }; }
/** Horas entre que se apuntó y la hora de esa comida, cena o noche (o null si no se sabe) */
function antelacion_(a, horaDe) {
  if (!a.creado || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(a.creado)) return null;
  const h = String(horaDe[a.turno] || '14:00');
  const x = (aUTC_(a.fecha) + (Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))) * 60000 - aUTC_(a.creado.slice(0, 10)) - (Number(a.creado.slice(11, 13)) * 60 + Number(a.creado.slice(14, 16))) * 60000) / 3600000;
  return x >= 0 ? x : null;
}
/** v4.82: ¿está en el top 10 de este mapa (id → número)? Con empates */
function enTop_(mapa, id) {
  if (!(id in mapa) || !(mapa[id] > 0)) return false;
  const v = Object.keys(mapa).map(function (k) { return mapa[k]; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return b - a; });
  return mapa[id] >= v[Math.min(9, v.length - 1)];
}
/** v4.83: los puntos de una categoría: 10 al primero, 9 al segundo… 1 al décimo (los empatados, igual) */
function puntosCat_(mapa) {
  const out = {};
  Object.keys(mapa).forEach(function (id) {
    if (!(mapa[id] > 0)) return;
    const puesto = 1 + Object.keys(mapa).filter(function (k) { return mapa[k] > mapa[id]; }).length;
    if (puesto <= 10) out[id] = 11 - puesto;
  });
  return out;
}
/**
 * v4.83: las categorías de los últimos 30 días (comidas, cenas, noches, eventos y avisar con tiempo), cada una con su top 10,
 * y los puntos de cada uno: la suma de lo que le da cada categoría. El top 10 general sale de esa suma.
 */
const CATEGORIAS = {
  comidas: { titulo: 'Top 10 en comidas', texto: 'De los que más han comido con la abuela.' },
  cenas: { titulo: 'Top 10 en cenas', texto: 'De los que más han cenado con ella.' },
  noches: { titulo: 'Top 10 en noches', texto: 'De los que más noches le han hecho compañía.' },
  eventos: { titulo: 'Top 10 en eventos', texto: 'De los que más se apuntan a los planes de la familia.' },
  avisa: { titulo: 'De los que antes avisan', texto: 'Te apuntas con tiempo: así se organiza mejor la casa.' },
  finde: { titulo: 'Top 10 de fin de semana', texto: 'De los que más van los sábados y los domingos.' },  // v4.85
  semana: { titulo: 'Top 10 entre semana', texto: 'De los que más van de lunes a viernes.' },
  compania: { titulo: 'Top 10 en traer compañía', texto: 'De los que más gente traen a la mesa.' },
  secretaria: { titulo: 'Secretaría de la familia', texto: 'De los que más apuntan y contestan por los demás.' },  // v4.88
};
/** v4.88: los cambios del último mes (MESA_CAMBIOS): quién los hizo y qué */
function cambios30_(ss) {
  return memo_('cambios30', function () {
    const h = ss.getSheetByName(HOJA_CAMBIOS);
    const n = h ? Math.max(0, h.getLastRow() - 1) : 0;
    if (!n) return [];
    const desde = Math.max(0, n - 4000), hace30 = sumarDias_(hoy_(), -30);
    return h.getRange(2 + desde, 1, n - desde, 4).getValues().map(function (f) {
      return { cuando: f[0] instanceof Date ? Utilities.formatDate(f[0], TZ, 'yyyy-MM-dd') : String(f[0]).slice(0, 10), quien: String(f[1]), apodo: String(f[2]), cambio: String(f[3]) };
    }).filter(function (x) { return x.cuando >= hace30; });
  });
}
/** v4.88: ¿ese cambio es apuntar o contestar por otra persona? (el nombre de quien va, distinto del de quien lo hace) */
function porOtro_(c) {
  const m = c.cambio.match(/^Apunta a (.+?) a la |^Quita a (.+?) de la |^Nota de (.+?) en |^(.+?) (?:va|no va|sin decir si va) a |^(.+?) va siempre los |^(.+?) deja de ir /);
  if (!m) return false;
  const quien = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
  return !!quien && quien !== c.apodo;
}
function esDatos_(c) { return /^(Cumpleaños|Otras fechas|Menú|Alergias|Apellido|Nombre) de |son pareja|: casados|es hijo o hija|falleció|: (hombre|mujer)$/.test(c.cambio); }
function categorias_(ss, config, personas) {
  return memo_('categorias', function () {
    const hoy = hoy_(), hace30 = sumarDias_(hoy, -30), v = visitas_(ss, config);
    const deFamilia = {};
    personas.forEach(function (x) { if (x.familia !== 'Servicio' && x.familia !== 'Otros') deFamilia[x.id] = true; });
    const cats = { comidas: {}, cenas: {}, noches: {}, eventos: {}, avisa: {}, finde: {}, semana: {}, compania: {}, secretaria: {} };
    cambios30_(ss).forEach(function (x) { if (deFamilia[x.quien] && porOtro_(x)) cats.secretaria[x.quien] = (cats.secretaria[x.quien] || 0) + 1; });  // v4.88
    const k = { COMIDA: 'comidas', CENA: 'cenas', DORMIR: 'noches' };
    const suma = function (c, id, n) { cats[c][id] = (cats[c][id] || 0) + n; };
    v.ef.forEach(function (a) {
      if (!deFamilia[a.persona] || a.fecha < hace30) return;
      suma(k[a.turno], a.persona, 1);
      const d = diaSemana_(a.fecha);
      suma(d === 0 || d === 6 ? 'finde' : 'semana', a.persona, 1);  // v4.85
      if (a.acompanantes) suma('compania', a.persona, a.acompanantes);
    });
    leerEventos_(ss).filter(function (e) { return e.hasta >= hace30; }).forEach(function (e) { e.van.forEach(function (id) { if (deFamilia[id]) cats.eventos[id] = (cats.eventos[id] || 0) + 1; }); });
    const horaDe = horasDe_(config), ante = {};
    leerApuntes_(ss).forEach(function (a) {
      if (!deFamilia[a.persona] || a.no || a.fecha < hace30 || a.fecha > hoy) return;
      const x = antelacion_(a, horaDe);
      if (x !== null) (ante[a.persona] = ante[a.persona] || []).push(x);
    });
    Object.keys(ante).forEach(function (id) { if (ante[id].length >= 2) { const l = ante[id].sort(function (a, b) { return a - b; }); cats.avisa[id] = Math.max(0.01, l[Math.floor(l.length / 2)]); } });
    const pts = {}, puntos = {};
    Object.keys(cats).forEach(function (c) { pts[c] = puntosCat_(cats[c]); Object.keys(pts[c]).forEach(function (id) { puntos[id] = (puntos[id] || 0) + pts[c][id]; }); });
    // v4.84: las medallas que no compiten con nadie suman PUNTOS_MEDALLA cada una
    Object.keys(deFamilia).forEach(function (id) { const m = logros_(ss, v, id).reduce(function (t, l) { return t + l[3]; }, 0); if (m) puntos[id] = (puntos[id] || 0) + m; });
    return { cats: cats, pts: pts, puntos: puntos };
  });
}
/** v4.82: las medallas de una persona, solo en positivo: las de cada categoría y las que no compiten con nadie */
function distinciones_(ss, config, personas, id) {
  const hoy = hoy_(), ayer = sumarDias_(hoy, -1), v = visitas_(ss, config), c = categorias_(ss, config, personas);
  const out = [];
  const pon = function (clave, titulo, texto, extra) { out.push(Object.assign({ id: clave, titulo: titulo, texto: texto }, extra || {})); };
  const yoP = personas.filter(function (x) { return x.id === id; })[0];
  if (yoP && yoP.familia === 'Servicio') { medallasServicio_(ss, personas, v, id, pon); return out; }  // v4.84: las suyas, sin competir con la familia
  Object.keys(CATEGORIAS).forEach(function (k) { if (c.pts[k][id]) pon(k, CATEGORIAS[k].titulo, CATEGORIAS[k].texto, { puntos: c.pts[k][id], categoria: true }); });
  logros_(ss, v, id).forEach(function (l) { pon(l[0], l[1], l[2], { puntos: l[3] }); });
  return out;
}
/**
 * v4.84: las medallas que no compiten con nadie: [id, título, texto, puntos].
 * v4.88: muchas, para que todo el mundo tenga alguna: las difíciles suman PUNTOS_MEDALLA; las de participar, PUNTOS_PARTICIPAR.
 */
const PUNTOS_MEDALLA = 3, PUNTOS_PARTICIPAR = 1;
function logros_(ss, v, id) {
  return memo_('logros|' + id, function () {
    const hoy = hoy_(), ayer = sumarDias_(hoy, -1), hace30 = sumarDias_(hoy, -30), out = [];
    const dif = function (a, b, c) { out.push([a, b, c, PUNTOS_MEDALLA]); }, facil = function (a, b, c) { out.push([a, b, c, PUNTOS_PARTICIPAR]); };
    const eventos = leerEventos_(ss).filter(function (e) { return e.desde >= v.inicio; });
    const pasados = eventos.filter(function (e) { return e.hasta < hoy; });
    if (pasados.length >= 2 && pasados.every(function (e) { return e.van.indexOf(id) !== -1; })) dif('ni-uno', 'A todos los eventos', 'Has ido a todos los eventos que ha habido.');
    if (eventos.length >= 2 && eventos.every(function (e) { return e.van.indexOf(id) !== -1 || e.noVan.indexOf(id) !== -1; })) dif('contesta', 'Contesta a todos los eventos', 'Has dicho si vas o no a todos los eventos. ¡Gracias!');
    const todas = v.ef.filter(function (a) { return a.persona === id; });
    const mias = todas.map(function (a) { return a.fecha; });
    if ([0, 1, 2, 3].every(function (k) { const fin = sumarDias_(ayer, -7 * k), ini = sumarDias_(fin, -6); return ini >= v.inicio && mias.some(function (f) { return f >= ini && f <= fin; }); })) dif('semanas', 'Cuatro semanas seguidas', 'Has ido al menos una vez cada semana del último mes.');
    if (leerFijos_(ss).some(function (f) { return f.persona === id && (!f.hasta || f.hasta >= hoy); })) dif('fijo', 'Día fijo con la abuela', 'Tienes un día fijo con la abuela cada semana.');
    // v4.88: bienvenida (la primera vez, este mes) y guardián de la memoria (ha rellenado datos de la familia)
    const mes = todas.filter(function (a) { return a.fecha >= hace30; });
    if (mes.length && v.inicio < hace30 && leerApuntes_(ss).some(function (a) { return a.fecha < hace30; }) && !todas.some(function (a) { return a.fecha < hace30; })) dif('bienvenida', 'Primera vez en la mesa', 'Este mes has ido por primera vez. ¡Qué alegría!');
    const cambios = cambios30_(ss).filter(function (x) { return x.quien === id; });
    if (cambios.some(esDatos_)) dif('memoria', 'Guardián de la memoria', 'Has ayudado a completar los datos de la familia.');
    // v4.88: las de participar (casi cualquiera las puede tener)
    if (mes.some(function (a) { return a.turno === 'DORMIR'; })) facil('noche', 'Compañía de noche', 'Le has hecho compañía por la noche.');
    if (mes.some(function (a) { const d = diaSemana_(a.fecha); return d === 0 || d === 6; })) facil('finde-uno', 'Fin de semana con la abuela', 'Has ido algún sábado o domingo.');
    const porDia = {};
    mes.forEach(function (a) { (porDia[a.fecha] = porDia[a.fecha] || {})[a.turno] = true; });
    if (Object.keys(porDia).some(function (f) { return porDia[f].COMIDA && porDia[f].CENA; })) facil('doble', 'Comida y cena', 'Algún día te has quedado a comer y a cenar.');
    const config = leerConfig_(ss), personas = leerPersonas_(ss, config.excluir);
    const yoP = personas.filter(function (x) { return x.id === id; })[0];
    const mismos = {};
    personas.forEach(function (x) { if (yoP && x.id !== id && x.familia === yoP.familia) mismos[x.id] = true; });
    if (mes.some(function (a) { return v.ef.some(function (b) { return b.fecha === a.fecha && b.turno === a.turno && mismos[b.persona]; }); })) facil('en-familia', 'En familia', 'Has ido con alguien de tu familia.');
    if (mes.some(function (a) { return a.acompanantes; })) facil('trae', 'Con invitados', 'Has traído a alguien más a la mesa.');
    const crudos = leerApuntes_(ss).filter(function (a) { return a.persona === id && !a.no && a.fecha >= hace30; });
    if (crudos.some(function (a) { return a.nota; })) facil('notas', 'Notas con cariño', 'Dejas notas para que la casa se organice mejor.');
    const horaDe = horasDe_(config);
    if (crudos.some(function (a) { const x = antelacion_(a, horaDe); return x !== null && x >= 7 * 24; })) facil('previsor', 'Con una semana de margen', 'Te has apuntado con más de una semana de antelación.');
    if (eventos.some(function (e) { return e.hasta >= hace30 && e.van.indexOf(id) !== -1; })) facil('planes', 'Planes en familia', 'Vas a los eventos de la familia.');
    if (cambios.some(porOtro_)) facil('mano', 'Echa una mano', 'Apuntas o contestas por los demás.');
    return out;
  });
}

/** v4.84: las medallas del servicio, solo en positivo y entre el servicio */
function medallasServicio_(ss, personas, v, id, pon) {
  const hoy = hoy_(), hace30 = sumarDias_(hoy, -30), ayer = sumarDias_(hoy, -1);
  const serv = personas.filter(function (x) { return x.familia === 'Servicio'; }).map(function (x) { return x.id; });
  const n = {};
  v.ef.forEach(function (a) { if (a.fecha >= hace30 && serv.indexOf(a.persona) !== -1) { n[a.persona] = n[a.persona] || { COMIDA: 0, CENA: 0, DORMIR: 0 }; n[a.persona][a.turno]++; } });
  const mio = n[id] || { COMIDA: 0, CENA: 0, DORMIR: 0 };
  // no falla nunca: tiene días fijos y en el último mes no ha dicho «no voy» a ninguno
  const fijos = leerFijos_(ss).filter(function (f) { return f.persona === id && (!f.hasta || f.hasta >= hace30); });
  const faltas = leerApuntes_(ss).filter(function (a) { return a.persona === id && a.no && a.fecha >= hace30 && a.fecha <= ayer; }).length;
  if (fijos.length && !faltas && (mio.COMIDA + mio.CENA + mio.DORMIR) > 0) pon('nunca-falla', 'Siempre está', 'Este último mes no has faltado ni un día de los tuyos.');
  const masNoches = serv.every(function (o) { return o === id || (n[o] || { DORMIR: 0 }).DORMIR <= mio.DORMIR; });
  if (mio.DORMIR > 0 && masNoches) pon('mas-noches', 'Compañía de noche', mio.DORMIR + (mio.DORMIR === 1 ? ' noche' : ' noches') + ' este último mes. Gracias.');
  else if (mio.DORMIR >= 8) pon('noches', 'Compañía de noche', mio.DORMIR + ' noches este último mes.');
  if (mio.COMIDA >= 8) pon('comidas', 'Comidas con la abuela', mio.COMIDA + ' comidas este último mes.');
  if (mio.CENA >= 8) pon('cenas', 'Cenas con la abuela', mio.CENA + ' cenas este último mes.');
  // v4.86: siempre un gracias (si ha estado) y su día de la semana
  const dias30 = {};
  v.ef.forEach(function (a) { if (a.persona === id && a.fecha >= hace30) dias30[a.fecha] = true; });
  const nd = Object.keys(dias30).length;
  if (nd) pon('dias', 'Cariño de cada día', (nd === 1 ? '1 día' : nd + ' días') + ' con la abuela este último mes. Gracias por tu cariño y tu paciencia.');
  const porDow = [0, 0, 0, 0, 0, 0, 0];
  Object.keys(dias30).forEach(function (f) { porDow[diaSemana_(f)]++; });
  const maxD = Math.max.apply(null, porDow);
  if (maxD >= 3) { const DIAS_ = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']; pon('tu-dia', 'Los ' + DIAS_[porDow.indexOf(maxD)] + ', con la abuela', 'La abuela sabe que ese día estás tú.'); }
  const mias = v.ef.filter(function (a) { return a.persona === id; }).map(function (a) { return a.fecha; });
  if ([0, 1, 2, 3].every(function (k) { const fin = sumarDias_(ayer, -7 * k), ini = sumarDias_(fin, -6); return ini >= v.inicio && mias.some(function (f) { return f >= ini && f <= fin; }); })) pon('semanas', 'Cuatro semanas seguidas', 'Has estado con ella todas las semanas del último mes.');
}

/**
 * v4.79: los números de una persona, desde que empezó el calendario hasta ayer; v4.83: con sus medallas, sus puntos
 * y si está en el top 10 general (la suma de los puntos de las categorías). Solo lee.
 */
function misNumeros(personaId) {
  reiniciar_();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = leerConfig_(ss);
  const personas = leerPersonas_(ss, config.excluir);
  const p = personas.filter(function (x) { return x.id === personaId; })[0];
  if (!p) throw new Error('No encontramos ese nombre en la lista.');
  const hoy = hoy_(), ayer = sumarDias_(hoy, -1);
  const inicio = esFecha_(config.inicio) ? config.inicio : sumarDias_(hoy, -365);
  const crudos = leerApuntes_(ss);
  const v = visitas_(ss, config), ef = v.ef;
  const mios = ef.filter(function (a) { return a.persona === personaId; });
  const cuenta = { COMIDA: 0, CENA: 0, DORMIR: 0 }, porDia = [0, 0, 0, 0, 0, 0, 0];
  let mes = 0, ultima = '';
  mios.forEach(function (a) {
    cuenta[a.turno] = (cuenta[a.turno] || 0) + 1;
    porDia[diaSemana_(a.fecha)]++;
    if (a.fecha.slice(0, 7) === hoy.slice(0, 7)) mes++;
    if (a.fecha > ultima) ultima = a.fecha;
  });
  const maxDia = Math.max.apply(null, porDia);
  const diaFav = maxDia >= 2 ? porDia.indexOf(maxDia) : -1;
  // con cuánta antelación avisa: de cuándo se apuntó a la hora de esa comida, cena o noche (la mediana, en horas)
  const horaDe = horasDe_(config);
  const antes = crudos.filter(function (a) { return a.persona === personaId && !a.no && a.creado && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(a.creado); }).map(function (a) {
    const h = String(horaDe[a.turno] || '14:00');
    const cuando = aUTC_(a.fecha) + (Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))) * 60000;
    const creado = aUTC_(a.creado.slice(0, 10)) + (Number(a.creado.slice(11, 13)) * 60 + Number(a.creado.slice(14, 16))) * 60000;
    return (cuando - creado) / 3600000;
  }).filter(function (x) { return x >= 0; }).sort(function (a, b) { return a - b; });
  const antelacion = antes.length >= 2 ? Math.round(antes[Math.floor(antes.length / 2)]) : null;
  // v4.83: las medallas, los puntos y el top 10 general (la suma de las categorías)
  const c = categorias_(ss, config, personas), yo = mios.length;
  return { servicio: p.familia === 'Servicio', distinciones: distinciones_(ss, config, personas, personaId), puntos: c.puntos[personaId] || 0, top10: enTop_(c.puntos, personaId), desde: inicio, total: yo, comidas: cuenta.COMIDA, cenas: cuenta.CENA, noches: cuenta.DORMIR, mes: mes, diaFav: diaFav, porDia: porDia,
    antelacionHoras: antelacion, ultima: ultima };
}

/**
 * v4.85: el portal de premios (solo para quien lleva la web): cada categoría con quién está, el top 10 general,
 * quién tiene cada medalla, las del servicio, las familias y los totales del último mes.
 */
function getPremios(quien, claveAdmin) {
  reiniciar_();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = leerConfig_(ss);
  comprobarAdmin_(config, quien, claveAdmin, 'Los premios son solo para quien lleva la web.');
  const personas = leerPersonas_(ss, config.excluir);
  const apodo = {};
  personas.forEach(function (p) { apodo[p.id] = p.apodo; });
  const v = visitas_(ss, config), c = categorias_(ss, config, personas);
  const lista = function (mapa, pts) {
    return Object.keys(pts).map(function (id) { return { id: id, apodo: apodo[id] || id, valor: Math.round(mapa[id] * 10) / 10, puntos: pts[id] }; })
      .sort(function (a, b) { return b.puntos - a.puntos || a.apodo.localeCompare(b.apodo); });
  };
  const categorias = Object.keys(CATEGORIAS).map(function (k) { return { id: k, titulo: CATEGORIAS[k].titulo, texto: CATEGORIAS[k].texto, gente: lista(c.cats[k], c.pts[k]) }; });
  const general = Object.keys(c.puntos).map(function (id) { return { id: id, apodo: apodo[id] || id, puntos: c.puntos[id], top: enTop_(c.puntos, id) }; })
    .sort(function (a, b) { return b.puntos - a.puntos || a.apodo.localeCompare(b.apodo); });
  const medallas = {};
  personas.filter(function (p) { return p.familia !== 'Servicio' && p.familia !== 'Otros'; }).forEach(function (p) {
    logros_(ss, v, p.id).forEach(function (l) { (medallas[l[0]] = medallas[l[0]] || { id: l[0], titulo: l[1], puntos: l[3], gente: [] }).gente.push(p.apodo); });
  });
  const servicio = personas.filter(function (p) { return p.familia === 'Servicio'; }).map(function (p) {
    const out = [];
    medallasServicio_(ss, personas, v, p.id, function (id, titulo, texto) { out.push({ id: id, titulo: titulo, texto: texto }); });
    return { apodo: p.apodo, medallas: out };
  });
  // las familias y los totales del último mes (sin el servicio)
  const hace30 = sumarDias_(hoy_(), -30), fam = {}, totales = { COMIDA: 0, CENA: 0, DORMIR: 0 }, gente = {};
  const deP = {};
  personas.forEach(function (p) { deP[p.id] = p; });
  v.ef.forEach(function (a) {
    const p = deP[a.persona];
    if (!p || a.fecha < hace30 || p.familia === 'Servicio' || p.familia === 'Otros') return;
    totales[a.turno]++; gente[a.persona] = true;
    fam[p.familia] = (fam[p.familia] || 0) + 1;
  });
  const familias = Object.keys(fam).map(function (f) { return { familia: f, visitas: fam[f] }; }).sort(function (a, b) { return b.visitas - a.visitas; });
  return { desde: hace30, totales: { comidas: totales.COMIDA, cenas: totales.CENA, noches: totales.DORMIR, personas: Object.keys(gente).length },
    curiosidades: curiosidades_(ss, config, v, deP, hace30),  // v5.7: para el informe del mes
    categorias: categorias, general: general, medallas: Object.keys(medallas).map(function (k) { return medallas[k]; }), servicio: servicio, familias: familias, puntosMedalla: PUNTOS_MEDALLA };
}

/** v5.7: cifras bonitas del último mes para el informe (solo la familia; nunca quién va menos) */
function curiosidades_(ss, config, v, deP, hace30) {
  const mesa = {}, dias = {}, dow = [0, 0, 0, 0, 0, 0, 0], fams = {};
  // v5.8: lo de cada día (para la gráfica), por día de la semana, acompañantes y el mes anterior
  const hace60 = sumarDias_(hace30, -30), serie = {}, porDow = [0, 0, 0, 0, 0, 0, 0], ant = { comidas: 0, cenas: 0, noches: 0 };
  let acomp = 0;
  for (let f = hace30; f < hoy_(); f = sumarDias_(f, 1)) serie[f] = [0, 0, 0, 0, 0, 0];  // comida, cena, noche · tíos, nietos, bisnietos
  // v5.9: por generación (las parejas, con la suya)
  const gen = function (p) { const j = String(p.jerarquia || ''); return /^Tios/.test(j) ? 0 : /^Nietos/.test(j) ? 1 : /^Biznietos/.test(j) ? 2 : -1; };
  const porGen = [0, 1, 2].map(function () { return { visitas: 0, gente: {} }; });
  v.ef.forEach(function (a) {
    const p = deP[a.persona];
    if (!p || p.familia === 'Servicio' || p.familia === 'Otros') return;
    const i = { COMIDA: 0, CENA: 1, DORMIR: 2 }[a.turno];
    if (a.fecha >= hace60 && a.fecha < hace30) ant[['comidas', 'cenas', 'noches'][i]]++;
    if (a.fecha < hace30) return;
    if (serie[a.fecha]) serie[a.fecha][i]++;
    const g = gen(p);
    if (g !== -1) { if (serie[a.fecha]) serie[a.fecha][3 + g]++; porGen[g].visitas++; porGen[g].gente[a.persona] = (porGen[g].gente[a.persona] || 0) + 1; }
    porDow[diaSemana_(a.fecha)]++;
    acomp += Number(a.acompanantes) || 0;
  });
  const horaDe = horasDe_(config), antes = [];
  leerApuntes_(ss).forEach(function (a) {
    const p = deP[a.persona];
    if (!p || p.familia === 'Servicio' || p.familia === 'Otros' || a.no || a.fecha < hace30 || a.fecha >= hoy_()) return;
    const x = antelacion_(a, horaDe);
    if (x !== null && x >= 0) antes.push(x);
  });
  antes.sort(function (a, b) { return a - b; });
  v.ef.forEach(function (a) {
    const p = deP[a.persona];
    if (!p || a.fecha < hace30 || p.familia === 'Servicio' || p.familia === 'Otros') return;
    dias[a.fecha] = true; fams[p.familia] = true;
    if (a.turno !== 'DORMIR') { const k = a.fecha + '|' + a.turno; mesa[k] = (mesa[k] || 0) + 1 + (Number(a.acompanantes) || 0); }
  });
  Object.keys(dias).forEach(function (f) { dow[diaSemana_(f)]++; });
  let llena = null;
  Object.keys(mesa).forEach(function (k) { if (!llena || mesa[k] > llena.n || (mesa[k] === llena.n && k > llena.fecha + '|' + llena.turno)) llena = { fecha: k.split('|')[0], turno: k.split('|')[1], n: mesa[k] }; });
  const max = Math.max.apply(null, dow);
  const hoy = hoy_();
  const ev = leerEventos_(ss).filter(function (e) { return e.hasta >= hace30 && e.desde < hoy; });
  const vanEv = {};
  ev.forEach(function (e) { e.van.forEach(function (id) { vanEv[id] = true; }); });
  return { dias: Object.keys(dias).length, deDias: 30, mesaLlena: llena, diaFavorito: max ? dow.indexOf(max) : null,
    familias: Object.keys(fams).length, eventos: ev.length, vanEventos: Object.keys(vanEv).length,
    serie: Object.keys(serie).sort().map(function (f) { return [f].concat(serie[f]); }), porDow: porDow, acompanantes: acomp,
    porGen: porGen.map(function (x, i) {
      const ids = Object.keys(x.gente).sort(function (a, b) { return x.gente[b] - x.gente[a]; }), m = ids.length ? x.gente[ids[0]] : 0;
      return { gen: ['Tios', 'Nietos', 'Biznietos'][i], visitas: x.visitas, personas: ids.length,
        primeros: ids.filter(function (id) { return x.gente[id] === m; }).slice(0, 3).map(function (id) { return deP[id].apodo; }), max: m };
    }),
    antelacionH: antes.length ? Math.round(antes[Math.floor(antes.length / 2)]) : null, apuntes: antes.length,
    anterior: v.inicio <= hace60 ? ant : null };
}

function leerConfig_(ss) { return memo_('config', function () { return leerConfigSin_(ss); }); }
function leerConfigSin_(ss) {
  const filas = ss.getSheetByName(HOJA_CONFIG).getDataRange().getValues().slice(1);
  const mapa = {};
  filas.forEach(function (f) { if (f[0]) mapa[String(f[0]).trim()] = f[1]; });
  return {
    inicio: aFecha_(mapa.FECHA_INICIO) || hoy_(),
    excluir: String(mapa.EXCLUIR_IDS || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean),
    horaComida: aHora_(mapa.HORA_COMIDA, '14:00'),
    horaCena: aHora_(mapa.HORA_CENA, '21:00'),
    horaDormir: aHora_(mapa.HORA_DORMIR, '22:30'),
    avisoHoras: Number(mapa.AVISO_HORAS) || 4,
    urlCompartir: String(mapa.URL_COMPARTIR || '').trim(),
    clave: String(mapa.CLAVE || '').trim(),
    pista: String(mapa.PISTA || '').trim(),
    admins: String(mapa.ADMIN_IDS || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean),  // v4.58
    claveAdmin: String(mapa.CLAVE_ADMIN || '').trim(),  // v4.91 (nunca sale hacia la web)
    avisosCalla: mapa.AVISOS_CALLA === '' || mapa.AVISOS_CALLA == null || isNaN(Number(mapa.AVISOS_CALLA)) ? 22 : Number(mapa.AVISOS_CALLA),  // v5.37 (T0623): de qué hora a qué hora no salen avisos
    avisosHabla: mapa.AVISOS_HABLA === '' || mapa.AVISOS_HABLA == null || isNaN(Number(mapa.AVISOS_HABLA)) ? 8 : Number(mapa.AVISOS_HABLA),
    noCuentan: String(mapa.NO_CUENTAN || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean),  // v4.61: quién no cuenta en «Quién la usa»
  };
}

function filasPersonas_(ss) { return memo_('personas', function () { return filasPersonasSin_(ss); }); }
function filasPersonasSin_(ss) {
  return ss.getSheetByName(HOJA_PERSONAS).getDataRange().getValues().slice(1)
    .filter(function (f) { return f[0] && String(f[1]).trim(); });
}

function aPersona_(f) {
  return {
    id: String(f[0]).trim(),
    apodo: String(f[1]).trim(),
    jerarquia: String(f[2] || '').trim(),
    familia: String(f[3] || '').trim(),
    menu: String(f[COL_MENU - 1] || '').trim(),
    alergias: String(f[COL_ALERGIAS - 1] || '').trim(),
    cumple: aCumple_(f[COL_CUMPLE - 1]),
    baja: aFecha_(f[COL_BAJA - 1]),
    apellido: String(f[COL_APELLIDO - 1] || '').trim(),
    sexo: SEXOS.indexOf(String(f[COL_SEXO - 1] || '').trim()) !== -1 ? String(f[COL_SEXO - 1]).trim() : '',
    pareja: String(f[COL_PAREJA - 1] || '').trim(),
    hijoDe: String(f[COL_HIJO_DE - 1] || '').trim(),
    nombre: String(f[COL_NOMBRE - 1] || '').trim(),
    casados: CASADOS.indexOf(String(f[COL_CASADOS - 1] || '').trim()) !== -1 ? String(f[COL_CASADOS - 1]).trim() : '',
    fallecio: aFallecio_(f[COL_FALLECIO - 1]),
    novios: aFechaSinAno_(f[COL_NOVIOS - 1], 1850),
    boda: aFechaSinAno_(f[COL_BODA - 1], 1850, 10),
    fechas: leerFechas_(f[COL_FECHAS - 1]),
  };
}

/** v4.10: Pareja e Hijo de, con el Id de ahora si a alguien se le cambió el nombre (MESA_ALIAS). */
function conAlias_(ss) {
  const alias = resolverAlias_(ss);
  return function (p) {
    if (p.pareja) p.pareja = alias(p.pareja);
    if (p.hijoDe) p.hijoDe = alias(p.hijoDe);
    return p;
  };
}

function leerPersonas_(ss, excluir) {
  return filasPersonas_(ss).filter(function (f) { return excluir.indexOf(String(f[0]).trim()) === -1; }).map(aPersona_)
    .filter(function (p) { return !p.baja; }).map(conAlias_(ss));
}

/** v4.7: quienes se han quitado de la lista (columna Baja). Solo para que sus comidas pasadas salgan con su nombre. */
function leerBajas_(ss) {
  return filasPersonas_(ss).map(aPersona_).filter(function (p) { return p.baja; });
}

/** Personas de EXCLUIR_IDS: no se apuntan, pero pueden identificarse para hacer cambios. */
function leerEditores_(ss, excluir) {
  if (!excluir.length) return [];
  return filasPersonas_(ss).filter(function (f) { return excluir.indexOf(String(f[0]).trim()) !== -1; }).map(aPersona_)
    .filter(function (p) { return !p.baja; }).map(conAlias_(ss));
}

function opcionesMenu_(personas) {
  const vistos = MENUS_BASE.slice();
  personas.forEach(function (p) { if (p.menu && vistos.indexOf(p.menu) === -1) vistos.push(p.menu); });
  return vistos;
}

function aFilaApunte_(f) {
  return [String(f[0]), aFecha_(f[1]), String(f[2]), String(f[3]),
    f[4] instanceof Date ? Utilities.formatDate(f[4], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[4] || ''),
    String(f[5] || ''), String(f[6] || '').toUpperCase(), String(f[7] || ''),
    f[8] instanceof Date ? Utilities.formatDate(f[8], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[8] || ''),
    String(Number(f[9]) > 0 ? Math.floor(Number(f[9])) : '')];
}

function leerApuntesTodos_(ss) { return memo_('apuntes', function () { return leerApuntesSin_(ss); }); }
/** v5.28: solo comida, cena y noche (lo que cuenta en la mesa, las medallas y el informe), sin las visitas */
function leerApuntes_(ss) { return leerApuntesTodos_(ss).filter(function (a) { return TURNOS.indexOf(a.turno) !== -1; }); }
function leerApuntesSin_(ss) {
  const alias = resolverAlias_(ss);
  return abrirTabla_(ss.getSheetByName(HOJA_APUNTES), COLS_APUNTES, aFilaApunte_).vivas().map(function (x) {
    const f = x.v;
    return { id: f[0], fecha: f[1], turno: f[2], persona: alias(f[3]), creado: f[4], nota: f[5], no: f[6] === 'NO', notaPor: f[7], notaEn: f[8], acompanantes: Number(f[9]) || 0 };
  });
}

function hojaFijos_(ss) {
  return ss.getSheetByName(HOJA_FIJOS) ||
    crearHoja_(ss, HOJA_FIJOS, ['ID_FIJO', 'PERSONA_ID', 'DIA_SEMANA', 'TURNO', 'DESDE', 'HASTA', 'NOTA', 'CREADO_POR', 'CREADO_EN']);
}

function aFilaFijo_(f) {
  return [String(f[0]), String(f[1]), Number(f[2]), String(f[3]), aFecha_(f[4]), aFecha_(f[5]), String(f[6] || ''), String(f[7] || ''),
    f[8] instanceof Date ? Utilities.formatDate(f[8], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[8] || '')];
}

function leerFijosTodos_(ss) { return memo_('fijos', function () { return leerFijosSin_(ss); }); }
function leerFijos_(ss) { return leerFijosTodos_(ss).filter(function (f) { return TURNOS.indexOf(f.turno) !== -1; }); }
function leerFijosSin_(ss) {
  const alias = resolverAlias_(ss);
  return abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_).vivas().map(function (x) {
    const f = x.v;
    return { id: f[0], persona: alias(f[1]), dow: f[2], turno: f[3], desde: f[4], hasta: f[5], nota: f[6] };
  });
}

/**
 * Lee una pestaña como lista de filas con su número de fila, y al guardar solo toca lo que ha cambiado:
 * primero actualiza filas, luego añade las nuevas al final y por último borra (de abajo arriba).
 * Así, si Apps Script se corta a medias, como mucho se pierde ese cambio, nunca la pestaña entera.
 */
function abrirTabla_(hoja, cols, aFila) {
  const filas = [];
  const ultima = hoja.getLastRow();
  if (ultima >= 2) {
    const ancho = Math.min(cols, hoja.getMaxColumns());
    hoja.getRange(2, 1, ultima - 1, ancho).getValues().forEach(function (f, i) {
      while (f.length < cols) f.push('');
      if (f[0]) filas.push({ n: i + 2, v: aFila(f), cambiada: false, borrada: false });
    });
  }
  return {
    vivas: function () { return filas.filter(function (x) { return !x.borrada; }); },
    nueva: function (v) { filas.push({ n: null, v: v, cambiada: true, borrada: false }); },
    guardar: function () {
      if (hoja.getMaxColumns() < cols) hoja.insertColumnsAfter(hoja.getMaxColumns(), cols - hoja.getMaxColumns());
      // v4.15.1: cada fila, con todas las columnas de la pestaña (aunque venga más corta)
      const texto = function (v) {
        const r = v.map(function (c) { return c === null || c === undefined ? '' : String(c); });
        while (r.length < cols) r.push('');
        return r.slice(0, cols);
      };
      filas.forEach(function (x) {
        if (x.n && x.cambiada && !x.borrada) {
          const r = hoja.getRange(x.n, 1, 1, cols);
          comoTexto_(r);
          r.setValues([texto(x.v)]);
        }
      });
      const nuevas = filas.filter(function (x) { return !x.n && !x.borrada; }).map(function (x) { return texto(x.v); });
      if (nuevas.length) {
        const r = hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, cols);
        comoTexto_(r);
        r.setValues(nuevas);
      }
      filas.filter(function (x) { return x.n && x.borrada; }).map(function (x) { return x.n; })
        .sort(function (a, b) { return b - a; })
        .forEach(function (n) { hoja.deleteRow(n); });
    },
  };
}

/**
 * MESA_ALIAS: si a alguien se le cambia el apodo o la jerarquía en PERSONAS, su Id cambia (es una fórmula).
 * Poniendo ahí el Id antiguo y el nuevo, sus apuntes y fijos antiguos siguen siendo suyos.
 */
function resolverAlias_(ss) { return memo_('alias', function () { return resolverAliasSin_(ss); }); }
function resolverAliasSin_(ss) {
  const hoja = ss.getSheetByName(HOJA_ALIAS);
  const mapa = {};
  if (hoja && hoja.getLastRow() >= 2) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues().forEach(function (f) {
      const a = String(f[0] || '').trim(), b = String(f[1] || '').trim();
      if (a && b && a !== b) mapa[a] = b;
    });
  }
  return function (id) {
    let actual = id;
    for (let i = 0; i < 10 && mapa[actual]; i++) actual = mapa[actual];
    return actual;
  };
}

/** Ids con apuntes o fijos desde hace un mes que ya no están en PERSONAS (seguramente por un cambio de apodo). */
function huerfanos_(crudos, fijos, todos, hoy) {
  const existe = {};
  todos.forEach(function (p) { existe[p.id] = true; });
  const desde = sumarDias_(hoy, -30);
  const vistos = {};
  crudos.forEach(function (a) { if (!existe[a.persona] && a.fecha >= desde) vistos[a.persona] = true; });
  fijos.forEach(function (f) { if (!existe[f.persona] && (!f.hasta || f.hasta >= hoy)) vistos[f.persona] = true; });
  return Object.keys(vistos);
}

/**
 * Quién va de verdad cada día: los fijos de ese día de la semana, más los apuntes sueltos,
 * menos los «no voy» (ESTADO = NO). Devuelve { fecha, turno, persona, nota, fijo }.
 */
function efectivos_(crudos, fijos, desde, hasta, turnos) {
  const out = [];
  const porDia = {};
  crudos.forEach(function (a) {
    if (a.fecha < desde || a.fecha > hasta) return;
    (porDia[a.fecha + '|' + a.turno] = porDia[a.fecha + '|' + a.turno] || []).push(a);
  });
  for (let d = desde; d <= hasta; d = sumarDias_(d, 1)) {
    const dow = diaSemana_(d);
    (turnos || TURNOS).forEach(function (t) {
      const mapa = {};
      const orden = [];
      fijos.forEach(function (f) {
        if (f.dow === dow && f.turno === t && f.desde <= d && (!f.hasta || d <= f.hasta) && !mapa[f.persona]) {
          mapa[f.persona] = { fecha: d, turno: t, persona: f.persona, nota: '', fijo: true };
          orden.push(f.persona);
        }
      });
      (porDia[d + '|' + t] || []).forEach(function (a) {
        if (a.no) { delete mapa[a.persona]; return; }
        if (!mapa[a.persona]) orden.push(a.persona);
        mapa[a.persona] = { fecha: d, turno: t, persona: a.persona, nota: a.nota, notaPor: a.nota ? a.notaPor : '', notaEn: a.nota ? a.notaEn : '', fijo: !!(mapa[a.persona] && mapa[a.persona].fijo), acompanantes: a.acompanantes || 0 };
      });
      orden.forEach(function (id) { if (mapa[id]) { out.push(mapa[id]); delete mapa[id]; } });
    });
  }
  return out;
}

function leerDias_(ss) { return memo_('dias', function () { return leerDiasSin_(ss); }); }
function leerDiasSin_(ss) {
  const hoja = hojaDias_(ss);
  if (hoja.getLastRow() < 2) return [];
  const ancho = Math.min(COLS_DIAS, hoja.getMaxColumns());
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      const todo = esSi_(f[2]);
      return {
        fecha: aFecha_(f[0]), nota: String(f[1] || ''), por: String(f[3] || ''),
        sinComida: todo || esSi_(f[5]), motivoComida: String(f[6] || ''),
        sinCena: todo || esSi_(f[7]), motivoCena: String(f[8] || ''),
        notaServicio: String(f[9] || ''),
        sinDormir: esSi_(f[10]), motivoDormir: String(f[11] || ''),
        notaPor: String(f[12] || f[3] || ''), notaEn: texto_(f[13] || f[4]),
        servicioPor: String(f[14] || f[3] || ''), servicioEn: texto_(f[15] || f[4]),
        comidaPor: String(f[16] || f[3] || ''), comidaEn: texto_(f[17] || f[4]),
        cenaPor: String(f[18] || f[3] || ''), cenaEn: texto_(f[19] || f[4]),
        dormirPor: String(f[20] || f[3] || ''), dormirEn: texto_(f[21] || f[4]),
        fueraComida: esSi_(f[22]) || esSi_(f[26]), fueraCena: esSi_(f[22]) || esSi_(f[27]), fueraDormir: esSi_(f[22]) || esSi_(f[28]),
        motivoFuera: String(f[23] || ''), fueraPor: String(f[24] || ''), fueraEn: texto_(f[25]),
        evento: String(f[29] || ''), eventoTurno: String(f[30] || ''), eventoTexto: String(f[31] || ''),
      };
    });
}

/* ---------- Escritura (todas guardan quién lo hace en MESA_CAMBIOS) ---------- */

/**
 * Editar a una persona (también a otros y días pasados).
 * cambios = { menu?, alergias?, cumple?, turnos?: [{ fecha, turno, apuntado, nota?, desdeAqui? }], fijos?: [{ dow, turno }] }
 * desdeAqui (al quitar un día que va siempre): deja de ir ese día y todos los siguientes de ese día de la semana.
 * fijos es la lista completa de sus comidas o cenas de siempre (sustituye a la anterior desde hoy).
 * La abuela (EXCLUIR_IDS) solo puede cambiar su menú y sus alergias.
 */
function guardarPersona(personaId, cambios, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const editores = leerEditores_(ss, config.excluir);
    const autor = autor_(personas.concat(editores), quien);
    soloLoSuyo_(autor, personaId);  // v4.86
    let p = personas.filter(function (x) { return x.id === personaId; })[0];
    const esEditor = !p;
    if (esEditor) p = editores.filter(function (x) { return x.id === personaId; })[0];
    if (!p) throw new Error('No encontramos ese nombre en la lista.');
    cambios = cambios || {};
    if (esEditor && ((cambios.turnos && cambios.turnos.length) || cambios.fijos)) throw new Error(p.apodo + ' no se apunta a las comidas.');
    const registro = [];

    if (cambios.cumple !== undefined) {
      const cumple = aCumple_(cambios.cumple);
      if (String(cambios.cumple || '').trim() && !cumple) throw new Error('El cumpleaños tiene que ser un día y un mes que existan (y, si se pone, un año de 1900 a hoy, o el que viene si está en camino), o el mes y el año, o solo el año.');
      escribirEnPersonas_(ss, personaId, COL_CUMPLE, cumple, true);
      if (cumple !== p.cumple) registro.push('Cumpleaños de ' + p.apodo + ': ' + (cumple || 'borrado'));
    }
    if (cambios.fechas !== undefined) {  // v4.28: otras fechas (bautizo, primera comunión, santo…), la lista entera
      const texto = textoFechas_(cambios.fechas);
      const antes = (p.fechas || []).map(function (x) { return x.que + ': ' + x.fecha; }).join('; ');
      if (texto !== antes) {
        asegurarColumnas_(ss, COL_FECHAS);
        escribirEnPersonas_(ss, personaId, COL_FECHAS, texto, true);
        registro.push('Otras fechas de ' + p.apodo + ': ' + (texto || 'ninguna'));
      }
    }
    if (cambios.menu !== undefined && cambios.menu !== p.menu) {
      if (opcionesMenu_(personas).indexOf(cambios.menu) === -1) throw new Error('Ese menú no está en la lista.');
      escribirEnPersonas_(ss, personaId, COL_MENU, cambios.menu, false);
      registro.push('Menú de ' + p.apodo + ': ' + cambios.menu);
    }
    if (cambios.alergias !== undefined) {
      const texto = limpiar_(cambios.alergias, MAX_ALERGIAS, 'Las alergias');
      if (texto.replace(/^'/, '') !== p.alergias) {
        escribirEnPersonas_(ss, personaId, COL_ALERGIAS, texto, false);
        registro.push((esEditor ? 'Comida de ' : 'Alergias de ') + p.apodo + ': ' + (texto.replace(/^'/, '') || 'nada'));
      }
    }

    if (CAMPOS_NUCLEO.some(function (k) { return cambios[k] !== undefined; })) {
      ponerNucleo_(ss, p, cambios, registro, personas.concat(editores));
    }

    const cierres = [];
    if (cambios.turnos && cambios.turnos.length) {
      const fijos = leerFijosTodos_(ss);
      const alias = resolverAlias_(ss);
      const tabla = abrirTabla_(ss.getSheetByName(HOJA_APUNTES), COLS_APUNTES, aFilaApunte_);
      cambios.turnos.forEach(function (t) {
        validarTurno_(config, t.fecha, t.turno);
        const cuando = nombreTurno_(t.turno) + ' del ' + ddmm_(t.fecha);
        const dow = diaSemana_(t.fecha);
        const esFijo = fijos.some(function (f) {
          return f.persona === personaId && f.dow === dow && f.turno === t.turno && f.desde <= t.fecha && (!f.hasta || t.fecha <= f.hasta);
        });
        const x = tabla.vivas().filter(function (r) { return r.v[1] === t.fecha && r.v[2] === t.turno && alias(r.v[3]) === personaId; })[0];
        const fila = x ? x.v : null;
        if (x && fila[3] !== personaId) { fila[3] = personaId; x.cambiada = true; }
        const iba = fila ? fila[6] !== 'NO' : esFijo;
        const notaAntes = fila ? fila[5] : '';
        const nota = t.nota !== undefined ? limpiar_(t.nota, MAX_NOTA, 'La nota', true) : null;
        // v4.15: acompañantes (gente que viene con esta persona y no está en la lista)
        let acomp = null;
        if (t.acompanantes !== undefined) {
          acomp = Math.floor(Number(t.acompanantes) || 0);
          if (acomp < 0 || acomp > MAX_ACOMPANANTES) throw new Error('Los acompañantes van de 0 a ' + MAX_ACOMPANANTES + '.');
        }
        const acompAntes = fila ? Number(fila[9]) || 0 : 0;
        if (t.apuntado) {
          if (!fila) {
            if (!esFijo || nota || acomp) tabla.nueva([Utilities.getUuid(), t.fecha, t.turno, personaId, ahora_(), nota || '', '', nota ? autor.apodo : '', nota ? ahora_() : '', acomp ? String(acomp) : '']);
          } else {
            if (fila[6] !== '') { fila[6] = ''; x.cambiada = true; }
            if (nota !== null && nota !== fila[5]) { fila[5] = nota; fila[7] = nota ? autor.apodo : ''; fila[8] = nota ? ahora_() : ''; x.cambiada = true; }
            if (acomp !== null && acomp !== acompAntes) { fila[9] = acomp ? String(acomp) : ''; x.cambiada = true; }
            if (esFijo && !fila[5] && !(Number(fila[9]) > 0)) x.borrada = true;
          }
          if (!iba) registro.push('Apunta a ' + p.apodo + ' a la ' + cuando + (acomp ? ' (con ' + acomp + ' más)' : '') + (nota ? ' (nota: ' + nota + ')' : ''));
          else {
            if (nota !== null && nota !== notaAntes) registro.push('Nota de ' + p.apodo + ' en la ' + cuando + ': ' + (nota || 'borrada'));
            if (acomp !== null && acomp !== acompAntes) registro.push(p.apodo + ' va a la ' + cuando + (acomp ? ' con ' + acomp + ' más' : ' sin acompañantes'));
          }
        } else {
          if (esFijo && t.desdeAqui) {
            if (x) x.borrada = true;
            cierres.push({ fecha: t.fecha, dow: dow, turno: t.turno });
          } else if (esFijo) {
            if (x) { fila[6] = 'NO'; x.cambiada = true; } else { tabla.nueva([Utilities.getUuid(), t.fecha, t.turno, personaId, ahora_(), '', 'NO', '', '', '']); }
          } else if (x) {
            x.borrada = true;
          }
          if (iba) registro.push('Quita a ' + p.apodo + ' de la ' + cuando + (esFijo ? (t.desdeAqui ? ' y de las siguientes' : ' (solo ese día)') : ''));
        }
      });
      tabla.guardar();
      const hojaA = ss.getSheetByName(HOJA_APUNTES);
      if (!String(hojaA.getRange(1, 10).getValue()).trim()) hojaA.getRange(1, 10).setValue('ACOMPANANTES');
      olvidar_('apuntes');
    }

    if (cierres.length) cerrarFijos_(ss, p, cierres);
    if (cambios.fijos) guardarFijos_(ss, p, cambios.fijos, autor, registro);
    if (cierres.length || cambios.fijos) olvidar_('fijos');

    let renombrado = null;
    if (!esEditor && (cambios.apodo !== undefined || cambios.jerarquia !== undefined || cambios.familia !== undefined)) {
      renombrado = renombrarPersona_(ss, p, cambios, registro);
    }

    registrar_(ss, autor, registro);
    const d = datos_(ss, vista || {});
    if (renombrado) d.renombrado = renombrado;
    return d;
  });
}

/** Deja de ir siempre a partir de una fecha: el fijo termina el día anterior (o se borra si aún no había empezado). */
function cerrarFijos_(ss, p, cierres) {
  const alias = resolverAlias_(ss);
  const tabla = abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_);
  cierres.forEach(function (c) {
    tabla.vivas().forEach(function (x) {
      const f = x.v;
      if (alias(f[1]) === p.id && f[2] === c.dow && f[3] === c.turno && f[4] <= c.fecha && (!f[5] || f[5] >= c.fecha)) {
        f[5] = sumarDias_(c.fecha, -1);
        if (f[5] < f[4]) x.borrada = true; else x.cambiada = true;
      }
    });
  });
  tabla.guardar();
}

/** Sustituye sus comidas o cenas de siempre: cierra las que ya no están (ayer) y abre las nuevas (hoy). */
function guardarFijos_(ss, p, lista, autor, registro) {
  const hoy = hoy_();
  const ayer = sumarDias_(hoy, -1);
  const nombres = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  const quiere = {};
  lista.forEach(function (x) {
    const dow = Number(x.dow);
    if (!(dow >= 0 && dow <= 6) || TODOS_TURNOS.indexOf(x.turno) === -1) throw new Error('Día fijo no válido.');
    quiere[dow + '|' + x.turno] = true;
  });
  const alias = resolverAlias_(ss);
  const tabla = abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_);
  const activos = {};
  tabla.vivas().forEach(function (x) {
    const f = x.v;
    if (alias(f[1]) !== p.id || (f[5] && f[5] < hoy)) return;
    const k = f[2] + '|' + f[3];
    if (quiere[k]) { activos[k] = true; return; }
    f[5] = f[4] >= hoy ? sumarDias_(f[4], -1) : ayer;
    if (f[5] < f[4]) x.borrada = true; else x.cambiada = true;
    registro.push(p.apodo + ' deja de ir siempre los ' + nombres[f[2]] + ' (' + nombreTurno_(f[3]) + ')');
  });
  Object.keys(quiere).forEach(function (k) {
    if (activos[k]) return;
    const partes = k.split('|');
    tabla.nueva([Utilities.getUuid(), p.id, Number(partes[0]), partes[1], hoy, '', '', autor.apodo, ahora_()]);
    registro.push(p.apodo + ' va siempre los ' + nombres[Number(partes[0])] + ' (' + nombreTurno_(partes[1]) + ')');
  });
  tabla.guardar();
}

/**
 * Lo de un día: nota familiar, nota para el servicio y si no hace falta nadie a la comida o a la cena (con motivo).
 * dia = { nota, notaServicio, sinComida, motivoComida, sinCena, motivoCena, sinDormir, motivoDormir, fueraComida, fueraCena, fueraDormir, motivoFuera }
 */
/**
 * v4.40: lo que rellena una familia de una vez (página «Rellenar lo que falta»): lista = [{ id, cambios }].
 * Cada persona se guarda como en su ficha; si una falla, se dice quién y se para (las anteriores ya están guardadas).
 */
function guardarPersonas(lista, quien, vista) {
  if (!Array.isArray(lista) || !lista.length) throw new Error('No hay nada que guardar.');
  if (lista.length > 60) throw new Error('Son demasiadas personas de una vez.');
  let d = null;
  lista.forEach(function (x) {
    try { d = guardarPersona(x.id, x.cambios || {}, quien, vista); }
    catch (e) { throw new Error(String(x.id || '').replace(/^\([^)]*\) - /, '') + ': ' + e.message); }
  });
  return d;
}

function guardarDia(fecha, dia, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const autor = autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien);
    validarDia_(config, fecha);
    dia = dia || {};
    const nota = limpiar_(dia.nota, MAX_NOTA, 'La nota', true);
    const notaServicio = limpiar_(dia.notaServicio, MAX_NOTA, 'La nota para el servicio', true);
    const sinComida = !!dia.sinComida, sinCena = !!dia.sinCena;
    const motivoComida = sinComida ? limpiar_(dia.motivoComida, MAX_NOTA, 'El motivo', true) : '';
    const motivoCena = sinCena ? limpiar_(dia.motivoCena, MAX_NOTA, 'El motivo', true) : '';
    const sinDormir = !!dia.sinDormir;
    const motivoDormir = sinDormir ? limpiar_(dia.motivoDormir, MAX_NOTA, 'El motivo', true) : '';
    const fueraC = !!dia.fueraComida, fueraX = !!dia.fueraCena, fueraD = !!dia.fueraDormir;
    const fuera = fueraC || fueraX || fueraD;
    const motivoFuera = fuera ? limpiar_(dia.motivoFuera, MAX_NOTA, 'El motivo', true) : '';
    // v4.15: un evento puntual (la castañada…) con su turno y su descripción
    const evento = limpiar_(dia.evento, MAX_EVENTO, 'El nombre del evento', true);
    const eventoTurno = evento ? (TURNOS.indexOf(dia.eventoTurno) !== -1 ? dia.eventoTurno : 'COMIDA') : '';
    const eventoTexto = evento ? limpiar_(dia.eventoTexto, MAX_EVENTO_TEXTO, 'La descripción del evento', true) : '';
    const hoja = hojaDias_(ss);
    if (hoja.getMaxColumns() < COLS_DIAS) hoja.insertColumnsAfter(hoja.getMaxColumns(), COLS_DIAS - hoja.getMaxColumns());
    const n = Math.max(0, hoja.getLastRow() - 1);
    const fechas = n ? hoja.getRange(2, 1, n, 1).getValues().map(function (f) { return aFecha_(f[0]); }) : [];
    const i = fechas.indexOf(fecha);
    const antes = i !== -1 ? leerDias_(ss).filter(function (d) { return d.fecha === fecha; })[0] : null;
    const ahora = ahora_();
    /* Quién y cuándo de cada cosa: solo cambia si cambia esa cosa */
    const autoria = function (vacio, igual, porAntes, enAntes) {
      if (vacio) return ['', ''];
      if (antes && igual) return [porAntes, enAntes];
      return [autor.apodo, ahora];
    };
    const aNota = autoria(!nota, antes && antes.nota === nota, antes && antes.notaPor, antes && antes.notaEn);
    const aServ = autoria(!notaServicio, antes && antes.notaServicio === notaServicio, antes && antes.servicioPor, antes && antes.servicioEn);
    const aComida = autoria(!sinComida, antes && antes.sinComida && antes.motivoComida === motivoComida, antes && antes.comidaPor, antes && antes.comidaEn);
    const aCena = autoria(!sinCena, antes && antes.sinCena && antes.motivoCena === motivoCena, antes && antes.cenaPor, antes && antes.cenaEn);
    const aDormir = autoria(!sinDormir, antes && antes.sinDormir && antes.motivoDormir === motivoDormir, antes && antes.dormirPor, antes && antes.dormirEn);
    const aFuera = autoria(!fuera, antes && antes.fueraComida === fueraC && antes.fueraCena === fueraX && antes.fueraDormir === fueraD && antes.motivoFuera === motivoFuera, antes && antes.fueraPor, antes && antes.fueraEn);
    if (!String(hoja.getRange(1, 30).getValue()).trim()) hoja.getRange(1, 30, 1, 3).setValues([TITULOS_DIAS_V415]);
    if (!nota && !notaServicio && !sinComida && !sinCena && !sinDormir && !fuera && !evento) {
      if (i !== -1) hoja.deleteRow(i + 2);
      registrar_(ss, autor, ['Borra lo anotado el ' + ddmm_(fecha)]);
    } else {
      const fila = i !== -1 ? i + 2 : hoja.getLastRow() + 1;
      const rango = hoja.getRange(fila, 1, 1, COLS_DIAS);
      comoTexto_(rango);
      rango.setValues([[fecha, nota, sinComida && sinCena ? 'TRUE' : 'FALSE', autor.apodo, ahora,
        sinComida ? 'TRUE' : 'FALSE', motivoComida, sinCena ? 'TRUE' : 'FALSE', motivoCena, notaServicio,
        sinDormir ? 'TRUE' : 'FALSE', motivoDormir].concat(aNota, aServ, aComida, aCena, aDormir, ['FALSE', motivoFuera], aFuera,
        [fueraC ? 'TRUE' : 'FALSE', fueraX ? 'TRUE' : 'FALSE', fueraD ? 'TRUE' : 'FALSE'], [evento, eventoTurno, eventoTexto])]);
      const partes = [];
      if (evento) partes.push('evento: ' + evento + ' (' + nombreTurno_(eventoTurno) + ')');
      if (nota) partes.push(nota);
      if (notaServicio) partes.push('para el servicio: ' + notaServicio);
      if (sinComida) partes.push('comida sin nadie' + (motivoComida ? ' (' + motivoComida + ')' : ''));
      if (sinCena) partes.push('cena sin nadie' + (motivoCena ? ' (' + motivoCena + ')' : ''));
      if (sinDormir) partes.push('noche sin nadie' + (motivoDormir ? ' (' + motivoDormir + ')' : ''));
      if (fuera) partes.push('la abuela no está: ' + [fueraC ? 'comida' : '', fueraX ? 'cena' : '', fueraD ? 'noche' : ''].filter(Boolean).join(', ') + (motivoFuera ? ' (' + motivoFuera + ')' : ''));
      registrar_(ss, autor, ['Día ' + ddmm_(fecha) + ': ' + partes.join(' · ')]);
    }
    olvidar_('dias');
    return datos_(ss, vista || {});
  });
}

/**
 * La abuela no está varios días: marca en qué comidas, cenas y noches no está, de desde a hasta.
 * marcados = ['aaaa-mm-dd|COMIDA', 'aaaa-mm-dd|CENA', …]; lo que no está en la lista, en ese rango, se desmarca.
 * Máximo 60 días de una vez.
 */
function guardarAusencia(desde, hasta, marcados, motivo, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const autor = autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien);
    validarDia_(config, desde);
    validarDia_(config, hasta);
    if (hasta < desde) throw new Error('El último día tiene que ser igual o posterior al primero.');
    if (diasEntre_(desde, hasta) > 60) throw new Error('Como mucho 60 días de una vez.');
    const marca = {};
    (marcados || []).forEach(function (k) { marca[k] = true; });
    const texto = Object.keys(marca).length ? limpiar_(motivo, MAX_NOTA, 'El motivo', true) : '';
    const hoja = hojaDias_(ss);
    if (hoja.getMaxColumns() < COLS_DIAS) hoja.insertColumnsAfter(hoja.getMaxColumns(), COLS_DIAS - hoja.getMaxColumns());
    const n = Math.max(0, hoja.getLastRow() - 1);
    const fechas = n ? hoja.getRange(2, 1, n, 1).getValues().map(function (f) { return aFecha_(f[0]); }) : [];
    const ahora = ahora_();
    const resumen = [];
    for (let d = desde; d <= hasta; d = sumarDias_(d, 1)) {
      const c = !!marca[d + '|COMIDA'], x = !!marca[d + '|CENA'], z = !!marca[d + '|DORMIR'];
      const algo = c || x || z;
      if (algo) resumen.push(ddmm_(d) + ' ' + [c ? 'comida' : '', x ? 'cena' : '', z ? 'noche' : ''].filter(Boolean).join(', '));
      const i = fechas.indexOf(d);
      const fuera = ['FALSE', algo ? texto : '', algo ? autor.apodo : '', algo ? ahora : ''];
      const turnos = [c ? 'TRUE' : 'FALSE', x ? 'TRUE' : 'FALSE', z ? 'TRUE' : 'FALSE'];
      if (i !== -1) {
        const r1 = hoja.getRange(i + 2, 23, 1, 4);
        comoTexto_(r1);
        r1.setValues([fuera]);
        const r2 = hoja.getRange(i + 2, 27, 1, 3);
        comoTexto_(r2);
        r2.setValues([turnos]);
      } else if (algo) {
        const fila = new Array(COLS_DIAS).fill('');
        fila[0] = d; fila[2] = 'FALSE'; fila[3] = autor.apodo; fila[4] = ahora; fila[5] = 'FALSE'; fila[7] = 'FALSE'; fila[10] = 'FALSE';
        fila[22] = fuera[0]; fila[23] = fuera[1]; fila[24] = fuera[2]; fila[25] = fuera[3];
        fila[26] = turnos[0]; fila[27] = turnos[1]; fila[28] = turnos[2];
        const r = hoja.getRange(hoja.getLastRow() + 1, 1, 1, COLS_DIAS);
        comoTexto_(r);
        r.setValues([fila]);
        fechas.push(d);
      }
    }
    registrar_(ss, autor, [resumen.length
      ? 'La abuela no está (' + resumen.join('; ') + ')' + (texto ? ': ' + texto : '')
      : 'Quita la ausencia de la abuela del ' + ddmm_(desde) + ' al ' + ddmm_(hasta)]);
    olvidar_('dias');
    return datos_(ss, vista || {});
  });
}

/* ---------- Personas: añadir y cambiar nombre o familia ---------- */

/** Opciones de Jerarquia y Familia: las de los desplegables de la tabla PERSONAS (o, si no, las que se usan). */
function listas_(ss, personas) {
  return memo_('listas', function () {
    const hoja = ss.getSheetByName(HOJA_PERSONAS);
    const desplegable = function (col) {
      try {
        const regla = hoja.getRange(2, col).getDataValidation();
        if (regla && regla.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return regla.getCriteriaValues()[0].map(String);
      } catch (e) { /* sin desplegable */ }
      return [];
    };
    const usados = function (campo) {
      const v = [];
      // v4.7: también quien está de baja, para poder recuperarlo
      personas.concat(leerBajas_(ss)).forEach(function (p) { if (p[campo] && v.indexOf(p[campo]) === -1) v.push(p[campo]); });
      return v;
    };
    let jerarquias = desplegable(3); if (!jerarquias.length) jerarquias = usados('jerarquia');
    let familias = desplegable(4); if (!familias.length) familias = usados('familia');
    return {
      jerarquias: jerarquias.filter(function (j) { return j !== 'Abuelos'; }),
      familias: familias.filter(function (f) { return f !== 'Abuelos'; }),
    };
  });
}

/** v4.11: el apodo es como le llaman en casa y no se puede repetir (da igual mayúsculas y acentos). salvo: Ids que no cuentan. */
function apodoLibre_(ss, apodo, salvo) {
  const n = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  const otro = filasPersonas_(ss).filter(function (f) { return salvo.indexOf(String(f[0]).trim()) === -1 && n(f[1]) === n(apodo); })[0];
  if (otro) throw new Error('Ya hay alguien que se llama «' + String(otro[1]).trim() + '» en la lista. El apodo no se puede repetir: añade una inicial o como le llamáis en casa (por ejemplo, «' + apodo + ' M»).');
}

/** El Id de PERSONAS lo calcula una fórmula: «(» + inicial de la jerarquía + «+1» si la lleva + «) - » + apodo. */
function idDe_(apodo, jerarquia) {
  return '(' + String(jerarquia || '').charAt(0) + (String(jerarquia || '').indexOf('+1') !== -1 ? '+1' : '') + ') - ' + apodo;
}

function validarFicha_(ss, personas, apodo, jerarquia, familia) {
  const listas = listas_(ss, personas);
  if (!apodo) throw new Error('Pon el nombre.');
  if (apodo.length > 40) throw new Error('El nombre cabe en 40 letras como mucho.');
  if (listas.jerarquias.length && listas.jerarquias.indexOf(jerarquia) === -1) throw new Error('Elige de quién es en la familia.');
  if (listas.familias.length && listas.familias.indexOf(familia) === -1) throw new Error('Elige la familia de la lista.');
}

/**
 * Añadir a alguien a PERSONAS: usa la primera fila vacía de la tabla (ya trae la fórmula del Id);
 * si no hay, inserta una fila al final de la tabla y copia la fórmula.
 * nueva = { apodo, jerarquia, familia, menu?, alergias?, cumple? }
 */
function crearPersona(nueva, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const autor = autor_(personas.concat(leerEditores_(ss, config.excluir)), quien);
    if (autor.familia === 'Servicio') throw new Error('Desde el servicio no se añaden personas.');  // v4.86
    nueva = nueva || {};
    const apodo = limpiar_(nueva.apodo, 40, 'El nombre', true);
    const jerarquia = String(nueva.jerarquia || '').trim();
    const familia = String(nueva.familia || '').trim();
    validarFicha_(ss, personas, apodo, jerarquia, familia);
    const id = idDe_(apodo, jerarquia);
    const deBaja = leerBajas_(ss).filter(function (b) { return b.id === id; })[0];
    if (deBaja) return recuperarPersona_(ss, deBaja, familia, nueva, personas, autor, vista);
    apodoLibre_(ss, apodo, []);
    if (filasPersonas_(ss).some(function (f) { return String(f[0]).trim() === id; })) throw new Error('Ya hay alguien llamado ' + apodo + ' con ese parentesco. Ponle un apodo distinto (por ejemplo, con la inicial del apellido).');
    const menu = nueva.menu && opcionesMenu_(personas).indexOf(nueva.menu) !== -1 ? nueva.menu : MENUS_BASE[0];
    const alergias = limpiar_(nueva.alergias, MAX_ALERGIAS, 'Las alergias');
    const cumple = aCumple_(nueva.cumple);

    const hoja = ss.getSheetByName(HOJA_PERSONAS);
    const n = Math.max(0, hoja.getLastRow() - 1);
    const ab = n ? hoja.getRange(2, 1, n, 2).getValues() : [];
    let fila = -1, ultimaConDatos = 1;
    ab.forEach(function (f, i) { if (String(f[1]).trim()) ultimaConDatos = i + 2; });
    for (let i = 0; i < ab.length; i++) { if (i + 2 > ultimaConDatos && !String(ab[i][1]).trim()) { fila = i + 2; break; } }
    if (fila === -1) {
      hoja.insertRowAfter(ultimaConDatos);
      fila = ultimaConDatos + 1;
      hoja.getRange(ultimaConDatos, 1).copyTo(hoja.getRange(fila, 1));
    }
    hoja.getRange(fila, 2, 1, 3).setValues([[apodo, jerarquia, familia]]);
    hoja.getRange(fila, COL_MENU, 1, 2).setValues([[menu, alergias]]);
    const celdaCumple = hoja.getRange(fila, COL_CUMPLE);
    celdaCumple.setNumberFormat('@');
    celdaCumple.setValue(cumple);
    olvidar_('personas', 'listas');
    const registro = ['Añade a ' + apodo + ' (' + jerarquia + ' · ' + familia + ')'];
    nucleoDeNueva_(ss, id, nueva, registro);
    registrar_(ss, autor, registro);
    const d = datos_(ss, vista || {});
    d.creado = id;
    return d;
  });
}

/** v4.7: volver a añadir a alguien que estaba de baja (mismo nombre y parentesco): se recupera su fila y se pone al día. */
function recuperarPersona_(ss, b, familia, nueva, personas, autor, vista) {
  const menu = nueva.menu && opcionesMenu_(personas).indexOf(nueva.menu) !== -1 ? nueva.menu : (b.menu || MENUS_BASE[0]);
  const alergias = limpiar_(nueva.alergias, MAX_ALERGIAS, 'Las alergias');
  const cumple = aCumple_(nueva.cumple);
  const fila = filaDePersona_(ss, b.id);
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  hoja.getRange(fila, 4).setValue(familia);
  hoja.getRange(fila, COL_MENU, 1, 2).setValues([[menu, alergias]]);
  if (cumple) { const c = hoja.getRange(fila, COL_CUMPLE); c.setNumberFormat('@'); c.setValue(cumple); }
  hoja.getRange(fila, COL_BAJA).setValue('');
  olvidar_('personas', 'listas');
  const registro = ['Vuelve a la lista ' + b.apodo + ' (' + b.jerarquia + ' · ' + familia + ')'];
  nucleoDeNueva_(ss, b.id, nueva, registro);
  registrar_(ss, autor, registro);
  const d = datos_(ss, vista || {});
  d.creado = b.id;
  return d;
}

/**
 * v4.7: quitar a alguien de la lista (añadido por error o porque ha fallecido). No se borra nada del Excel:
 * su fila de PERSONAS se queda con la fecha en Baja (I), se le quitan las comidas de hoy en adelante,
 * deja de ir siempre (sus fijos terminan ayer) y sus comidas pasadas se quedan como estaban.
 */
function darDeBaja(personaId, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const autor = autor_(personas.concat(leerEditores_(ss, config.excluir)), quien);
    if (autor.familia === 'Servicio') throw new Error('Desde el servicio no se quita a nadie de la lista.');  // v4.86
    const p = personas.filter(function (x) { return x.id === personaId; })[0];
    if (!p) throw new Error('No encontramos ese nombre en la lista.');
    const hoy = hoy_();
    asegurarColumnaBaja_(ss);
    escribirEnPersonas_(ss, personaId, COL_BAJA, hoy, true);

    const alias = resolverAlias_(ss);
    const apuntes = abrirTabla_(ss.getSheetByName(HOJA_APUNTES), COLS_APUNTES, aFilaApunte_);
    let quitadas = 0;
    apuntes.vivas().forEach(function (x) {
      if (alias(x.v[3]) === personaId && x.v[1] >= hoy) { x.borrada = true; if (x.v[6] !== 'NO') quitadas++; }
    });
    apuntes.guardar();

    const fijos = abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_);
    let fijosCerrados = 0;
    fijos.vivas().forEach(function (x) {
      const f = x.v;
      if (alias(f[1]) !== personaId || (f[5] && f[5] < hoy)) return;
      f[5] = sumarDias_(hoy, -1);
      if (f[5] < f[4]) x.borrada = true; else x.cambiada = true;
      fijosCerrados++;
    });
    fijos.guardar();
    olvidar_('personas', 'listas', 'apuntes', 'fijos');

    registrar_(ss, autor, ['Quita de la lista a ' + p.apodo + ' (' + p.jerarquia + ' · ' + p.familia + ')' +
      (quitadas || fijosCerrados ? ': se le quitan ' + [quitadas ? quitadas + ' comidas apuntadas' : '', fijosCerrados ? 'las de siempre' : ''].filter(String).join(' y ') : '')]);
    return datos_(ss, vista || {});
  });
}

/** Las columnas nuevas de PERSONAS (I Baja; J-M, núcleos), con su título, hasta la que hace falta. */
function asegurarColumnas_(ss, hasta) {
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  if (hoja.getMaxColumns() < hasta) hoja.insertColumnsAfter(hoja.getMaxColumns(), hasta - hoja.getMaxColumns());
  for (let c = COL_BAJA; c <= hasta; c++) {
    const titulo = hoja.getRange(1, c);
    if (!String(titulo.getValue()).trim() || /^Column \d+$/.test(String(titulo.getValue()).trim())) titulo.setValue(TITULOS_EXTRA[c]);  // v4.21: las tablas ponen «Column 16»
  }
}
function sinFechasPareja_(ss, id) {  // v4.21: al deshacerse una pareja, fuera «Casados» y sus fechas
  [COL_CASADOS, COL_NOVIOS, COL_BODA].forEach(function (c) { escribirEnPersonas_(ss, id, c, '', true); });
}
function asegurarColumnaBaja_(ss) { asegurarColumnas_(ss, COL_BAJA); }

/**
 * v4.10: apellido, Hombre o Mujer, pareja e hijo de. La pareja va en los dos sentidos: si alguien tenía otra, se le quita.
 * Hijo de no puede ser uno mismo ni alguien que desciende de él (sería un círculo).
 */
function ponerNucleo_(ss, p, cambios, registro, todos) {
  const nombre = function (id) { const x = todos.filter(function (t) { return t.id === id; })[0]; return x ? x.apodo : id; };
  const existe = function (id) { return todos.some(function (t) { return t.id === id; }); };
  asegurarColumnas_(ss, COL_BODA);
  if (cambios.fallecio !== undefined) {
    const texto = String(cambios.fallecio || '').trim();
    const fallecio = aFallecio_(texto);
    if (texto && !fallecio) throw new Error('La fecha de fallecimiento tiene que ser un día, mes y año que existan (o mes y año, o solo el año), y no de después de hoy.');
    if (fallecio !== (p.fallecio || '')) { escribirEnPersonas_(ss, p.id, COL_FALLECIO, fallecio, true); registro.push(p.apodo + (fallecio === 'Sí' ? ': falleció (sin saber cuándo)' : (fallecio ? ': falleció (' + fallecio + ')' : ': ya no consta que haya fallecido'))); }
  }
  if (cambios.nombre !== undefined) {
    const nombreReal = limpiar_(cambios.nombre, 40, 'El nombre', true);
    if (nombreReal !== p.nombre) { escribirEnPersonas_(ss, p.id, COL_NOMBRE, nombreReal, true); registro.push('Nombre de ' + p.apodo + ': ' + (nombreReal || 'borrado')); }
  }
  if (cambios.apellido !== undefined) {
    const apellido = limpiar_(cambios.apellido, 40, 'El apellido', true);
    if (apellido !== p.apellido) { escribirEnPersonas_(ss, p.id, COL_APELLIDO, apellido, true); registro.push('Apellido de ' + p.apodo + ': ' + (apellido || 'borrado')); }
  }
  if (cambios.sexo !== undefined) {
    const sexo = String(cambios.sexo || '').trim();
    if (sexo && SEXOS.indexOf(sexo) === -1) throw new Error('Elige hombre o mujer.');
    if (sexo !== p.sexo) { escribirEnPersonas_(ss, p.id, COL_SEXO, sexo, true); registro.push(p.apodo + ': ' + (sexo ? sexo.toLowerCase() : 'sin decir si es hombre o mujer')); }
  }
  if (cambios.hijoDe !== undefined) {
    const padre = String(cambios.hijoDe || '').trim();
    if (padre) {
      if (padre === p.id) throw new Error(p.apodo + ' no puede ser hijo de sí mismo.');
      if (!existe(padre)) throw new Error('No encontramos a su padre o su madre en la lista.');
      const padreDe = {};
      todos.forEach(function (t) { padreDe[t.id] = t.hijoDe; });
      for (let x = padre, i = 0; x && i < 50; x = padreDe[x], i++) {
        if (x === p.id) throw new Error(nombre(padre) + ' no puede ser padre o madre de ' + p.apodo + ': ya desciende de él o de ella.');
      }
    }
    if (padre !== p.hijoDe) { escribirEnPersonas_(ss, p.id, COL_HIJO_DE, padre, true); registro.push(p.apodo + (padre ? ' es hijo o hija de ' + nombre(padre) : ' ya no tiene padre o madre apuntado')); }
  }
  if (cambios.pareja !== undefined) {
    const nueva = String(cambios.pareja || '').trim();
    if (nueva === p.id) throw new Error(p.apodo + ' no puede ser su propia pareja.');
    if (nueva && !existe(nueva)) throw new Error('No encontramos a su pareja en la lista.');
    if (nueva !== p.pareja) {
      const parejaDe = {};
      todos.forEach(function (t) { parejaDe[t.id] = t.pareja; });
      // Al cambiar de pareja, «Casados» se borra en las dos parejas que se deshacen y en la nueva (v4.12)
      if (p.pareja && parejaDe[p.pareja] === p.id) { escribirEnPersonas_(ss, p.pareja, COL_PAREJA, '', true); sinFechasPareja_(ss, p.pareja); }
      if (nueva) {
        const anterior = parejaDe[nueva];
        if (anterior && anterior !== p.id && parejaDe[anterior] === nueva) { escribirEnPersonas_(ss, anterior, COL_PAREJA, '', true); sinFechasPareja_(ss, anterior); }
        escribirEnPersonas_(ss, nueva, COL_PAREJA, p.id, true);
        sinFechasPareja_(ss, nueva);
      }
      escribirEnPersonas_(ss, p.id, COL_PAREJA, nueva, true);
      sinFechasPareja_(ss, p.id);
      p.casados = ''; p.novios = ''; p.boda = '';
      registro.push(nueva ? p.apodo + ' y ' + nombre(nueva) + ' son pareja' : p.apodo + ' ya no tiene pareja');
    }
  }
  if (cambios.casados !== undefined) {
    const casados = String(cambios.casados || '').trim();
    if (casados && CASADOS.indexOf(casados) === -1) throw new Error('Elige si están casados: sí o no.');
    const pareja = cambios.pareja !== undefined ? String(cambios.pareja || '').trim() : p.pareja;
    if (casados && !pareja) throw new Error('Para decir si están casados, elige primero su pareja.');
    if (casados !== p.casados) {
      escribirEnPersonas_(ss, p.id, COL_CASADOS, casados, true);
      if (pareja) escribirEnPersonas_(ss, pareja, COL_CASADOS, casados, true);
      if (pareja) registro.push(p.apodo + ' y ' + nombre(pareja) + (casados === 'Sí' ? ': casados' : casados === 'No' ? ': no casados' : ': sin decir si están casados'));
    }
  }
  // v4.21: cuándo empezaron a salir y cuándo se casaron, en los dos de la pareja
  [['novios', COL_NOVIOS, 'empezaron a salir', 'cuándo empezaron a salir'], ['boda', COL_BODA, 'se casaron', 'la boda']].forEach(function (x) {
    if (cambios[x[0]] === undefined) return;
    const texto = String(cambios[x[0]] || '').trim();
    const fecha = aFechaSinAno_(texto, 1850, x[0] === 'boda' ? 10 : 0);  // v4.23: la boda, también la que viene; v4.30: o sin año
    if (texto && !fecha) throw new Error('La fecha de ' + x[3] + ' tiene que ser un día, mes y año que existan (o mes y año, o solo el año, o el día y el mes)' + (x[0] === 'boda' ? ', de aquí a diez años como mucho.' : ', y no de después de hoy.'));
    const pareja = cambios.pareja !== undefined ? String(cambios.pareja || '').trim() : p.pareja;
    if (fecha && !pareja) throw new Error('Para poner la fecha de ' + x[3] + ', elige primero su pareja.');
    if (fecha !== (p[x[0]] || '')) {
      escribirEnPersonas_(ss, p.id, x[1], fecha, true);
      if (pareja) escribirEnPersonas_(ss, pareja, x[1], fecha, true);
      registro.push(p.apodo + (pareja ? ' y ' + nombre(pareja) : '') + (fecha ? ' ' + x[2] + ': ' + fecha : ': sin fecha de ' + x[3]));
    }
  });
  olvidar_('personas');
}

/** El núcleo de alguien que se acaba de añadir (o recuperar). */
function nucleoDeNueva_(ss, id, nueva, registro) {
  if (!CAMPOS_NUCLEO.some(function (k) { return nueva[k]; })) return;
  SpreadsheetApp.flush();
  olvidar_('personas');
  const config = leerConfig_(ss);
  const todos = leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir));
  const p = todos.filter(function (t) { return t.id === id; })[0];
  if (p) ponerNucleo_(ss, p, { nombre: nueva.nombre || '', apellido: nueva.apellido || '', sexo: nueva.sexo || '', pareja: nueva.pareja || '', hijoDe: nueva.hijoDe || '', casados: nueva.casados || '', fallecio: nueva.fallecio || '', novios: nueva.novios || '', boda: nueva.boda || '' }, registro, todos);
}

function filaDePersona_(ss, personaId) {
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  const ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]).trim() === personaId) return i + 2; }
  throw new Error('No encontramos ese nombre en la lista.');
}

/** Cambiar apodo, jerarquía o familia. Si cambia el Id, guarda el alias para que no pierda sus apuntes. */
function renombrarPersona_(ss, p, cambios, registro) {
  const config = leerConfig_(ss);
  const personas = leerPersonas_(ss, config.excluir);
  const apodo = cambios.apodo !== undefined ? limpiar_(cambios.apodo, 40, 'El nombre', true) : p.apodo;
  const jerarquia = cambios.jerarquia !== undefined ? String(cambios.jerarquia).trim() : p.jerarquia;
  const familia = cambios.familia !== undefined ? String(cambios.familia).trim() : p.familia;
  if (apodo === p.apodo && jerarquia === p.jerarquia && familia === p.familia) return null;
  validarFicha_(ss, personas, apodo, jerarquia, familia);
  if (apodo !== p.apodo) apodoLibre_(ss, apodo, [p.id]);
  const nuevoId = idDe_(apodo, jerarquia);
  if (nuevoId !== p.id && filasPersonas_(ss).some(function (f) { return String(f[0]).trim() === nuevoId; })) {
    throw new Error('Ya hay alguien llamado ' + apodo + ' con ese parentesco.');
  }
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  const ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  let fila = -1;
  for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]).trim() === p.id) { fila = i + 2; break; } }
  if (fila === -1) throw new Error('No encontramos ese nombre en la lista.');
  hoja.getRange(fila, 2, 1, 3).setValues([[apodo, jerarquia, familia]]);
  if (nuevoId !== p.id) {
    const alias = ss.getSheetByName(HOJA_ALIAS) || crearHoja_(ss, HOJA_ALIAS, ['ID_ANTIGUO', 'ID_NUEVO', 'NOTA']);
    const r = alias.getRange(alias.getLastRow() + 1, 1, 1, 3);
    comoTexto_(r);
    r.setValues([[p.id, nuevoId, 'Cambiado desde la web el ' + ahora_().slice(0, 10)]]);
  }
  olvidar_('personas', 'alias', 'apuntes', 'fijos', 'listas');
  const partes = [];
  if (apodo !== p.apodo) partes.push('se llama ' + apodo);
  if (jerarquia !== p.jerarquia) partes.push(jerarquia);
  if (familia !== p.familia) partes.push('familia ' + familia);
  registro.push(p.apodo + ': ' + partes.join(', '));
  return { antes: p.id, despues: nuevoId };
}

/** Escribe una celda de la fila de esa persona en PERSONAS (F, G, H o I). La columna A está protegida y no se toca. */
function escribirEnPersonas_(ss, personaId, columna, valor, esTexto) {
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  if (hoja.getMaxColumns() < columna) {
    try {
      hoja.insertColumnsAfter(hoja.getMaxColumns(), columna - hoja.getMaxColumns());
      if (columna === COL_CUMPLE) hoja.getRange(1, COL_CUMPLE).setValue('Cumple');
    } catch (e) {
      throw new Error('Falta la columna Cumple (H) en PERSONAS. Hay que añadirla en el Excel.');
    }
  }
  const ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  let fila = -1;
  for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]).trim() === personaId) { fila = i + 2; break; } }
  if (fila === -1) throw new Error('No encontramos ese nombre en la lista.');
  const celda = hoja.getRange(fila, columna);
  if (esTexto) celda.setNumberFormat('@');
  celda.setValue(valor);
  olvidar_('personas');
}

function registrar_(ss, autor, lineas) {
  if (!lineas.length) return;
  const hoja = ss.getSheetByName(HOJA_CAMBIOS) || crearHoja_(ss, HOJA_CAMBIOS, ['CUANDO', 'QUIEN_ID', 'QUIEN', 'CAMBIO']);
  const cuando = ahora_();
  const filas = lineas.map(function (l) { return [cuando, autor.id, autor.apodo, l]; });
  const rango = hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 4);
  comoTexto_(rango);
  rango.setValues(filas);
}

function autor_(todos, quien) {
  const a = todos.filter(function (p) { return p.id === quien; })[0];
  if (!a) throw new Error('Elige primero quién eres, para guardar quién hace cada cambio.');
  return a;
}
/** v4.86: desde el servicio, cada uno cambia solo lo suyo (apuntarse, sus eventos y sus notas) */
function soloLoSuyo_(autor, personaId) {
  if (autor.familia === 'Servicio' && personaId !== autor.id) throw new Error('Desde el servicio solo puedes cambiar lo tuyo.');
}
function sinServicio_(autor) {
  if (autor.familia === 'Servicio') throw new Error('Los eventos los organiza la familia. Tú solo tienes que decir si vas.');
}

/* ---------- Validaciones ---------- */

function validarDia_(config, fecha) {
  if (!esFecha_(fecha)) throw new Error('Fecha no válida.');
  if (fecha < config.inicio) throw new Error('Ese día es anterior al inicio del calendario.');
}

function validarTurno_(config, fecha, turno) {
  if (TODOS_TURNOS.indexOf(turno) === -1) throw new Error('Turno no válido.');
  validarDia_(config, fecha);
}

function conBloqueo_(fn) {
  reiniciar_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Ahora mismo hay otra persona guardando. Vuelve a probar en unos segundos.');
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const r = fn(ss);
    invalidarCache_();
    return r;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Utilidades ---------- */

/**
 * v4.15.2: formato de texto (para que las fechas y los Ids no se conviertan), columna a columna:
 * en una pestaña con formato de tabla, Google no deja hacerlo de golpe en varias columnas
 * («Haz una selección en una sola columna para realizar acciones a nivel de columna»).
 */
function comoTexto_(rango) {
  const hoja = rango.getSheet(), fila = rango.getRow(), col = rango.getColumn(), filas = rango.getNumRows();
  for (let i = 0; i < rango.getNumColumns(); i++) hoja.getRange(fila, col + i, filas, 1).setNumberFormat('@');
}

function hojaDias_(ss) {
  return ss.getSheetByName(HOJA_DIAS) || crearHoja_(ss, HOJA_DIAS,
    ['FECHA', 'NOTA', 'SIN_TURNO', 'CAMBIADO_POR', 'CAMBIADO_EN', 'SIN_COMIDA', 'MOTIVO_COMIDA', 'SIN_CENA', 'MOTIVO_CENA', 'NOTA_SERVICIO', 'SIN_DORMIR', 'MOTIVO_DORMIR',
      'NOTA_POR', 'NOTA_EN', 'SERVICIO_POR', 'SERVICIO_EN', 'COMIDA_POR', 'COMIDA_EN', 'CENA_POR', 'CENA_EN', 'DORMIR_POR', 'DORMIR_EN']);
}

/* ---------- v4.58: ajustes del administrador ---------- */

/** La última vez que alguien abrió la web: como mucho una vez por hora y persona (con la caché), sin esperar si hay otro guardando. */
function registrarVisita_(cache, yo) {
  yo = String(yo || '').trim();
  if (!yo || cache.get('visto|' + yo)) return;
  cache.put('visto|' + yo, '1', 3600);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(HOJA_VISITAS) || crearHoja_(ss, HOJA_VISITAS, ['PERSONA_ID', 'ULTIMA_VEZ', 'VECES']);
    const n = Math.max(0, hoja.getLastRow() - 1);
    const filas = n ? hoja.getRange(2, 1, n, 3).getValues() : [];
    const i = filas.findIndex(function (f) { return String(f[0]).trim() === yo; });
    const fila = i === -1 ? hoja.getLastRow() + 1 : i + 2;
    const r = hoja.getRange(fila, 1, 1, 3);
    comoTexto_(r);
    r.setValues([[yo, ahora_(), String((i === -1 ? 0 : Number(filas[i][2]) || 0) + 1)]]);
  } finally { lock.releaseLock(); }
}
function esAdmin_(config, quien) { return !!quien && config.admins.indexOf(String(quien).trim()) !== -1; }
/** v4.91: Ajustes y Premios, solo para quien lleva la web y, si en MESA_CONFIG hay CLAVE_ADMIN, con esa clave (elegir el nombre no basta) */
function comprobarAdmin_(config, quien, claveAdmin, mensaje) {
  if (!esAdmin_(config, quien)) throw new Error(mensaje);
  const n = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  if (config.claveAdmin && n(claveAdmin) !== n(config.claveAdmin)) throw new Error('ADMIN: hace falta la clave de administrador.');
}
function ponerConfig_(ss, k, v) {
  const hoja = ss.getSheetByName(HOJA_CONFIG);
  const n = Math.max(0, hoja.getLastRow() - 1);
  const claves = n ? hoja.getRange(2, 1, n, 1).getValues().map(function (f) { return String(f[0]).trim(); }) : [];
  const i = claves.indexOf(k);
  const r = hoja.getRange(i === -1 ? hoja.getLastRow() + 1 : i + 2, 1, 1, 2);
  comoTexto_(r);
  r.setValues([[k, String(v)]]);
}

/** Para la pestaña Ajustes: la configuración, quién entra y el historial de cambios. Solo para los de ADMIN_IDS. */
function getAjustes(quien, claveAdmin) {
  reiniciar_();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = leerConfig_(ss);
  comprobarAdmin_(config, quien, claveAdmin, 'Los ajustes son solo para quien lleva la web.');
  const hc = ss.getSheetByName(HOJA_CAMBIOS);
  const nc = hc ? Math.max(0, hc.getLastRow() - 1) : 0;
  // v5.32: los últimos 1000 y, además, todo lo de los últimos 14 días (que las cuentas de la semana nunca se queden cortas)
  const desde = Math.max(0, nc - MAX_LEER_CONTROL), corte = sumarDias_(hoy_(), -DIAS_CONTROL);
  const texto = function (v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(v); };
  const todos = nc ? hc.getRange(2 + desde, 1, nc - desde, 4).getValues().map(function (f) {
    return { cuando: texto(f[0]), quien: String(f[1]), apodo: String(f[2]), cambio: String(f[3]) };
  }).reverse() : [];
  const cambios = todos.filter(function (x, i) { return i < MAX_CAMBIOS_CONTROL || x.cuando.slice(0, 10) >= corte; });
  const hv = ss.getSheetByName(HOJA_VISITAS);
  const nv = hv ? Math.max(0, hv.getLastRow() - 1) : 0;
  const visitas = nv ? hv.getRange(2, 1, nv, 3).getValues().filter(function (f) { return f[0]; }).map(function (f) {
    return { persona: String(f[0]).trim(), ultima: f[1] instanceof Date ? Utilities.formatDate(f[1], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[1]), veces: Number(f[2]) || 0 };
  }) : [];
  // v5.32 (T0591): los errores de uso, los últimos 200
  const he = ss.getSheetByName(HOJA_ERRORES);
  const ne = he ? Math.max(0, he.getLastRow() - 1) : 0;
  const de = Math.max(0, ne - MAX_LEER_CONTROL);
  const errores = ne ? he.getRange(2 + de, 1, ne - de, 5).getValues().map(function (f) {
    return { cuando: texto(f[0]), quien: String(f[1]), accion: String(f[2]), error: String(f[3]), detalle: String(f[4]) };
  }).reverse().filter(function (x, i) { return i < MAX_ERRORES || x.cuando.slice(0, 10) >= corte; }) : [];
  return {
    config: { clave: config.clave, pista: config.pista, horaComida: config.horaComida, horaCena: config.horaCena, horaDormir: config.horaDormir, avisoHoras: config.avisoHoras, inicio: config.inicio, noCuentan: config.noCuentan },
    cambios: cambios, visitas: visitas, errores: errores,
  };
}

function guardarAjustes(aj, quien, vista, claveAdmin) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    comprobarAdmin_(config, quien, claveAdmin, 'Los ajustes son solo para quien lleva la web.');
    const autor = autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien);
    aj = aj || {};
    const hora = function (v, que) { const t = String(v || '').trim(); if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('La hora de ' + que + ' tiene que ser como 14:00.'); return t.length === 4 ? '0' + t : t; };
    const registro = [];
    if (aj.clave !== undefined) {
      const c = limpiar_(aj.clave, 40, 'La clave', true);
      if (!c) throw new Error('La clave no puede quedar vacía (si no, cualquiera podría entrar).');
      if (c !== config.clave) { ponerConfig_(ss, 'CLAVE', c); registro.push('Cambia la clave de la familia'); }
    }
    if (aj.pista !== undefined) { const t = limpiar_(aj.pista, 100, 'La pista', true); if (t !== config.pista) { ponerConfig_(ss, 'PISTA', t); registro.push('Cambia la pista de la clave'); } }
    [['horaComida', 'HORA_COMIDA', 'la comida'], ['horaCena', 'HORA_CENA', 'la cena'], ['horaDormir', 'HORA_DORMIR', 'dormir']].forEach(function (x) {
      if (aj[x[0]] === undefined) return;
      const h = hora(aj[x[0]], x[2]);
      if (h !== config[x[0]]) { ponerConfig_(ss, x[1], h); registro.push('Hora de ' + x[2] + ': ' + h); }
    });
    if (aj.avisoHoras !== undefined) {
      const n = Math.floor(Number(aj.avisoHoras));
      if (!(n >= 0 && n <= 48)) throw new Error('El aviso tiene que ser de 0 a 48 horas antes.');
      if (n !== config.avisoHoras) { ponerConfig_(ss, 'AVISO_HORAS', n); registro.push('Aviso de «falta alguien»: ' + n + ' horas antes'); }
    }
    if (aj.inicio !== undefined) {
      if (!esFecha_(aj.inicio)) throw new Error('Elige el día en que empieza el calendario.');
      if (aj.inicio !== config.inicio) { ponerConfig_(ss, 'FECHA_INICIO', aj.inicio); registro.push('El calendario empieza el ' + aj.inicio); }
    }
    if (aj.noCuentan !== undefined) {  // v4.61
      if (!Array.isArray(aj.noCuentan)) throw new Error('La lista de quién no cuenta no se entiende.');
      const lista = aj.noCuentan.map(function (x) { return String(x).replace(/;/g, ' ').trim(); }).filter(Boolean);
      if (lista.join(';') !== config.noCuentan.join(';')) { ponerConfig_(ss, 'NO_CUENTAN', lista.join('; ')); registro.push('Quién no cuenta en «Quién la usa»: ' + (lista.length ? lista.length + ' personas' : 'nadie')); }
    }
    if (!registro.length) throw new Error('No has cambiado nada.');
    try { CacheService.getScriptCache().remove('clave_familia_v2'); } catch (e) { /* la clave nueva vale en 5 minutos */ }
    olvidar_('config');
    registrar_(ss, autor, registro);
    return datos_(ss, vista || {});
  });
}

/* ---------- v4.28: otras fechas de cada persona ---------- */
function leerFechas_(v) {
  return String(v || '').split(';').map(function (t) {
    const i = t.lastIndexOf(':');
    if (i < 1) return null;
    const que = t.slice(0, i).trim(), fecha = aFechaSinAno_(t.slice(i + 1).trim(), 1850);
    return que && fecha ? { que: que, fecha: fecha } : null;
  }).filter(Boolean);
}
function textoFechas_(lista) {
  if (!Array.isArray(lista)) throw new Error('Las fechas no se entienden. Recarga la página.');
  if (lista.length > MAX_FECHAS) throw new Error('Caben ' + MAX_FECHAS + ' fechas como mucho.');
  return lista.map(function (x) {
    const que = limpiar_(String((x && x.que) || '').replace(/[;:]/g, ' '), 40, 'Qué se recuerda', true);
    const t = String((x && x.fecha) || '').trim();
    const fecha = aFechaSinAno_(t, 1850);
    if (!que) throw new Error('A cada fecha ponle qué es (bautizo, primera comunión…).');
    if (!fecha) throw new Error('La fecha de «' + que + '» tiene que ser un día, mes y año que existan (o mes y año, o solo el año), y no de después de hoy.');
    return que + ': ' + fecha;
  }).join('; ');
}

/* ---------- v4.28: eventos ---------- */

function hojaEventos_(ss) {
  return ss.getSheetByName(HOJA_EVENTOS) || crearHoja_(ss, HOJA_EVENTOS, ['ID', 'NOMBRE', 'DESDE', 'HASTA', 'CUANDO', 'TEXTO', 'VAN', 'NO_VAN', 'CREADO_EN', 'BORRADO', 'LUGAR', 'HORA', 'TURNOS', 'DIAS', 'NOTAS']);
}
function listaIds_(t) { return String(t || '').split(';').map(function (x) { return x.trim(); }).filter(Boolean); }
function aFilaEvento_(f) { return f.map(function (c, i) { return (i === 2 || i === 3) ? (aFecha_(c) || String(c || '').trim()) : String(c == null ? '' : c).trim(); }); }
function leerEventos_(ss) {
  return memo_('eventos', function () {
    const hoja = ss.getSheetByName(HOJA_EVENTOS);
    if (!hoja) return [];
    const alias = resolverAlias_(ss);
    return abrirTabla_(hoja, COLS_EVENTOS, aFilaEvento_).vivas().filter(function (x) { return !x.v[9]; }).map(function (x) {
      const f = x.v;
      return { id: f[0], nombre: f[1], desde: f[2], hasta: f[3] || f[2], cuando: f[4] || 'DIA', texto: f[5],
        van: listaIds_(f[6]).map(alias), noVan: listaIds_(f[7]).map(alias), lugar: f[10], hora: f[11], turnos: leerTurnosEv_(f[12]), dias: leerDiasEv_(f[13], alias), notas: leerNotasEv_(f[14], alias) };
    }).sort(function (a, b) { return (a.desde + a.id).localeCompare(b.desde + b.id); });
  });
}
/* v4.33: en un evento de varios días, qué turnos de cada día se salta («2026-12-19 COMIDA CENA DORMIR; 2026-12-20 COMIDA») */
function leerTurnosEv_(v) {
  const t = String(v || '').trim();
  if (!t) return null;
  const r = {};
  t.split(';').forEach(function (x) {
    const p = x.trim().split(/\s+/);
    if (esFecha_(p[0])) r[p[0]] = p.slice(1).filter(function (k) { return TURNOS.indexOf(k) !== -1; });
  });
  return r;
}
function textoTurnosEv_(turnos, desde, hasta) {
  if (!turnos || typeof turnos !== 'object') return '';
  const dias = Object.keys(turnos).filter(function (f) { return esFecha_(f) && f >= desde && f <= hasta; }).sort();
  const partes = dias.map(function (f) { return [f].concat(TURNOS.filter(function (k) { return (turnos[f] || []).indexOf(k) !== -1; })); });
  if (!partes.some(function (p) { return p.length > 1; })) throw new Error('Marca al menos una comida, cena o noche del evento.');
  return partes.map(function (p) { return p.join(' '); }).join('; ');
}
/* v4.67: en un evento de varios días, quién va solo algunos («(N) - Marcos 2026-12-20; (N) - Ana 2026-12-19 2026-12-20»).
   Quien va y no sale aquí, va todos los días. */
function leerDiasEv_(v, alias) {
  const r = {};
  String(v || '').split(';').forEach(function (x) {
    const t = x.trim(), m = t.match(/^(.*?)\s+((?:\d{4}-\d{2}-\d{2}\s*)+)$/);
    if (!m) return;
    const dias = m[2].trim().split(/\s+/).filter(esFecha_);
    if (dias.length) r[alias ? alias(m[1].trim()) : m[1].trim()] = dias;
  });
  return r;
}
function textoDiasEv_(dias) {
  return Object.keys(dias).filter(function (id) { return dias[id] && dias[id].length; }).map(function (id) { return id + ' ' + dias[id].join(' '); }).join('; ');
}
function tituloEv_(ss, col, titulo) {
  const cab = hojaEventos_(ss).getRange(1, col);
  if (!String(cab.getValue()).trim() || /^Column \d+$/.test(String(cab.getValue()).trim())) cab.setValue(titulo);
}
/* v4.68: una nota de cada persona en el evento ({"(N) - Marcos": "Llego el domingo a las 11"}) */
function leerNotasEv_(v, alias) {
  let o = {};
  try { o = JSON.parse(String(v || '').trim() || '{}'); } catch (e) { o = {}; }
  const r = {};
  if (o && typeof o === 'object') Object.keys(o).forEach(function (id) { if (String(o[id] || '').trim()) r[alias ? alias(id) : id] = String(o[id]).trim(); });
  return r;
}
/** La nota de una persona en un evento (vacía, se quita) */
function notaEvento(id, personaId, nota, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const todos = leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir));
    const autor = autor_(todos, quien);
    soloLoSuyo_(autor, personaId);  // v4.86
    const p = todos.filter(function (t) { return t.id === personaId; })[0];
    if (!p) throw new Error('No encontramos ese nombre en la lista.');
    const texto = limpiar_(nota, MAX_NOTA, 'La nota', true);
    const tabla = abrirEventos_(ss);
    const x = filaEvento_(tabla, id);
    const notas = leerNotasEv_(x.v[14], resolverAlias_(ss));
    if ((notas[personaId] || '') === texto) return datos_(ss, vista || {});
    if (texto) notas[personaId] = texto; else delete notas[personaId];
    x.v[14] = Object.keys(notas).length ? JSON.stringify(notas) : ''; x.cambiada = true;
    tabla.guardar();
    tituloEv_(ss, 15, 'NOTAS');
    olvidar_('eventos');
    registrar_(ss, autor, ['Nota de ' + p.apodo + ' en ' + x.v[1] + ': ' + (texto || 'borrada')]);
    return datos_(ss, vista || {});
  });
}
function abrirEventos_(ss) { return abrirTabla_(hojaEventos_(ss), COLS_EVENTOS, aFilaEvento_); }
function filaEvento_(tabla, id) {
  const x = tabla.vivas().filter(function (r) { return r.v[0] === id && !r.v[9]; })[0];
  if (!x) throw new Error('Ese evento ya no está. Recarga la página.');
  return x;
}

function guardarEvento(ev, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const autor = autor_(personas.concat(leerEditores_(ss, config.excluir)), quien);
    sinServicio_(autor);  // v4.86
    ev = ev || {};
    const nombre = limpiar_(ev.nombre, MAX_EVENTO, 'El nombre del evento', true);
    if (!nombre) throw new Error('Pon el nombre del evento.');
    if (!esFecha_(ev.desde)) throw new Error('Elige el día en que empieza.');
    const hasta = esFecha_(ev.hasta) ? ev.hasta : ev.desde;
    const lugar = limpiar_(ev.lugar, 100, 'El sitio', true);
    const hora = limpiar_(ev.hora, 40, 'La hora', true);
    const turnos = hasta > ev.desde ? textoTurnosEv_(ev.turnos, ev.desde, hasta) : '';  // v4.33
    if (hasta < ev.desde) throw new Error('El último día no puede ser antes del primero.');
    if (diasEntre_(ev.desde, hasta) >= MAX_DIAS_EVENTO) throw new Error('Un evento dura un mes como mucho.');
    const cuando = CUANDO_EVENTO.indexOf(ev.cuando) !== -1 ? ev.cuando : 'DIA';
    const texto = limpiar_(ev.texto, MAX_EVENTO_TEXTO, 'La descripción del evento', true);
    const tabla = abrirEventos_(ss);
    let registro;
    if (ev.id) {
      const x = filaEvento_(tabla, ev.id);
      x.v[1] = nombre; x.v[2] = ev.desde; x.v[3] = hasta; x.v[4] = cuando; x.v[5] = texto; x.v[10] = lugar; x.v[11] = hora; x.v[12] = turnos; x.cambiada = true;
      registro = 'Cambia el evento ' + nombre + ' (' + ev.desde + (hasta !== ev.desde ? ' a ' + hasta : '') + ')';
    } else {
      let id;  // v5.11: que no se repita nunca (dos eventos en el mismo segundo)
      do { id = 'E' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmmss') + Math.floor(Math.random() * 90 + 10); } while (tabla.vivas().some(function (r) { return r.v[0] === id; }));
      tabla.nueva([id, nombre, ev.desde, hasta, cuando, texto, '', '', ahora_(), '', lugar, hora, turnos]);
      registro = 'Añade el evento ' + nombre + ' (' + ev.desde + (hasta !== ev.desde ? ' a ' + hasta : '') + ')';
    }
    tabla.guardar();
    olvidar_('eventos');
    registrar_(ss, autor, [registro]);
    return datos_(ss, vista || {});
  });
}

function borrarEvento(id, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const autor = autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien);
    sinServicio_(autor);  // v4.86
    const tabla = abrirEventos_(ss);
    const x = filaEvento_(tabla, id);
    x.v[9] = ahora_(); x.cambiada = true;
    tabla.guardar();
    olvidar_('eventos');
    registrar_(ss, autor, ['Quita el evento ' + x.v[1]]);
    return datos_(ss, vista || {});
  });
}

/** va: true (va), false (no va) o null (sin decir); dias (v4.67, si va): los días que va de un evento de varios días (nada = todos) */
function apuntarEvento(id, personaId, va, quien, vista, dias) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const todos = leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir));
    const autor = autor_(todos, quien);
    soloLoSuyo_(autor, personaId);  // v4.86
    const p = todos.filter(function (t) { return t.id === personaId; })[0];
    if (!p) throw new Error('No encontramos ese nombre en la lista.');
    const tabla = abrirEventos_(ss);
    const x = filaEvento_(tabla, id);
    const alias = resolverAlias_(ss);
    const van = listaIds_(x.v[6]).map(alias).filter(function (i) { return i !== personaId; });
    const noVan = listaIds_(x.v[7]).map(alias).filter(function (i) { return i !== personaId; });
    if (va === true) van.push(personaId); else if (va === false) noVan.push(personaId);
    // v4.67: los días sueltos (solo si va, el evento es de varios días y no son todos)
    const desde = x.v[2], hasta = x.v[3] || x.v[2];
    const todosDias = [];
    for (let f = desde; esFecha_(f) && f <= hasta && todosDias.length <= MAX_DIAS_EVENTO; f = sumarDias_(f, 1)) todosDias.push(f);
    const suyos = va === true && Array.isArray(dias) ? todosDias.filter(function (f) { return dias.indexOf(f) !== -1; }) : [];
    if (va === true && Array.isArray(dias) && !suyos.length) throw new Error('Marca al menos un día (o, si no va ninguno, «no va»).');
    const porDias = leerDiasEv_(x.v[13], alias);
    delete porDias[personaId];
    if (suyos.length && suyos.length < todosDias.length) porDias[personaId] = suyos;
    x.v[6] = van.join('; '); x.v[7] = noVan.join('; '); x.v[13] = textoDiasEv_(porDias); x.cambiada = true;
    tabla.guardar();
    tituloEv_(ss, 14, 'DIAS');  // v4.67: el título de la columna nueva
    olvidar_('eventos');
    const soloDias = porDias[personaId] ? ' (solo ' + porDias[personaId].map(ddmm_).join(', ') + ')' : '';
    registrar_(ss, autor, [p.apodo + (va === true ? ' va a ' : va === false ? ' no va a ' : ' sin decir si va a ') + x.v[1] + soloDias]);
    return datos_(ss, vista || {});
  });
}

function crearHoja_(ss, nombre, cabecera) {
  const hoja = ss.insertSheet(nombre);
  hoja.getRange(1, 1, 1, cabecera.length).setValues([cabecera]);
  hoja.setFrozenRows(1);
  return hoja;
}

/** Texto corto y seguro para el Excel. En celdas de texto no hace falta el apóstrofo. */
function limpiar_(v, max, que, esCeldaTexto) {
  let texto = String(v || '').replace(/\s+/g, ' ').trim();
  if (texto.length > max) throw new Error(que + ' caben en ' + max + ' letras como mucho.');
  if (!esCeldaTexto && /^[=+\-@]/.test(texto)) texto = "'" + texto;
  return texto;
}

/** Cumpleaños como texto dd/mm (acepta fechas del Excel y «5/3»). Vacío si no es válido. */
/** Cumpleaños: dd/mm o, con el año (v4.13), dd/mm/aaaa. Una fecha escrita a mano en el Excel se queda sin año (el Excel le pone el de hoy). */
function aCumple_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM');
  const t = String(v || '').trim();
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return aFechaParcial_(t, 1900, 1);  // con el año (v4.13), o solo mes y año, o solo el año (v4.16); v4.24: o la fecha prevista de un bebé en camino
  const d = Number(m[1]), mes = Number(m[2]);
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (!max || d < 1 || d > max) return '';
  return ('0' + d).slice(-2) + '/' + ('0' + mes).slice(-2);
}

/**
 * v4.16: una fecha como se sepa: dd/mm/aaaa, mm/aaaa o aaaa. Se guarda siempre dd/mm/aaaa, con 00 en lo que no se sabe
 * («00/01/2008» es enero de 2008; «00/00/1928», 1928). Entre el año «desde» y hoy. Una celda de fecha del Excel, entera.
 */
/* v4.20: el fallecimiento, con su fecha (como se sepa) o «Sí» si no se sabe cuándo */
function aFallecio_(v) {
  return /^s[ií]$/i.test(String(v || '').trim()) ? 'Sí' : aFechaParcial_(v, 1850);
}

/* v4.30: como aFechaParcial_, pero también día y mes sin año («04/10»): bodas, noviazgos y otras fechas (los santos) */
function aFechaSinAno_(v, desde, futuro) {
  const m = String(v || '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return aFechaParcial_(v, desde, futuro);
  const d = Number(m[1]), mes = Number(m[2]);
  if (mes < 1 || mes > 12 || d < 1 || d > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]) return '';
  return ('0' + d).slice(-2) + '/' + ('0' + mes).slice(-2);
}

function aFechaParcial_(v, desde, futuro) {  // v4.23: futuro = años que puede ir por delante de hoy (la boda)
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
  const t = String(v || '').trim();
  let m, d = 0, mes = 0, ano = 0;
  if ((m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) { d = Number(m[1]); mes = Number(m[2]); ano = Number(m[3]); }
  else if ((m = t.match(/^(\d{1,2})[\/\-.](\d{4})$/))) { mes = Number(m[1]); ano = Number(m[2]); }
  else if ((m = t.match(/^(\d{4})$/))) { ano = Number(m[1]); }
  else return '';
  if (ano < (desde || 1850) || ano > Number(hoy_().slice(0, 4)) + (futuro || 0) || mes > 12 || (!mes && d)) return '';
  if (d && d > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]) return '';
  return ('0' + d).slice(-2) + '/' + ('0' + mes).slice(-2) + '/' + ano;
}

function aFecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function aHora_(v, porDefecto) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : porDefecto;
}

function nombreTurno_(t) { return { CENA: 'cena', DORMIR: 'noche', MANANA: 'mañana', TARDE: 'tarde' }[t] || 'comida'; }
function texto_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(v || ''); }
function esSi_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function esFecha_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function ahora_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

function aUTC_(iso) { const p = iso.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function sumarDias_(iso, n) { return new Date(aUTC_(iso) + n * 86400000).toISOString().slice(0, 10); }
function diasEntre_(a, b) { return Math.round((aUTC_(b) - aUTC_(a)) / 86400000); }
function diaSemana_(iso) { return new Date(aUTC_(iso)).getUTCDay(); }
function lunesDe_(iso) { const dow = diaSemana_(iso) || 7; return sumarDias_(iso, 1 - dow); }
function ddmm_(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }


/* ---------- v5.37 (T0623): avisos al móvil de la abuela (Firebase Cloud Messaging) ----------
 * MESA_AVISOS  TOKEN | PERSONA_ID | CREADO_EN | ULTIMO_ENVIO | ULTIMO_ERROR (se crea sola): los móviles con los avisos activados.
 * Solo los puede activar la abuela (EXCLUIR_IDS); si va bien, se abrirá al resto en otra tarea.
 * Cada 5 minutos (disparador de revisarAvisos), se compara quién viene hoy y mañana con la vez anterior (la «foto»,
 * en las propiedades del script) y, si algo ha cambiado, sale un solo aviso con todo. De AVISOS_CALLA a AVISOS_HABLA
 * (MESA_CONFIG; por defecto, de 22 a 8) no se manda nada y la foto no se toca: lo de la noche llega por la mañana.
 * La cuenta de servicio de Firebase, en la propiedad del script FCM_CUENTA (el JSON entero), nunca en el código.
 */
const HOJA_AVISOS = 'MESA_AVISOS';
const MAX_TOKEN = 4096, MAX_MOVILES = 10;
const WEB_AVISOS = 'https://utilo-digital.github.io/casa-abuela/';
const FRASE_TURNO_ = { MANANA: 'por la mañana', COMIDA: 'a comer', TARDE: 'por la tarde', CENA: 'a cenar', DORMIR: 'a dormir' };

function hojaAvisos_(ss) { return ss.getSheetByName(HOJA_AVISOS) || crearHoja_(ss, HOJA_AVISOS, ['TOKEN', 'PERSONA_ID', 'CREADO_EN', 'ULTIMO_ENVIO', 'ULTIMO_ERROR']); }
function leerAvisos_(ss) {
  const h = ss.getSheetByName(HOJA_AVISOS);
  if (!h || h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, 5).getValues()
    .map(function (f, i) { return { fila: i + 2, token: String(f[0] || ''), persona: String(f[1] || '') }; })
    .filter(function (a) { return a.token; });
}
function puedeAvisos_(ss, quien) {
  const config = leerConfig_(ss);
  return !!quien && config.excluir.indexOf(String(quien).trim()) !== -1 && leerEditores_(ss, config.excluir).some(function (p) { return p.id === quien && !p.fallecio; });
}

/** La web, al pulsar «Activar avisos» (y cada vez que la abre la abuela, por si el móvil cambia el token). → true */
function activarAvisos(token, quien) {
  token = String(token || '').trim();
  if (!token || token.length > MAX_TOKEN || /\s/.test(token)) throw new Error('Este móvil no ha dado un código de avisos válido.');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!puedeAvisos_(ss, quien)) throw new Error('Los avisos al móvil, de momento, solo son para la abuela.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hay otra persona guardando. Prueba otra vez.');
  try {
    const hoja = hojaAvisos_(ss);
    const lista = leerAvisos_(ss);
    if (lista.some(function (a) { return a.token === token; })) return true;
    if (lista.length >= MAX_MOVILES) throw new Error('Ya hay ' + MAX_MOVILES + ' móviles con los avisos activados.');
    const rango = hoja.getRange(hoja.getLastRow() + 1, 1, 1, 5);
    comoTexto_(rango);
    rango.setValues([[token, String(quien), ahora_(), '', '']]);
    if (!lista.length) guardarFoto_(fotoAvisos_(ss));  // el primer móvil: se empieza de lo que hay ahora, sin avisar de lo de antes
    try { asegurarDisparador_(); } catch (e) { filaError_(quien, 'avisos', 'No se pudo crear el disparador: ' + ((e && e.message) || e), ''); }
    registrar_(ss, autor_(leerEditores_(ss, leerConfig_(ss).excluir), quien), ['Activa los avisos en el móvil']);
  } finally { lock.releaseLock(); }
  return true;
}

/** La web, al quitarlos (o si el móvil ya no deja). → true */
function quitarAvisos(token, quien) {
  token = String(token || '').trim();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const a = leerAvisos_(ss).filter(function (x) { return x.token === token; })[0];
  if (a) {
    hojaAvisos_(ss).deleteRow(a.fila);
    const config = leerConfig_(ss);
    try { registrar_(ss, autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien || a.persona), ['Quita los avisos del móvil']); } catch (e) { /* quien ya no está: se quita igual */ }
  }
  return true;
}

/** Una vez, desde el editor (Ejecutar › instalarAvisos): da los permisos nuevos y crea el disparador de cada 5 minutos. */
function instalarAvisos() { asegurarDisparador_(); return 'Listo: los avisos se revisan cada 5 minutos.'; }
function asegurarDisparador_() {
  const hay = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'revisarAvisos'; });
  if (!hay) ScriptApp.newTrigger('revisarAvisos').timeBased().everyMinutes(5).create();
}

/** Quién viene hoy y mañana: { 'aaaa-mm-dd': { TURNO: { id: acompañantes } } } */
function fotoAvisos_(ss) {
  const hoy = hoy_(), manana = sumarDias_(hoy, 1);
  const foto = {};
  foto[hoy] = {}; foto[manana] = {};
  efectivos_(leerApuntesTodos_(ss), leerFijosTodos_(ss), hoy, manana, TODOS_TURNOS).forEach(function (a) {
    (foto[a.fecha][a.turno] = foto[a.fecha][a.turno] || {})[a.persona] = a.acompanantes || 0;
  });
  return foto;
}
function guardarFoto_(foto) { PropertiesService.getScriptProperties().setProperty('avisos_foto', JSON.stringify(foto)); }

/** Lo que ha cambiado entre dos fotos, solo en los días que están en las dos. → [{ fecha, turno, id, que: 'viene'|'no'|'mas', mas }] */
function cambiosAvisos_(antes, ahora) {
  const out = [];
  Object.keys(ahora).sort().forEach(function (fecha) {
    if (!antes[fecha]) return;
    TODOS_TURNOS.forEach(function (t) {
      const a = antes[fecha][t] || {}, b = ahora[fecha][t] || {};
      Object.keys(b).forEach(function (id) {
        if (!(id in a)) out.push({ fecha: fecha, turno: t, id: id, que: 'viene', mas: b[id] });
        else if (a[id] !== b[id]) out.push({ fecha: fecha, turno: t, id: id, que: 'mas', mas: b[id] });
      });
      Object.keys(a).forEach(function (id) { if (!(id in b)) out.push({ fecha: fecha, turno: t, id: id, que: 'no', mas: 0 }); });
    });
  });
  return out;
}

/** El texto del aviso, en palabras para la abuela: «Hoy: Marta y Pablo vienen a comer. Jan ya no viene a cenar.» */
function textoAvisos_(cambios, ahora, hoy, gente) {
  const nombre = function (id) { return (gente[id] && gente[id].apodo) || String(id).replace(/^\([^)]*\) - /, ''); };
  const y = function (l) { return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1]; };
  const conMas = function (c) { return nombre(c.id) + (c.mas ? ' (con ' + c.mas + (c.mas === 1 ? ' más)' : ' más)') : ''); };
  const lineas = [];
  [hoy, sumarDias_(hoy, 1)].forEach(function (fecha) {
    const frases = [];
    TODOS_TURNOS.forEach(function (t) {
      const de = cambios.filter(function (c) { return c.fecha === fecha && c.turno === t; });
      if (!de.length) return;
      const vienen = de.filter(function (c) { return c.que === 'viene'; }), noVienen = de.filter(function (c) { return c.que === 'no'; }), mas = de.filter(function (c) { return c.que === 'mas'; });
      if (vienen.length) frases.push(y(vienen.map(conMas)) + (vienen.length > 1 ? ' vienen ' : ' viene ') + FRASE_TURNO_[t] + '.');
      mas.forEach(function (c) { frases.push(nombre(c.id) + ' viene ' + FRASE_TURNO_[t] + (c.mas ? ' con ' + c.mas + ' más.' : ' sin nadie más.')); });
      if (noVienen.length) frases.push(y(noVienen.map(function (c) { return nombre(c.id); })) + (noVienen.length > 1 ? ' ya no vienen ' : ' ya no viene ') + FRASE_TURNO_[t] + '.');
      // si se queda sin nadie (en comida y cena, el servicio no cuenta como compañía)
      const quedan = Object.keys((ahora[fecha] || {})[t] || {}).filter(function (id) { return t === 'DORMIR' || t === 'MANANA' || t === 'TARDE' || !(gente[id] && gente[id].familia === 'Servicio'); });
      if (noVienen.length && !quedan.length && (t === 'COMIDA' || t === 'CENA' || t === 'DORMIR')) frases.push('No queda nadie para ' + { COMIDA: 'comer', CENA: 'cenar', DORMIR: 'dormir' }[t] + '.');
    });
    if (frases.length) lineas.push((fecha === hoy ? 'Hoy: ' : 'Mañana: ') + frases.join(' '));
  });
  return lineas.join('\n');
}

function callado_(config, hora) {
  const de = Number(config.avisosCalla), a = Number(config.avisosHabla);
  return de > a ? (hora >= de || hora < a) : (hora >= de && hora < a);
}

/** El disparador, cada 5 minutos. → lo que ha hecho, en una línea (para el editor y las pruebas) */
function revisarAvisos() {
  reiniciar_();
  // v5.38: sin el bloqueo de los guardados (LockService), que es de todo el script: con él, quien guardaba justo entonces
  // veía «hay otra persona guardando». Solo se evita que dos revisiones vayan a la vez, con una marca de 4 minutos.
  const cache = CacheService.getScriptCache();
  if (cache.get('avisos_revisando')) return 'Ocupado';
  try { cache.put('avisos_revisando', '1', 240); } catch (e) { /* sin caché, sigue */ }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const moviles = leerAvisos_(ss);
    if (!moviles.length) return 'Sin móviles';
    const config = leerConfig_(ss);
    if (callado_(config, Number(Utilities.formatDate(new Date(), TZ, 'H')))) return 'Callado';
    const props = PropertiesService.getScriptProperties();
    let antes = null;
    try { antes = JSON.parse(props.getProperty('avisos_foto') || 'null'); } catch (e) { antes = null; }
    const ahora = fotoAvisos_(ss);
    guardarFoto_(ahora);
    if (!antes) return 'Primera foto';
    const cambios = cambiosAvisos_(antes, ahora);
    if (!cambios.length) return 'Sin cambios';
    const gente = {};
    leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir), leerBajas_(ss)).forEach(function (p) { gente[p.id] = p; });
    const texto = textoAvisos_(cambios, ahora, hoy_(), gente);
    if (!texto) return 'Sin cambios';
    const hoja = hojaAvisos_(ss);
    let mandados = 0;
    moviles.slice().reverse().forEach(function (m) {  // de abajo arriba, para poder borrar filas sin descolocar las demás
      const r = mandarAviso_(m.token, 'Casa Abuela', texto, WEB_AVISOS);
      if (r.ok) { mandados++; hoja.getRange(m.fila, 4, 1, 2).setValues([[ahora_(), '']]); }
      else if (r.borrar) { hoja.deleteRow(m.fila); filaError_(m.persona, 'avisos', 'Ese móvil ya no recibe avisos; se quita de la lista.', ''); }
      else { hoja.getRange(m.fila, 5).setValue(String(r.error).slice(0, 300)); filaError_(m.persona, 'avisos', String(r.error).slice(0, 300), texto.slice(0, 200)); }
    });
    return 'Avisos: ' + mandados + ' · ' + texto;
  } finally { try { cache.remove('avisos_revisando'); } catch (e) { /* caduca sola */ } }
}

/** v5.38: desde el editor (Ejecutar › probarAvisos): un aviso de prueba a todos los móviles de MESA_AVISOS.
 * La primera vez, Google pide el permiso de conectarse a un servicio externo (sin él, no sale ningún aviso). → qué ha pasado */
function probarAvisos() {
  // v5.39: si el permiso se quedó sin marcar, Google no lo vuelve a pedir solo; esto enseña otra vez la ventana con lo que falte
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.scriptapp', 'https://www.googleapis.com/auth/spreadsheets']);
  const salida = probarAvisos_();
  console.log(salida);  // el editor no enseña lo que devuelve una función: así sale en el registro
  return salida;
}
function probarAvisos_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const moviles = leerAvisos_(ss);
  if (!moviles.length) return 'No hay ningún móvil con los avisos activados.';
  const hoja = hojaAvisos_(ss);
  const out = [];
  moviles.slice().reverse().forEach(function (m) {
    const r = mandarAviso_(m.token, 'Casa Abuela', 'Prueba: si ves esto, los avisos de Casa Abuela funcionan.', WEB_AVISOS);
    if (r.ok) hoja.getRange(m.fila, 4, 1, 2).setValues([[ahora_(), '']]);
    else if (!r.borrar) hoja.getRange(m.fila, 5).setValue(String(r.error).slice(0, 300));
    out.push(m.persona + ': ' + (r.ok ? 'mandado' : r.borrar ? 'ese móvil ya no los recibe' : r.error));
  });
  return out.join('\n');
}

/** Un aviso a un móvil por FCM HTTP v1. → { ok } | { ok: false, borrar?, error } */
function mandarAviso_(token, titulo, texto, enlace) {
  let cuenta;
  try { cuenta = JSON.parse(PropertiesService.getScriptProperties().getProperty('FCM_CUENTA') || 'null'); } catch (e) { cuenta = null; }
  if (!cuenta || !cuenta.project_id || !cuenta.client_email || !cuenta.private_key) return { ok: false, error: 'Falta la cuenta de Firebase (FCM_CUENTA en las propiedades del script).' };
  const sinPermiso = function (e) {
    const t = String((e && e.message) || e);
    return /UrlFetchApp|external_request/.test(t) ? 'Falta el permiso de conectarse a un servicio externo: en el editor, ejecuta probarAvisos y acéptalo.' : t;
  };
  let acceso;
  try { acceso = accesoFcm_(cuenta); } catch (e) { return { ok: false, error: 'Firebase no deja entrar: ' + sinPermiso(e) }; }
  let r;
  try { r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(cuenta.project_id) + '/messages:send', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + acceso },
    payload: JSON.stringify({ message: { token: token,
      data: { titulo: titulo, texto: texto, enlace: enlace },
      webpush: { headers: { Urgency: 'high', TTL: '43200' } } } }),
  }); } catch (e) { return { ok: false, error: 'No se pudo hablar con Firebase: ' + sinPermiso(e) }; }
  const codigo = r.getResponseCode();
  if (codigo === 200) return { ok: true };
  const cuerpo = String(r.getContentText() || '');
  if (codigo === 404 || /UNREGISTERED/.test(cuerpo)) return { ok: false, borrar: true, error: cuerpo };
  return { ok: false, error: 'Firebase dice ' + codigo + ': ' + cuerpo.slice(0, 200) };
}

/** El permiso de una hora para hablar con FCM, con la cuenta de servicio (JWT firmado con RS256). Se guarda 50 minutos. */
function accesoFcm_(cuenta) {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('fcm_acceso');
  if (guardado) return guardado;
  const b64 = function (x) { return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); };
  const ahora = Math.floor(Date.now() / 1000);
  const cabeza = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: cuenta.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }));
  const firma = b64(Utilities.computeRsaSha256Signature(cabeza, cuenta.private_key));
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cabeza + '.' + firma } });
  const j = JSON.parse(r.getContentText() || '{}');
  if (!j.access_token) throw new Error(j.error_description || j.error || ('código ' + r.getResponseCode()));
  try { cache.put('fcm_acceso', j.access_token, 3000); } catch (e) { /* sin caché, se pide cada vez */ }
  return j.access_token;
}
