/* T0386 · Generado por node herramientas/montar.js konamigas/plataforma --web desde clientes/konamigas/plataforma/config.json: no se edita a mano. Lo lee nucleo/acceso-supabase.js. */
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
   "id": "LIGAS",
   "modulo": "competicion",
   "titulo": "Ligas",
   "icono": "<path d=\"M8 4h8v5a4 4 0 0 1-8 0z\"/><path d=\"M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4\"/><path d=\"M12 13v4M9 20h6\"/>",
   "web": "konamigas/secciones/competicion.js",
   "version": "1d1cacb5d1",
   "perfiles": "todos",
   "config": {},
   "api": [
    "ligas_acta",
    "ligas_partido",
    "ligas_carta",
    "ligas_mover",
    "ligas_jornadas",
    "ligas_recuperar",
    "ligas_huecos_mover",
    "ligas_dias_recuperar",
    "ligas_sancion",
    "ligas_sancion_quitar",
    "ligas_sanciones_faltan",
    "ligas_sancion_cuentas",
    "ligas_sancion_pagar",
    "ligas_sancion_despagar",
    "ligas_premio",
    "ligas_premio_quitar"
   ],
   "servidor": [
    "justificante"
   ]
  }
 ],
 "entrar": [
  "google",
  "codigo"
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
   "COLORES": {
    "db": "colores",
    "clave": "ID",
    "prefijo": "COL",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "CODIGO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "COLOR_HEX",
      "tipo": "texto"
     },
     {
      "nombre": "ESTAMPADO",
      "tipo": "texto"
     },
     {
      "nombre": "IMAGEN_URL",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "colores_pkey": [
      "ID"
     ],
     "colores_id_formato": [
      "ID"
     ],
     "colores_codigo_key": [
      "CODIGO"
     ]
    }
   },
   "TEMPORADAS": {
    "db": "temporadas",
    "clave": "ID",
    "prefijo": "TEM-",
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
      "nombre": "FECHA_INICIO",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_FIN",
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
     }
    ],
    "restricciones": {
     "temporadas_pkey": [
      "ID"
     ],
     "temporadas_id_formato": [
      "ID"
     ],
     "temporadas_nombre_key": [
      "NOMBRE"
     ]
    }
   },
   "COMPETICIONES": {
    "db": "competiciones",
    "clave": "ID",
    "prefijo": "COM",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_TEMPORADA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TEMPORADAS"
     },
     {
      "nombre": "ID_FORMATO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "FORMATOS"
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Liga",
       "Copa",
       "Supercopa",
       "Kopa di Mondo",
       "Torneo"
      ]
     },
     {
      "nombre": "INCLUIDA",
      "tipo": "booleano"
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE_COMERCIAL",
      "tipo": "texto"
     },
     {
      "nombre": "FECHA_INICIO",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_FIN",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "LINK_XPORTY",
      "tipo": "texto"
     },
     {
      "nombre": "DESCRIPCION",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     },
     {
      "nombre": "PARTIDOS_EQUIPO",
      "tipo": "numero"
     },
     {
      "nombre": "SENAL",
      "tipo": "importe"
     },
     {
      "nombre": "DESCANSO_CADA",
      "tipo": "numero"
     }
    ],
    "restricciones": {
     "competiciones_pkey": [
      "ID"
     ],
     "competiciones_id_formato": [
      "ID"
     ],
     "competiciones_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "competiciones_id_formato_fkey": [
      "ID_FORMATO"
     ],
     "competiciones_tipo_valores": [
      "TIPO"
     ],
     "competiciones_id_temporada_nombre_key": [
      "ID_TEMPORADA",
      "NOMBRE"
     ]
    }
   },
   "LIGAS": {
    "db": "ligas",
    "clave": "ID",
    "prefijo": "LIG",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_COMPETICION",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "DIA_SEMANA",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Lunes",
       "Martes",
       "Miércoles",
       "Jueves",
       "Viernes",
       "Sábado",
       "Domingo"
      ]
     },
     {
      "nombre": "NIVEL",
      "tipo": "lista",
      "valores": [
       "1",
       "2",
       "3",
       "4",
       "5"
      ]
     },
     {
      "nombre": "FECHA_INICIO",
      "tipo": "fecha"
     },
     {
      "nombre": "NUM_JORNADAS",
      "tipo": "numero"
     },
     {
      "nombre": "ID_GESTOR",
      "tipo": "ref",
      "ref": "STAFF"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     },
     {
      "nombre": "MINUTOS_PARTIDO",
      "tipo": "numero",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_CIERRE",
      "tipo": "fecha"
     },
     {
      "nombre": "APERTURA_COLORES",
      "tipo": "fecha_hora"
     }
    ],
    "restricciones": {
     "ligas_pkey": [
      "ID"
     ],
     "ligas_id_formato": [
      "ID"
     ],
     "ligas_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "ligas_dia_semana_valores": [
      "DIA_SEMANA"
     ],
     "ligas_nivel_valores": [
      "NIVEL"
     ],
     "ligas_id_gestor_fkey": [
      "ID_GESTOR"
     ],
     "ligas_id_competicion_nombre_key": [
      "ID_COMPETICION",
      "NOMBRE"
     ]
    }
   },
   "INSTALACIONES": {
    "db": "instalaciones",
    "clave": "ID",
    "prefijo": "INS",
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
      "nombre": "ENTIDAD",
      "tipo": "texto"
     },
     {
      "nombre": "DIRECCION",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "UBICACION_URL",
      "tipo": "texto"
     },
     {
      "nombre": "CONTACTO_NOMBRE",
      "tipo": "texto"
     },
     {
      "nombre": "CONTACTO_TELEFONO",
      "tipo": "texto"
     },
     {
      "nombre": "CONTACTO_EMAIL",
      "tipo": "texto"
     },
     {
      "nombre": "MATERIAL",
      "tipo": "texto"
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
      "nombre": "NOMBRE_CORTO",
      "tipo": "texto"
     }
    ],
    "restricciones": {
     "instalaciones_pkey": [
      "ID"
     ],
     "instalaciones_id_formato": [
      "ID"
     ],
     "instalaciones_nombre_key": [
      "NOMBRE"
     ],
     "instalaciones_nombre_corto_key": [
      "NOMBRE_CORTO"
     ]
    }
   },
   "CAMPOS": {
    "db": "campos",
    "clave": "ID",
    "prefijo": "CAM",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_INSTALACION",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSTALACIONES"
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ABREVIACION",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "F7",
       "F11",
       "Sala"
      ]
     },
     {
      "nombre": "SUPERFICIE",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Césped artificial",
       "Césped natural",
       "Cemento",
       "Parquet",
       "Tierra",
       "Otro"
      ]
     },
     {
      "nombre": "NOTAS",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "campos_pkey": [
      "ID"
     ],
     "campos_id_formato": [
      "ID"
     ],
     "campos_id_instalacion_fkey": [
      "ID_INSTALACION"
     ],
     "campos_tipo_valores": [
      "TIPO"
     ],
     "campos_superficie_valores": [
      "SUPERFICIE"
     ],
     "campos_abreviacion_key": [
      "ABREVIACION"
     ],
     "campos_id_instalacion_nombre_key": [
      "ID_INSTALACION",
      "NOMBRE"
     ]
    }
   },
   "CALENDARIO": {
    "db": "calendario",
    "clave": "FECHA",
    "columnas": [
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "FESTIVO",
      "tipo": "booleano"
     },
     {
      "nombre": "DESCANSO",
      "tipo": "booleano"
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "calendario_pkey": [
      "FECHA"
     ]
    }
   },
   "HUECOS": {
    "db": "huecos",
    "clave": "ID",
    "prefijo": "HUE",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "LIGAS"
     },
     {
      "nombre": "DIA_SEMANA",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Lunes",
       "Martes",
       "Miércoles",
       "Jueves",
       "Viernes",
       "Sábado",
       "Domingo"
      ]
     },
     {
      "nombre": "HORA",
      "tipo": "hora",
      "obligatoria": true
     },
     {
      "nombre": "ID_CAMPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CAMPOS"
     },
     {
      "nombre": "ID_ARBITRO",
      "tipo": "ref",
      "ref": "STAFF"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "huecos_pkey": [
      "ID"
     ],
     "huecos_id_formato": [
      "ID"
     ],
     "huecos_id_liga_fkey": [
      "ID_LIGA"
     ],
     "huecos_dia_semana_valores": [
      "DIA_SEMANA"
     ],
     "huecos_id_campo_fkey": [
      "ID_CAMPO"
     ],
     "huecos_id_arbitro_fkey": [
      "ID_ARBITRO"
     ],
     "huecos_id_liga_hora_id_campo_key": [
      "ID_LIGA",
      "HORA",
      "ID_CAMPO"
     ]
    }
   },
   "PARTIDOS": {
    "db": "partidos",
    "clave": "ID",
    "prefijo": "PAR",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "LIGAS"
     },
     {
      "nombre": "JORNADA",
      "tipo": "numero",
      "obligatoria": true
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "HORA",
      "tipo": "hora",
      "obligatoria": true
     },
     {
      "nombre": "ID_CAMPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CAMPOS"
     },
     {
      "nombre": "ID_HUECO",
      "tipo": "ref",
      "ref": "HUECOS"
     },
     {
      "nombre": "ID_ARBITRO",
      "tipo": "ref",
      "ref": "STAFF"
     },
     {
      "nombre": "ID_GESTOR",
      "tipo": "ref",
      "ref": "STAFF"
     },
     {
      "nombre": "ID_INSCRIPCION_LOCAL",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "ID_INSCRIPCION_VISITANTE",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "GOLES_LOCAL",
      "tipo": "numero"
     },
     {
      "nombre": "GOLES_VISITANTE",
      "tipo": "numero"
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Programado",
       "Jugado",
       "Aplazado",
       "Suspendido",
       "Anulado",
       "Libre"
      ]
     },
     {
      "nombre": "ID_ARBITRO_REAL",
      "tipo": "ref",
      "ref": "STAFF"
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto"
     },
     {
      "nombre": "ANULADO_POR",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "ID_PARTIDO_ORIGEN",
      "tipo": "ref",
      "ref": "PARTIDOS"
     },
     {
      "nombre": "NOTAS",
      "tipo": "texto"
     },
     {
      "nombre": "APLAZADO_POR",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "AVISO_APLAZAMIENTO",
      "tipo": "fecha"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "partidos_pkey": [
      "ID"
     ],
     "partidos_id_formato": [
      "ID"
     ],
     "partidos_id_liga_fkey": [
      "ID_LIGA"
     ],
     "partidos_id_campo_fkey": [
      "ID_CAMPO"
     ],
     "partidos_id_hueco_fkey": [
      "ID_HUECO"
     ],
     "partidos_id_arbitro_fkey": [
      "ID_ARBITRO"
     ],
     "partidos_id_gestor_fkey": [
      "ID_GESTOR"
     ],
     "partidos_id_inscripcion_local_fkey": [
      "ID_INSCRIPCION_LOCAL"
     ],
     "partidos_id_inscripcion_visitante_fkey": [
      "ID_INSCRIPCION_VISITANTE"
     ],
     "partidos_estado_valores": [
      "ESTADO"
     ],
     "partidos_id_arbitro_real_fkey": [
      "ID_ARBITRO_REAL"
     ],
     "partidos_anulado_por_fkey": [
      "ANULADO_POR"
     ],
     "partidos_id_partido_origen_fkey": [
      "ID_PARTIDO_ORIGEN"
     ],
     "partidos_aplazado_por_fkey": [
      "APLAZADO_POR"
     ],
     "partidos_id_campo_fecha_hora_key": [
      "ID_CAMPO",
      "FECHA",
      "HORA"
     ]
    }
   },
   "GOLES": {
    "db": "goles",
    "clave": "ID",
    "prefijo": "GOL",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_PARTIDO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "PARTIDOS"
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "ID_INSCRIPCION_JUGADORA",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_JUGADORAS"
     },
     {
      "nombre": "ID_STAFF",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "STAFF"
     },
     {
      "nombre": "NOTAS",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "goles_pkey": [
      "ID"
     ],
     "goles_id_formato": [
      "ID"
     ],
     "goles_id_partido_fkey": [
      "ID_PARTIDO"
     ],
     "goles_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "goles_id_inscripcion_jugadora_fkey": [
      "ID_INSCRIPCION_JUGADORA"
     ],
     "goles_id_staff_fkey": [
      "ID_STAFF"
     ]
    }
   },
   "SANCIONES": {
    "db": "sanciones",
    "clave": "ID",
    "prefijo": "SAN",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_PARTIDO",
      "tipo": "ref",
      "ref": "PARTIDOS"
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "No presentado",
       "Aplazamiento fuera de plazo",
       "Aplazamiento sin carta",
       "Retraso",
       "Alineación indebida",
       "Conducta",
       "Otro"
      ]
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "IMPORTE",
      "tipo": "importe"
     },
     {
      "nombre": "FECHA_PAGO",
      "tipo": "fecha"
     },
     {
      "nombre": "COMPENSACION",
      "tipo": "importe"
     },
     {
      "nombre": "FECHA_COMPENSACION",
      "tipo": "fecha"
     },
     {
      "nombre": "PARA_ARBITRO",
      "tipo": "importe"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "sanciones_pkey": [
      "ID"
     ],
     "sanciones_id_formato": [
      "ID"
     ],
     "sanciones_id_partido_fkey": [
      "ID_PARTIDO"
     ],
     "sanciones_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "sanciones_tipo_valores": [
      "TIPO"
     ]
    }
   },
   "PREMIOS": {
    "db": "premios",
    "clave": "ID",
    "prefijo": "PRM",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_COMPETICION",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "ID_INSCRIPCION_JUGADORA",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_JUGADORAS"
     },
     {
      "nombre": "FECHA_ENTREGA",
      "tipo": "fecha"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "premios_pkey": [
      "ID"
     ],
     "premios_id_formato": [
      "ID"
     ],
     "premios_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "premios_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "premios_id_inscripcion_jugadora_fkey": [
      "ID_INSCRIPCION_JUGADORA"
     ],
     "premios_id_competicion_nombre_key": [
      "ID_COMPETICION",
      "NOMBRE"
     ]
    }
   },
   "STAFF": {
    "db": "staff",
    "clave": "ID",
    "prefijo": "STA",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "APODO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "APELLIDOS",
      "tipo": "texto",
      "obligatoria": true
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
      "nombre": "TALLA",
      "tipo": "lista",
      "valores": [
       "XS",
       "S",
       "M",
       "L",
       "XL",
       "XXL"
      ]
     },
     {
      "nombre": "ES_ARBITRO",
      "tipo": "booleano"
     },
     {
      "nombre": "ES_GESTOR",
      "tipo": "booleano"
     },
     {
      "nombre": "ACTIVO",
      "tipo": "booleano"
     },
     {
      "nombre": "FECHA_ALTA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     },
     {
      "nombre": "GUARDA_DINERO",
      "tipo": "booleano"
     },
     {
      "nombre": "PERSONA",
      "tipo": "persona"
     }
    ],
    "restricciones": {
     "staff_pkey": [
      "ID"
     ],
     "staff_id_formato": [
      "ID"
     ],
     "staff_tipo_documento_valores": [
      "TIPO_DOCUMENTO"
     ],
     "staff_talla_valores": [
      "TALLA"
     ],
     "staff_persona_fkey": [
      "PERSONA"
     ],
     "staff_apodo_key": [
      "APODO"
     ],
     "staff_tipo_documento_num_documento_key": [
      "TIPO_DOCUMENTO",
      "NUM_DOCUMENTO"
     ],
     "staff_telefono_key": [
      "TELEFONO"
     ],
     "staff_persona_key": [
      "PERSONA"
     ]
    }
   },
   "CONFIG": {
    "db": "config",
    "clave": "ID",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "VALOR",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "PARA_QUE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "config_pkey": [
      "ID"
     ]
    }
   },
   "EQUIPOS_INSCRITOS": {
    "db": "equipos_inscritos",
    "clave": "ID",
    "de": "INSCRIPCIONES_EQUIPOS",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_EQUIPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "EQUIPOS"
     },
     {
      "nombre": "ID_COMPETICION",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "ref",
      "ref": "LIGAS"
     },
     {
      "nombre": "NOMBRE_EQUIPO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ID_COLOR",
      "tipo": "ref",
      "ref": "COLORES"
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Solicitada",
       "Confirmada",
       "Baja"
      ]
     }
    ],
    "restricciones": {}
   },
   "STAFF_NOMBRES": {
    "db": "staff_nombres",
    "clave": "ID",
    "de": "STAFF",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "APODO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ES_ARBITRO",
      "tipo": "booleano"
     },
     {
      "nombre": "ES_GESTOR",
      "tipo": "booleano"
     },
     {
      "nombre": "ACTIVO",
      "tipo": "booleano"
     }
    ],
    "restricciones": {}
   },
   "PLANTILLAS": {
    "db": "plantillas",
    "clave": "ID",
    "de": "INSCRIPCIONES_JUGADORAS",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_JUGADORA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "JUGADORAS"
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "DORSAL",
      "tipo": "texto"
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Activa",
       "Baja"
      ]
     },
     {
      "nombre": "TALLA",
      "tipo": "lista",
      "valores": [
       "XS",
       "S",
       "M",
       "L",
       "XL",
       "XXL"
      ]
     },
     {
      "nombre": "COMPLETA",
      "tipo": "booleano"
     }
    ],
    "restricciones": {}
   },
   "NOMBRES_JUGADORAS": {
    "db": "nombres_jugadoras",
    "clave": "ID",
    "de": "JUGADORAS",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto"
     }
    ],
    "restricciones": {}
   },
   "CONTACTOS_CAPITANAS": {
    "db": "contactos_capitanas",
    "clave": "ID_INSCRIPCION_EQUIPO",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "texto"
     },
     {
      "nombre": "NOMBRE_EQUIPO",
      "tipo": "texto"
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "texto"
     },
     {
      "nombre": "ID_JUGADORA",
      "tipo": "texto"
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto"
     },
     {
      "nombre": "TELEFONO",
      "tipo": "texto"
     },
     {
      "nombre": "EMAIL",
      "tipo": "texto"
     }
    ],
    "restricciones": {}
   },
   "CLASIFICACION": {
    "db": "clasificacion",
    "clave": "ID_INSCRIPCION_EQUIPO",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID_LIGA",
      "tipo": "texto"
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "texto"
     },
     {
      "nombre": "NOMBRE_EQUIPO",
      "tipo": "texto"
     },
     {
      "nombre": "PUESTO",
      "tipo": "numero"
     },
     {
      "nombre": "PJ",
      "tipo": "numero"
     },
     {
      "nombre": "PG",
      "tipo": "numero"
     },
     {
      "nombre": "PE",
      "tipo": "numero"
     },
     {
      "nombre": "PP",
      "tipo": "numero"
     },
     {
      "nombre": "GF",
      "tipo": "numero"
     },
     {
      "nombre": "GC",
      "tipo": "numero"
     },
     {
      "nombre": "DG",
      "tipo": "numero"
     },
     {
      "nombre": "PTS",
      "tipo": "numero"
     },
     {
      "nombre": "POR_JUGAR",
      "tipo": "numero"
     },
     {
      "nombre": "RACHA",
      "tipo": "texto"
     },
     {
      "nombre": "BAJA",
      "tipo": "booleano"
     }
    ],
    "restricciones": {}
   },
   "LIGAS_RESUMEN": {
    "db": "ligas_resumen",
    "clave": "ID_LIGA",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID_LIGA",
      "tipo": "texto"
     },
     {
      "nombre": "JUGADOS",
      "tipo": "numero"
     },
     {
      "nombre": "GOLES",
      "tipo": "numero"
     }
    ],
    "restricciones": {}
   },
   "GOLEADORAS": {
    "db": "goleadoras",
    "clave": "ID_INSCRIPCION_JUGADORA",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID_LIGA",
      "tipo": "texto"
     },
     {
      "nombre": "ID_COMPETICION",
      "tipo": "texto"
     },
     {
      "nombre": "ID_TEMPORADA",
      "tipo": "texto"
     },
     {
      "nombre": "ID_JUGADORA",
      "tipo": "texto"
     },
     {
      "nombre": "ID_INSCRIPCION_JUGADORA",
      "tipo": "texto"
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "texto"
     },
     {
      "nombre": "GOLES",
      "tipo": "numero"
     },
     {
      "nombre": "PUESTO",
      "tipo": "numero"
     }
    ],
    "restricciones": {}
   },
   "PARTIDOS_DETALLE": {
    "db": "partidos_detalle",
    "clave": "ID",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "texto"
     },
     {
      "nombre": "GESTIONA",
      "tipo": "booleano"
     },
     {
      "nombre": "PUEDE",
      "tipo": "texto"
     },
     {
      "nombre": "MOVER",
      "tipo": "booleano"
     },
     {
      "nombre": "POR_RECUPERAR",
      "tipo": "booleano"
     },
     {
      "nombre": "RECUPERAR",
      "tipo": "booleano"
     },
     {
      "nombre": "RECUPERACION",
      "tipo": "texto"
     },
     {
      "nombre": "RECUPERA_FECHA",
      "tipo": "fecha"
     },
     {
      "nombre": "RECUPERA_HORA",
      "tipo": "hora"
     },
     {
      "nombre": "RECUPERA_CAMPO",
      "tipo": "texto"
     },
     {
      "nombre": "DEBE_LOCAL",
      "tipo": "importe"
     },
     {
      "nombre": "DEBE_VISITANTE",
      "tipo": "importe"
     },
     {
      "nombre": "SIN_SANCION",
      "tipo": "booleano"
     }
    ],
    "restricciones": {}
   },
   "JORNADAS": {
    "db": "jornadas",
    "clave": "ID",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "texto"
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "texto"
     },
     {
      "nombre": "JORNADA",
      "tipo": "numero"
     },
     {
      "nombre": "MOVIBLE",
      "tipo": "booleano"
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto"
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha"
     }
    ],
    "restricciones": {}
   },
   "LIGAS_GESTIONADAS": {
    "db": "ligas_gestionadas",
    "clave": "ID",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "texto"
     }
    ],
    "restricciones": {}
   },
   "EQUIPOS_DETALLE": {
    "db": "equipos_detalle",
    "clave": "ID",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "texto"
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "texto"
     },
     {
      "nombre": "GESTIONA",
      "tipo": "booleano"
     },
     {
      "nombre": "DEBE",
      "tipo": "importe"
     },
     {
      "nombre": "CARTA_USADA",
      "tipo": "texto"
     },
     {
      "nombre": "CARTA_USADA_FECHA",
      "tipo": "fecha"
     }
    ],
    "restricciones": {}
   }
  }
 }
};
