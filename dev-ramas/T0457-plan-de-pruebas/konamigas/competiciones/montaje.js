/* T0386 · Generado por node herramientas/montar.js konamigas/competiciones --web desde clientes/konamigas/competiciones/config.json: no se edita a mano. Lo lee nucleo/publica-supabase.js. */
window.NUCLEO_MONTAJE = {
 "negocio": "Konamigas",
 "nombreApp": "Konamigas",
 "zona": "Europe/Madrid",
 "publica": true,
 "secciones": [
  {
   "id": "LIGAS",
   "modulo": "competicion",
   "titulo": "Competiciones",
   "icono": "<path d=\"M8 4h8v5a4 4 0 0 1-8 0z\"/><path d=\"M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4\"/><path d=\"M12 13v4M9 20h6\"/>",
   "web": "konamigas/secciones/competicion.js",
   "version": "e318222612",
   "config": {},
   "api": []
  }
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
    },
    "soloLeer": true
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
    },
    "soloLeer": true
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
    },
    "soloLeer": true
   },
   "PARTIDOS": {
    "db": "partidos_publicos",
    "clave": "ID",
    "de": "PARTIDOS",
    "soloLeer": true,
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
      "nombre": "APLAZADO_POR",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "FASE",
      "tipo": "texto"
     },
     {
      "nombre": "RONDA",
      "tipo": "lista",
      "valores": [
       "Semifinal",
       "Final",
       "Tercer puesto"
      ]
     },
     {
      "nombre": "PUESTO_LOCAL",
      "tipo": "numero"
     },
     {
      "nombre": "PUESTO_VISITANTE",
      "tipo": "numero"
     },
     {
      "nombre": "PENALTIS_LOCAL",
      "tipo": "numero"
     },
     {
      "nombre": "PENALTIS_VISITANTE",
      "tipo": "numero"
     }
    ],
    "restricciones": {}
   },
   "GOLES": {
    "db": "goles_publicos",
    "clave": "ID",
    "de": "GOLES",
    "soloLeer": true,
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
      "nombre": "NOTAS",
      "tipo": "texto"
     }
    ],
    "restricciones": {}
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
    },
    "soloLeer": true
   },
   "INSTALACIONES": {
    "db": "instalaciones_publicas",
    "clave": "ID",
    "de": "INSTALACIONES",
    "soloLeer": true,
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
      "nombre": "DIRECCION",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "UBICACION_URL",
      "tipo": "texto"
     },
     {
      "nombre": "NOMBRE_CORTO",
      "tipo": "texto"
     }
    ],
    "restricciones": {}
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
     }
    ],
    "restricciones": {
     "calendario_pkey": [
      "FECHA"
     ]
    },
    "soloLeer": true
   },
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
    },
    "soloLeer": true
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
     },
     {
      "nombre": "FASE_FINAL",
      "tipo": "texto"
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
   }
  }
 }
};
