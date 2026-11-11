/* T0386 · Generado por node herramientas/montar.js konamigas/area --web desde clientes/konamigas/area/config.json: no se edita a mano. Lo lee nucleo/acceso-supabase.js. */
window.NUCLEO_MONTAJE = {
 "negocio": "Konamigas",
 "nombreApp": "Konamigas",
 "zona": "Europe/Madrid",
 "perfiles": [
  "admin",
  "socio",
  "gestor",
  "arbitro",
  "capitana",
  "jugadora"
 ],
 "secciones": [
  {
   "id": "MIFICHA",
   "modulo": "mificha",
   "titulo": "Tu ficha",
   "icono": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/><path d=\"M7.5 17c1-2 2.6-3 4.5-3s3.5 1 4.5 3\"/>",
   "web": "konamigas/secciones/mificha.js",
   "version": "ac11721c45",
   "perfiles": [
    "capitana",
    "jugadora"
   ],
   "config": {},
   "api": []
  }
 ],
 "entrar": [
  "codigo",
  "google"
 ],
 "supabase": {
  "prod": {
   "url": "https://kkeiitpfuxvosmiehftd.supabase.co",
   "clave": "sb_publishable_pP369PDRnSpjd8MjFEg0NA_qNcE0wys",
   "nombre": "konamigas"
  },
  "dev": {
   "url": "https://bizkhbuahaqmxmlrdios.supabase.co",
   "clave": "sb_publishable_-7pWx7lxVtCygyO-hYLhOA_IfA_xCLF",
   "nombre": "konamigas-dev"
  }
 },
 "esquema": {
  "zona": "Europe/Madrid",
  "tablas": {
   "JUGADORAS": {
    "db": "jugadoras",
    "clave": "ID",
    "prefijo": "J",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "APELLIDO_1",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "APELLIDO_2",
      "tipo": "texto"
     },
     {
      "nombre": "FECHA_NACIMIENTO",
      "tipo": "fecha"
     },
     {
      "nombre": "TIPO_DOCUMENTO",
      "tipo": "lista",
      "valores": [
       "DNI",
       "NIE",
       "Pasaporte",
       "Otro"
      ]
     },
     {
      "nombre": "NUM_DOCUMENTO",
      "tipo": "texto"
     },
     {
      "nombre": "TELEFONO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "EMAIL",
      "tipo": "texto"
     },
     {
      "nombre": "INSTAGRAM",
      "tipo": "texto"
     },
     {
      "nombre": "IDIOMA",
      "tipo": "lista",
      "valores": [
       "Castellano",
       "Català",
       "English"
      ]
     },
     {
      "nombre": "FECHA_ALTA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "NOTAS",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     },
     {
      "nombre": "PERSONA",
      "tipo": "persona"
     },
     {
      "nombre": "NOMBRE_PUBLICO",
      "tipo": "booleano"
     }
    ],
    "restricciones": {
     "jugadoras_pkey": [
      "ID"
     ],
     "jugadoras_id_formato": [
      "ID"
     ],
     "jugadoras_tipo_documento_valores": [
      "TIPO_DOCUMENTO"
     ],
     "jugadoras_idioma_valores": [
      "IDIOMA"
     ],
     "jugadoras_persona_fkey": [
      "PERSONA"
     ],
     "jugadoras_tipo_documento_num_documento_key": [
      "TIPO_DOCUMENTO",
      "NUM_DOCUMENTO"
     ],
     "jugadoras_telefono_key": [
      "TELEFONO"
     ],
     "jugadoras_persona_key": [
      "PERSONA"
     ]
    }
   }
  }
 }
};
