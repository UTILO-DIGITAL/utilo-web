/*
 * AJUSTES DE LA DEMO · Barbería Tallat (T0029)
 *
 * Aquí está todo lo que se puede cambiar de la demo sin tocar el resto del código:
 * el negocio, el horario, los barberos, los servicios y precios, el cliente de ejemplo,
 * las cifras del mes y los textos de los WhatsApp.
 * Los colores, la letra y las esquinas están en marca.css.
 *
 * Cómo editar sin romper nada:
 * - Cambia solo lo que va entre comillas '…' y los números.
 * - No borres las comas del final de cada línea, ni los corchetes [ ] ni las llaves { }.
 * - Si un texto lleva un apóstrofo, escríbelo así: \'  (por ejemplo 'l\'Eixample').
 * - En los mensajes, lo que va entre llaves se rellena solo:
 *   {cliente} {barbero} {servicio} {precio} {dia} {diaSemana} {hora} {cuando} {semanas} {negocio} {calle} {barrio}
 * - Para añadir un barbero o un servicio, copia una línea entera de su lista (con su coma) y cámbiala.
 *
 * Guía completa: COMO-EDITAR.md, en esta misma carpeta.
 */
var AJUSTES = {

  /* ---------- El negocio ---------- */
  negocio: 'Barbería Tallat',      // nombre completo: sale en los WhatsApp, el calendario y las fichas
  logo: 'tallat',                  // palabra del logo; el punto de color se añade solo
  tipo: 'Barbería',                // va debajo del logo: «Barbería · Sant Antoni»
  calle: 'Carrer de Manso',
  barrio: 'Sant Antoni',
  ciudad: 'Barcelona',
  pago: 'Tarjeta o efectivo',

  /* ---------- Horario ---------- */
  horario: {
    abre: '10:00',
    cierra: '20:30',
    dias: ['martes', 'miércoles', 'jueves', 'viernes', 'sábado'],   // días que abre, en minúscula y con tilde
    texto: 'Martes a sábado'                                        // cómo se lee en la app
  },

  /* ---------- Barberos ---------- */
  barberos: [
    { nombre: 'Toni',    especialidad: 'Cortes clásicos y a tijera' },
    { nombre: 'Marc',    especialidad: 'Barba y afeitado a navaja' },
    { nombre: 'Yassine', especialidad: 'Degradados y diseños' }
  ],

  /* ---------- Servicios ----------
     «corto» es el nombre que cabe en el cuadrante del mostrador. Los minutos marcan cuánto ocupa la cita. */
  servicios: [
    { nombre: 'Corte',          corto: 'Corte',       minutos: 30, precio: 16 },
    { nombre: 'Corte y barba',  corto: 'Corte+barba', minutos: 45, precio: 22 },
    { nombre: 'Barba',          corto: 'Barba',       minutos: 20, precio: 10 },
    { nombre: 'Rapado',         corto: 'Rapado',      minutos: 20, precio: 12 },
    { nombre: 'Corte infantil', corto: 'Infantil',    minutos: 30, precio: 13 }
  ],

  /* ---------- El cliente con el que empieza la demo ----------
     «cortes» va del más reciente al más antiguo. «haceDias»: cuántos días hace de ese corte.
     «barbero» y «servicio» tienen que llamarse igual que en las listas de arriba. */
  clienteHabitual: {
    nombre: 'Jordi',
    movil: '612345218',
    cadaSemanas: 4,
    cortes: [
      { haceDias: 26, barbero: 'Toni', servicio: 'Corte y barba', hora: '11:30', nota: 'Degradado bajo, arriba a tijera y barba perfilada' },
      { haceDias: 54, barbero: 'Toni', servicio: 'Corte y barba', hora: '18:00', nota: 'Igual que la otra vez, un poco más corto de lados' },
      { haceDias: 83, barbero: 'Marc', servicio: 'Corte',         hora: '17:00', nota: 'Primera visita' }
    ]
  },

  /* ---------- Cifras del mes en el mostrador (de ejemplo; suben con lo que se hace en la demo) ---------- */
  cifrasDelMes: {
    reservasSinLlamar: 64,
    whatsappEnviados: 132,
    ausenciasEvitadas: 9,
    resenasPedidas: 17
  },

  /* ---------- Textos de los WhatsApp ---------- */
  mensajes: {
    confirmacion: 'Hola {cliente}, tu cita está confirmada.\n\n{dia}, {hora}\n{servicio} con {barbero} · {precio}\n{calle}, {barrio}',
    cambiada: 'Hola {cliente}, tu cita está cambiada.\n\n{dia}, {hora}\n{servicio} con {barbero} · {precio}\n{calle}, {barrio}',
    recordatorio: 'Hola {cliente}, te recordamos tu cita de {cuando} a las {hora} con {barbero}. ¿Vienes?',
    botonesRecordatorio: ['Sí, ahí estaré', 'Cambiar la hora', 'Anular la cita'],
    confirmada: 'Perfecto, {cliente}. Te esperamos el {diaSemana} a las {hora}.',
    cambiar: 'Sin problema, {cliente}. Elige otra hora y te la cambiamos.',
    anulada: 'Cita anulada. Hemos dejado libre el hueco de las {hora} para otro cliente. Gracias por avisar, {cliente}.',
    pedirFoto: '¿Qué tal con {barbero}? Mándanos una foto o un vídeo de cómo te ha quedado: lo guardamos en tus cortes para la próxima vez.',
    botonFoto: 'Añadir foto o vídeo',
    fotoGuardada: 'Guardado en tus cortes. La próxima vez {barbero} lo tendrá delante.',
    pedirResena: 'Y si te ha gustado, nos ayudas mucho con una reseña en Google.',
    botonResena: 'Escribir reseña',
    yaTeToca: 'Hola {cliente}, ya hace {semanas} semanas de tu último corte con {barbero}. ¿Te guardo el {diaSemana} {diaMes} a las {hora}, como la otra vez?',
    botonesYaTeToca: ['Sí, guárdamela', 'Otro día'],
    vuelta: 'Hecho. Te esperamos el {dia} a las {hora} con {barbero}.',
    otroDia: 'Sin problema. Cuando te vaya bien, elige día y hora.'
  }
};
