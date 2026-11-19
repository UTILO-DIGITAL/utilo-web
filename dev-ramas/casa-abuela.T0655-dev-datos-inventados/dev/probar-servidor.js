// Prueba del servidor de mentira de DEV (T0655): node dev/probar-servidor.js
// Lo ejecuta como en el navegador (vm, con fetch de los archivos de la rama y un localStorage) y mira que la web tendría
// lo suyo: la familia inventada, sus apuntes alrededor de hoy, el evento y la excursión, quién es cada uno y que lo
// cambiado se queda.
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.join(__dirname, '..');
const ver = (t, ok) => { console.log((ok ? '✔ ' : '✘ ') + t); if (!ok) process.exitCode = 1; };

function navegador(hash, guardado) {
  const datos = new Map(Object.entries(guardado || {}));
  const w = {
    location: { href: 'https://x.github.io/utilo-web/dev-ramas/casa-abuela.main/' + (hash || ''), hash: hash || '', pathname: '/utilo-web/dev-ramas/casa-abuela.main/', search: '' },
    addEventListener: (n, f) => { (w.oyentes[n] = w.oyentes[n] || []).push(f); }, oyentes: {},
    history: { replaceState: (a, b, u) => { w.location.hash = ''; w.limpio = u; } },
    localStorage: { getItem: k => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: k => datos.delete(k) },
    fetch: u => {
      const f = path.join(RAIZ, decodeURIComponent(new URL(u).pathname.replace('/utilo-web/dev-ramas/casa-abuela.main/', '')));
      return Promise.resolve({ ok: fs.existsSync(f), status: fs.existsSync(f) ? 200 : 404, text: () => Promise.resolve(fs.readFileSync(f, 'utf8')) });
    },
    document: { currentScript: { src: 'https://x.github.io/utilo-web/dev-ramas/casa-abuela.main/dev/servidor.js' } },
    setTimeout: (f) => setImmediate(f), URL, Promise, Intl, Date, Math, JSON, console: { warn: (...a) => console.log('   aviso:', ...a), log: () => {} },
    decodeURIComponent,
  };
  w.window = w; w.self = w;
  vm.createContext(w);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'servidor.js'), 'utf8'), w);
  return { w, datos };
}
const iso = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }); };
const V = yo => ({ desde: iso(-7), hasta: iso(14), yo });

(async () => {
  const a = navegador('#carmen');
  ver('#carmen: elige a Carmen, quita los datos de antes y limpia la dirección', a.datos.get('mesa-abuela-yo') === '(T) - Carmen' && a.w.location.hash === '' && a.w.limpio === '/utilo-web/dev-ramas/casa-abuela.main/');
  ver('MESA_PREVIEW, como la API', !!(a.w.MESA_PREVIEW && a.w.MESA_PREVIEW.llamar));
  const d = await a.w.MESA_PREVIEW.llamar('getDatos', [V('(T) - Carmen')], '');
  ver('la familia inventada (sin la abuela, que no cuenta)', ['(T) - Carmen', '(T+1) - Luis', '(N) - Pablo', '(N) - Lucía', '(T) - Elena', '(N) - Marcos', '(O) - Rosa'].every(id => d.personas.some(p => p.id === id)));
  ver('nada de la familia de verdad', !JSON.stringify(d).match(/Mercedes|Jordi|Jan\b/));
  ver('apuntes de antes y de después de hoy', d.apuntes.some(x => x.fecha < iso(0)) && d.apuntes.some(x => x.fecha > iso(0)));
  const mie = [1, 2, 3, 4, 5, 6, 7].map(iso).find(f => new Date(f + 'T12:00:00Z').getUTCDay() === 3);
  const otroMie = [8, 9, 10, 11, 12, 13, 14].map(iso).find(f => new Date(f + 'T12:00:00Z').getUTCDay() === 3);
  const come = f => d.apuntes.some(x => x.fecha === f && x.turno === 'COMIDA' && x.persona === '(T) - Carmen');
  ver('Carmen, fija los miércoles, dice que no al próximo (y al otro sí va)', !come(mie) && come(otroMie));
  ver('una nota de Pablo, mañana', d.apuntes.some(x => x.persona === '(N) - Pablo' && x.fecha === iso(1) && x.nota === 'Llego tarde' && x.notaPor === 'Pablo'));
  ver('Carmen trae a alguien más algún día', d.apuntes.some(x => x.persona === '(T) - Carmen' && x.acompanantes === 1));
  ver('Rosa, del servicio, duerme sus días fijos', d.apuntes.some(x => x.persona === '(O) - Rosa' && x.turno === 'DORMIR' && x.fijo));
  ver('el cumpleaños de Luis, en su día', JSON.stringify(d).includes('Cumpleaños de Luis'));
  const p = id => d.personas.find(x => x.id === id) || {};
  ver('el cumple de Luis cae el día del evento', p('(T+1) - Luis').cumple === iso(5).slice(8, 10) + '/' + iso(5).slice(5, 7));
  ver('quién es quién: Carmen, mujer e hija de la abuela, casada con Luis; Pablo, hijo de Carmen', p('(T) - Carmen').sexo === 'Mujer' && p('(T) - Carmen').hijoDe === '(A) - Abuela' &&
    p('(T) - Carmen').pareja === '(T+1) - Luis' && p('(T) - Carmen').casados === 'Sí' && p('(N) - Pablo').hijoDe === '(T) - Carmen' && p('(N) - Marcos').hijoDe === '(T) - Elena');
  const ex = (d.eventos || []).find(e => e.nombre === 'Excursión a la sierra');
  ver('la excursión, con quién va y quién no', !!ex && ex.van.includes('(T) - Carmen') && ex.van.includes('(N) - Pablo') && (ex.noVan || ex.no_van || []).includes('(T) - Elena'));
  let err = ''; try { await a.w.MESA_PREVIEW.llamar('noExiste', [], ''); } catch (e) { err = e.message; }
  ver('un error del Apps Script llega a la web como error', /Acción no válida/.test(err));
  await a.w.MESA_PREVIEW.llamar('guardarDia', [iso(1), { nota: 'Nota de DEV' }, '(T) - Carmen', V('(T) - Carmen')], '');
  ver('lo que se cambia se guarda en el dispositivo', /Nota de DEV/.test(a.datos.get('casa-abuela-dev-hojas') || ''));

  const b = navegador('#abuela', Object.fromEntries(a.datos));
  const d2 = await b.w.MESA_PREVIEW.llamar('getDatos', [V('(A) - Abuela')], '');
  ver('al volver, sigue ahí (y ahora soy la abuela)', JSON.stringify(d2).includes('Nota de DEV') && b.datos.get('mesa-abuela-yo') === '(A) - Abuela');
  const c = navegador('#datos-nuevos', Object.fromEntries(a.datos));
  const d3 = await c.w.MESA_PREVIEW.llamar('getDatos', [V('(T) - Carmen')], '');
  ver('#datos-nuevos: vuelve a empezar', !JSON.stringify(d3).includes('Nota de DEV') && JSON.stringify(d3).includes('Cumpleaños de Luis'));
  const f = navegador('');
  let recargada = false; f.w.location.reload = () => { recargada = true; };
  f.w.location.hash = '#semana'; (f.w.oyentes.hashchange || []).forEach(x => x());
  ver('con la página abierta, #semana no recarga', !recargada);
  f.w.location.hash = '#datos-nuevos'; (f.w.oyentes.hashchange || []).forEach(x => x());
  ver('con la página abierta, #datos-nuevos o #pablo la recargan', recargada);
  const e = navegador('#semana');
  ver('un # de la web (#semana) no se toca', e.w.location.hash === '#semana' && !e.datos.has('mesa-abuela-yo'));
})();
