/* T0386 · Generado por node herramientas/montar.js utilo/plataforma --web desde clientes/utilo/plataforma/config.json: no se edita a mano. Lo lee nucleo/acceso-supabase.js. */
window.NUCLEO_MONTAJE = {
 "negocio": "Utilo",
 "nombreApp": "Utilo",
 "zona": "Europe/Madrid",
 "perfiles": [
  "admin",
  "responsable",
  "colaborador",
  "lector"
 ],
 "secciones": [
  {
   "id": "TABLERO",
   "modulo": "tablero",
   "titulo": "Tareas",
   "icono": "<rect x=\"3\" y=\"4\" width=\"5\" height=\"16\" rx=\"1\"/><rect x=\"10\" y=\"4\" width=\"5\" height=\"11\" rx=\"1\"/><rect x=\"17\" y=\"4\" width=\"4\" height=\"7\" rx=\"1\"/>",
   "web": "utilo/secciones/tablero.js",
   "version": "b4d5f13cc3",
   "perfiles": "todos",
   "config": {
    "VISTA": "ocho",
    "DIAS_CERRADAS": 30
   },
   "api": [
    "mover_tarea",
    "anotar",
    "personas_gestion"
   ]
  },
  {
   "id": "ENTREGAS",
   "modulo": "entregas",
   "titulo": "Entregas",
   "icono": "<path d=\"M3 7l9-4 9 4-9 4-9-4z\"/><path d=\"M3 7v10l9 4 9-4V7\"/><path d=\"M12 11v10\"/>",
   "web": "utilo/secciones/entregas.js",
   "version": "dcbe80ee17",
   "perfiles": "todos",
   "config": {
    "VER": "En marcha"
   },
   "api": []
  }
 ],
 "supabase": {
  "prod": {
   "url": "https://vguojgqeoaaowktbagbm.supabase.co",
   "clave": "sb_publishable_It-DNlk9IELXRCEEjH3DOg_PaQ9r0J4",
   "nombre": "utilo"
  },
  "dev": {
   "url": "https://wpjcdszlkzxbmqkqyjsn.supabase.co",
   "clave": "sb_publishable_bKp5qCd6Gk5NaToFOz0Wig_dKxkLaKV",
   "nombre": "utilo-dev"
  }
 },
 "esquema": {
  "zona": "Europe/Madrid",
  "tablas": {
   "INICIATIVAS": {
    "db": "iniciativas",
    "clave": "ID",
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
      "nombre": "INICIAL",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Activa",
       "Aparcada",
       "Cerrada"
      ]
     },
     {
      "nombre": "REVISAR_EL",
      "tipo": "fecha"
     },
     {
      "nombre": "DESCRIPCION",
      "tipo": "texto"
     }
    ],
    "restricciones": {
     "iniciativas_pkey": [
      "ID"
     ],
     "iniciativas_estado_valores": [
      "ESTADO"
     ],
     "iniciativas_nombre_key": [
      "NOMBRE"
     ],
     "iniciativas_inicial_key": [
      "INICIAL"
     ]
    }
   },
   "EMPLEADOS": {
    "db": "empleados",
    "clave": "ID",
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
      "nombre": "DEPARTAMENTO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Coordinación",
       "Comercial y marca",
       "Producto y desarrollo",
       "Legal y administración",
       "Control"
      ]
     },
     {
      "nombre": "ENCARGO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "DOCUMENTO",
      "tipo": "texto"
     },
     {
      "nombre": "MODELO",
      "tipo": "texto"
     },
     {
      "nombre": "FICHA",
      "tipo": "texto"
     },
     {
      "nombre": "ACTIVO",
      "tipo": "booleano"
     }
    ],
    "restricciones": {
     "empleados_pkey": [
      "ID"
     ],
     "empleados_departamento_valores": [
      "DEPARTAMENTO"
     ],
     "empleados_nombre_key": [
      "NOMBRE"
     ]
    }
   },
   "ENTREGAS": {
    "db": "entregas",
    "clave": "ID",
    "prefijo": "E",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "INICIATIVA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INICIATIVAS"
     },
     {
      "nombre": "NUMERO",
      "tipo": "numero",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Planificada",
       "En curso",
       "Entregada",
       "Aplazada",
       "Descartada"
      ]
     },
     {
      "nombre": "FECHA_INICIO",
      "tipo": "fecha"
     },
     {
      "nombre": "FECHA_PREVISTA",
      "tipo": "fecha"
     },
     {
      "nombre": "FECHA_ENTREGA",
      "tipo": "fecha"
     },
     {
      "nombre": "QUE_INCLUYE",
      "tipo": "texto"
     },
     {
      "nombre": "CRITERIO",
      "tipo": "texto"
     },
     {
      "nombre": "RESUMEN",
      "tipo": "texto"
     }
    ],
    "restricciones": {
     "entregas_pkey": [
      "ID"
     ],
     "entregas_id_formato": [
      "ID"
     ],
     "entregas_iniciativa_fkey": [
      "INICIATIVA"
     ],
     "entregas_estado_valores": [
      "ESTADO"
     ],
     "entregas_iniciativa_numero_key": [
      "INICIATIVA",
      "NUMERO"
     ]
    }
   },
   "TAREAS": {
    "db": "tareas",
    "clave": "ID",
    "prefijo": "T",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "INICIATIVA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INICIATIVAS"
     },
     {
      "nombre": "EPICA",
      "tipo": "texto"
     },
     {
      "nombre": "TITULO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "P",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "!",
       "!!",
       "!!!",
       "!!!!"
      ]
     },
     {
      "nombre": "T",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "XS",
       "S",
       "M",
       "L",
       "XL"
      ]
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Esperando",
       "En cola",
       "En curso",
       "Necesita tu respuesta",
       "Bloqueada",
       "Para revisar",
       "Aprobada",
       "Entregada",
       "Aplazada",
       "Descartada"
      ]
     },
     {
      "nombre": "FASE",
      "tipo": "lista",
      "valores": [
       "Comprobando",
       "Haciendo",
       "Revisores",
       "Corrigiendo",
       "Cerrando"
      ]
     },
     {
      "nombre": "ASIGNADO",
      "tipo": "persona",
      "obligatoria": true
     },
     {
      "nombre": "PIDE",
      "tipo": "persona",
      "obligatoria": true
     },
     {
      "nombre": "REVISA",
      "tipo": "persona",
      "obligatoria": true
     },
     {
      "nombre": "EMPLEADO",
      "tipo": "ref",
      "ref": "EMPLEADOS"
     },
     {
      "nombre": "ENTREGA",
      "tipo": "ref",
      "ref": "ENTREGAS"
     },
     {
      "nombre": "DEADLINE",
      "tipo": "fecha"
     },
     {
      "nombre": "DISPONIBLE_DESDE",
      "tipo": "fecha"
     },
     {
      "nombre": "REVISAR_EL",
      "tipo": "fecha"
     },
     {
      "nombre": "MOTIVO_BLOQUEO",
      "tipo": "lista",
      "valores": [
       "Falta material del cliente",
       "Falta un acceso",
       "Problema técnico",
       "Un tercero"
      ]
     },
     {
      "nombre": "PREGUNTA",
      "tipo": "texto"
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto"
     },
     {
      "nombre": "PUBLICAR",
      "tipo": "booleano"
     },
     {
      "nombre": "URGENTE",
      "tipo": "booleano"
     },
     {
      "nombre": "FECHA_CIERRE",
      "tipo": "fecha"
     },
     {
      "nombre": "DESCRIPCION",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "DOCUMENTOS_RELEVANTES",
      "tipo": "texto"
     },
     {
      "nombre": "CONCLUSIONES",
      "tipo": "texto"
     },
     {
      "nombre": "HERRAMIENTA",
      "tipo": "lista",
      "valores": [
       "Chat",
       "Cowork",
       "Claude Code"
      ]
     },
     {
      "nombre": "AUTONOMA",
      "tipo": "booleano"
     },
     {
      "nombre": "MODELO",
      "tipo": "lista",
      "valores": [
       "pequeño",
       "mediano",
       "grande"
      ]
     },
     {
      "nombre": "CREADA",
      "tipo": "fecha_hora",
      "obligatoria": true
     }
    ],
    "restricciones": {
     "tareas_pkey": [
      "ID"
     ],
     "tareas_id_formato": [
      "ID"
     ],
     "tareas_iniciativa_fkey": [
      "INICIATIVA"
     ],
     "tareas_p_valores": [
      "P"
     ],
     "tareas_t_valores": [
      "T"
     ],
     "tareas_estado_valores": [
      "ESTADO"
     ],
     "tareas_fase_valores": [
      "FASE"
     ],
     "tareas_asignado_fkey": [
      "ASIGNADO"
     ],
     "tareas_pide_fkey": [
      "PIDE"
     ],
     "tareas_revisa_fkey": [
      "REVISA"
     ],
     "tareas_empleado_fkey": [
      "EMPLEADO"
     ],
     "tareas_entrega_fkey": [
      "ENTREGA"
     ],
     "tareas_motivo_bloqueo_valores": [
      "MOTIVO_BLOQUEO"
     ],
     "tareas_herramienta_valores": [
      "HERRAMIENTA"
     ],
     "tareas_modelo_valores": [
      "MODELO"
     ]
    }
   },
   "DEPENDENCIAS": {
    "db": "dependencias",
    "clave": "ID",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "TAREA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TAREAS"
     },
     {
      "nombre": "DE",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TAREAS"
     }
    ],
    "restricciones": {
     "dependencias_pkey": [
      "ID"
     ],
     "dependencias_tarea_fkey": [
      "TAREA"
     ],
     "dependencias_de_fkey": [
      "DE"
     ],
     "dependencias_tarea_de_key": [
      "TAREA",
      "DE"
     ]
    }
   },
   "BITACORA": {
    "db": "bitacora",
    "clave": "ID",
    "prefijo": "B",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "TAREA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TAREAS"
     },
     {
      "nombre": "CUANDO",
      "tipo": "fecha_hora",
      "obligatoria": true
     },
     {
      "nombre": "QUIEN",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "PERSONA",
      "tipo": "persona"
     },
     {
      "nombre": "EMPLEADO",
      "tipo": "ref",
      "ref": "EMPLEADOS"
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Creada",
       "Estado",
       "Nota",
       "Respuesta",
       "Revisión",
       "Sistema"
      ]
     },
     {
      "nombre": "TEXTO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ESTADO_ANTES",
      "tipo": "texto"
     },
     {
      "nombre": "ESTADO_DESPUES",
      "tipo": "texto"
     }
    ],
    "restricciones": {
     "bitacora_pkey": [
      "ID"
     ],
     "bitacora_id_formato": [
      "ID"
     ],
     "bitacora_tarea_fkey": [
      "TAREA"
     ],
     "bitacora_persona_fkey": [
      "PERSONA"
     ],
     "bitacora_empleado_fkey": [
      "EMPLEADO"
     ],
     "bitacora_tipo_valores": [
      "TIPO"
     ]
    }
   },
   "TABLERO": {
    "db": "tablero",
    "clave": "ID",
    "de": "TAREAS",
    "soloLeer": true,
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "INICIATIVA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INICIATIVAS"
     },
     {
      "nombre": "EPICA",
      "tipo": "texto"
     },
     {
      "nombre": "TITULO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "P",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "!",
       "!!",
       "!!!",
       "!!!!"
      ]
     },
     {
      "nombre": "T",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "XS",
       "S",
       "M",
       "L",
       "XL"
      ]
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Esperando",
       "En cola",
       "En curso",
       "Necesita tu respuesta",
       "Bloqueada",
       "Para revisar",
       "Aprobada",
       "Entregada",
       "Aplazada",
       "Descartada"
      ]
     },
     {
      "nombre": "FASE",
      "tipo": "lista",
      "valores": [
       "Comprobando",
       "Haciendo",
       "Revisores",
       "Corrigiendo",
       "Cerrando"
      ]
     },
     {
      "nombre": "ASIGNADO",
      "tipo": "persona",
      "obligatoria": true
     },
     {
      "nombre": "PIDE",
      "tipo": "persona",
      "obligatoria": true
     },
     {
      "nombre": "REVISA",
      "tipo": "persona",
      "obligatoria": true
     },
     {
      "nombre": "EMPLEADO",
      "tipo": "ref",
      "ref": "EMPLEADOS"
     },
     {
      "nombre": "ENTREGA",
      "tipo": "ref",
      "ref": "ENTREGAS"
     },
     {
      "nombre": "DEADLINE",
      "tipo": "fecha"
     },
     {
      "nombre": "DISPONIBLE_DESDE",
      "tipo": "fecha"
     },
     {
      "nombre": "REVISAR_EL",
      "tipo": "fecha"
     },
     {
      "nombre": "MOTIVO_BLOQUEO",
      "tipo": "lista",
      "valores": [
       "Falta material del cliente",
       "Falta un acceso",
       "Problema técnico",
       "Un tercero"
      ]
     },
     {
      "nombre": "PREGUNTA",
      "tipo": "texto"
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto"
     },
     {
      "nombre": "PUBLICAR",
      "tipo": "booleano"
     },
     {
      "nombre": "URGENTE",
      "tipo": "booleano"
     },
     {
      "nombre": "FECHA_CIERRE",
      "tipo": "fecha"
     },
     {
      "nombre": "DESCRIPCION",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "DOCUMENTOS_RELEVANTES",
      "tipo": "texto"
     },
     {
      "nombre": "CONCLUSIONES",
      "tipo": "texto"
     },
     {
      "nombre": "HERRAMIENTA",
      "tipo": "lista",
      "valores": [
       "Chat",
       "Cowork",
       "Claude Code"
      ]
     },
     {
      "nombre": "AUTONOMA",
      "tipo": "booleano"
     },
     {
      "nombre": "MODELO",
      "tipo": "lista",
      "valores": [
       "pequeño",
       "mediano",
       "grande"
      ]
     },
     {
      "nombre": "CREADA",
      "tipo": "fecha_hora",
      "obligatoria": true
     },
     {
      "nombre": "ENTREGA_CORTA",
      "tipo": "texto"
     },
     {
      "nombre": "EN_MANOS_TIPO",
      "tipo": "lista",
      "valores": [
       "persona",
       "empleado",
       "fuera",
       "espera"
      ]
     },
     {
      "nombre": "EN_MANOS_DE",
      "tipo": "texto"
     },
     {
      "nombre": "EN_MANOS_NOMBRE",
      "tipo": "texto"
     }
    ],
    "restricciones": {}
   }
  }
 }
};
