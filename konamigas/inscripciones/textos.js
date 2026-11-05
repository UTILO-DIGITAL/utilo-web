/*
 * web/konamigas/inscripciones/textos.js · T0335 · Los textos de la página de inscripciones de Konamigas, en cada idioma
 *
 * Copiados de los formularios de Google que se usaban hasta la temporada 26-27 («INSCRIPCIONES EQUIPOS» e «INSCRIPCIONES
 * JUGADORAS», de konamigasbarcelona) y de la normativa (PDF «2026-05_Konamigas_Normativa_v1»). Lo que depende de la
 * temporada (competiciones, precio, lo que incluye, días, sedes, horas, señal, equipos) no está aquí: sale de los Excel.
 * Javi: castellano, catalán e inglés (window.INS_TEXTOS.es, .ca y .en, con las mismas claves). Un texto que falta en un
 * idioma sale en castellano. {X} es un hueco que rellena la página.
 * WHATSAPP: el número de Konamigas para dudas (solo cifras, con el 34; Javi, 02/11/2026). Vacío: el botón de WhatsApp no sale.
 */
window.INS_TEXTOS = {
  WHATSAPP: '34613072544',
  INSTAGRAM: 'https://www.instagram.com/konamigasbarcelona/',
  idiomas: { es: 'Castellano', ca: 'Català', en: 'English' }
};

window.INS_TEXTOS.es = {
  dias: { Lunes: 'Lunes', Martes: 'Martes', Miércoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes', Sábado: 'Sábado', Domingo: 'Domingo' },
  meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  general: {
    cabecera: 'Inscripciones', privacidad: 'Leer la política de privacidad', faltaDato: 'Falta este dato.', y: 'y', cargando: 'Cargando…', volver: 'Volver al inicio', falta: 'Falta', opcional: 'opcional', resumen: 'Resumen', faltan: 'Faltan {N}', faltaUno: 'Falta 1', ver: 'Ver',
    listo: 'Todo listo para enviar', enviando: 'Enviando… puede tardar unos segundos', revisa: 'Revisa lo que está marcado en rojo.',
    sinConexion: 'No hay conexión. Comprueba internet y vuelve a enviarlo.', reintentar: 'Volver a intentarlo',
    noAbierta: 'Las inscripciones todavía no están abiertas. Vuelve a mirar pronto o escríbenos por Instagram.',
    sinCompeticiones: 'Ahora mismo no hay ninguna competición con inscripciones abiertas.',
    borrador: 'Seguimos donde lo dejaste.', deCero: 'Empezar de cero', copiar: 'Copiar', copiado: 'Copiado', porWhatsapp: 'Enviarlo por WhatsApp',
    temporada: 'Temporada {T}', porEquipo: 'por equipo', iva: '+ IVA', precioConfirmar: 'Precio por confirmar', buscar: 'Escribe para buscarlo',
    nada: 'No encontramos ese equipo.', si: 'Sí', no: 'No', cambiar: 'Cambiar', contacto: 'Escríbenos por WhatsApp', instagram: 'Instagram',
    dia: 'Día', mes: 'Mes', ano: 'Año', idiomaPregunta: '¿En qué idioma prefieres que te escribamos?'
  },
  plazas: { libre: 'Quedan plazas', ultimas: 'Últimas plazas', completo: 'Completo · lista de espera', ultimasCorto: 'últimas plazas', completoCorto: 'completo' },
  detalle: { precio: 'Precio', incluye: 'Incluye', fechas: 'Fechas', dias: 'Días', horario: 'Horario', del: 'Del {A} al {B}' },
  incluye: { partidos: '{N} partidos de liga por equipo', copa: 'Copa eliminatoria incluida', otra: '{X} incluida', equipacion: 'Equipación oficial para cada jugadora' },
  horarios: 'Un día fijo a la semana. Los horarios son rotativos: cada semana a una hora distinta{HORAS}, para que todas juguéis a todas las horas.',
  horasEntre: ', entre las {A} y las {B}', horasA: ', a las {A}',

  portada: {
    sup: 'Bienvenidas a una nueva temporada de las mejores ligas del mundo',
    titulo: 'Inscribe a tu equipo',
    para: 'Elige la competición y rellena la inscripción del equipo (la capitana, una vez). Al acabar te damos el enlace para que cada jugadora haga la suya.',
    boton: 'Inscribir a mi equipo',
    jugadora: '¿Tu equipo ya está inscrito?', jugadoraBoton: 'Inscríbete como jugadora',
    banco: 'Banco de jugadoras y equipos', bancoPara: '¿Buscas equipo o le faltan jugadoras al tuyo? Mira quién busca.', bancoBoton: 'Ver el banco',
    faq: 'Dudas frecuentes',
    preguntas: [
      ['¿Y si todavía no somos suficientes?', 'Inscribid el equipo igual: se juega con 5 (y hacen falta 4 para empezar). Podéis buscar refuerzos en el banco de jugadoras y equipos, y os ayudamos.'],
      ['¿Cuándo empieza?', 'Cada competición tiene sus fechas en su tarjeta, arriba. Cuando confirmemos vuestra plaza, os decimos la liga, el día y el calendario.'],
      ['¿Cómo se paga?', 'Al inscribir el equipo os pedimos la paga y señal para reservar la plaza. El resto, más adelante. Lo paga el equipo, no cada jugadora.'],
      ['¿Y si un día no podemos ir?', 'Avisad cuanto antes a vuestro gestor. Los partidos no se anulan: mirad las normas para los aplazamientos y las sanciones.'],
      ['Soy jugadora y no tengo equipo', 'Inscríbete como jugadora y marca «No tengo equipo»: te buscamos uno de tu nivel. También puedes mirar el banco.']
    ]
  },

  equipo: {
    titulo: 'Inscribir a mi equipo', para: 'Lo rellena la capitana, una vez por equipo.',
    competicion: 'Competición', competicionAyuda: '¿En qué liga os queréis inscribir?',
    jugado: '¿Habéis jugado antes en Konamigas?', jugadoSi: 'Sí', jugadoNo: 'No, somos nuevas',
    anterior: '¿Cuál era vuestro equipo?', anteriorAyuda: 'Sale con la última temporada y la liga en que jugó, por si hay dos con el mismo nombre. Si sois la unión de varios equipos, elegid uno y contadlo en los comentarios.',
    buscarAnterior: 'Escribe el nombre de tu equipo', yaInscrito: 'Ya está inscrito en esta competición', sinTemporadas: 'Sin temporadas jugadas', noAnterior: 'No encontramos ese equipo. Escribe otra parte del nombre o marca «No, somos nuevas».',
    nombre: 'Nombre del equipo', nombreAyuda: 'Máximo 20 caracteres, espacios incluidos. Se podrá cambiar más adelante. Si dos equipos eligen el mismo nombre, se queda el que antes complete la inscripción. Por ejemplo: AMIGAS DEL COLE ✅, PELOTUDAS ✅, LAS MAS AMAS DE BCN FC ❌ (22 caracteres).',
    capitana: 'Nombre y apellido de la capitana', telefono: 'Teléfono de la capitana', email: 'Email de la capitana', emailAyuda: 'Te enviaremos aquí lo de la inscripción.',
    cuantas: '¿Cuántas sois?', cuantasAyuda: 'Más o menos: nos ayuda a saber si os llega y a prever las camisetas.',
    nivel: 'Nivel del equipo', nivelAyuda: 'La idea es agruparos con equipos de vuestro mismo nivel :)', nivelExtremos: ['Empezando', 'Muy competitivas'],
    dias: 'Día e instalación', diasAyuda: 'Marca el día o los días que os iría bien jugar.', esperaAyuda: 'Un día completo también se puede marcar: os apuntamos en la lista de espera por si queda un hueco.',
    horasAyuda: 'Si hay algo que tengamos que saber sobre vuestros horarios, escríbelo en los comentarios.', disponible: 'Disponible',
    busca: '¿Buscáis jugadoras?', buscaAyuda: 'Si decís que sí, vuestro equipo sale en el banco y las que buscan equipo os pueden encontrar.', buscaCuantas: '¿Cuántas os faltan?',
    factura: '¿Necesitáis factura?', facturaAyuda: 'Por ejemplo, si lo paga una empresa.', facturaNombre: 'Nombre o razón social', facturaNif: 'NIF o CIF', facturaDireccion: 'Dirección fiscal', facturaEmail: 'Email para la factura',
    comentarios: '¿Algo que comentar?', comentariosAyuda: 'Cualquier comentario, propuesta o crítica es bienvenida.',
    boton: 'Inscribir al equipo', enviando: 'Inscribiendo…',
    gracias: '¡Gracias infinitas!', inscrito: '¡Equipo inscrito!', enEspera: '¡Estáis en la lista de espera!',
    esperaTodo: 'Los días que habéis elegido ({D}) están completos: estáis en la lista de espera y os escribimos en cuanto haya plaza.', esperaAlgunos: 'Algún día de los que habéis elegido está completo ({D}): para ese, estáis en la lista de espera.',
    graciasEspera: 'Todavía no os pedimos la paga y señal: os escribimos a la capitana en cuanto haya plaza.',
    graciasTexto: 'Nos pondremos en breve en contacto con la capitana para confirmar la disponibilidad. Entonces os pediremos la paga y señal{SENAL} para confirmar la plaza y la inscripción.',
    siguiente: 'Ahora, cada jugadora del equipo (también la capitana) tiene que rellenar su inscripción. Pásales este enlace:',
    mensaje: '¡Hola equipo! Para completar la inscripción de {EQUIPO} en Konamigas, cada una tiene que rellenar la suya aquí: {URL}',
    laMia: 'Rellenar ahora la mía',
    errores: { largo: 'Tiene {N} caracteres: como mucho 20.', yaInscrito: 'Ya hay un equipo «{E}» inscrito en esta competición. Si es el vuestro, no hace falta volver a hacerlo; si no, elegid otro nombre.',
      nif: 'Revisa el NIF o CIF: de 8 a 12 letras y cifras.', capitana: 'Escribe su nombre y su apellido.', dias: 'Marca al menos un día.', anterior: 'Elige vuestro equipo de la lista o busca su nombre.', jugado: 'Elige sí o no.', nivel: 'Elige el nivel.' },
    resumen: { competicion: 'Competición', otros: 'Equipo anterior', nuevas: 'Somos nuevas', buscan: 'Os faltan', factura: 'Factura', nombre: 'Nombre', capitana: 'Capitana', telefono: 'Teléfono', email: 'Email', nivel: 'Nivel', dias: 'Días', precio: 'Precio' }
  },

  jugadora: {
    titulo: 'Inscribirme como jugadora', para: 'Obligatorio para cada jugadora, también la capitana.', paga: 'La inscripción la paga el equipo: tú no tienes que pagar nada aquí.',
    repetir: '¿Necesitas cambiar algo? Vuelve a rellenarlo con el mismo teléfono y guardaremos tu última respuesta.',
    competicionAyuda: '¿En qué competición quieres jugar?', teInscribes: 'Te inscribes en', enlaceOtro: '¿No es tu equipo?',
    tienes: '¿Tienes equipo?', conEquipo: 'Tengo equipo', conEquipoAyuda: 'Lo eliges de la lista de equipos inscritos.',
    sinEquipo: 'No tengo equipo: busco uno', sinEquipoAyuda: 'Solo tus datos de contacto: Konamigas te busca un equipo de tu nivel.',
    equipo: 'Tu equipo', equipoAyuda: 'Busca tu equipo por su nombre.', noSale: '¿No sale tu equipo? Tu capitana tiene que inscribirlo primero.', noSaleCapitana: 'Soy la capitana: inscribir al equipo',
    todaviaNadie: 'Todavía no hay equipos inscritos en esta competición.',
    datos: 'Tus datos', nombre: 'Nombre', nombreAyuda: 'Solo el nombre; los apellidos, abajo.', apellido1: 'Primer apellido', apellido2: 'Segundo apellido',
    nacimiento: 'Fecha de nacimiento', documento: 'DNI, NIE o pasaporte', telefono: 'Teléfono (móvil)', email: 'Email', emailAyuda: 'Con este email podrás entrar más adelante a ver tu perfil.',
    email2: 'Repite tu email', email2Ayuda: 'Para que no se cuele ninguna errata.', instagram: 'Usuario de Instagram', instagramAyuda: 'Síguenos en @konamigasbarcelona, que queremos crear mucho mucho contenido sobre vosotras.',
    camiseta: 'Tu camiseta', eligeEquipo: 'Elige primero tu equipo.', mirando: 'Mirando los dorsales libres…',
    inscritas: 'Ya inscritas ({N})', primera: 'Todavía no se ha inscrito nadie de tu equipo: ¡eres la primera!', capitanaEt: 'capitana',
    dorsal: 'Dorsal y talla', dorsalAyuda: 'Con tu inscripción tienes incluida tu camiseta oficial. Estas son las combinaciones de dorsal y talla que quedan libres en tu equipo.',
    dorsalOtro: 'Otra combinación de dorsal y talla', dorsalOtroAyuda: 'Cualquier camiseta fuera de las combinaciones de la lista tiene un suplemento de 10 €.', cogidos: 'Ya están cogidos: {L}.',
    dorsalSolo: 'Dorsal', talla: 'Talla', tallaElige: 'Elige tu talla', tallaEt: 'Talla {T}',
    packIncluida: 'El {D} con talla {T} está incluido en tu inscripción, no se paga: lo hemos marcado en la lista.',
    packOtraTalla: 'El {D} solo va incluido en talla {T}. En talla {U} pagas 10 € más.', suplemento: 'Esta combinación no está en el pack: pagas 10 € más.',
    suplementoHecho: 'Tu camiseta va fuera del pack: lleva un suplemento de 10 €.', verTodos: 'Ver los {N} equipos', aceptado: 'Aceptado',
    sinColor: 'El color, cuando el equipo esté confirmado', tuColor: 'Vuestro color',
    busco: 'Para buscarte equipo', buscoAyuda: 'Con esto te buscamos un equipo de tu nivel y de tus días. Cuando lo tengamos, te enviamos el enlace para completar la inscripción (camiseta, normas y lo demás).',
    tuNivel: 'Tu nivel', tusDias: 'Días que te van bien', portera: 'Juego de portera', enBanco: 'Que los equipos que buscan jugadoras me vean en el banco (mi nombre con la inicial del apellido, mi edad aproximada, mi nivel y mis días)',
    bancoTelefono: 'Y que me puedan escribir por WhatsApp (se verá mi teléfono)',
    interesan: 'Te interesan estos equipos: se lo diremos.', quitar: 'Quitar',
    derechos: 'Derechos y responsabilidades', aceptarTodo: 'Aceptar normas, datos y exención', seguro: 'Quiero información del seguro médico opcional',
    ultimo: 'Por último', conocio: '¿Cómo conociste Konamigas?', conocioElige: 'Elige una', conocioOpciones: ['Amigas', 'Redes sociales', 'Internet', 'Otro'],
    comentarios: '¿Algo más que contarnos?', comentariosAyuda: 'Propuestas nuevas, críticas constructivas, piropos a los árbitros, reflexiones personales, dudas, consejos… etcétera.',
    boton: 'Enviar mi inscripción', botonBusco: 'Apuntarme para buscar equipo',
    gracias: '¡Gracias!', inscrita: '¡Ya estás inscrita en {EQUIPO}!', apuntadaTitulo: '¡Apuntada!', apuntada: 'Te escribiremos en cuanto tengamos un equipo para ti, con el enlace para completar la inscripción.',
    guardada: 'Hemos guardado tu última respuesta.', tuCamiseta: 'Tu camiseta: dorsal {D}, talla {T}.',
    ahora: 'Y ahora', ahoraTexto: ['La inscripción la paga el equipo: lo habla Konamigas con vuestra capitana.', 'Tu camiseta va en el pedido del equipo: te la damos en la pista.', 'Te escribiremos al teléfono y al email que has puesto.'],
    compartir: '¿Falta alguien de tu equipo? Pásale el enlace:', mensaje: '¡Hola! Para inscribirte en {EQUIPO} en Konamigas, rellena esto: {URL}',
    otra: 'Inscribir a otra jugadora',
    resumen: { competicion: 'Competición', equipo: 'Equipo', busco: 'Busco equipo', nombre: 'Nombre', nacimiento: 'Nacimiento', documento: 'Documento', dias: 'Días', interesan: 'Te interesan', mas10: '+10 €', telefono: 'Teléfono', email: 'Email', nivel: 'Nivel', camiseta: 'Camiseta', camisetaV: 'Dorsal {D} · Talla {T}', datos: 'Datos', aceptado: 'Aceptado', todo: 'Todo', deN: '{A} de {B}' },
    errores: {
      dorsalNumero: 'El dorsal es un número del 0 al 99.', dorsalCogido: 'El {D} ya lo tiene otra jugadora de tu equipo. Elige otro.',
      fecha: 'Revisa tu fecha de nacimiento.', fechaNoExiste: 'Esa fecha no existe.', tienes: 'Dinos si tienes equipo.', equipo: 'Elige tu equipo de la lista.', combinacion: 'Elige tu dorsal y tu talla.', nivel: 'Elige tu nivel.', dias: 'Marca al menos un día.', aceptaUna: 'Hay que aceptarlo para inscribirse.', edad: 'Para jugar en Konamigas hay que tener {N} años cumplidos.',
      email: 'Revisa tu email: tiene que ser como nombre@dominio.com, sin espacios.', email2: 'Los dos emails no son iguales.',
      telEs: 'Un móvil de España tiene 9 cifras y empieza por 6 o 7 (o un fijo, por 8 o 9).', telOtro: 'Revisa el número: solo cifras, sin el prefijo.',
      docLetra: 'La letra de tu {T} no cuadra con el número: revísalo.', docSinLetra: 'A tu DNI le falta la letra.', doc: 'Revisa tu DNI, NIE o pasaporte.',
      acepta: 'Para que la inscripción valga tienes que aceptar la normativa, tus datos y la exención de responsabilidad.', aceptaDatos: 'Para apuntarte tienes que aceptar el tratamiento de tus datos.'
    }
  },

  acepta: {
    ACEPTA_NORMAS: { titulo: 'Normas Konamigas', texto: 'Importante leer este apartado: se explican, entre otras cosas, las sanciones por faltas de asistencia. Si no la aceptas, la inscripción no vale.',
      enlace: 'https://drive.google.com/file/d/16hRQg1K7QZDiVFh_m4EttVnqn6GII8Sy/view', leer: 'Leer la normativa', pdf: 'Abrir el PDF de la normativa', si: 'He leído y acepto la normativa', obligatoria: true },
    ACEPTA_DERECHOS_IMAGEN: { titulo: 'Derechos de imagen', texto: 'Para destacar la emoción de la liga Konamigas, hacemos fotos y vídeos de los partidos y actividades para nuestras redes sociales y para contenido promocional en nuestras plataformas. Si lo aceptas, podremos publicar las imágenes en las que salgas.',
      si: 'Acepto que se publiquen mis fotos y vídeos', obligatoria: false, no: 'Si no lo aceptas, no publicaremos fotos en las que salgas.' },
    ACEPTA_DATOS: { titulo: 'Tus datos', texto: 'Para enriquecer la experiencia de Konamigas, vuestros datos de participación (nombres, resultados, estadísticas) podrán ser utilizados en comunicaciones internas y contenido promocional. Vuestros números de teléfono y correos electrónicos también podrán usarse para futuros comunicados importantes y novedades de la liga.',
      si: 'Consiento el tratamiento de mis datos personales según la política de privacidad', obligatoria: true },
    ACEPTA_RESPONSABILIDAD: { titulo: 'Exención de responsabilidad', texto: 'Konamigas S.L. no se hace responsable de las lesiones físicas o daños corporales que puedan producirse durante los entrenamientos, partidos o cualquier actividad relacionada con la liga, a menos que el seguro médico opcional ofrecido por Konamigas S.L. haya sido contratado expresamente por el participante y se encuentren cubiertas por dicho seguro. La intención de contratar este seguro deberá ser comunicada explícitamente al equipo gestor de Konamigas S.L. para su formalización. Si no la aceptas, la inscripción no vale.',
      si: 'Acepto la exención de responsabilidad', obligatoria: true }
  },

  normativa: {
    titulo: 'Normativa Konamigas · ¡Normas para disfrutar del fútbol!',
    puntos: [
      'EN NINGÚN CASO SE CONTEMPLA LA ANULACIÓN DE PARTIDOS. De forma excepcional, en caso de lluvia, nieve, huracán o tsunami el árbitro podrá decidir suspender el partido cuando lo crea conveniente, y se designará otro día para el encuentro. En caso de no presentarse a un partido, se sancionará al equipo con 60 € que deberán pagar a la liga antes de jugar el siguiente partido (el equipo perjudicado recibirá 50 € como compensación y 10 € serán para el árbitro o la árbitra del partido).',
      'Se requiere un mínimo de 4 jugadoras para empezar un partido. Juegan 5 jugadoras dentro del campo incluyendo la portera. No hay límite de cambios, pero se ruega hacerlos de forma ordenada y nunca en medio de una jugada.',
      'Los partidos empiezan puntuales. Por cada 7 minutos de retraso, el equipo contrario ya preparado podrá pedir un gol en contra del equipo tardío o con menos de 4 jugadoras preparadas.',
      'Los saques de banda y los córneres se hacen con el pie y el balón plantado y quieto (el árbitro podrá mandar repetir el saque si no se cumple tal norma). La portera puede sacar con el pie o la mano indiferentemente.',
      'Los partidos duran 45 minutos y jamás se podrán alargar, ya que después empieza otro partido. ¡Por ello se exige extrema puntualidad!',
      'NO HAY CESIÓN: si una jugadora le pasa la pelota a la portera, esta podrá cogerla con la mano sin ningún problema.',
      'Los saques de falta por manos son siempre directos.',
      'La barrera en las faltas/manos se pondrá únicamente si la jugadora que va a chutar lo pide, y se pondrá a 5 pasos de la pelota. En caso de pedir barrera se deberá esperar al pitido del árbitro para poder chutar; si no, basta con plantar bien la pelota y podrá chutar o pasarla cuando quiera.',
      'NO SE PUEDE MARCAR DE SAQUE DE BANDA DIRECTAMENTE. Debe tocarla alguna jugadora mínimamente antes de que la pelota entre en la portería para poder ser contabilizado como gol.',
      'En caso de que el balón toque la red que está sobre la pista (techo) se hará saque de banda.',
      'En fases eliminatorias ÚNICAMENTE PODRÁN JUGAR JUGADORAS INSCRITAS EN LA LIGA. El resto de temporada pueden venir siempre amigas o conocidas que conozcan esta normativa.',
      'REGLA DE ORO: toda sospecha de no alegría o actitud pesimista será castigada con la expatriación Konamicense. La sonrisa desenfrenada y la coleta alegre son condición sine qua non para jugar en esta liga. Queda dicho.'
    ],
    firma: '¡Muchas gracias y a disfrutar! Firmado, C.A.P.K. (Comité de Árbitros Profesionales de Konami)'
  },

  banco: {
    titulo: 'Banco de jugadoras y equipos', para: 'Equipos que buscan jugadoras y jugadoras que buscan equipo. Cada una enseña lo que quiere: si no deja su teléfono, Konamigas os pone en contacto.',
    anos: '{N} años', puede: 'Puede: {D}', desdeHoy: 'Busca equipo desde hoy', desdeAyer: 'Busca equipo desde ayer', desdeHace: 'Busca equipo desde hace {N} días',
    escribirle: 'Escribirle por WhatsApp', copiarTel: 'Copiar teléfono', hola: '¡Hola {N}! Te escribimos desde el banco de Konamigas: buscamos jugadora para nuestro equipo.',
    pedirContacto: 'Pedir su contacto a Konamigas', pedirContactoIg: 'Para contactarla, escríbenos con su referencia ({REF}):',
    equipos: 'Equipos que buscan jugadoras', jugadoras: 'Jugadoras que buscan equipo', todas: 'Todas las competiciones',
    buscan: 'Buscan {N}', buscanAlgunas: 'Buscan jugadoras', inscritas: '{N} inscritas', nivel: 'Nivel {N}', portera: 'Portera', 
    meInteresa: 'Me interesa', sinEquipos: 'Ahora mismo ningún equipo busca jugadoras.', sinJugadoras: 'Ahora mismo no hay jugadoras buscando equipo.',
    mensaje: '¡Hola Konamigas! Somos el equipo ____ y nos interesa la jugadora {REF} del banco (nivel {NIVEL}, {DIAS}).',
    salir: '¿Ya no buscas? Salir del banco', salirTexto: 'Si ya tienes equipo o has cambiado de idea, escribe el teléfono y el email con que te apuntaste. Si eres capitana, tu equipo deja de salir como que busca jugadoras.',
    salirBoton: 'Salir del banco', salidaJugadora: 'Hecho: ya no sales en el banco ni te buscamos equipo. Si cambias de idea, vuelve a apuntarte.', salidaEquipo: 'Hecho: tu equipo ya no sale como que busca jugadoras.',
    siEncuentras: 'Si encuentras equipo por tu cuenta o cambias de idea, puedes salir cuando quieras:',
    marcado: 'Te interesa', teInteresaUno: 'Te interesa 1 equipo', teInteresan: 'Te interesan {N} equipos', apuntarme: 'Apuntarme',
    otraComp: 'Solo puedes marcar equipos de una competición a la vez: hemos empezado de nuevo con este.',
    apuntate: '¿Buscas equipo?', apuntateBoton: 'Apuntarme sin equipo', equipoBusca: '¿A tu equipo le faltan jugadoras?', equipoBuscaTexto: 'Márcalo al inscribir el equipo («¿Buscáis jugadoras?») o pídenoslo y os sacamos aquí.'
  },

  // T0343 · La capitana elige el color de su equipo (?f=color&e=…&k=…, el enlace que le manda Konamigas).
  color: {
    titulo: 'El color de vuestra camiseta', para: '{E} · {L}', mirando: 'Mirando los colores de tu liga…',
    sinLiga: 'Vuestra liga todavía no está cerrada. Cuando lo esté, Konamigas os dirá cuándo se eligen los colores.',
    sinHora: 'Todavía no sabemos cuándo se abren los colores de vuestra liga. Lo anunciaremos en Instagram: ¡estad atentas!',
    pronto: 'Los colores de vuestra liga se abren el {D} a las {H}. Volved a este enlace a esa hora: el primer equipo que coge un color se lo queda.',
    sinColores: 'Todavía no hay colores para elegir en vuestra liga. Escríbenos y lo miramos.',
    elige: 'Elegid el color de vuestro equipo entre los que quedan libres en vuestra liga. El primero que coge un color se lo queda.',
    vuestro: 'Vuestro color: {C}', cambiar: 'Podéis cambiarlo mientras no se pidan las camisetas.', fijo: 'Vuestras camisetas ya están pedidas: el color ya no se puede cambiar.',
    libre: 'Libre', cogido: 'Lo tiene {E}', vuestroCorto: 'El vuestro', boton: 'Quedarnos el {C}', guardando: 'Guardando…', hecho: '¡Hecho! Vuestro color es el {C}.',
    actualizar: 'Ver cómo está ahora', noEnlace: 'Este enlace no es válido. Pedid el vuestro a Konamigas.', cogidoYa: 'Otro equipo acaba de coger ese color. Elegid otro.', aunNo: 'Los colores de vuestra liga aún no se han abierto.'
  },

  despedida: '¡VIVA LA VIDA! ¡VIVA KONAMI Y, SOBRE TODO, VIVA VOSOTRAS!',
  animo: '¡Asegura la plaza de tu equipo!'
};

window.INS_TEXTOS.ca = {
  dias: { Lunes: 'Dilluns', Martes: 'Dimarts', Miércoles: 'Dimecres', Jueves: 'Dijous', Viernes: 'Divendres', Sábado: 'Dissabte', Domingo: 'Diumenge' },
  meses: ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'],
  general: {
    cabecera: 'Inscripcions', privacidad: 'Llegir la política de privacitat', faltaDato: 'Falta aquesta dada.', y: 'i', cargando: 'Carregant…', volver: "Tornar a l'inici", falta: 'Falta', opcional: 'opcional', resumen: 'Resum', faltan: 'Falten {N}', faltaUno: 'Falta 1', ver: 'Veure',
    listo: 'Tot a punt per enviar', enviando: 'Enviant… pot trigar uns segons', revisa: 'Revisa el que està marcat en vermell.',
    sinConexion: 'No hi ha connexió. Comprova internet i torna-ho a enviar.', reintentar: 'Tornar-ho a provar',
    noAbierta: "Les inscripcions encara no estan obertes. Torna-hi aviat o escriu-nos per Instagram.",
    sinCompeticiones: 'Ara mateix no hi ha cap competició amb inscripcions obertes.',
    borrador: 'Continuem on ho vas deixar.', deCero: 'Començar de zero', copiar: 'Copiar', copiado: 'Copiat', porWhatsapp: 'Enviar-ho per WhatsApp',
    temporada: 'Temporada {T}', porEquipo: 'per equip', iva: '+ IVA', precioConfirmar: 'Preu per confirmar', buscar: 'Escriu per buscar-lo',
    nada: 'No trobem aquest equip.', si: 'Sí', no: 'No', cambiar: 'Canviar', contacto: 'Escriu-nos per WhatsApp', instagram: 'Instagram',
    dia: 'Dia', mes: 'Mes', ano: 'Any', idiomaPregunta: 'En quin idioma prefereixes que t\'escriguem?'
  },
  plazas: { libre: 'Queden places', ultimas: 'Últimes places', completo: "Complet · llista d'espera", ultimasCorto: 'últimes places', completoCorto: 'complet' },
  detalle: { precio: 'Preu', incluye: 'Inclou', fechas: 'Dates', dias: 'Dies', horario: 'Horari', del: 'Del {A} al {B}' },
  incluye: { partidos: '{N} partits de lliga per equip', copa: 'Copa eliminatòria inclosa', otra: '{X} inclosa', equipacion: 'Equipació oficial per a cada jugadora' },
  horarios: 'Un dia fix a la setmana. Els horaris són rotatius: cada setmana a una hora diferent{HORAS}, perquè totes jugueu a totes les hores.',
  horasEntre: ', entre les {A} i les {B}', horasA: ', a les {A}',

  portada: {
    sup: 'Benvingudes un any més a les millors lligues del món',
    titulo: 'Inscriu el teu equip',
    para: "Tria la competició i omple la inscripció de l'equip (la capitana, una vegada). En acabar et donem l'enllaç perquè cada jugadora faci la seva.",
    boton: 'Inscriure el meu equip',
    jugadora: 'El teu equip ja està inscrit?', jugadoraBoton: "Inscriu-te com a jugadora",
    banco: "Borsa de jugadores i equips", bancoPara: "Busques equip o al teu li falten jugadores? Mira qui busca.", bancoBoton: 'Veure la borsa',
    faq: 'Dubtes freqüents',
    preguntas: [
      ['I si encara no som prou?', "Inscriviu l'equip igualment: es juga amb 5 (i en calen 4 per començar). Podeu buscar reforços a la borsa de jugadores i equips, i us ajudem."],
      ['Quan comença?', 'Cada competició té les seves dates a la seva targeta. Quan confirmem la vostra plaça, us diem la lliga, el dia i el calendari.'],
      ['Com es paga?', "En inscriure l'equip us demanem la paga i senyal per reservar la plaça. La resta, més endavant. Ho paga l'equip, no cada jugadora."],
      ['I si un dia no podem anar-hi?', 'Aviseu com més aviat millor el vostre gestor. Els partits no s\'anul·len: mireu les normes per als ajornaments i les sancions.'],
      ['Soc jugadora i no tinc equip', "Inscriu-te com a jugadora i marca «No tinc equip»: te'n busquem un del teu nivell. També pots mirar la borsa."]
    ]
  },

  equipo: {
    titulo: 'Inscriure el meu equip', para: 'Ho omple la capitana, una vegada per equip.',
    competicion: 'Competició', competicionAyuda: 'A quina lliga us voleu inscriure?',
    jugado: 'Heu jugat abans a Konamigas?', jugadoSi: 'Sí', jugadoNo: 'No, som noves',
    anterior: 'Quin era el vostre equip?', anteriorAyuda: "Surt amb l'última temporada i la lliga on va jugar, per si n'hi ha dos amb el mateix nom. Si sou la unió de diversos equips, trieu-ne un i expliqueu-ho als comentaris.",
    buscarAnterior: 'Escriu el nom del teu equip', yaInscrito: 'Ja està inscrit en aquesta competició', sinTemporadas: 'Sense temporades jugades', noAnterior: "No trobem aquest equip. Escriu una altra part del nom o marca «No, som noves».",
    nombre: "Nom de l'equip", nombreAyuda: "Màxim 20 caràcters, espais inclosos. Es podrà canviar més endavant. Si dos equips trien el mateix nom, es queda el que abans completi la inscripció. Per exemple: AMIGAS DEL COLE ✅, PELOTUDAS ✅, LAS MAS AMAS DE BCN FC ❌ (22 caràcters).",
    capitana: 'Nom i cognom de la capitana', telefono: 'Telèfon de la capitana', email: 'Email de la capitana', emailAyuda: "T'enviarem aquí tot el de la inscripció.",
    cuantas: 'Quantes sou?', cuantasAyuda: 'Més o menys: ens ajuda a saber si us arriba i a preveure les samarretes.',
    nivel: "Nivell de l'equip", nivelAyuda: 'La idea és agrupar-vos amb equips del vostre mateix nivell :)', nivelExtremos: ['Començant', 'Molt competitives'],
    dias: 'Dia i instal·lació', diasAyuda: 'Marca el dia o els dies que us aniria bé jugar.', esperaAyuda: "Un dia complet també es pot marcar: us apuntem a la llista d'espera per si queda un forat.",
    horasAyuda: 'Si hi ha alguna cosa que hàgim de saber dels vostres horaris, escriu-ho als comentaris.', disponible: 'Disponible',
    busca: 'Busqueu jugadores?', buscaAyuda: "Si dieu que sí, el vostre equip surt a la borsa i les que busquen equip us poden trobar.", buscaCuantas: 'Quantes us en falten?',
    factura: 'Necessiteu factura?', facturaAyuda: 'Per exemple, si ho paga una empresa.', facturaNombre: 'Nom o raó social', facturaNif: 'NIF o CIF', facturaDireccion: 'Adreça fiscal', facturaEmail: 'Email per a la factura',
    comentarios: 'Alguna cosa a comentar?', comentariosAyuda: 'Sempre benvinguts qualsevol tipus de comentaris, propostes, crítiques constructives o el que sigui.',
    boton: "Inscriure l'equip", enviando: 'Inscrivint…',
    gracias: 'Gràcies infinites!', inscrito: 'Equip inscrit!', enEspera: "Sou a la llista d'espera!",
    esperaTodo: "Els dies que heu triat ({D}) són complets: sou a la llista d'espera i us escrivim quan hi hagi plaça.", esperaAlgunos: "Algun dels dies que heu triat és complet ({D}): per a aquest, sou a la llista d'espera.",
    graciasEspera: 'Encara no us demanem la paga i senyal: escrivim a la capitana quan hi hagi plaça.',
    graciasTexto: "Ens posarem en contacte aviat amb la capitana per confirmar la disponibilitat. Llavors us demanarem la paga i senyal{SENAL} per confirmar la plaça i la inscripció.",
    siguiente: "Ara, cada jugadora de l'equip (també la capitana) ha d'omplir la seva inscripció. Passa'ls aquest enllaç:",
    mensaje: "Hola equip! Per completar la inscripció de {EQUIPO} a Konamigas, cadascuna ha d'omplir la seva aquí: {URL}",
    laMia: 'Omplir ara la meva',
    errores: { largo: 'Té {N} caràcters: com a màxim 20.', yaInscrito: "Ja hi ha un equip «{E}» inscrit en aquesta competició. Si és el vostre, no cal tornar-ho a fer; si no, trieu un altre nom.",
      nif: 'Revisa el NIF o CIF: de 8 a 12 lletres i xifres.', capitana: 'Escriu el seu nom i el seu cognom.', dias: 'Marca almenys un dia.', anterior: 'Tria el vostre equip de la llista o busca el seu nom.', jugado: 'Tria sí o no.', nivel: 'Tria el nivell.' },
    resumen: { competicion: 'Competició', otros: 'Equip anterior', nuevas: 'Som noves', buscan: 'Us en falten', factura: 'Factura', nombre: 'Nom', capitana: 'Capitana', telefono: 'Telèfon', email: 'Email', nivel: 'Nivell', dias: 'Dies', precio: 'Preu' }
  },

  jugadora: {
    titulo: "Inscriure'm com a jugadora", para: 'Obligatori per a cada jugadora, també la capitana.', paga: "La inscripció la paga l'equip: tu no has de pagar res aquí.",
    repetir: "Necessites canviar alguna cosa? Torna-ho a omplir amb el mateix telèfon i guardarem la teva última resposta.",
    competicionAyuda: 'En quina competició vols jugar?', teInscribes: "T'inscrius a", enlaceOtro: 'No és el teu equip?',
    tienes: 'Tens equip?', conEquipo: 'Tinc equip', conEquipoAyuda: "El tries de la llista d'equips inscrits.",
    sinEquipo: "No tinc equip: en busco un", sinEquipoAyuda: "Només les teves dades de contacte: Konamigas et busca un equip del teu nivell.",
    equipo: 'El teu equip', equipoAyuda: 'Busca el teu equip pel nom.', noSale: "No surt el teu equip? La teva capitana l'ha d'inscriure primer.", noSaleCapitana: "Soc la capitana: inscriure l'equip",
    todaviaNadie: 'Encara no hi ha equips inscrits en aquesta competició.',
    datos: 'Les teves dades', nombre: 'Nom', nombreAyuda: 'Només el nom, que el cognom va després 😎', apellido1: 'Primer cognom', apellido2: 'Segon cognom',
    nacimiento: 'Data de naixement', documento: 'DNI, NIE o passaport', telefono: 'Telèfon (mòbil)', email: 'Email', emailAyuda: 'Amb aquest email podràs entrar més endavant a veure el teu perfil.',
    email2: 'Repeteix el teu email', email2Ayuda: 'Perquè no s\'escoli cap errada.', instagram: "Usuari d'Instagram", instagramAyuda: 'Segueix-nos a @konamigasbarcelona, que volem crear molt molt contingut sobre vosaltres.',
    camiseta: 'La teva samarreta', eligeEquipo: 'Tria primer el teu equip.', mirando: 'Mirant els dorsals lliures…',
    inscritas: 'Ja inscrites ({N})', primera: "Encara no s'ha inscrit ningú del teu equip: ets la primera!", capitanaEt: 'capitana',
    dorsal: 'Dorsal i talla', dorsalAyuda: 'Amb la teva inscripció tens inclosa la samarreta oficial. Aquestes són les combinacions de dorsal i talla que queden lliures al teu equip.',
    dorsalOtro: 'Una altra combinació de dorsal i talla', dorsalOtroAyuda: 'Qualsevol samarreta fora de les combinacions de la llista té un suplement de 10 €.', cogidos: 'Ja estan agafats: {L}.',
    dorsalSolo: 'Dorsal', talla: 'Talla', tallaElige: 'Tria la teva talla', tallaEt: 'Talla {T}',
    packIncluida: "El {D} amb talla {T} està inclòs a la teva inscripció, no es paga: l'hem marcat a la llista.",
    packOtraTalla: 'El {D} només va inclòs en talla {T}. En talla {U} pagues 10 € més.', suplemento: 'Aquesta combinació no és al pack: pagues 10 € més.',
    suplementoHecho: 'La teva samarreta va fora del pack: porta un suplement de 10 €.', verTodos: 'Veure els {N} equips', aceptado: 'Acceptat',
    sinColor: "El color, quan l'equip estigui confirmat", tuColor: 'El vostre color',
    busco: 'Per buscar-te equip', buscoAyuda: "Amb això et busquem un equip del teu nivell i dels teus dies. Quan el tinguem, t'enviem l'enllaç per completar la inscripció (samarreta, normes i la resta).",
    tuNivel: 'El teu nivell', tusDias: "Dies que et van bé", portera: 'Jugo de portera', enBanco: "Que els equips que busquen jugadores em vegin a la borsa (el meu nom amb la inicial del cognom, la meva edat aproximada, el meu nivell i els meus dies)",
    bancoTelefono: "I que em puguin escriure per WhatsApp (es veurà el meu telèfon)",
    interesan: "T'interessen aquests equips: els ho direm.", quitar: 'Treure',
    derechos: 'Drets i responsabilitats', aceptarTodo: 'Acceptar normes, dades i exempció', seguro: "Vull informació de l'assegurança mèdica opcional",
    ultimo: 'Per acabar', conocio: 'Com vas conèixer Konamigas?', conocioElige: "Tria'n una", conocioOpciones: ['Amigues', 'Xarxes socials', 'Internet', 'Altres'],
    comentarios: 'Alguna cosa més a explicar-nos?', comentariosAyuda: 'Propostes noves, crítiques constructives, piropos als àrbitres, reflexions personals, dubtes, consells… etcètera.',
    boton: 'Enviar la meva inscripció', botonBusco: "Apuntar-me per buscar equip",
    gracias: 'Gràcies!', inscrita: 'Ja estàs inscrita a {EQUIPO}!', apuntadaTitulo: 'Apuntada!', apuntada: "T'escriurem quan tinguem un equip per a tu, amb l'enllaç per completar la inscripció.",
    guardada: "Hem guardat la teva última resposta.", tuCamiseta: 'La teva samarreta: dorsal {D}, talla {T}.',
    ahora: 'I ara', ahoraTexto: ["La inscripció la paga l'equip: ho parla Konamigas amb la vostra capitana.", "La teva samarreta va a la comanda de l'equip: te la donem a la pista.", "T'escriurem al telèfon i a l'email que has posat."],
    compartir: "Falta algú del teu equip? Passa-li l'enllaç:", mensaje: "Hola! Per inscriure't a {EQUIPO} a Konamigas, omple això: {URL}",
    otra: 'Inscriure una altra jugadora',
    resumen: { competicion: 'Competició', equipo: 'Equip', busco: 'Busco equip', nombre: 'Nom', nacimiento: 'Naixement', documento: 'Document', dias: 'Dies', interesan: "T'interessen", mas10: '+10 €', telefono: 'Telèfon', email: 'Email', nivel: 'Nivell', camiseta: 'Samarreta', camisetaV: 'Dorsal {D} · Talla {T}', datos: 'Dades', aceptado: 'Acceptat', todo: 'Tot', deN: '{A} de {B}' },
    errores: {
      dorsalNumero: 'El dorsal és un número del 0 al 99.', dorsalCogido: "El {D} ja el té una altra jugadora del teu equip. Tria'n un altre.",
      fecha: 'Revisa la teva data de naixement.', fechaNoExiste: 'Aquesta data no existeix.', tienes: 'Digues-nos si tens equip.', equipo: 'Tria el teu equip de la llista.', combinacion: 'Tria el teu dorsal i la teva talla.', nivel: 'Tria el teu nivell.', dias: 'Marca almenys un dia.', aceptaUna: "Cal acceptar-ho per inscriure's.", edad: 'Per jugar a Konamigas cal tenir {N} anys complerts.',
      email: 'Revisa el teu email: ha de ser com nom@domini.com, sense espais.', email2: 'Els dos emails no són iguals.',
      telEs: "Un mòbil d'Espanya té 9 xifres i comença per 6 o 7 (o un fix, per 8 o 9).", telOtro: 'Revisa el número: només xifres, sense el prefix.',
      docLetra: 'La lletra del teu {T} no quadra amb el número: revisa-ho.', docSinLetra: 'Al teu DNI li falta la lletra.', doc: 'Revisa el teu DNI, NIE o passaport.',
      acepta: "Perquè la inscripció sigui vàlida has d'acceptar la normativa, les teves dades i l'exempció de responsabilitat.", aceptaDatos: "Per apuntar-te has d'acceptar el tractament de les teves dades."
    }
  },

  acepta: {
    ACEPTA_NORMAS: { titulo: 'Normes Konamigas', texto: "Important llegir aquest apartat: s'hi expliquen, entre altres coses, les sancions per faltes d'assistència. Si no l'acceptes, la inscripció no és vàlida.",
      leer: 'Llegir la normativa', pdf: 'Obrir el PDF de la normativa (en castellà)', si: "He llegit i accepto la normativa" },
    ACEPTA_DERECHOS_IMAGEN: { titulo: "Drets d'imatge", texto: "Per destacar l'emoció de la lliga Konamigas, fem fotos i vídeos dels partits i activitats per a les nostres xarxes socials i per a contingut promocional a les nostres plataformes. Si ho acceptes, podrem publicar les imatges on surtis.",
      si: 'Accepto que es publiquin les meves fotos i vídeos', no: 'Si no ho acceptes, no publicarem fotos on surtis.' },
    ACEPTA_DATOS: { titulo: 'Les teves dades', texto: "Per enriquir l'experiència de Konamigas, les vostres dades de participació (noms, resultats, estadístiques) es podran fer servir en comunicacions internes i contingut promocional. Els vostres telèfons i correus electrònics també es podran fer servir per a futurs comunicats importants i novetats de la lliga.",
      si: 'Consento el tractament de les meves dades personals segons la política de privacitat' },
    ACEPTA_RESPONSABILIDAD: { titulo: 'Exempció de responsabilitat', texto: "Konamigas S.L. no es fa responsable de les lesions físiques o danys corporals que es puguin produir durant els entrenaments, partits o qualsevol activitat relacionada amb la lliga, tret que l'assegurança mèdica opcional oferta per Konamigas S.L. hagi estat contractada expressament pel participant i estiguin cobertes per aquesta assegurança. La intenció de contractar aquesta assegurança s'haurà de comunicar explícitament a l'equip gestor de Konamigas S.L. per formalitzar-la. Si no l'acceptes, la inscripció no és vàlida.",
      si: "Accepto l'exempció de responsabilitat" }
  },

  normativa: {
    titulo: 'Normativa Konamigas · Normes per gaudir del futbol!!',
    puntos: [
      "EN CAP CAS NO ES CONTEMPLA L'ANUL·LACIÓ DE PARTITS. De manera excepcional, en cas de pluja, neu, huracà o tsunami l'àrbitre podrà decidir suspendre el partit quan ho cregui convenient, i es fixarà un altre dia per a la trobada. Si un equip no es presenta a un partit, se'l sancionarà amb 60 € que haurà de pagar a la lliga abans de jugar el partit següent (l'equip perjudicat rebrà 50 € com a compensació i 10 € per a l'àrbitre del partit).",
      "Calen un mínim de 4 jugadores per començar un partit. Juguen 5 jugadores al camp, incloent-hi la portera. No hi ha límit de canvis, però es demana fer-los de manera ordenada i mai enmig d'una jugada.",
      "Els partits comencen puntuals. Per cada 7 minuts de retard, l'equip contrari ja preparat podrà demanar un gol en contra de l'equip que arriba tard o amb menys de 4 jugadores preparades.",
      "Els serveis de banda i els córners es fan amb el peu i la pilota aturada (l'àrbitre podrà fer repetir el servei si no es compleix). La portera pot treure amb el peu o la mà indistintament.",
      "Els partits duren 45 minuts i mai no es podran allargar, perquè després comença un altre partit. Per això s'exigeix una puntualitat extrema!",
      "NO HI HA CESSIÓ: si una jugadora passa la pilota a la portera, aquesta la podrà agafar amb la mà sense cap problema.",
      "Les faltes per mans són sempre directes.",
      "La barrera en les faltes/mans només es posarà si la jugadora que xutarà la demana, i es posarà a 5 passes de la pilota. Si es demana barrera, caldrà esperar el xiulet de l'àrbitre per xutar; si no, n'hi ha prou de plantar bé la pilota i podrà xutar o passar quan vulgui.",
      "NO ES POT MARCAR DIRECTAMENT DE SERVEI DE BANDA. Alguna jugadora l'ha de tocar mínimament abans que la pilota entri a la porteria perquè sigui gol.",
      "Si la pilota toca la xarxa que hi ha sobre la pista (sostre) es farà servei de banda.",
      "A les fases eliminatòries NOMÉS PODRAN JUGAR JUGADORES INSCRITES A LA LLIGA. La resta de la temporada poden venir sempre amigues o conegudes que coneguin aquesta normativa.",
      "REGLA D'OR: tota sospita de no alegria o actitud pessimista serà castigada amb l'expatriació konamicense. El somriure desenfrenat i la cua alegre són condició sine qua non per jugar en aquesta lliga. Queda dit."
    ],
    firma: 'Moltes gràcies i a gaudir... jugueu!!!! Signat, C.A.P.K. (Comitè d\'Àrbitres Professionals de Konami)'
  },

  banco: {
    titulo: 'Borsa de jugadores i equips', para: "Equips que busquen jugadores i jugadores que busquen equip. Cadascuna ensenya el que vol: si no deixa el seu telèfon, Konamigas us posa en contacte.",
    anos: '{N} anys', puede: 'Pot: {D}', desdeHoy: "Busca equip des d'avui", desdeAyer: "Busca equip des d'ahir", desdeHace: 'Busca equip des de fa {N} dies',
    escribirle: 'Escriure-li per WhatsApp', copiarTel: 'Copiar el telèfon', hola: "Hola {N}! T'escrivim des de la borsa de Konamigas: busquem jugadora per al nostre equip.",
    pedirContacto: 'Demanar el seu contacte a Konamigas', pedirContactoIg: 'Per contactar-la, escriu-nos amb la seva referència ({REF}):',
    equipos: 'Equips que busquen jugadores', jugadoras: 'Jugadores que busquen equip', todas: 'Totes les competicions',
    buscan: 'En busquen {N}', buscanAlgunas: 'Busquen jugadores', inscritas: '{N} inscrites', nivel: 'Nivell {N}', portera: 'Portera', 
    meInteresa: "M'interessa", sinEquipos: 'Ara mateix cap equip busca jugadores.', sinJugadoras: 'Ara mateix no hi ha jugadores buscant equip.',
    mensaje: 'Hola Konamigas! Som l\'equip ____ i ens interessa la jugadora {REF} de la borsa (nivell {NIVEL}, {DIAS}).',
    salir: 'Ja no busques? Sortir de la borsa', salirTexto: "Si ja tens equip o has canviat d'idea, escriu el telèfon i l'email amb què et vas apuntar. Si ets capitana, el teu equip deixa de sortir com que busca jugadores.",
    salirBoton: 'Sortir de la borsa', salidaJugadora: "Fet: ja no surts a la borsa ni et busquem equip. Si canvies d'idea, torna-t'hi a apuntar.", salidaEquipo: 'Fet: el teu equip ja no surt com que busca jugadores.',
    siEncuentras: "Si trobes equip pel teu compte o canvies d'idea, pots sortir quan vulguis:",
    marcado: "T'interessa", teInteresaUno: "T'interessa 1 equip", teInteresan: "T'interessen {N} equips", apuntarme: "Apuntar-me",
    otraComp: "Només pots marcar equips d'una competició alhora: hem tornat a començar amb aquest.",
    apuntate: 'Busques equip?', apuntateBoton: "Apuntar-me sense equip", equipoBusca: 'Al teu equip li falten jugadores?', equipoBuscaTexto: "Marca-ho en inscriure l'equip («Busqueu jugadores?») o demana-ho i us hi traiem."
  },

  // T0343 · La capitana tria el color del seu equip.
  color: {
    titulo: 'El color de la vostra samarreta', para: '{E} · {L}', mirando: 'Mirant els colors de la teva lliga…',
    sinLiga: 'La vostra lliga encara no està tancada. Quan ho estigui, Konamigas us dirà quan es trien els colors.',
    sinHora: 'Encara no sabem quan s’obren els colors de la vostra lliga. Ho anunciarem a Instagram: estigueu atentes!',
    pronto: 'Els colors de la vostra lliga s’obren el {D} a les {H}. Torneu a aquest enllaç a aquella hora: el primer equip que agafa un color se’l queda.',
    sinColores: 'Encara no hi ha colors per triar a la vostra lliga. Escriviu-nos i ho mirem.',
    elige: 'Trieu el color del vostre equip entre els que queden lliures a la vostra lliga. El primer que agafa un color se’l queda.',
    vuestro: 'El vostre color: {C}', cambiar: 'El podeu canviar mentre no es demanin les samarretes.', fijo: 'Les vostres samarretes ja estan demanades: el color ja no es pot canviar.',
    libre: 'Lliure', cogido: 'El té {E}', vuestroCorto: 'El vostre', boton: 'Quedar-nos el {C}', guardando: 'Desant…', hecho: 'Fet! El vostre color és el {C}.',
    actualizar: 'Veure com està ara', noEnlace: 'Aquest enllaç no és vàlid. Demaneu el vostre a Konamigas.', cogidoYa: 'Un altre equip acaba d’agafar aquest color. Trieu-ne un altre.', aunNo: 'Els colors de la vostra lliga encara no s’han obert.'
  },

  despedida: 'VISCA LA VIDA! VISCA KONAMI I, SOBRETOT, VISQUEU VOSALTRES!',
  animo: "Assegura la plaça del teu equip!"
};

window.INS_TEXTOS.en = {
  dias: { Lunes: 'Monday', Martes: 'Tuesday', Miércoles: 'Wednesday', Jueves: 'Thursday', Viernes: 'Friday', Sábado: 'Saturday', Domingo: 'Sunday' },
  meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  general: {
    cabecera: 'Registration', privacidad: 'Read the privacy policy', faltaDato: 'This is missing.', y: 'and', cargando: 'Loading…', volver: 'Back to start', falta: 'Missing', opcional: 'optional', resumen: 'Summary', faltan: '{N} missing', faltaUno: '1 missing', ver: 'Go',
    listo: 'All set to send', enviando: 'Sending… this may take a few seconds', revisa: 'Please check what is marked in red.',
    sinConexion: 'No connection. Check your internet and send it again.', reintentar: 'Try again',
    noAbierta: 'Registration is not open yet. Check back soon or message us on Instagram.',
    sinCompeticiones: 'There are no competitions open for registration right now.',
    borrador: 'We kept what you had filled in.', deCero: 'Start over', copiar: 'Copy', copiado: 'Copied', porWhatsapp: 'Send it on WhatsApp',
    temporada: 'Season {T}', porEquipo: 'per team', iva: '+ VAT', precioConfirmar: 'Price to be confirmed', buscar: 'Type to search',
    nada: "We can't find that team.", si: 'Yes', no: 'No', cambiar: 'Change', contacto: 'Message us on WhatsApp', instagram: 'Instagram',
    dia: 'Day', mes: 'Month', ano: 'Year', idiomaPregunta: 'Which language would you like us to write to you in?'
  },
  plazas: { libre: 'Places left', ultimas: 'Last places', completo: 'Full · waiting list', ultimasCorto: 'last places', completoCorto: 'full' },
  detalle: { precio: 'Price', incluye: 'Includes', fechas: 'Dates', dias: 'Days', horario: 'Times', del: 'From {A} to {B}' },
  incluye: { partidos: '{N} league matches per team', copa: 'Knockout cup included', otra: '{X} included', equipacion: 'Official kit for every player' },
  horarios: 'One fixed day a week. Times rotate: each week at a different time{HORAS}, so every team gets every time slot.',
  horasEntre: ', between {A} and {B}', horasA: ', at {A}',

  portada: {
    sup: 'Welcome to a new season of the best leagues in the world',
    titulo: 'Register your team',
    para: 'Choose the competition and fill in the team registration (captains only, once per team). When you finish, we give you the link so each player can do hers.',
    boton: 'Register my team',
    jugadora: 'Is your team already registered?', jugadoraBoton: 'Register as a player',
    banco: 'Players & teams board', bancoPara: 'Looking for a team, or is yours short of players? See who is looking.', bancoBoton: 'See the board',
    faq: 'FAQ',
    preguntas: [
      ["What if we don't have enough players yet?", 'Register the team anyway: games are 5-a-side (and you need 4 to start). You can look for players on the players & teams board, and we will help you.'],
      ['When does it start?', 'Each competition shows its dates on its card. Once we confirm your place, we will tell you the league, the day and the fixtures.'],
      ['How do we pay?', 'When you register the team we ask for a deposit to hold your place. The rest comes later. The team pays, not each player.'],
      ["What if we can't make it one day?", "Tell your league manager as soon as possible. Matches aren't cancelled: check the rules for postponements and penalties."],
      ["I'm a player without a team", 'Register as a player and choose "I don\'t have a team": we will find you one at your level. You can also check the board.']
    ]
  },

  equipo: {
    titulo: 'Register my team', para: 'Captains only, once per team.',
    competicion: 'Competition', competicionAyuda: 'Which league do you want to join?',
    jugado: 'Have you played in Konamigas before?', jugadoSi: 'Yes', jugadoNo: "No, we're new",
    anterior: 'What was your team called?', anteriorAyuda: 'Shown with its last season and league, in case two share a name. If you are several teams joining together, choose one and tell us in the comments.',
    buscarAnterior: 'Type your team\'s name', yaInscrito: 'Already registered in this competition', sinTemporadas: 'No seasons played', noAnterior: 'We can\'t find that team. Type another part of the name or choose "No, we\'re new".',
    nombre: 'Team name', nombreAyuda: 'Up to 20 characters, spaces included. You can change it later. If two teams choose the same name, the first to complete the registration keeps it. For example: AMIGAS DEL COLE ✅, PELOTUDAS ✅, LAS MAS AMAS DE BCN FC ❌ (22 characters).',
    capitana: "Captain's first and last name", telefono: "Captain's phone", email: "Captain's email", emailAyuda: "We'll send the registration details here.",
    cuantas: 'How many of you are there?', cuantasAyuda: "Roughly: it helps us know if you have enough players and plan the shirts.",
    nivel: 'Team level', nivelAyuda: 'The idea is to group you with teams of your level :)', nivelExtremos: ['Just starting', 'Very competitive'],
    dias: 'Day and venue', diasAyuda: 'Tick the day or days that would suit you.', esperaAyuda: "You can also tick a full day: we'll put you on the waiting list in case a place opens up.",
    horasAyuda: "If there is anything we should know about your times, write it in the comments.", disponible: 'Available',
    busca: 'Are you looking for players?', buscaAyuda: 'If you say yes, your team appears on the board and players looking for a team can find you.', buscaCuantas: 'How many do you need?',
    factura: 'Do you need an invoice?', facturaAyuda: 'For example, if a company pays.', facturaNombre: 'Name or company name', facturaNif: 'Tax ID (NIF / CIF)', facturaDireccion: 'Billing address', facturaEmail: 'Email for the invoice',
    comentarios: 'Anything to add?', comentariosAyuda: 'Any comments, ideas, constructive criticism or whatever are always very welcome.',
    boton: 'Register the team', enviando: 'Registering…',
    gracias: 'Thank you so much!', inscrito: 'Team registered!', enEspera: "You're on the waiting list!",
    esperaTodo: "The days you chose ({D}) are full: you're on the waiting list and we'll write as soon as a place opens up.", esperaAlgunos: "One of the days you chose is full ({D}): for that one, you're on the waiting list.",
    graciasEspera: "We won't ask for the deposit yet: we'll write to the captain as soon as there's a place.",
    graciasTexto: "We'll get in touch with the captain shortly to confirm availability. Then we'll ask you for the deposit{SENAL} to confirm your place and registration.",
    siguiente: 'Now every player on the team (the captain too) has to fill in her registration. Send them this link:',
    mensaje: 'Hi team! To complete the registration of {EQUIPO} in Konamigas, each of us has to fill in ours here: {URL}',
    laMia: 'Fill in mine now',
    errores: { largo: 'It has {N} characters: 20 at most.', yaInscrito: 'There is already a team "{E}" registered in this competition. If it is yours, there is no need to do it again; if not, choose another name.',
      nif: 'Check the tax ID: 8 to 12 letters and digits.', capitana: 'Write her first and last name.', dias: 'Tick at least one day.', anterior: 'Choose your team from the list or search for its name.', jugado: 'Choose yes or no.', nivel: 'Choose the level.' },
    resumen: { competicion: 'Competition', otros: 'Previous team', nuevas: "We're new", buscan: 'You need', factura: 'Invoice', nombre: 'Name', capitana: 'Captain', telefono: 'Phone', email: 'Email', nivel: 'Level', dias: 'Days', precio: 'Price' }
  },

  jugadora: {
    titulo: 'Register as a player', para: 'Required for every player, the captain too.', paga: "The team pays the registration: you don't pay anything here.",
    repetir: 'Need to change something? Fill it in again with the same phone number and we will keep your latest answer.',
    competicionAyuda: 'Which competition do you want to play in?', teInscribes: "You're registering with", enlaceOtro: 'Not your team?',
    tienes: 'Do you have a team?', conEquipo: 'I have a team', conEquipoAyuda: 'Choose it from the list of registered teams.',
    sinEquipo: "I don't have a team: I'm looking for one", sinEquipoAyuda: 'Just your contact details: Konamigas will find you a team at your level.',
    equipo: 'Your team', equipoAyuda: 'Search for your team by name.', noSale: "Can't see your team? Your captain has to register it first.", noSaleCapitana: "I'm the captain: register the team",
    todaviaNadie: 'No teams registered in this competition yet.',
    datos: 'Your details', nombre: 'First name', nombreAyuda: 'Just your first name, the surname comes next 😎', apellido1: 'Surname', apellido2: 'Second surname',
    nacimiento: 'Date of birth', documento: 'ID card, NIE or passport', telefono: 'Phone (mobile)', email: 'Email', emailAyuda: 'With this email you will be able to log in later to see your profile.',
    email2: 'Repeat your email', email2Ayuda: 'So no typos slip in.', instagram: 'Instagram username', instagramAyuda: 'Follow us at @konamigasbarcelona, we want to create lots and lots of content about you.',
    camiseta: 'Your shirt', eligeEquipo: 'Choose your team first.', mirando: 'Checking free numbers…',
    inscritas: 'Already registered ({N})', primera: "Nobody from your team has registered yet: you're the first!", capitanaEt: 'captain',
    dorsal: 'Number and size', dorsalAyuda: 'Your official shirt is included in your registration. These are the number and size combinations still free in your team.',
    dorsalOtro: 'Another number and size', dorsalOtroAyuda: 'Any shirt outside the combinations on the list costs €10 extra.', cogidos: 'Already taken: {L}.',
    dorsalSolo: 'Number', talla: 'Size', tallaElige: 'Choose your size', tallaEt: 'Size {T}',
    packIncluida: "Number {D} in size {T} is included in your registration, at no cost: we've ticked it on the list.",
    packOtraTalla: 'Number {D} is only included in size {T}. In size {U} it costs €10 extra.', suplemento: 'This combination is not in the pack: it costs €10 extra.',
    suplementoHecho: 'Your shirt is outside the pack: it has a €10 supplement.', verTodos: 'See all {N} teams', aceptado: 'Accepted',
    sinColor: 'The colour, once the team is confirmed', tuColor: 'Your colour',
    busco: 'To find you a team', buscoAyuda: "With this we look for a team at your level and on your days. When we have one, we'll send you the link to complete your registration (shirt, rules and the rest).",
    tuNivel: 'Your level', tusDias: 'Days that suit you', portera: "I'm a goalkeeper", enBanco: 'Let teams looking for players see me on the board (my first name and surname initial, approximate age, level and days)',
    bancoTelefono: 'And let them message me on WhatsApp (my phone number will be shown)',
    interesan: "You're interested in these teams: we'll let them know.", quitar: 'Remove',
    derechos: 'Rights and responsibilities', aceptarTodo: 'Accept rules, privacy and waiver', seguro: "I'd like information about the optional medical insurance",
    ultimo: 'Finally', conocio: 'How did you hear about Konamigas?', conocioElige: 'Choose one', conocioOpciones: ['Friends', 'Social media', 'Internet', 'Other'],
    comentarios: 'Anything else to tell us?', comentariosAyuda: 'New ideas, constructive criticism, compliments for the referees, personal thoughts, questions, advice… and so on.',
    boton: 'Send my registration', botonBusco: 'Sign me up to find a team',
    gracias: 'Thank you!', inscrita: "You're registered with {EQUIPO}!", apuntadaTitulo: "You're signed up!", apuntada: "We'll message you as soon as we have a team for you, with the link to complete your registration.",
    guardada: 'We have saved your latest answer.', tuCamiseta: 'Your shirt: number {D}, size {T}.',
    ahora: 'What happens now', ahoraTexto: ['The team pays the registration: Konamigas sorts it out with your captain.', "Your shirt goes in the team's order: we'll give it to you at the pitch.", "We'll contact you on the phone and email you gave us."],
    compartir: 'Is someone from your team missing? Send them the link:', mensaje: 'Hi! To register with {EQUIPO} in Konamigas, fill this in: {URL}',
    otra: 'Register another player',
    resumen: { competicion: 'Competition', equipo: 'Team', busco: 'Looking for a team', nombre: 'Name', nacimiento: 'Date of birth', documento: 'ID', dias: 'Days', interesan: 'Interested in', mas10: '+€10', telefono: 'Phone', email: 'Email', nivel: 'Level', camiseta: 'Shirt', camisetaV: 'Number {D} · Size {T}', datos: 'Data', aceptado: 'Accepted', todo: 'All', deN: '{A} of {B}' },
    errores: {
      dorsalNumero: 'The number must be between 0 and 99.', dorsalCogido: 'Number {D} is already taken by another player on your team. Choose another.',
      fecha: 'Please check your date of birth.', fechaNoExiste: "That date doesn't exist.", tienes: 'Tell us if you have a team.', equipo: 'Choose your team from the list.', combinacion: 'Choose your number and size.', nivel: 'Choose your level.', dias: 'Tick at least one day.', aceptaUna: 'You must accept this to register.', edad: 'You must be at least {N} to play in Konamigas.',
      email: 'Please check your email: it should look like name@domain.com, with no spaces.', email2: "The two emails don't match.",
      telEs: 'A Spanish mobile has 9 digits and starts with 6 or 7 (or a landline, with 8 or 9).', telOtro: 'Please check the number: digits only, without the prefix.',
      docLetra: "The letter of your {T} doesn't match the number: please check it.", docSinLetra: 'Your DNI is missing its letter.', doc: 'Please check your ID card, NIE or passport.',
      acepta: 'For the registration to count you must accept the rules, the processing of your data and the liability waiver.', aceptaDatos: 'To sign up you must accept the processing of your data.'
    }
  },

  acepta: {
    ACEPTA_NORMAS: { titulo: 'Konamigas rules', texto: "Important to read: among other things, it explains the penalties for not turning up. If you don't accept them, the registration doesn't count.",
      leer: 'Read the rules', pdf: 'Open the rules PDF (in Spanish)', si: 'I have read and accept the rules' },
    ACEPTA_DERECHOS_IMAGEN: { titulo: 'Image rights', texto: 'To showcase the excitement of the Konamigas league, we may take photos and videos of matches and activities for our social media and promotional content on our platforms. If you accept, we may publish images you appear in.',
      si: 'I agree to my photos and videos being published', no: "If you don't agree, we won't publish photos you appear in." },
    ACEPTA_DATOS: { titulo: 'Your data', texto: 'To enrich the Konamigas experience, your participation data (names, results, statistics) may be used in internal communications and promotional content. Your phone numbers and emails may also be used for important future announcements and league news.',
      si: 'I consent to the processing of my personal data in accordance with the privacy policy' },
    ACEPTA_RESPONSABILIDAD: { titulo: 'Liability waiver', texto: "Konamigas S.L. is not responsible for physical injuries or bodily harm that may occur during training, matches or any league-related activity, unless the optional medical insurance offered by Konamigas S.L. has been expressly taken out by the participant and the injuries are covered by it. The intention to take out this insurance must be explicitly communicated to the Konamigas S.L. management team for it to be arranged. If you don't accept it, the registration doesn't count.",
      si: 'I accept the liability waiver' }
  },

  normativa: {
    titulo: 'Konamigas rules · Rules for enjoying football!!',
    puntos: [
      'MATCHES ARE NEVER CANCELLED. Exceptionally, in case of rain, snow, hurricane or tsunami, the referee may decide to suspend the match when appropriate, and another day will be set. A team that does not turn up for a match will be fined €60, to be paid to the league before its next match (the other team receives €50 as compensation and €10 goes to the referee).',
      'A minimum of 4 players is needed to start a match. 5 players play on the pitch, including the goalkeeper. There is no limit on substitutions, but please make them in an orderly way and never in the middle of a play.',
      'Matches start on time. For every 7 minutes of delay, the opposing team, if ready, may claim a goal against the late team or the team with fewer than 4 players ready.',
      'Throw-ins and corners are taken with the foot, with the ball still on the ground (the referee may order a retake if not). The goalkeeper may restart with foot or hand.',
      'Matches last 45 minutes and can never be extended, because another match starts right after. That is why extreme punctuality is required!',
      'NO BACK-PASS RULE: if a player passes the ball to her goalkeeper, she may pick it up with her hands with no problem.',
      'Free kicks for handball are always direct.',
      'A wall is only set for free kicks if the player taking it asks for one, and it stands 5 steps from the ball. If a wall is requested, the player must wait for the whistle to shoot; otherwise, she just needs to place the ball properly and can shoot or pass whenever she wants.',
      'YOU CANNOT SCORE DIRECTLY FROM A THROW-IN. Another player must touch the ball, even slightly, before it enters the goal for it to count.',
      'If the ball touches the net above the pitch (the roof), it is a throw-in.',
      'In knockout stages, ONLY PLAYERS REGISTERED IN THE LEAGUE MAY PLAY. During the rest of the season, friends or acquaintances who know these rules are always welcome.',
      'GOLDEN RULE: any suspicion of lack of joy or a pessimistic attitude will be punished with Konamigas expatriation. A wild smile and a happy ponytail are a sine qua non for playing in this league. That is all.'
    ],
    firma: 'Thank you so much and enjoy... play!!!! Signed, C.A.P.K. (Konami Professional Referees Committee)'
  },

  banco: {
    titulo: 'Players & teams board', para: "Teams looking for players and players looking for a team. Each player shows what she wants: if she doesn't share her phone, Konamigas puts you in touch.",
    anos: '{N} years old', puede: 'Available: {D}', desdeHoy: 'Looking for a team since today', desdeAyer: 'Looking for a team since yesterday', desdeHace: 'Looking for a team for {N} days',
    escribirle: 'Message her on WhatsApp', copiarTel: 'Copy phone', hola: "Hi {N}! We're writing from the Konamigas board: we're looking for a player for our team.",
    pedirContacto: 'Ask Konamigas for her contact', pedirContactoIg: 'To contact her, message us with her reference ({REF}):',
    equipos: 'Teams looking for players', jugadoras: 'Players looking for a team', todas: 'All competitions',
    buscan: 'Looking for {N}', buscanAlgunas: 'Looking for players', inscritas: '{N} registered', nivel: 'Level {N}', portera: 'Goalkeeper', 
    meInteresa: "I'm interested", sinEquipos: 'No teams are looking for players right now.', sinJugadoras: 'No players are looking for a team right now.',
    mensaje: "Hi Konamigas! We're the team ____ and we're interested in player {REF} from the board (level {NIVEL}, {DIAS}).",
    salir: 'Not looking any more? Leave the board', salirTexto: "If you already have a team or changed your mind, enter the phone and email you signed up with. If you're a captain, your team stops showing as looking for players.",
    salirBoton: 'Leave the board', salidaJugadora: "Done: you're no longer on the board and we won't look for a team for you. If you change your mind, sign up again.", salidaEquipo: 'Done: your team no longer shows as looking for players.',
    siEncuentras: 'If you find a team yourself or change your mind, you can leave whenever you want:',
    marcado: 'Interested', teInteresaUno: "You're interested in 1 team", teInteresan: "You're interested in {N} teams", apuntarme: 'Sign me up',
    otraComp: 'You can only pick teams from one competition at a time: we started again with this one.',
    apuntate: 'Looking for a team?', apuntateBoton: 'Sign me up without a team', equipoBusca: 'Is your team short of players?', equipoBuscaTexto: 'Tick it when registering the team ("Are you looking for players?") or ask us and we\'ll list you here.'
  },

  // T0343 · The captain chooses her team's colour.
  color: {
    titulo: 'Your shirt colour', para: '{E} · {L}', mirando: 'Looking at the colours in your league…',
    sinLiga: 'Your league is not closed yet. When it is, Konamigas will tell you when colours are chosen.',
    sinHora: 'We don’t know yet when colours open in your league. We will announce it on Instagram: stay tuned!',
    pronto: 'Colours in your league open on {D} at {H}. Come back to this link then: the first team to take a colour keeps it.',
    sinColores: 'There are no colours to choose in your league yet. Write to us and we will look into it.',
    elige: 'Choose your team’s colour from the ones still free in your league. The first team to take a colour keeps it.',
    vuestro: 'Your colour: {C}', cambiar: 'You can change it until the shirts are ordered.', fijo: 'Your shirts are already ordered: the colour can no longer be changed.',
    libre: 'Free', cogido: '{E} has it', vuestroCorto: 'Yours', boton: 'Take {C}', guardando: 'Saving…', hecho: 'Done! Your colour is {C}.',
    actualizar: 'See how it is now', noEnlace: 'This link is not valid. Ask Konamigas for yours.', cogidoYa: 'Another team has just taken that colour. Choose another one.', aunNo: 'Colours in your league are not open yet.'
  },

  despedida: 'LONG LIVE LIFE! LONG LIVE KONAMI AND, ABOVE ALL, LONG LIVE YOU!',
  animo: "Secure your team's place!"
};
