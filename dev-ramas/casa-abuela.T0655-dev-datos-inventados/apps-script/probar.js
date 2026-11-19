// Prueba de Apps Script con un Google falso (T0479): node apps-script/probar.js apps-script/Código.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const { hoja, contexto, ejecutar } = require(path.join(__dirname, '..', 'dev', 'google-falso.js'));  // T0655: el mismo que usa la web en DEV
const codigo = fs.readFileSync(process.argv[2], 'utf8');
const HOY = '2026-11-13';
const hojas = {
  PERSONAS: hoja('PERSONAS', [['Id', 'Apodo', 'Jerarquia', 'Familia', 'Cama', 'Menu', 'Alergias', 'Cumple'],
    ['(A) - Abuela', 'Abuela', 'Abuelos', 'Abuelos', '', '🌕 Entero', '', ''],
    ['(T) - Mercedes', 'Mercedes', 'Tios', 'Canela', '', '🌕 Entero', '', '01/02'],
    ['(N) - Jan', 'Jan', 'Nietos', 'Canela', '', '🌕 Entero', '', ''],
    ['(O) - Amiga', 'Amiga', 'Otros', 'Otros', '', '🌕 Entero', '', '']]),
  MESA_APUNTES: hoja('MESA_APUNTES', [['ID_APUNTE', 'FECHA', 'TURNO', 'PERSONA_ID', 'CREADO_EN', 'NOTA', 'ESTADO', 'NOTA_POR', 'NOTA_EN'],
    ['a1', '2026-11-10', 'COMIDA', '(N) - Jan', '', '', '', '', ''],
    ['a2', '2026-11-13', 'CENA', '(N) - Jan', '', '', '', '', ''],
    ['a3', '2026-11-20', 'COMIDA', '(N) - Jan', '', '', '', '', ''],
    ['a4', '2026-11-20', 'COMIDA', '(T) - Mercedes', '', '', '', '', '']]),
  MESA_FIJOS: hoja('MESA_FIJOS', [['ID_FIJO', 'PERSONA_ID', 'DIA_SEMANA', 'TURNO', 'DESDE', 'HASTA', 'NOTA', 'CREADO_POR', 'CREADO_EN'],
    ['f1', '(N) - Jan', 2, 'COMIDA', '2026-10-01', '', '', '', ''],
    ['f2', '(N) - Jan', 4, 'CENA', '2026-11-20', '', '', '', '']]),
  MESA_CONFIG: hoja('MESA_CONFIG', [['CLAVE', 'VALOR'], ['FECHA_INICIO', '2026-10-01'], ['EXCLUIR_IDS', '(A) - Abuela']]),
  MESA_DIAS: hoja('MESA_DIAS', [['FECHA']]), MESA_CAMBIOS: hoja('MESA_CAMBIOS', [['CUANDO', 'QUIEN_ID', 'QUIEN', 'CAMBIO']]), MESA_ALIAS: hoja('MESA_ALIAS', [['ID_ANTIGUO', 'ID_NUEVO', 'NOTA']]),
};
// La columna A de PERSONAS es una fórmula: «(» + inicial de la jerarquía + «+1» si la lleva + «) - » + apodo
hojas.PERSONAS.formula = () => hojas.PERSONAS.filas.slice(1).forEach(f => { if (f[1]) f[0] = '(' + String(f[2]).charAt(0) + (String(f[2]).indexOf('+1') !== -1 ? '+1' : '') + ') - ' + f[1]; });
hojas.PERSONAS.filas.push(['(T+1) - Jordi', 'Jordi', 'Tios +1', 'Canela', '', '🌕 Entero', '', '']);
const pad = n => String(n).padStart(2, '0');
// La fecha, siempre la de HOY (las pruebas no dependen del día en que se pasan)
const ctx = contexto({ hojas, uuid: () => 'u' + Math.random().toString(36).slice(2, 8), formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? HOY : HOY + 'T10:00:00' });
const ss = ctx.ss;
ctx.__ = ejecutar(codigo, ctx, ' darDeBaja, crearPersona, getDatos, guardarPersona, guardarEvento, borrarEvento, apuntarEvento, notaEvento, misNumeros, getPremios, guardarPersonas, getAjustes, guardarAjustes, api_, activarAvisos, quitarAvisos, revisarAvisos, probarAvisos, cambiosAvisos_, textoAvisos_ '.split(', '));
const R = ctx.__;
const ver = (t, ok) => { console.log((ok ? '✔ ' : '✘ ') + t); if (!ok) process.exitCode = 1; };
const V = { desde: '2026-11-09', hasta: '2026-11-22', yo: '(T) - Mercedes' };
let d = R.getDatos(V);
ver('antes: Jan sale en personas', d.personas.some(p => p.id === '(N) - Jan'));
d = R.darDeBaja('(N) - Jan', '(T) - Mercedes', V);
ver('Jan ya no sale en personas', !d.personas.some(p => p.id === '(N) - Jan'));
ver('Jan sale en bajas con fecha de hoy', d.bajas.length === 1 && d.bajas[0].id === '(N) - Jan' && d.bajas[0].baja === HOY);
ver('su comida pasada (10/11) se queda', d.apuntes.some(a => a.persona === '(N) - Jan' && a.fecha === '2026-11-10'));
ver('su cena de hoy y su comida del 20/11 se quitan', !d.apuntes.some(a => a.persona === '(N) - Jan' && a.fecha >= HOY));
ver('la comida de Mercedes del 20/11 sigue', d.apuntes.some(a => a.persona === '(T) - Mercedes' && a.fecha === '2026-11-20'));
const fj = hojas.MESA_FIJOS.filas.slice(1).filter(f => f[0]);
ver('el fijo de los martes termina ayer y el que no había empezado se borra', fj.length === 1 && fj[0][0] === 'f1' && fj[0][5] === '2026-11-12');
ver('no sale como huérfano', !d.huerfanos.includes('(N) - Jan'));
ver('columna I con título Baja', hojas.PERSONAS.filas[0][8] === 'Baja' && hojas.PERSONAS.filas[3][8] === HOY);
ver('queda en el registro de cambios', /Quita de la lista a Jan/.test(hojas.MESA_CAMBIOS.filas.slice(-1)[0][3]));
let err = ''; try { R.darDeBaja('(N) - Jan', '(T) - Mercedes', V); } catch (e) { err = e.message; }
ver('dos veces: «No encontramos…»', /No encontramos/.test(err));
err = ''; try { R.darDeBaja('(T) - Mercedes', '', V); } catch (e) { err = e.message; }
ver('sin decir quién eres: pide elegir', /Elige primero/.test(err));
err = ''; try { R.darDeBaja('(A) - Abuela', '(T) - Mercedes', V); } catch (e) { err = e.message; }
ver('a la abuela no se la puede quitar', /No encontramos/.test(err));
const filas = hojas.PERSONAS.filas.length;
d = R.crearPersona({ apodo: 'Jan', jerarquia: 'Nietos', familia: 'Canela', menu: '🌕 Entero', alergias: 'Nueces', cumple: '05/06' }, '(T) - Mercedes', V);
ver('volver a añadir a Jan recupera su fila', hojas.PERSONAS.filas.length === filas && d.personas.some(p => p.id === '(N) - Jan' && p.alergias === 'Nueces' && p.cumple === '05/06') && !d.bajas.length && d.creado === '(N) - Jan');
ver('su comida pasada sigue siendo suya', d.apuntes.some(a => a.persona === '(N) - Jan' && a.fecha === '2026-11-10'));

// ---------- v4.10: núcleos familiares ----------
const M_ = '(T) - Mercedes', J_ = '(T+1) - Jordi', N_ = '(N) - Jan';
const quien = id => d.personas.concat(d.editores).find(p => p.id === id) || {};
const col = (id, c) => (hojas.PERSONAS.filas.find(f => f[0] === id) || [])[c - 1];
d = R.guardarPersona(M_, { apellido: 'Canela', sexo: 'Mujer', pareja: J_ }, M_, V);
ver('apellido y mujer de Mercedes', quien(M_).apellido === 'Canela' && quien(M_).sexo === 'Mujer');
ver('pareja en los dos sentidos', quien(M_).pareja === J_ && quien(J_).pareja === M_);
ver('títulos J-M', ['Apellido', 'Sexo', 'Pareja', 'Hijo de'].every((t, i) => hojas.PERSONAS.filas[0][9 + i] === t));
d = R.guardarPersona(N_, { hijoDe: M_ }, M_, V);
ver('Jan es hijo de Mercedes', quien(N_).hijoDe === M_);
err = ''; try { R.guardarPersona(M_, { hijoDe: N_ }, M_, V); } catch (e) { err = e.message; }
ver('Mercedes no puede ser hija de Jan (círculo)', /ya desciende/.test(err));
err = ''; try { R.guardarPersona(M_, { pareja: M_ }, M_, V); } catch (e) { err = e.message; }
ver('nadie es su propia pareja', /propia pareja/.test(err));
err = ''; try { R.guardarPersona(M_, { sexo: 'Otro' }, M_, V); } catch (e) { err = e.message; }
ver('sexo solo Hombre o Mujer', /hombre o mujer/.test(err));
d = R.guardarPersona('(O) - Amiga', { pareja: J_ }, M_, V);
ver('si Jordi pasa a tener otra pareja, Mercedes se queda sin', quien(J_).pareja === '(O) - Amiga' && !quien(M_).pareja && quien('(O) - Amiga').pareja === J_);
d = R.guardarPersona(J_, { pareja: M_ }, M_, V);
ver('y al volver, la Amiga se queda sin pareja', quien(J_).pareja === M_ && quien(M_).pareja === J_ && !quien('(O) - Amiga').pareja);
d = R.guardarPersona('(A) - Abuela', { apellido: 'Canela' }, M_, V);
ver('la abuela también puede tener apellido', quien('(A) - Abuela').apellido === 'Canela');
d = R.guardarPersona(M_, { hijoDe: '(A) - Abuela' }, M_, V);
ver('Mercedes, hija de la abuela', quien(M_).hijoDe === '(A) - Abuela');
d = R.crearPersona({ apodo: 'Laura', jerarquia: 'Nietos', familia: 'Canela', apellido: 'López', sexo: 'Mujer', pareja: N_ }, M_, V);
ver('persona nueva con apellido y pareja', quien('(N) - Laura').apellido === 'López' && quien('(N) - Laura').pareja === N_ && quien(N_).pareja === '(N) - Laura');
d = R.guardarPersona(J_, { apodo: 'Jordi P' }, M_, V);
ver('si Jordi cambia de nombre, su pareja y sus referencias le siguen', quien(M_).pareja === '(T+1) - Jordi P' && quien('(T+1) - Jordi P').pareja === M_);
ver('queda en el registro', hojas.MESA_CAMBIOS.filas.some(f => /son pareja/.test(f[3])) && hojas.MESA_CAMBIOS.filas.some(f => /es hijo o hija de/.test(f[3])));

// ---------- v4.11: nombre y apodo único ----------
d = R.guardarPersona(M_, { nombre: 'Mercedes', apellido: 'Ribas' }, M_, V);
ver('nombre de verdad y título N', quien(M_).nombre === 'Mercedes' && hojas.PERSONAS.filas[0][13] === 'Nombre');
err = ''; try { R.crearPersona({ apodo: 'mercedes', jerarquia: 'Nietos', familia: 'Canela' }, M_, V); } catch (e) { err = e.message; }
ver('no se puede añadir otro apodo «mercedes» (aunque sea otra jerarquía y en minúsculas)', /no se puede repetir/.test(err));
err = ''; try { R.crearPersona({ apodo: 'Jordí P', jerarquia: 'Nietos', familia: 'Canela' }, M_, V); } catch (e) { err = e.message; }
ver('ni «Jordí P» con acento si ya está «Jordi P»', /no se puede repetir/.test(err));
err = ''; try { R.guardarPersona('(O) - Amiga', { apodo: 'Jan' }, M_, V); } catch (e) { err = e.message; }
ver('ni cambiar un apodo a uno que ya existe', /no se puede repetir/.test(err));
d = R.guardarPersona('(O) - Amiga', { apodo: 'Amiga M' }, M_, V);
ver('cambiar a un apodo libre, sí', !!d.personas.find(p => p.id === '(O) - Amiga M'));
d = R.darDeBaja('(O) - Amiga M', M_, V);
err = ''; try { R.crearPersona({ apodo: 'Amiga M', jerarquia: 'Nietos', familia: 'Canela' }, M_, V); } catch (e) { err = e.message; }
ver('el apodo de alguien de baja tampoco se reutiliza con otro parentesco', /no se puede repetir/.test(err));
d = R.crearPersona({ apodo: 'Amiga M', jerarquia: 'Otros', familia: 'Otros', nombre: 'Ana' }, M_, V);
ver('pero se recupera con el mismo parentesco, con su nombre', !!d.personas.find(p => p.id === '(O) - Amiga M' && p.nombre === 'Ana'));

// ---------- v4.12: casados ----------
d = R.guardarPersona(M_, { casados: 'Sí' }, M_, V);
ver('Mercedes y Jordi P, casados (en los dos)', quien(M_).casados === 'Sí' && quien('(T+1) - Jordi P').casados === 'Sí' && hojas.PERSONAS.filas[0][14] === 'Casados');
err = ''; try { R.guardarPersona('(N) - Laura', { pareja: '', casados: 'Sí' }, M_, V); } catch (e) { err = e.message; }
ver('sin pareja no se puede estar casado', /elige primero su pareja/.test(err));
err = ''; try { R.guardarPersona(M_, { casados: 'Quizá' }, M_, V); } catch (e) { err = e.message; }
ver('casados solo Sí o No', /sí o no/.test(err));
d = R.guardarPersona(M_, { pareja: '(N) - Lucía'.replace('Lucía', 'Laura') }, M_, V);
ver('al cambiar de pareja, «casados» se borra en los tres', !quien(M_).casados && !quien('(T+1) - Jordi P').casados && !quien('(N) - Laura').casados && quien(M_).pareja === '(N) - Laura');
d = R.guardarPersona(M_, { pareja: '(T+1) - Jordi P', casados: 'No' }, M_, V);
ver('pareja y «no casados» en el mismo guardado', quien(M_).pareja === '(T+1) - Jordi P' && quien(M_).casados === 'No' && quien('(T+1) - Jordi P').casados === 'No');

// ---------- v4.21: noviazgo y boda ----------
d = R.guardarPersona(M_, { casados: 'Sí', novios: '1980', boda: '12/06/1985' }, M_, V);
ver('novios y boda, en los dos', quien(M_).novios === '00/00/1980' && quien('(T+1) - Jordi P').novios === '00/00/1980' && quien(M_).boda === '12/06/1985' && quien('(T+1) - Jordi P').boda === '12/06/1985');
ver('con sus títulos en el Excel', hojas.PERSONAS.filas[0][16] === 'Novios desde' && hojas.PERSONAS.filas[0][17] === 'Boda');
d = R.guardarPersona('(T+1) - Jordi P', { novios: '03/1980' }, M_, V);
ver('se cambia desde cualquiera de los dos', quien(M_).novios === '00/03/1980');
err = ''; try { R.guardarPersona(M_, { boda: '31/02/1985' }, M_, V); } catch (e) { err = e.message; }
ver('una boda que no existe no se guarda', /la boda/.test(err));
d = R.guardarPersona(M_, { boda: '20/06/2030' }, M_, V);
ver('una boda que viene, también', quien(M_).boda === '20/06/2030');
d = R.guardarPersona(M_, { boda: '04/10' }, M_, V);
ver('v4.30: una boda sin año, en los dos', quien(M_).boda === '04/10' && quien('(T+1) - Jordi P').boda === '04/10');
err = ''; try { R.guardarPersona(M_, { boda: '2099' }, M_, V); } catch (e) { err = e.message; }
ver('pero no de aquí a más de diez años', /diez años/.test(err));
err = ''; try { R.guardarPersona(M_, { novios: '2030' }, M_, V); } catch (e) { err = e.message; }
ver('el noviazgo, no en el futuro', /después de hoy/.test(err));
err = ''; try { R.guardarPersona('(N) - Laura', { novios: '2001' }, M_, V); } catch (e) { err = e.message; }
ver('sin pareja, no hay fecha de novios', /elige primero su pareja/.test(err) || !!quien('(N) - Laura').pareja);
d = R.guardarPersona(M_, { boda: '' }, M_, V);
ver('la boda se puede borrar', !quien(M_).boda && !quien('(T+1) - Jordi P').boda && quien(M_).novios === '00/03/1980');
d = R.guardarPersona(M_, { pareja: '(N) - Laura' }, M_, V);
ver('al cambiar de pareja, las fechas se borran', !quien(M_).novios && !quien('(T+1) - Jordi P').novios && !quien('(N) - Laura').novios);
d = R.guardarPersona(M_, { pareja: '(T+1) - Jordi P', casados: 'No' }, M_, V);

// ---------- v4.13: el año del cumpleaños ----------
d = R.guardarPersona(M_, { cumple: '00/03/2027' }, M_, V);
ver('v4.24: la fecha prevista de un bebé en camino (el año que viene)', quien(M_).cumple === '00/03/2027');
err = ''; try { R.guardarPersona(M_, { cumple: '2028' }, M_, V); } catch (e) { err = e.message; }
ver('pero no más allá', /cumpleaños/.test(err));
d = R.guardarPersona(M_, { cumple: '07/03/1952' }, M_, V);
ver('cumpleaños con año', quien(M_).cumple === '07/03/1952');
d = R.guardarPersona(M_, { cumple: '7/3' }, M_, V);
ver('y sin año, como antes', quien(M_).cumple === '07/03');
err = ''; try { R.guardarPersona(M_, { cumple: '07/03/1850' }, M_, V); } catch (e) { err = e.message; }
ver('un año imposible no se guarda', /de 1900 a hoy/.test(err));
err = ''; try { R.guardarPersona(M_, { cumple: '07/03/2099' }, M_, V); } catch (e) { err = e.message; }
ver('ni uno del futuro', /de 1900 a hoy/.test(err));

// ---------- v4.15: acompañantes y eventos ----------
vm.runInContext('this.__.guardarDia = guardarDia;', ctx);
const V2 = { desde: '2026-11-16', hasta: '2026-11-29', yo: M_ };
const ap = (f, t, id) => d.apuntes.find(a => a.fecha === f && a.turno === t && a.persona === id);
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'CENA', apuntado: true, acompanantes: 2 }] }, M_, V2);
ver('apuntarse con 2 acompañantes', (ap('2026-11-21', 'CENA', M_) || {}).acompanantes === 2);
ver('título de la columna J de MESA_APUNTES', hojas.MESA_APUNTES.filas[0][9] === 'ACOMPANANTES');
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'CENA', apuntado: true, acompanantes: 0 }] }, M_, V2);
ver('volver a 0 acompañantes', (ap('2026-11-21', 'CENA', M_) || {}).acompanantes === 0);
err = ''; try { R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'CENA', apuntado: true, acompanantes: 50 }] }, M_, V2); } catch (e) { err = e.message; }
ver('acompañantes como mucho 20', /de 0 a 20/.test(err));
d = R.guardarDia('2026-11-21', { evento: 'Castañada', eventoTurno: 'CENA', eventoTexto: 'Traed castañas y boniatos' }, M_, V2);
const ev = d.dias.find(x => x.fecha === '2026-11-21') || {};
ver('evento guardado con su turno y su descripción', ev.evento === 'Castañada' && ev.eventoTurno === 'CENA' && ev.eventoTexto === 'Traed castañas y boniatos');
ver('títulos de los eventos en MESA_DIAS', hojas.MESA_DIAS.filas[0][29] === 'EVENTO');
d = R.guardarDia('2026-11-22', { evento: 'Santo de la abuela' }, M_, V2);
ver('sin turno, el evento es a la comida', (d.dias.find(x => x.fecha === '2026-11-22') || {}).eventoTurno === 'COMIDA');
d = R.guardarDia('2026-11-22', {}, M_, V2);
ver('borrar el día quita el evento', !d.dias.some(x => x.fecha === '2026-11-22'));

// ---------- v4.15.1: «no va» un día de los de siempre (fila con todas las columnas) ----------
d = R.guardarPersona(M_, { fijos: [{ dow: 6, turno: 'COMIDA' }] }, M_, V2);
ver('Mercedes va siempre los sábados a comer', !!ap('2026-11-21', 'COMIDA', M_));
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'COMIDA', apuntado: false }] }, M_, V2);
ver('un sábado concreto no va (sin error de columnas)', !ap('2026-11-21', 'COMIDA', M_));
ver('la fila «no va» tiene las 10 columnas', hojas.MESA_APUNTES.filas.filter(f => f[6] === 'NO').every(f => f.length >= 10));

// ---------- v4.15.2: con las pestañas en formato de tabla ----------
Object.values(hojas).forEach(h => { h.tabla = true; });
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-25', turno: 'CENA', apuntado: true, nota: 'Con tabla' }] }, M_, V2);
ver('con tablas: apuntarse con nota (MESA_APUNTES y MESA_CAMBIOS)', !!ap('2026-11-25', 'CENA', M_));
d = R.guardarDia('2026-11-26', { nota: 'Con tabla' }, M_, V2);
ver('con tablas: nota del día (MESA_DIAS)', (d.dias.find(x => x.fecha === '2026-11-26') || {}).nota === 'Con tabla');
d = R.guardarPersona('(O) - Amiga M', { apodo: 'Amiga N' }, M_, V2);
ver('con tablas: cambiar el apodo (MESA_ALIAS)', !!d.personas.find(x => x.id === '(O) - Amiga N'));
d = R.guardarPersona(M_, { fijos: [{ dow: 3, turno: 'CENA' }] }, M_, V2);
ver('con tablas: va siempre (MESA_FIJOS)', d.fijos.some(f => f.persona === M_ && f.dow === 3));

// ---------- v4.16: fallecidos y fechas como se sepan ----------
Object.values(hojas).forEach(h => { h.tabla = false; });
d = R.crearPersona({ apodo: 'Nacio', jerarquia: 'Nietos', familia: 'Canela', nombre: 'Ignacio', cumple: '01/2008', fallecio: '06/2008', hijoDe: M_ }, M_, V2);
const nacio = d.personas.find(p => p.id === '(N) - Nacio') || {};
ver('Nacio, nacido en enero de 2008 y fallecido en junio de 2008', nacio.cumple === '00/01/2008' && nacio.fallecio === '00/06/2008' && nacio.hijoDe === M_);
ver('título de la columna P', hojas.PERSONAS.filas[0][15] === 'Falleció');
d = R.guardarPersona('(N) - Nacio', { fallecio: '2008' }, M_, V2);
ver('solo el año', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === '00/00/2008');
d = R.guardarPersona('(N) - Nacio', { fallecio: '10/06/2008' }, M_, V2);
ver('fecha completa', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === '10/06/2008');
err = ''; try { R.guardarPersona('(N) - Nacio', { fallecio: '31/02/2008' }, M_, V2); } catch (e) { err = e.message; }
ver('una fecha que no existe no se guarda', /fallecimiento/.test(err));
err = ''; try { R.guardarPersona('(N) - Nacio', { fallecio: '2099' }, M_, V2); } catch (e) { err = e.message; }
ver('ni una del futuro', /fallecimiento/.test(err));
// v4.20: fallecido sin saber cuándo
d = R.guardarPersona('(N) - Nacio', { fallecio: 'si' }, M_, V2);
ver('«sí» = falleció sin saber cuándo', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === 'Sí');
d = R.guardarPersona('(N) - Nacio', { fallecio: '06/2008' }, M_, V2);
ver('y se le puede volver a poner fecha', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === '00/06/2008');
d = R.guardarPersona(M_, { cumple: '1952' }, M_, V2);
ver('cumpleaños con solo el año', quien(M_).cumple === '00/00/1952');

// ---------- v4.28: eventos ----------
const JP_ = '(T+1) - Jordi P';
ver('sin MESA_EVENTOS, ningún evento', Array.isArray(d.eventos) && d.eventos.length === 0);
d = R.guardarEvento({ nombre: 'PortAventura', desde: '2026-12-19', hasta: '2026-12-20', cuando: 'DIA', texto: 'Salimos a las 9' }, M_, V2);
const ev1 = (d.eventos || []).find(e => e.nombre === 'PortAventura') || {};
ver('se crea la pestaña y el evento, de dos días', !!hojas.MESA_EVENTOS && ev1.desde === '2026-12-19' && ev1.hasta === '2026-12-20' && ev1.cuando === 'DIA' && ev1.texto === 'Salimos a las 9');
d = R.apuntarEvento(ev1.id, M_, true, M_, V2);
d = R.apuntarEvento(ev1.id, JP_, false, M_, V2);
let evt = d.eventos.find(e => e.id === ev1.id);
ver('quién va y quién no', evt.van.join() === M_ && evt.noVan.join() === JP_);
d = R.apuntarEvento(ev1.id, JP_, true, M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('cambiar de «no voy» a «voy»', evt.van.join() === M_ + ',' + JP_ && !evt.noVan.length);
d = R.apuntarEvento(ev1.id, M_, null, M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('y quitarse', evt.van.join() === JP_);
d = R.guardarEvento({ id: ev1.id, nombre: 'PortAventura y Ferrari Land', desde: '2026-12-19', hasta: '2026-12-21', cuando: 'DIA' }, M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('cambiar el evento no borra quién va', evt.nombre === 'PortAventura y Ferrari Land' && evt.hasta === '2026-12-21' && evt.van.join() === JP_);
// v4.67: días sueltos de un evento de varios días
d = R.apuntarEvento(ev1.id, M_, true, M_, V2, ['2026-12-20']);
evt = d.eventos.find(e => e.id === ev1.id);
ver('ir solo el domingo', evt.van.indexOf(M_) !== -1 && JSON.stringify(evt.dias) === JSON.stringify({ [M_]: ['2026-12-20'] }) && hojas.MESA_EVENTOS.filas[0][13] === 'DIAS');
d = R.apuntarEvento(ev1.id, JP_, true, M_, V2, ['2026-12-19', '2026-12-21', '2027-01-01']);
evt = d.eventos.find(e => e.id === ev1.id);
ver('dos días (y uno que no es del evento, fuera)', evt.dias[JP_].join() === '2026-12-19,2026-12-21' && evt.dias[M_].join() === '2026-12-20');
d = R.apuntarEvento(ev1.id, JP_, true, M_, V2, ['2026-12-19', '2026-12-20', '2026-12-21']);
evt = d.eventos.find(e => e.id === ev1.id);
ver('todos los días = sin días sueltos', !evt.dias[JP_] && evt.van.indexOf(JP_) !== -1);
err = ''; try { R.apuntarEvento(ev1.id, JP_, true, M_, V2, []); } catch (e) { err = e.message; }
ver('ningún día, no', /al menos un día/.test(err));
d = R.apuntarEvento(ev1.id, M_, false, M_, V2, ['2026-12-20']);
evt = d.eventos.find(e => e.id === ev1.id);
ver('si no va, fuera sus días', !evt.dias[M_] && evt.noVan.indexOf(M_) !== -1);
const porApi = R.api_('apuntarEvento', [ev1.id, M_, true, M_, V2, ['2026-12-21']]);
evt = ((JSON.parse(porApi.getContent ? porApi.getContent() : JSON.stringify(porApi)).r || {}).eventos || []).find(e => e.id === ev1.id) || R.getDatos(V2).eventos.find(e => e.id === ev1.id);
ver('los días también llegan por la API', (evt.dias[M_] || []).join() === '2026-12-21');
// v4.68: notas
d = R.notaEvento(ev1.id, M_, 'Llego el domingo a las 11', JP_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('una nota en el evento', evt.notas[M_] === 'Llego el domingo a las 11' && hojas.MESA_EVENTOS.filas[0][14] === 'NOTAS');
d = R.notaEvento(ev1.id, JP_, 'Sin gluten; ojo', M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('dos notas, con punto y coma', evt.notas[JP_] === 'Sin gluten; ojo' && evt.notas[M_] === 'Llego el domingo a las 11');
d = R.notaEvento(ev1.id, M_, '', M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('borrar la nota', !evt.notas[M_] && evt.notas[JP_]);
err = ''; try { R.notaEvento(ev1.id, M_, 'x'.repeat(200), M_, V2); } catch (e) { err = e.message; }
ver('una nota muy larga, no', /nota/i.test(err));
ver('notaEvento, en la API', R.api_('notaEvento', [ev1.id, JP_, '', M_, V2]) !== undefined);
d = R.apuntarEvento(ev1.id, M_, null, M_, V2);
err = ''; try { R.guardarEvento({ nombre: 'X', desde: '2026-12-20', hasta: '2026-12-19' }, M_, V2); } catch (e) { err = e.message; }
ver('el último día no puede ser antes', /antes del primero/.test(err));
err = ''; try { R.guardarEvento({ nombre: '', desde: '2026-12-20' }, M_, V2); } catch (e) { err = e.message; }
ver('sin nombre, no', /nombre del evento/.test(err));
err = ''; try { R.guardarEvento({ nombre: 'Largo', desde: '2026-12-01', hasta: '2027-01-15' }, M_, V2); } catch (e) { err = e.message; }
ver('un mes como mucho', /un mes/.test(err));
err = ''; try { R.apuntarEvento(ev1.id, '(X) - Nadie', true, M_, V2); } catch (e) { err = e.message; }
ver('apuntar a alguien que no está, no', /No encontramos/.test(err));
d = R.borrarEvento(ev1.id, M_, V2);
ver('borrar el evento', !d.eventos.some(e => e.id === ev1.id) && hojas.MESA_EVENTOS.filas.some(f => f[0] === ev1.id && f[9]));
err = ''; try { R.apuntarEvento(ev1.id, M_, true, M_, V2); } catch (e) { err = e.message; }
ver('y ya no se puede apuntar nadie', /ya no está/.test(err));

d = R.guardarEvento({ nombre: 'Cena de Navidad', desde: '2026-12-24', lugar: 'Casa de la abuela', hora: '21:00' }, M_, V2);
const cen = d.eventos.find(e => e.nombre === 'Cena de Navidad') || {};
ver('el evento con dónde y a qué hora', cen.lugar === 'Casa de la abuela' && cen.hora === '21:00' && cen.hasta === '2026-12-24');
d = R.apuntarEvento(cen.id, JP_, true, M_, V2);
ver('se puede apuntar a otro (un padre por su hijo)', d.eventos.find(e => e.id === cen.id).van.join() === JP_);

d = R.guardarEvento({ nombre: 'PortAventura', desde: '2026-12-19', hasta: '2026-12-20', cuando: 'DIA', turnos: { '2026-12-19': ['COMIDA', 'CENA', 'DORMIR'], '2026-12-20': ['COMIDA'], '2027-01-01': ['CENA'] } }, M_, V2);
const pa = d.eventos.find(e => e.nombre === 'PortAventura' && e.desde === '2026-12-19') || {};
ver('v4.33: los turnos de cada día, y nada fuera del evento', JSON.stringify(pa.turnos) === JSON.stringify({ '2026-12-19': ['COMIDA', 'CENA', 'DORMIR'], '2026-12-20': ['COMIDA'] }));
err = ''; try { R.guardarEvento({ nombre: 'Nada', desde: '2026-12-19', hasta: '2026-12-20', turnos: { '2026-12-19': [], '2026-12-20': [] } }, M_, V2); } catch (e) { err = e.message; }
ver('al menos un turno', /al menos una/.test(err));
d = R.guardarEvento({ nombre: 'Un día', desde: '2026-12-22', cuando: 'CENA' }, M_, V2);
ver('un evento de un día, sin turnos', (d.eventos.find(e => e.nombre === 'Un día') || {}).turnos === null);

// ---------- v4.28: otras fechas de cada persona ----------
d = R.guardarPersona(M_, { fechas: [{ que: 'Bautizo', fecha: '12/05/1961' }, { que: 'Carnet de conducir', fecha: '03/1980' }] }, M_, V2);
ver('otras fechas, con lo que se sepa', JSON.stringify(quien(M_).fechas) === JSON.stringify([{ que: 'Bautizo', fecha: '12/05/1961' }, { que: 'Carnet de conducir', fecha: '00/03/1980' }]) && hojas.PERSONAS.filas[0][18] === 'Otras fechas');
d = R.guardarPersona(M_, { fechas: [{ que: 'Comunión; 2ª: parte', fecha: '1968' }] }, M_, V2);
ver('sin «;» ni «:» en el nombre, y se cambia la lista entera', quien(M_).fechas.length === 1 && quien(M_).fechas[0].que === 'Comunión 2ª parte' && quien(M_).fechas[0].fecha === '00/00/1968');
err = ''; try { R.guardarPersona(M_, { fechas: [{ que: '', fecha: '1968' }] }, M_, V2); } catch (e) { err = e.message; }
ver('sin decir qué es, no', /ponle qué es/.test(err));
err = ''; try { R.guardarPersona(M_, { fechas: [{ que: 'Futuro', fecha: '2099' }] }, M_, V2); } catch (e) { err = e.message; }
ver('ni una fecha imposible', /Futuro/.test(err));
d = R.guardarPersona(M_, { fechas: [{ que: 'Santo', fecha: '25/07' }] }, M_, V2);
ver('v4.30: una fecha sin año (un santo)', quien(M_).fechas[0].fecha === '25/07');
err = ''; try { R.guardarPersona(M_, { fechas: [{ que: 'Santo', fecha: '31/02' }] }, M_, V2); } catch (e) { err = e.message; }
ver('pero que exista', /Santo/.test(err));
d = R.guardarPersona(M_, { fechas: [] }, M_, V2);
ver('y se pueden quitar todas', quien(M_).fechas.length === 0);

// ---------- v4.40: rellenar lo que falta, varias personas de una vez ----------
d = R.guardarPersonas([{ id: M_, cambios: { cumple: '07/03/1952' } }, { id: JP_, cambios: { apellido: 'Puig', sexo: 'Hombre' } }], M_, V2);
ver('varias personas de una vez', quien(M_).cumple === '07/03/1952' && quien(JP_).apellido === 'Puig');
err = ''; try { R.guardarPersonas([{ id: M_, cambios: { cumple: '31/02/1952' } }], M_, V2); } catch (e) { err = e.message; }
ver('si una falla, dice quién', /^Mercedes: /.test(err));
err = ''; try { R.guardarPersonas([], M_, V2); } catch (e) { err = e.message; }
ver('sin nada, no', /nada que guardar/.test(err));

// ---------- v4.58: ajustes del administrador ----------
err = ''; try { R.getAjustes(M_); } catch (e) { err = e.message; }
ver('sin ADMIN_IDS, nadie ve los ajustes', /solo para quien lleva la web/.test(err));
hojas.MESA_CONFIG.filas.push(['ADMIN_IDS', M_]);
let aj = R.getAjustes(M_);
ver('el administrador ve la configuración y el historial', aj.config.horaComida === '14:00' && Array.isArray(aj.cambios) && aj.cambios.length > 0 && Array.isArray(aj.visitas));
err = ''; try { R.getAjustes(JP_); } catch (e) { err = e.message; }
ver('los demás, no', /solo para quien lleva la web/.test(err));
d = R.guardarAjustes({ horaComida: '13:30', avisoHoras: 6, pista: 'Una pista', clave: 'nueva' }, M_, V2);
aj = R.getAjustes(M_);
ver('guardar horas, aviso, pista y clave', aj.config.horaComida === '13:30' && aj.config.avisoHoras === 6 && aj.config.pista === 'Una pista' && aj.config.clave === 'nueva' && d.config.horaComida === '13:30');
ver('y queda en el historial (sin decir la clave)', aj.cambios[0].cambio && !aj.cambios.some(c => /nueva/.test(c.cambio)));
err = ''; try { R.guardarAjustes({ horaCena: '25:00' }, M_, V2); } catch (e) { err = e.message; }
ver('una hora imposible, no', /hora de la cena/.test(err));
err = ''; try { R.guardarAjustes({ clave: '' }, M_, V2); } catch (e) { err = e.message; }
ver('la clave no puede quedar vacía', /no puede quedar vacía/.test(err));
err = ''; try { R.guardarAjustes({ horaComida: '13:30' }, JP_, V2); } catch (e) { err = e.message; }
ver('los demás no pueden guardar ajustes', /solo para quien lleva la web/.test(err));
d = R.guardarAjustes({ noCuentan: [N_, JP_] }, M_, V2);
ver('quién no cuenta, en el Excel', R.getAjustes(M_).config.noCuentan.join() === [N_, JP_].join());
hojas.MESA_CONFIG.filas = hojas.MESA_CONFIG.filas.filter(f => f[0] !== 'CLAVE' && f[0] !== 'PISTA');
d = R.getDatos(Object.assign({}, V2, { yo: JP_ }));
ver('al entrar, se apunta la visita (una vez)', !!hojas.MESA_VISITAS && hojas.MESA_VISITAS.filas.some(f => f[0] === JP_ && f[2] === '1'));

// ---------- v4.65: «Por rellenar» también para los abuelos (lo rellena cualquiera) ----------
d = R.guardarPersona('(A) - Abuela', { cumple: '12/02/1930', apellido: 'Coll', fechas: [{ que: 'Santo', fecha: '24/06' }, { que: 'Bautizo', fecha: '00/00/1930' }] }, JP_, V2);
ver('de la abuela: nacimiento, apellido, santo y bautizo', quien('(A) - Abuela').cumple === '12/02/1930' && quien('(A) - Abuela').apellido === 'Coll' &&
  JSON.stringify(quien('(A) - Abuela').fechas) === JSON.stringify([{ que: 'Santo', fecha: '24/06' }, { que: 'Bautizo', fecha: '00/00/1930' }]));
d = R.guardarPersona('(A) - Abuela', { fallecio: '03/05/1999' }, JP_, V2);
ver('y la fecha de fallecimiento', quien('(A) - Abuela').fallecio === '03/05/1999');
err = ''; try { R.guardarPersona('(A) - Abuela', { fallecio: '03/05' }, JP_, V2); } catch (e) { err = e.message; }
ver('el fallecimiento sin año, no', /fallecimiento/.test(err));
d = R.guardarPersona('(A) - Abuela', { fallecio: '' }, JP_, V2);
ver('(se deshace)', !quien('(A) - Abuela').fallecio);

// ---------- v4.79: Mis números ----------
hojas.MESA_APUNTES.filas.push(['n1', '2026-11-01', 'COMIDA', '(N) - Jan', '2026-10-31T14:00:00', '', '', '', '', ''],
  ['n2', '2026-11-08', 'COMIDA', '(N) - Jan', '2026-11-05T10:00:00', '', '', '', '', ''],
  ['n3', '2026-11-10', 'CENA', '(N) - Jan', '', '', '', '', '', ''],
  ['n4', '2026-11-11', 'COMIDA', '(N) - Jan', '2026-11-01T10:00:00', '', 'NO', '', '', '']);
R.guardarAjustes({ inicio: '2026-10-01' }, M_, V2);
const mn = R.misNumeros('(N) - Jan');
ver('mis números: cuántas veces (sin el «no voy» ni lo de hoy)', mn.total >= 4 && mn.cenas >= 1 && mn.ultima === '2026-11-10' && mn.mes >= 4);
ver('mi día: el martes (sus comidas fijas cuentan)', mn.diaFav === 2);
ver('con cuánta antelación aviso (horas, la mediana)', mn.antelacionHoras === 76);
ver('los 7 días, para la gráfica', mn.porDia.length === 7 && mn.porDia.reduce((x, y) => x + y, 0) === mn.total);
ver('top 10 general: con puntos (y menos de 10 con puntos), dentro', mn.puntos > 0 && mn.top10 === true);
const nadie = R.misNumeros(M_);
ver('sin puntos, fuera del top 10 general', nadie.top10 === (nadie.puntos > 0));
const dis = (mn.distinciones || []).map(x => x.id);
const janFijo = R.getDatos(V2).fijos.some(f => f.persona === '(N) - Jan');
ver('distinciones: top de comidas y cuatro semanas seguidas', dis.indexOf('comidas') !== -1 && dis.indexOf('semanas') !== -1);
ver('«tienes tu día» solo si tiene un fijo', (dis.indexOf('fijo') !== -1) === janFijo);
ver('distinciones: cada una con su título y su explicación', (mn.distinciones || []).every(x => x.titulo && x.texto));
ver('los puntos son la suma de las categorías y de las medallas (3 las difíciles, 1 las de participar)', mn.puntos === (mn.distinciones || []).reduce((t, x) => t + x.puntos, 0) && (mn.distinciones || []).filter(x => !x.categoria).every(x => x.puntos === 3 || x.puntos === 1));
ver('quien no ha ido no tiene las de ir (solo en positivo)', !(R.misNumeros(M_).distinciones || []).some(x => x.id === 'comidas' && !nadie.total));
// v4.93: las medallas de eventos
const evA = R.guardarEvento({ nombre: 'Merienda de octubre', desde: '2026-10-10' }, M_, V2).eventos.find(e => e.nombre === 'Merienda de octubre');
const evB = R.guardarEvento({ nombre: 'Paseo de octubre', desde: '2026-10-20' }, M_, V2).eventos.find(e => e.nombre === 'Paseo de octubre');
R.apuntarEvento(evA.id, '(N) - Jan', true, M_, V2); R.apuntarEvento(evB.id, '(N) - Jan', true, M_, V2);
let dj = R.misNumeros('(N) - Jan').distinciones.map(x => x.id);
ver('medalla: no te pierdes ni uno (ha ido a todos los eventos pasados)', dj.indexOf('ni-uno') !== -1);
R.getDatos(V2).eventos.forEach(e => { if (e.van.indexOf('(N) - Jan') === -1 && e.noVan.indexOf('(N) - Jan') === -1) R.apuntarEvento(e.id, '(N) - Jan', false, M_, V2); });
dj = R.misNumeros('(N) - Jan').distinciones.map(x => x.id);
ver('medalla: siempre contestas (ha contestado todos)', dj.indexOf('contesta') !== -1);
R.apuntarEvento(evB.id, '(N) - Jan', false, M_, V2);
ver('sin ir a uno, ya no tiene «no te pierdes ni uno»', R.misNumeros('(N) - Jan').distinciones.every(x => x.id !== 'ni-uno'));
R.borrarEvento(evA.id, M_, V2); R.borrarEvento(evB.id, M_, V2);
// v4.84: el servicio, con sus medallas (sin competir con la familia ni entrar en el top)
const janAntes = R.misNumeros('(N) - Jan').puntos;
const anchoP = hojas.PERSONAS.filas[0].length;
hojas.PERSONAS.filas.push(['(O) - Soledad', 'Soledad', 'Otros', 'Servicio', '', '🌕 Entero', '', ''].concat(Array(Math.max(0, anchoP - 8)).fill('')));
['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-27', '2026-10-28', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10'].forEach((f, i) => hojas.MESA_APUNTES.filas.push(['s' + i, f, 'DORMIR', '(O) - Soledad', '', '', '', '', '', '']));
const sol = R.misNumeros('(O) - Soledad'), dsol = (sol.distinciones || []).map(x => x.id);
ver('servicio: la que más noches le hace compañía', sol.servicio === true && dsol.indexOf('mas-noches') !== -1);
ver('servicio: cuatro semanas seguidas', dsol.indexOf('semanas') !== -1);
ver('servicio: sin puntos ni top 10 de la familia', !sol.top10 && !sol.puntos && !dsol.some(x => x === 'comidas' && (sol.distinciones.find(d => d.id === x) || {}).categoria));
ver('servicio: no sale en las medallas de la familia', R.misNumeros('(N) - Jan').puntos === janAntes);
ver('servicio: siempre un gracias con sus días del mes', dsol.indexOf('dias') !== -1);
// v4.86: desde el servicio, solo lo suyo
err = ''; try { R.guardarPersona('(N) - Jan', { alergias: 'x' }, '(O) - Soledad', V2); } catch (e) { err = e.message; }
ver('servicio: no cambia lo de otros', /solo puedes cambiar lo tuyo/.test(err));
err = ''; try { R.guardarPersona('(O) - Soledad', { alergias: 'Nada' }, '(O) - Soledad', V2); } catch (e) { err = e.message; }
ver('servicio: lo suyo, sí', !err);
err = ''; try { R.guardarEvento({ nombre: 'Algo', desde: '2026-12-01' }, '(O) - Soledad', V2); } catch (e) { err = e.message; }
ver('servicio: no crea eventos', /organiza la familia/.test(err));
hojas.PERSONAS.filas = hojas.PERSONAS.filas.filter(f => f[0] !== '(O) - Soledad');
hojas.MESA_APUNTES.filas = hojas.MESA_APUNTES.filas.filter(f => !/^s\d$/.test(f[0]));
// v4.85: el portal de premios
err = ''; try { R.getPremios(JP_); } catch (e) { err = e.message; }
ver('premios: solo para quien lleva la web', /solo para quien lleva la web/.test(err));
// v4.91: con CLAVE_ADMIN, elegir el nombre no basta
hojas.MESA_CONFIG.filas.push(['CLAVE_ADMIN', 'Higuera']);
err = ''; try { R.getPremios(M_); } catch (e) { err = e.message; }
ver('admin: sin su clave, no', /^ADMIN/.test(err));
err = ''; try { R.getAjustes(M_, 'otra'); } catch (e) { err = e.message; }
ver('admin: con otra clave, tampoco', /^ADMIN/.test(err));
ver('admin: con su clave, sí (y no sale hacia la web)', !!R.getAjustes(M_, ' HIGUERA ').config && !JSON.stringify(R.getAjustes(M_, 'higuera')).includes('Higuera'));
hojas.MESA_CONFIG.filas = hojas.MESA_CONFIG.filas.filter(f => f[0] !== 'CLAVE_ADMIN');
const pr = R.getPremios(M_);
const secre = pr.categorias.find(c => c.id === 'secretaria');
ver('secretaría: quien apunta o contesta por otros (Mercedes)', secre.gente.some(g => g.apodo === 'Mercedes'));
ver('medallas nuevas: guardián de la memoria y echar una mano', ['memoria', 'mano'].every(k => pr.medallas.some(m => m.id === k)));
ver('premios: las 9 categorías (con la secretaría), cada una con su gente', pr.categorias.length === 9 && pr.categorias.find(c => c.id === 'comidas').gente.some(g => g.apodo === 'Jan'));
ver('premios: fin de semana y entre semana', pr.categorias.find(c => c.id === 'semana').gente.some(g => g.apodo === 'Jan'));
ver('premios: el general, ordenado por puntos', pr.general.length > 0 && pr.general.every((g, i) => !i || pr.general[i - 1].puntos >= g.puntos));
{  // v5.11: si la web se empezó a usar este mes, nadie es «nuevo en la mesa»
  const fij = hojas.MESA_FIJOS.filas, apu = hojas.MESA_APUNTES.filas;
  hojas.MESA_FIJOS.filas = [fij[0]];
  hojas.MESA_APUNTES.filas = [apu[0]].concat(apu.slice(1).filter(f => String(f[1]) >= '2026-10-20'));
  const pr2 = R.getPremios(M_);
  ver('bienvenida: con la web recién estrenada, no se da', !pr2.medallas.some(m => m.id === 'bienvenida') && pr2.totales.comidas + pr2.totales.cenas + pr2.totales.noches > 0);
  hojas.MESA_FIJOS.filas = fij; hojas.MESA_APUNTES.filas = apu;
}
ver('informe: las curiosidades del mes', pr.curiosidades.dias > 0 && pr.curiosidades.dias <= 30 && pr.curiosidades.familias > 0 && pr.curiosidades.mesaLlena && pr.curiosidades.mesaLlena.n >= 1 && pr.curiosidades.diaFavorito >= 0 && pr.curiosidades.diaFavorito <= 6);
ver('informe: la mesa más llena cuenta a los acompañantes y no la noche', pr.curiosidades.mesaLlena.turno !== 'DORMIR');
ver('informe: la serie de los 30 días, con comida, cena y noche', pr.curiosidades.serie.length === 30 && pr.curiosidades.serie.every(x => x.length === 7) && pr.curiosidades.serie.reduce((t, x) => t + x[1] + x[2] + x[3], 0) === pr.totales.comidas + pr.totales.cenas + pr.totales.noches);
ver('informe: por día de la semana suma lo mismo', pr.curiosidades.porDow.length === 7 && pr.curiosidades.porDow.reduce((a, b) => a + b, 0) === pr.totales.comidas + pr.totales.cenas + pr.totales.noches);
ver('informe: antelación (mediana, en horas) y acompañantes', (pr.curiosidades.antelacionH === null || pr.curiosidades.antelacionH >= 0) && pr.curiosidades.acompanantes >= 0);
ver('informe: por generaciones (tíos, nietos, bisnietos), con su gente', pr.curiosidades.porGen.length === 3 && pr.curiosidades.porGen.map(g => g.gen).join() === 'Tios,Nietos,Biznietos' && pr.curiosidades.porGen.every(g => g.visitas >= 0 && g.personas >= 0 && Array.isArray(g.primeros)));
ver('informe: lo de cada generación cuadra con la serie', pr.curiosidades.porGen.every((g, i) => g.visitas === pr.curiosidades.serie.reduce((t, x) => t + x[4 + i], 0)));
ver('informe: sin el servicio en las curiosidades', typeof pr.curiosidades.eventos === 'number' && typeof pr.curiosidades.vanEventos === 'number');
ver('premios: las familias y los totales del mes', pr.familias.length > 0 && pr.totales.comidas > 0 && pr.totales.personas > 0);
ver('la etiqueta dorada llega con los datos', R.getDatos(Object.assign({}, V2, { yo: '(N) - Jan' })).yoTop10 === true);
err = ''; try { R.misNumeros('(X) - Nadie'); } catch (e) { err = e.message; }
ver('de alguien que no está, no', /No encontramos/.test(err));

// ---------- v4.17: la clave de la familia ----------
ver('sin CLAVE en MESA_CONFIG, no se pide', R.api_('getDatos', [V2], undefined).ok === true);
hojas.MESA_CONFIG.filas.push(['CLAVE', 'Paella']);
ver('con CLAVE, sin clave no se puede', /^CLAVE/.test(R.api_('getDatos', [V2], '').error || ''));
ver('con una clave que no es, tampoco', /^CLAVE/.test(R.api_('getDatos', [V2], 'paela').error || ''));
ver('con la clave, sí (da igual mayúsculas y acentos)', R.api_('getDatos', [V2], ' PÁELLA ').ok === true);
ver('y también para guardar', /^CLAVE/.test(R.api_('guardarPersona', [M_, { alergias: 'x' }, M_, V2], 'no').error || ''));
// v4.18: la pista, en el aviso
ver('sin PISTA, el aviso no lleva pista', !/PISTA/.test(R.api_('getDatos', [V2], 'no').error || ''));
hojas.MESA_CONFIG.filas.push(['PISTA', 'Lo que se come en verano…']);
ver('con PISTA, va en el aviso', /PISTA: Lo que se come en verano…$/.test(R.api_('getDatos', [V2], 'no').error || ''));
ver('y con la clave buena, entra igual', R.api_('getDatos', [V2], 'paella').ok === true);
const conPista = R.api_('getDatos', [V2], 'paella').r;
ver('la pista llega con los datos, la clave no', conPista.config.pista === 'Lo que se come en verano…' && !('clave' in conPista.config));

// ---------- v5.28 (T0586): las visitas, por la mañana o por la tarde sin comer ni cenar ----------
{
  const VV = { desde: '2026-11-09', hasta: '2026-11-22', yo: N_ };
  const numAntes = R.misNumeros(N_);
  const ultimoCambio = () => { const f = hojas.MESA_CAMBIOS.filas; return String((f[f.length - 1] || [])[3] || ''); };
  let dv = R.guardarPersona(N_, { turnos: [{ fecha: '2026-11-18', turno: 'MANANA', apuntado: true, nota: 'teletrabajo' }] }, N_, VV);
  const vm1 = dv.apuntes.find(a => a.fecha === '2026-11-18' && a.turno === 'MANANA' && a.persona === N_);
  ver('visitas: Jan va por la mañana del 18/11, con su nota', !!vm1 && vm1.nota === 'teletrabajo' && !vm1.fijo);
  ver('visitas: el registro lo dice con palabras', /^Apunta a Jan a la mañana del 18\/11 \(nota: teletrabajo\)$/.test(ultimoCambio()));
  ver('visitas: no sale en «Tus próximas comidas y cenas»', R.getDatos(VV).misProximas.every(a => a.turno !== 'MANANA' && a.turno !== 'TARDE'));
  // también la comida del mismo día: son dos cosas distintas
  dv = R.guardarPersona(N_, { turnos: [{ fecha: '2026-11-18', turno: 'COMIDA', apuntado: true }] }, N_, VV);
  ver('visitas: la mañana y la comida del mismo día, las dos', ['MANANA', 'COMIDA'].every(t => dv.apuntes.some(a => a.fecha === '2026-11-18' && a.turno === t && a.persona === N_)));
  // todas las semanas por la tarde, sin perder sus otros días fijos
  const fijosJan = dv.fijos.filter(f => f.persona === N_).map(f => ({ dow: f.dow, turno: f.turno }));
  dv = R.guardarPersona(M_, { fijos: [{ dow: 3, turno: 'TARDE' }] }, M_, VV);
  ver('visitas: Mercedes va todos los miércoles por la tarde', dv.fijos.some(f => f.persona === M_ && f.dow === 3 && f.turno === 'TARDE') &&
    dv.apuntes.some(a => a.fecha === '2026-11-18' && a.turno === 'TARDE' && a.persona === M_ && a.fijo));
  ver('visitas: el registro del fijo, con palabras', /^Mercedes va siempre los miércoles \(tarde\)$/.test(ultimoCambio()));
  dv = R.guardarPersona(N_, { fijos: fijosJan.concat([{ dow: 1, turno: 'MANANA' }]) }, N_, VV);
  ver('visitas: un fijo de mañana se suma a los de comer y cenar', fijosJan.every(x => dv.fijos.some(f => f.persona === N_ && f.dow === x.dow && f.turno === x.turno)) && dv.fijos.some(f => f.persona === N_ && f.dow === 1 && f.turno === 'MANANA'));
  // quitarse un día que va siempre por la tarde: solo ese día
  dv = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-18', turno: 'TARDE', apuntado: false }] }, M_, VV);
  ver('visitas: quitar un miércoles por la tarde deja los demás', !dv.apuntes.some(a => a.fecha === '2026-11-18' && a.turno === 'TARDE' && a.persona === M_) && dv.fijos.some(f => f.persona === M_ && f.turno === 'TARDE'));
  // lo de ayer: una visita pasada no cuenta en sus números (medallas e informe)
  R.guardarPersona(N_, { turnos: [{ fecha: '2026-11-11', turno: 'MANANA', apuntado: true }, { fecha: '2026-11-12', turno: 'TARDE', apuntado: true }] }, N_, VV);
  const numDespues = R.misNumeros(N_);
  ver('visitas: no cuentan en sus números ni en sus puntos', numDespues.total === numAntes.total && numDespues.puntos === numAntes.puntos);
  // lo raro: un turno que no existe, y una visita en un día no válido
  err = ''; try { R.guardarPersona(N_, { turnos: [{ fecha: '2026-11-18', turno: 'SIESTA', apuntado: true }] }, N_, VV); } catch (e) { err = e.message; }
  ver('visitas: un turno que no existe, no', /Turno no válido/.test(err));
  err = ''; try { R.guardarPersona(N_, { fijos: [{ dow: 9, turno: 'MANANA' }] }, N_, VV); } catch (e) { err = e.message; }
  ver('visitas: un fijo en un día que no existe, no', /Día fijo no válido/.test(err));
  // y quitarse del todo
  dv = R.guardarPersona(N_, { turnos: [{ fecha: '2026-11-18', turno: 'MANANA', apuntado: false }] }, N_, VV);
  ver('visitas: quitarse de la mañana no toca la comida', !dv.apuntes.some(a => a.fecha === '2026-11-18' && a.turno === 'MANANA' && a.persona === N_) && dv.apuntes.some(a => a.fecha === '2026-11-18' && a.turno === 'COMIDA' && a.persona === N_));
}

// ---------- v5.32 (T0591): los errores de uso, en MESA_ERRORES y en Control ----------
{
  const r1 = R.api_('guardarPersona', [N_, { turnos: [{ fecha: '2026-11-18', turno: 'SIESTA', apuntado: true }] }, N_, V2], 'paella');
  ver('errores: la acción falla igual que antes', r1.ok === false && /Turno no válido/.test(r1.error));
  const fe = (hojas.MESA_ERRORES || { filas: [] }).filas;
  const ult = fe[fe.length - 1] || [];
  ver('errores: se crea la pestaña con su cabecera', (fe[0] || []).join() === 'CUANDO,QUIEN_ID,ACCION,ERROR,DETALLE');
  ver('errores: quién, qué acción, el error y lo que intentaba', ult[1] === N_ && ult[2] === 'guardarPersona' && /Turno no válido/.test(ult[3]) && /SIESTA/.test(ult[4]));
  const n0 = fe.length;
  R.api_('getDatos', [V2], 'otra');
  R.api_('guardarPersona', [M_, { alergias: 'x' }, M_, V2], 'otra');
  ver('errores: la clave de la familia (entrar o guardar) no se apunta', hojas.MESA_ERRORES.filas.length === n0);
  R.api_('accionQueNoExiste', [], 'paella');
  ver('errores: una acción que no existe, sí (sin quién)', hojas.MESA_ERRORES.filas.length === n0 + 1 && hojas.MESA_ERRORES.filas[n0][2] === 'accionQueNoExiste' && hojas.MESA_ERRORES.filas[n0][1] === '');
  const r2 = R.api_('getDatos', [V2], 'paella');
  ver('errores: lo que va bien no se apunta', r2.ok === true && hojas.MESA_ERRORES.filas.length === n0 + 1);
  const ajE = R.getAjustes(M_, 'higuera');
  ver('errores: Control los recibe, el último primero', Array.isArray(ajE.errores) && ajE.errores.length === 2 && ajE.errores[0].accion === 'accionQueNoExiste' && ajE.errores[1].quien === N_);
  // si la hoja falla, la respuesta llega igual
  const viejo = hojas.MESA_ERRORES; hojas.MESA_ERRORES = null;
  const ins = ss.insertSheet; ss.insertSheet = () => { throw new Error('sin permiso'); };
  const r3 = R.api_('guardarPersona', [N_, { turnos: [{ fecha: '2026-11-18', turno: 'SIESTA', apuntado: true }] }, N_, V2], 'paella');
  ver('errores: si no se puede apuntar, la respuesta llega igual', r3.ok === false && /Turno no válido/.test(r3.error));
  ss.insertSheet = ins; hojas.MESA_ERRORES = viejo;
}
// v5.32: los avisos de la web (lo que alguien hace mal en una ventana)
{
  const n0 = hojas.MESA_ERRORES.filas.length;
  const r = R.api_('avisoWeb', [N_, 'Busca y toca primero a quién quieres apuntar.', 'Jueves 19/11'], 'paella');
  const f = hojas.MESA_ERRORES.filas[n0] || [];
  ver('avisos de la web: se apuntan con quién, el aviso y la ventana', r.ok === true && f[1] === N_ && f[2] === 'web' && /Busca y toca/.test(f[3]) && f[4] === 'Jueves 19/11');
  const r2 = R.api_('avisoWeb', [N_, '   ', 'x'], 'paella');
  ver('avisos de la web: sin texto, no (y ese fallo tampoco se apunta como aviso vacío)', r2.ok === false && !hojas.MESA_ERRORES.filas.some(x => x[2] === 'web' && !String(x[3]).trim()));
  ver('avisos de la web: sin la clave, no se apuntan', R.api_('avisoWeb', [N_, 'algo', 'x'], 'otra').ok === false && hojas.MESA_ERRORES.filas.filter(x => x[3] === 'algo').length === 0);
  const ajW = R.getAjustes(M_, 'higuera');
  ver('avisos de la web: Control los recibe', ajW.errores.some(x => x.accion === 'web' && x.detalle === 'Jueves 19/11'));
}
// v5.32: Control nunca se queda corto en la semana, y el último error para el punto rojo
{
  const ultimoFila = hojas.MESA_ERRORES.filas[hojas.MESA_ERRORES.filas.length - 1][0];
  ver('punto rojo: quien lleva la web recibe cuándo fue el último error', R.getDatos(Object.assign({}, V2, { yo: M_ })).ultimoError === ultimoFila);
  ver('punto rojo: los demás, no', R.getDatos(Object.assign({}, V2, { yo: N_ })).ultimoError === '');
  // 1200 cambios de hoy: llegan todos (los 1000 últimos no bastarían para la semana)
  const hc = hojas.MESA_CAMBIOS;
  for (let i = 0; i < 1200; i++) hc.filas.push(['2026-11-13T09:' + String(i % 60).padStart(2, '0') + ':00', N_, 'Jan', 'Apunta a Jan a la comida del 20/11']);
  const ajC = R.getAjustes(M_, 'higuera');
  ver('Control: con más de 1000 cambios en la semana, llegan todos los de 14 días', ajC.cambios.filter(x => x.cuando.slice(0, 10) === '2026-11-13').length >= 1200);
  // y uno de hace un mes, más allá de los 1000 últimos, ya no
  hc.filas.splice(1, 0, ['2026-10-01T10:00:00', N_, 'Jan', 'Viejo']);
  ver('Control: lo de hace un mes, más allá de los 1000 últimos, no', !R.getAjustes(M_, 'higuera').cambios.some(x => x.cambio === 'Viejo'));
}
// v5.37 (T0623): los avisos al móvil de la abuela, con un Firebase falso
{
  const A_ = '(A) - Abuela';
  const props = {}, disparadores = [], llamadas = [];
  let HORA = 10, respuestaFcm = () => ({ codigo: 200, texto: '{"name":"projects/casa-abuela/messages/1"}' });
  ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) };
  ctx.ScriptApp.getProjectTriggers = () => disparadores.map(f => ({ getHandlerFunction: () => f }));
  ctx.ScriptApp.newTrigger = f => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => disparadores.push(f) }) }) });
  const fmt = ctx.Utilities.formatDate;
  ctx.Utilities.formatDate = (d, tz, f) => f === 'H' ? String(HORA) : fmt(d, tz, f);
  ctx.Utilities.base64EncodeWebSafe = x => Buffer.from(typeof x === 'string' ? x : Buffer.from(x)).toString('base64url') + '==';
  ctx.Utilities.computeRsaSha256Signature = () => [1, 2, 3];
  ctx.UrlFetchApp = { fetch: (url, o) => {
    llamadas.push({ url, o });
    if (/oauth2/.test(url)) return { getResponseCode: () => 200, getContentText: () => '{"access_token":"ya29.falso"}' };
    const r = respuestaFcm(JSON.parse(o.payload));
    return { getResponseCode: () => r.codigo, getContentText: () => r.texto };
  } };
  props.FCM_CUENTA = JSON.stringify({ project_id: 'casa-abuela', client_email: 'avisos@casa-abuela.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nfalsa\n-----END PRIVATE KEY-----\n' });
  const aFcm = () => llamadas.filter(l => /fcm\.googleapis/.test(l.url));
  const ultimoTexto = () => { const l = aFcm().slice(-1)[0]; return l ? JSON.parse(l.o.payload).message.data.texto : ''; };
  const MANANA = '2026-11-14';
  const apuntar = (id, fecha, turno, persona, extra) => hojas.MESA_APUNTES.filas.push([id, fecha, turno, persona, '', '', (extra || {}).estado || '', '', '', (extra || {}).mas || '']);

  ver('avisos: sin móviles, no se mira nada ni se manda', R.revisarAvisos() === 'Sin móviles' && !llamadas.length);
  let e = ''; try { R.activarAvisos('tok-mercedes', M_); } catch (x) { e = x.message; }
  ver('avisos: de momento, solo la abuela los activa', /solo son para la abuela/.test(e) && !hojas.MESA_AVISOS);
  e = ''; try { R.activarAvisos('  ', A_); } catch (x) { e = x.message; }
  ver('avisos: sin código del móvil, no', /código de avisos válido/.test(e));
  e = ''; try { R.activarAvisos('a b', A_); } catch (x) { e = x.message; }
  ver('avisos: un código con espacios, tampoco', /código de avisos válido/.test(e));

  R.activarAvisos('tok1', A_);
  ver('avisos: la abuela los activa: su móvil, en MESA_AVISOS', hojas.MESA_AVISOS.filas.length === 2 && hojas.MESA_AVISOS.filas[1][0] === 'tok1' && hojas.MESA_AVISOS.filas[1][1] === A_);
  ver('avisos: se crea el disparador de cada 5 minutos', disparadores.length === 1 && disparadores[0] === 'revisarAvisos');
  ver('avisos: la foto de ahora, para no avisar de lo que ya había', !!props.avisos_foto && JSON.parse(props.avisos_foto)[HOY] !== undefined);
  ver('avisos: queda en el registro de cambios', /Activa los avisos/.test(hojas.MESA_CAMBIOS.filas.slice(-1)[0][3]));
  R.activarAvisos('tok1', A_);
  ver('avisos: el mismo móvil otra vez no se repite (ni otro disparador)', hojas.MESA_AVISOS.filas.length === 2 && disparadores.length === 1);
  ver('avisos: sin cambios, no se manda nada', R.revisarAvisos() === 'Sin cambios' && !aFcm().length);

  apuntar('av1', MANANA, 'COMIDA', M_);
  apuntar('av2', HOY, 'CENA', J_, { mas: 2 });
  let r = R.revisarAvisos();
  const m = aFcm()[0] ? JSON.parse(aFcm()[0].o.payload).message : {};
  ver('avisos: un cambio de hoy y otro de mañana, un solo aviso', aFcm().length === 1 && m.token === 'tok1');
  ver('avisos: «Hoy: Jordi P (con 2 más) viene a cenar.» (con su apodo de ahora)', /^Hoy: .*Jordi P \(con 2 más\) viene a cenar\./.test(m.data.texto));
  ver('avisos: «Mañana: Mercedes viene a comer.»', /\nMañana: .*Mercedes viene a comer\./.test(m.data.texto));
  ver('avisos: con el título y el enlace a la web', m.data.titulo === 'Casa Abuela' && m.data.enlace === 'https://utilo-digital.github.io/casa-abuela/');
  ver('avisos: con permiso de Firebase de la cuenta de servicio', llamadas.some(l => /oauth2/.test(l.url)) && aFcm()[0].o.headers.Authorization === 'Bearer ya29.falso' && /projects\/casa-abuela\//.test(aFcm()[0].url));
  ver('avisos: se apunta cuándo se mandó', hojas.MESA_AVISOS.filas[1][3] === HOY + 'T10:00:00');
  ver('avisos: la segunda vez, sin cambios, nada', R.revisarAvisos() === 'Sin cambios' && aFcm().length === 1);

  hojas.MESA_APUNTES.filas.find(f => f[0] === 'av1')[6] = 'NO';
  R.revisarAvisos();
  ver('avisos: «Mercedes ya no viene a comer» mañana', aFcm().length === 2 && /Mañana: .*Mercedes ya no viene a comer\./.test(ultimoTexto()) && !/Hoy:/.test(ultimoTexto()));

  HORA = 23;
  apuntar('av3', MANANA, 'DORMIR', N_);
  ver('avisos: de noche, callado (y no se pierde)', R.revisarAvisos() === 'Callado' && aFcm().length === 2);
  HORA = 7;
  ver('avisos: a las 7, aún callado', R.revisarAvisos() === 'Callado');
  HORA = 8;
  R.revisarAvisos();
  ver('avisos: a las 8 llega lo de la noche', aFcm().length === 3 && /Jan viene a dormir/.test(ultimoTexto()));

  hojas.MESA_CONFIG.filas.push(['AVISOS_CALLA', 0], ['AVISOS_HABLA', 0]);
  HORA = 3;
  apuntar('av4', MANANA, 'TARDE', M_);
  R.revisarAvisos();
  ver('avisos: con AVISOS_CALLA y AVISOS_HABLA a 0, no se calla nunca', aFcm().length === 4 && /Mercedes viene por la tarde/.test(ultimoTexto()));
  hojas.MESA_CONFIG.filas.splice(-2, 2); HORA = 10;

  const cuenta = props.FCM_CUENTA; delete props.FCM_CUENTA;
  hojas.MESA_APUNTES.filas.find(f => f[0] === 'av4')[6] = 'NO';
  const nErr = hojas.MESA_ERRORES.filas.length;
  r = R.revisarAvisos();
  ver('avisos: sin la cuenta de Firebase, no manda, lo apunta y el móvil se queda', aFcm().length === 4 && /FCM_CUENTA/.test(hojas.MESA_AVISOS.filas[1][4]) && hojas.MESA_ERRORES.filas.length === nErr + 1 && hojas.MESA_ERRORES.filas[nErr][2] === 'avisos');
  props.FCM_CUENTA = cuenta;

  R.activarAvisos('tok2', A_);
  respuestaFcm = p => p.message.token === 'tok1' ? { codigo: 404, texto: '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}' } : { codigo: 200, texto: '{}' };
  apuntar('av5', HOY, 'COMIDA', N_);
  R.revisarAvisos();
  ver('avisos: un móvil que ya no los recibe se quita; el otro sí lo recibe', hojas.MESA_AVISOS.filas.slice(1).filter(f => f[0]).map(f => f[0]).join() === 'tok2' && aFcm().slice(-2).map(l => JSON.parse(l.o.payload).message.token).sort().join() === 'tok1,tok2');
  respuestaFcm = () => ({ codigo: 500, texto: 'Internal' });
  hojas.MESA_APUNTES.filas.find(f => f[0] === 'av5')[6] = 'NO';
  R.revisarAvisos();
  ver('avisos: si Firebase falla, el móvil se queda y se apunta el error', hojas.MESA_AVISOS.filas[1][0] === 'tok2' && /500/.test(hojas.MESA_AVISOS.filas[1][4]));
  respuestaFcm = () => ({ codigo: 200, texto: '{}' });

  // v5.38: la prueba desde el editor, y la revisión sin el bloqueo de los guardados
  respuestaFcm = () => ({ codigo: 200, texto: '{}' });
  const pedidos = [];
  ctx.ScriptApp.requireScopes = (modo, l) => pedidos.push(l);
  ctx.ScriptApp.AuthMode = { FULL: 'FULL' };
  const logs = []; const logViejo = ctx.console; ctx.console = { log: x => logs.push(x), warn: () => {} };
  const nP = aFcm().length;
  const rp = R.probarAvisos();
  ver('probarAvisos: manda la prueba a cada móvil y dice cómo ha ido', aFcm().length === nP + 1 && /Prueba: si ves esto/.test(ultimoTexto()) && /Abuela: mandado/.test(rp));
  ver('probarAvisos: pide el permiso de servicio externo si falta', pedidos.length === 1 && pedidos[0].includes('https://www.googleapis.com/auth/script.external_request'));
  ver('probarAvisos: el resultado sale en el registro del editor', logs.some(x => /Abuela: mandado/.test(x)));
  const viejoFetch = ctx.UrlFetchApp.fetch;
  ctx.UrlFetchApp.fetch = () => { throw new Error('No tienes permiso para llamar a UrlFetchApp.fetch.'); };
  const rp2 = R.probarAvisos();
  ver('probarAvisos: sin permiso, dice qué hacer y lo apunta en el móvil', /ejecuta probarAvisos/.test(rp2) && /ejecuta probarAvisos/.test(hojas.MESA_AVISOS.filas[1][4]));
  ctx.UrlFetchApp.fetch = viejoFetch; ctx.console = logViejo;
  const lockViejo = ctx.LockService.getScriptLock;
  ctx.LockService.getScriptLock = () => ({ tryLock: () => false, releaseLock: () => {} });
  apuntar('av6', HOY, 'MANANA', M_);
  R.revisarAvisos();
  ver('avisos: la revisión no espera a los guardados (ni se los quita)', /Mercedes viene por la mañana/.test(ultimoTexto()));
  ctx.LockService.getScriptLock = lockViejo;
  const cacheVieja = ctx.CacheService.getScriptCache;
  ctx.CacheService.getScriptCache = () => ({ get: k => (k === 'avisos_revisando' ? '1' : null), put: () => {}, remove: () => {} });
  ver('avisos: si ya hay otra revisión en marcha, no se repite', R.revisarAvisos() === 'Ocupado');
  ctx.CacheService.getScriptCache = cacheVieja;
  R.quitarAvisos('tok2', A_);
  ver('avisos: al quitarlos, el móvil sale de la lista', !hojas.MESA_AVISOS.filas.slice(1).some(f => f[0]) && /Quita los avisos/.test(hojas.MESA_CAMBIOS.filas.slice(-1)[0][3]));
  ver('avisos: quitar uno que no está, no pasa nada', R.quitarAvisos('no-existe', A_) === true);

  // el texto y los cambios, solos
  const g = { a: { apodo: 'Marta' }, b: { apodo: 'Pablo' }, c: { apodo: 'Rosa', familia: 'Servicio' } };
  let t = R.textoAvisos_([{ fecha: HOY, turno: 'CENA', id: 'a', que: 'viene', mas: 0 }, { fecha: HOY, turno: 'CENA', id: 'b', que: 'viene', mas: 1 }], { [HOY]: { CENA: { a: 0, b: 1 } } }, HOY, g);
  ver('avisos (texto): dos que vienen, en plural', t === 'Hoy: Marta y Pablo (con 1 más) vienen a cenar.');
  t = R.textoAvisos_([{ fecha: MANANA, turno: 'COMIDA', id: 'a', que: 'no', mas: 0 }], { [MANANA]: { COMIDA: { c: 0 } } }, HOY, g);
  ver('avisos (texto): si solo queda el servicio, «No queda nadie para comer»', t === 'Mañana: Marta ya no viene a comer. No queda nadie para comer.');
  t = R.textoAvisos_([{ fecha: MANANA, turno: 'DORMIR', id: 'a', que: 'no', mas: 0 }], { [MANANA]: { DORMIR: { c: 0 } } }, HOY, g);
  ver('avisos (texto): para dormir, el servicio sí cuenta', t === 'Mañana: Marta ya no viene a dormir.');
  t = R.textoAvisos_([{ fecha: HOY, turno: 'COMIDA', id: 'b', que: 'mas', mas: 0 }, { fecha: HOY, turno: 'TARDE', id: 'a', que: 'mas', mas: 3 }], {}, HOY, g);
  ver('avisos (texto): cambian los que vienen con alguien', t === 'Hoy: Pablo viene a comer sin nadie más. Marta viene por la tarde con 3 más.');
  t = R.textoAvisos_([{ fecha: HOY, turno: 'COMIDA', id: '(N) - Desconocido', que: 'viene', mas: 0 }], {}, HOY, {});
  ver('avisos (texto): alguien que ya no está en la lista, por su apodo', t === 'Hoy: Desconocido viene a comer.');
  const c = R.cambiosAvisos_({ '2026-11-13': { CENA: { a: 0 } }, '2026-11-14': { COMIDA: { a: 0 } } }, { '2026-11-14': { COMIDA: { a: 0, b: 0 } }, '2026-11-15': { COMIDA: { c: 0 } } });
  ver('avisos (cambios): al cambiar de día, solo se compara lo que está en las dos fotos', c.length === 1 && c[0].id === 'b' && c[0].fecha === '2026-11-14' && c[0].que === 'viene');
  ver('avisos (cambios): fotos iguales, nada', R.cambiosAvisos_({ x: { CENA: { a: 2 } } }, { x: { CENA: { a: 2 } } }).length === 0);
}
