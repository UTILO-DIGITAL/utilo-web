/*
 * web/konamigas/inscripciones/privacidad.js · T0335 · La política de privacidad de la página de inscripciones de Konamigas
 *
 * Redactada para lo que hace esta página y la app de Gestión (qué datos se piden, para qué, quién los ve). La tiene que revisar
 * Konamigas (y su gestoría o un abogado) antes de publicarla. Los datos de la empresa van en DATOS: mientras falte alguno, la
 * página lo enseña entre corchetes. {RESPONSABLE}, {NIF}, {DOMICILIO}, {EMAIL} y {WHATSAPP} se rellenan con DATOS.
 * Castellano, catalán e inglés, con las mismas secciones (la prueba lo comprueba).
 */
window.INS_PRIVACIDAD = {
  DATOS: {
    RESPONSABLE: 'Konamigas S.L.',
    NIF: 'B19967843',
    DOMICILIO: 'c/ Balmes 426, 08022 Barcelona',
    EMAIL: 'konamigasbarcelona@gmail.com',
    WHATSAPP: '+34 613 072 544'
  },

  es: {
    titulo: 'Política de privacidad',
    actualizada: 'Última actualización: 2 de noviembre de 2026',
    secciones: [
      ['Quién trata tus datos', [
        'El responsable es {RESPONSABLE} (Konamigas), con NIF {NIF} y domicilio en {DOMICILIO}.',
        'Para cualquier cosa sobre tus datos, escríbenos a {EMAIL} o por WhatsApp al {WHATSAPP}.'
      ]],
      ['Qué datos tratamos', [
        'Al inscribir un equipo: nombre del equipo, nivel, días que os van bien, cuántas sois, si buscáis jugadoras y vuestros comentarios. De la capitana: nombre y apellidos, teléfono, email e idioma. Si pedís factura: razón social, NIF o CIF, dirección fiscal y email.',
        'Al inscribirte como jugadora: nombre y apellidos, fecha de nacimiento, DNI, NIE o pasaporte, teléfono, email, idioma, usuario de Instagram (si lo das), dorsal y talla, cómo nos conociste, tus comentarios y lo que aceptas.',
        'Si te apuntas para buscar equipo: tus datos de contacto, fecha de nacimiento, nivel, días que te van bien, si juegas de portera y los equipos que te interesan.',
        'Durante la temporada: tu equipo, partidos, resultados, goles y sanciones. Fotos y vídeos, solo si lo aceptas.',
        'No pedimos datos de salud. Si pides información del seguro médico, solo guardamos que la has pedido.'
      ]],
      ['Para qué los usamos y por qué podemos hacerlo', [
        'Para gestionar tu inscripción y la competición (ligas, calendario, camisetas, avisos de la liga). Es necesario para darte el servicio que pides (artículo 6.1.b del RGPD).',
        'Para facturar y cumplir nuestras obligaciones contables y fiscales. Lo exige la ley (artículo 6.1.c).',
        'Para escribirte por WhatsApp o email con avisos importantes y novedades de la liga, por nuestro interés legítimo en informar a quien participa (artículo 6.1.f). Puedes pedirnos que paremos cuando quieras.',
        'Para usar tus datos de participación (nombre, resultados, estadísticas) en comunicaciones de la liga y publicar fotos y vídeos en los que salgas, solo con tu consentimiento (artículo 6.1.a).',
        'Para que salgas en el banco de jugadoras (nombre con la inicial del apellido, edad aproximada, nivel y días; y tu teléfono solo si lo marcas aparte), solo con tu consentimiento.',
        'Para inscribirte hay que tener 15 años cumplidos. En España, desde los 14 años se puede consentir el tratamiento de los propios datos (artículo 7 de la LOPDGDD).'
      ]],
      ['Quién más ve tus datos', [
        'No vendemos tus datos ni los cedemos para publicidad.',
        'Los ve el equipo de Konamigas que organiza la liga, cada uno lo que necesita para su trabajo (por ejemplo, el árbitro ve las jugadoras de su partido).',
        'Los tratan, solo por encargo nuestro, los proveedores que nos dan servicio: Google (donde guardamos los datos), Utilo (que hace y mantiene esta página y la app de gestión), GitHub (que aloja esta página, sin guardar tus datos), WhatsApp (Meta) cuando nos escribimos por ahí, la app de resultados de la liga y nuestra gestoría.',
        'La aseguradora, solo si contratas el seguro y con tu permiso.',
        'Lo que aparece en el banco de jugadoras y equipos lo puede ver cualquiera que abra la página.',
        'Algunos de estos proveedores (Google, Meta, GitHub) pueden tratar datos fuera de la Unión Europea, en Estados Unidos, con las garantías del Marco de Privacidad de Datos UE-EE. UU. o de cláusulas contractuales tipo de la Comisión Europea.'
      ]],
      ['Cuánto tiempo los guardamos', [
        'Mientras participes en la liga y hasta cinco años después de tu última temporada, para que puedas volver a inscribirte sin repetirlo todo y para guardar el historial de la liga. Antes, si nos pides que los borremos.',
        'Los datos de facturación, el tiempo que obliga la ley (seis años).',
        'Las fotos y vídeos publicados, hasta que retires tu consentimiento.',
        'Lo que dejas en el banco, hasta que salgas de él o acabe la competición.'
      ]],
      ['Tus derechos', [
        'Puedes pedirnos acceder a tus datos, corregirlos, borrarlos, oponerte a un uso, limitarlo o llevártelos (portabilidad), y retirar en cualquier momento un consentimiento que nos hayas dado (lo hecho antes sigue siendo válido).',
        'Escríbenos a {EMAIL} con tu nombre y tu teléfono. Te contestamos en un mes como mucho.',
        'Si crees que no tratamos bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).'
      ]],
      ['Esta página y tu dispositivo', [
        'No usamos cookies de publicidad ni de análisis.',
        'La página guarda en tu propio navegador el idioma que eliges y, mientras rellenas un formulario, un borrador para que no lo pierdas (se borra al enviarlo). No nos llega a nosotros.',
        'Las tipografías de la página se cargan de Google Fonts, que recibe tu dirección IP al hacerlo.'
      ]],
      ['Cambios', [
        'Si cambiamos esta política, lo diremos en esta página con la fecha de la última actualización.'
      ]]
    ]
  },

  ca: {
    titulo: 'Política de privacitat',
    actualizada: 'Darrera actualització: 2 de novembre de 2026',
    secciones: [
      ['Qui tracta les teves dades', [
        'El responsable és {RESPONSABLE} (Konamigas), amb NIF {NIF} i domicili a {DOMICILIO}.',
        'Per a qualsevol cosa sobre les teves dades, escriu-nos a {EMAIL} o per WhatsApp al {WHATSAPP}.'
      ]],
      ['Quines dades tractem', [
        "En inscriure un equip: nom de l'equip, nivell, dies que us van bé, quantes sou, si busqueu jugadores i els vostres comentaris. De la capitana: nom i cognoms, telèfon, email i idioma. Si demaneu factura: raó social, NIF o CIF, adreça fiscal i email.",
        "En inscriure't com a jugadora: nom i cognoms, data de naixement, DNI, NIE o passaport, telèfon, email, idioma, usuari d'Instagram (si el dones), dorsal i talla, com ens vas conèixer, els teus comentaris i el que acceptes.",
        "Si t'apuntes per buscar equip: les teves dades de contacte, data de naixement, nivell, dies que et van bé, si jugues de portera i els equips que t'interessen.",
        'Durant la temporada: el teu equip, partits, resultats, gols i sancions. Fotos i vídeos, només si ho acceptes.',
        "No demanem dades de salut. Si demanes informació de l'assegurança mèdica, només guardem que l'has demanada."
      ]],
      ['Per a què les fem servir i per què podem fer-ho', [
        "Per gestionar la teva inscripció i la competició (lligues, calendari, samarretes, avisos de la lliga). És necessari per donar-te el servei que demanes (article 6.1.b del RGPD).",
        'Per facturar i complir les nostres obligacions comptables i fiscals. Ho exigeix la llei (article 6.1.c).',
        "Per escriure't per WhatsApp o email amb avisos importants i novetats de la lliga, pel nostre interès legítim a informar qui hi participa (article 6.1.f). Ens pots demanar que parem quan vulguis.",
        'Per fer servir les teves dades de participació (nom, resultats, estadístiques) en comunicacions de la lliga i publicar fotos i vídeos on surtis, només amb el teu consentiment (article 6.1.a).',
        'Perquè surtis a la borsa de jugadores (nom amb la inicial del cognom, edat aproximada, nivell i dies; i el teu telèfon només si ho marques a part), només amb el teu consentiment.',
        "Per inscriure't cal tenir 15 anys complerts. A Espanya, des dels 14 anys es pot consentir el tractament de les pròpies dades (article 7 de la LOPDGDD)."
      ]],
      ['Qui més veu les teves dades', [
        'No venem les teves dades ni les cedim per a publicitat.',
        "Les veu l'equip de Konamigas que organitza la lliga, cadascú el que necessita per a la seva feina (per exemple, l'àrbitre veu les jugadores del seu partit).",
        "Les tracten, només per encàrrec nostre, els proveïdors que ens donen servei: Google (on guardem les dades), Utilo (que fa i manté aquesta pàgina i l'app de gestió), GitHub (que allotja aquesta pàgina, sense guardar les teves dades), WhatsApp (Meta) quan ens escrivim per allà, l'app de resultats de la lliga i la nostra gestoria.",
        "L'asseguradora, només si contractes l'assegurança i amb el teu permís.",
        'El que surt a la borsa de jugadores i equips ho pot veure qualsevol que obri la pàgina.',
        "Alguns d'aquests proveïdors (Google, Meta, GitHub) poden tractar dades fora de la Unió Europea, als Estats Units, amb les garanties del Marc de Privacitat de Dades UE-EUA o de clàusules contractuals tipus de la Comissió Europea."
      ]],
      ['Quant de temps les guardem', [
        "Mentre participis a la lliga i fins a cinc anys després de la teva última temporada, perquè et puguis tornar a inscriure sense repetir-ho tot i per guardar l'historial de la lliga. Abans, si ens demanes que les esborrem.",
        'Les dades de facturació, el temps que obliga la llei (sis anys).',
        'Les fotos i vídeos publicats, fins que retiris el teu consentiment.',
        "El que deixes a la borsa, fins que en surtis o acabi la competició."
      ]],
      ['Els teus drets', [
        "Ens pots demanar accedir a les teves dades, corregir-les, esborrar-les, oposar-te a un ús, limitar-lo o endur-te-les (portabilitat), i retirar en qualsevol moment un consentiment que ens hagis donat (el que s'ha fet abans continua sent vàlid).",
        "Escriu-nos a {EMAIL} amb el teu nom i el teu telèfon. Et contestem en un mes com a màxim.",
        "Si creus que no tractem bé les teves dades, pots reclamar davant l'Agència Espanyola de Protecció de Dades (www.aepd.es)."
      ]],
      ['Aquesta pàgina i el teu dispositiu', [
        "No fem servir galetes de publicitat ni d'anàlisi.",
        "La pàgina guarda al teu propi navegador l'idioma que tries i, mentre omples un formulari, un esborrany perquè no el perdis (s'esborra en enviar-lo). No ens arriba a nosaltres.",
        'Les tipografies de la pàgina es carreguen de Google Fonts, que rep la teva adreça IP en fer-ho.'
      ]],
      ['Canvis', [
        "Si canviem aquesta política, ho direm en aquesta pàgina amb la data de la darrera actualització."
      ]]
    ]
  },

  en: {
    titulo: 'Privacy policy',
    actualizada: 'Last updated: 2 November 2026',
    secciones: [
      ['Who processes your data', [
        'The data controller is {RESPONSABLE} (Konamigas), tax ID {NIF}, registered address {DOMICILIO}.',
        'For anything about your data, write to us at {EMAIL} or on WhatsApp at {WHATSAPP}.'
      ]],
      ['What data we process', [
        "When registering a team: team name, level, days that suit you, how many of you there are, whether you're looking for players and your comments. From the captain: first and last name, phone, email and language. If you need an invoice: company name, tax ID, billing address and email.",
        'When registering as a player: first and last names, date of birth, ID card, NIE or passport, phone, email, language, Instagram username (if you give it), number and size, how you heard about us, your comments and what you accept.',
        "If you sign up to find a team: your contact details, date of birth, level, days that suit you, whether you're a goalkeeper and the teams you're interested in.",
        'During the season: your team, matches, results, goals and penalties. Photos and videos, only if you agree.',
        "We don't ask for health data. If you ask for information about the medical insurance, we only keep the fact that you asked."
      ]],
      ['What we use it for and on what basis', [
        'To manage your registration and the competition (leagues, fixtures, shirts, league notices). This is necessary to provide the service you ask for (article 6.1.b GDPR).',
        'To invoice and meet our accounting and tax obligations. This is required by law (article 6.1.c).',
        'To send you important notices and league news by WhatsApp or email, based on our legitimate interest in informing participants (article 6.1.f). You can ask us to stop at any time.',
        'To use your participation data (name, results, statistics) in league communications and to publish photos and videos you appear in, only with your consent (article 6.1.a).',
        'To show you on the players board (first name and surname initial, approximate age, level and days; and your phone only if you tick it separately), only with your consent.',
        'You must be at least 15 to register. In Spain, people aged 14 and over can consent to the processing of their own data (article 7 of the LOPDGDD).'
      ]],
      ['Who else sees your data', [
        "We don't sell your data or share it for advertising.",
        'The Konamigas team that runs the league sees it, each person only what they need for their job (for example, the referee sees the players of their match).',
        "It is processed, only on our behalf, by the providers that serve us: Google (where we store the data), Utilo (which builds and maintains this page and the management app), GitHub (which hosts this page, without storing your data), WhatsApp (Meta) when we message each other there, the league's results app and our accountants.",
        'The insurer, only if you take out the insurance and with your permission.',
        'What appears on the players & teams board can be seen by anyone who opens the page.',
        'Some of these providers (Google, Meta, GitHub) may process data outside the European Union, in the United States, under the EU-US Data Privacy Framework or the European Commission standard contractual clauses.'
      ]],
      ['How long we keep it', [
        "While you take part in the league and up to five years after your last season, so you can register again without repeating everything and so we can keep the league's history. Earlier, if you ask us to delete it.",
        'Billing data, for as long as the law requires (six years).',
        'Published photos and videos, until you withdraw your consent.',
        'What you leave on the board, until you leave it or the competition ends.'
      ]],
      ['Your rights', [
        "You can ask us to access, correct or delete your data, object to or restrict a use, or take it with you (portability), and you can withdraw any consent at any time (what was done before remains valid).",
        'Write to us at {EMAIL} with your name and phone number. We will reply within one month at most.',
        "If you think we aren't handling your data properly, you can complain to the Spanish Data Protection Agency (www.aepd.es)."
      ]],
      ['This page and your device', [
        "We don't use advertising or analytics cookies.",
        "The page stores in your own browser the language you choose and, while you fill in a form, a draft so you don't lose it (it is deleted when you send it). It never reaches us.",
        "The page's fonts are loaded from Google Fonts, which receives your IP address when they load."
      ]],
      ['Changes', [
        'If we change this policy, we will say so on this page with the date of the last update.'
      ]]
    ]
  }
};
