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
   "version": "901c54848c",
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
   "MODELOS": {
    "db": "modelos",
    "clave": "ID",
    "prefijo": "MOD",
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
      "nombre": "PRENDA",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ID_PROVEEDOR",
      "tipo": "ref",
      "ref": "CONTRAPARTES"
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
      "nombre": "DISENO_URL",
      "tipo": "texto"
     },
     {
      "nombre": "PEDIDO_MINIMO",
      "tipo": "numero"
     },
     {
      "nombre": "DIAS_ENTREGA",
      "tipo": "numero"
     }
    ],
    "restricciones": {
     "modelos_pkey": [
      "ID"
     ],
     "modelos_id_formato": [
      "ID"
     ],
     "modelos_id_proveedor_fkey": [
      "ID_PROVEEDOR"
     ],
     "modelos_nombre_key": [
      "NOMBRE"
     ]
    }
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
   "MODELOS_COMPETICION": {
    "db": "modelos_competicion",
    "clave": "ID",
    "prefijo": "MCO",
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
      "nombre": "ID_MODELO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "MODELOS"
     },
     {
      "nombre": "CAMISETAS_INCLUIDAS",
      "tipo": "numero",
      "obligatoria": true
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "modelos_competicion_pkey": [
      "ID"
     ],
     "modelos_competicion_id_formato": [
      "ID"
     ],
     "modelos_competicion_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "modelos_competicion_id_modelo_fkey": [
      "ID_MODELO"
     ],
     "modelos_competicion_id_competicion_id_modelo_key": [
      "ID_COMPETICION",
      "ID_MODELO"
     ]
    }
   },
   "PACKS": {
    "db": "packs",
    "clave": "ID",
    "prefijo": "PCK",
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
      "nombre": "DORSAL",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "TALLA",
      "tipo": "lista",
      "obligatoria": true,
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
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "packs_pkey": [
      "ID"
     ],
     "packs_id_formato": [
      "ID"
     ],
     "packs_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "packs_talla_valores": [
      "TALLA"
     ],
     "packs_id_competicion_dorsal_key": [
      "ID_COMPETICION",
      "DORSAL"
     ]
    }
   },
   "CATALOGO": {
    "db": "catalogo",
    "clave": "ID",
    "prefijo": "CAT",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_PROVEEDOR",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CONTRAPARTES"
     },
     {
      "nombre": "ID_MODELO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "MODELOS"
     },
     {
      "nombre": "ID_COLOR",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COLORES"
     },
     {
      "nombre": "CODIGO",
      "tipo": "texto"
     },
     {
      "nombre": "PRECIO",
      "tipo": "importe"
     },
     {
      "nombre": "ACTIVO",
      "tipo": "booleano"
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
     "catalogo_pkey": [
      "ID"
     ],
     "catalogo_id_formato": [
      "ID"
     ],
     "catalogo_id_proveedor_fkey": [
      "ID_PROVEEDOR"
     ],
     "catalogo_id_modelo_fkey": [
      "ID_MODELO"
     ],
     "catalogo_id_color_fkey": [
      "ID_COLOR"
     ],
     "catalogo_id_proveedor_id_modelo_id_color_key": [
      "ID_PROVEEDOR",
      "ID_MODELO",
      "ID_COLOR"
     ]
    }
   },
   "CAMISETAS": {
    "db": "camisetas",
    "clave": "ID",
    "prefijo": "CMS",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_INSCRIPCION_JUGADORA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSCRIPCIONES_JUGADORAS"
     },
     {
      "nombre": "ID_MODELO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "MODELOS"
     },
     {
      "nombre": "ID_COLOR",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COLORES"
     },
     {
      "nombre": "TALLA",
      "tipo": "lista",
      "obligatoria": true,
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
      "nombre": "DORSAL",
      "tipo": "texto"
     },
     {
      "nombre": "INCLUIDA",
      "tipo": "booleano"
     },
     {
      "nombre": "ID_PEDIDO",
      "tipo": "ref",
      "ref": "PEDIDOS"
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Por pedir",
       "Pedida",
       "Por preparar",
       "Preparada",
       "Entregada",
       "No llegó",
       "Defectuosa",
       "Sin camiseta"
      ]
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
     "camisetas_pkey": [
      "ID"
     ],
     "camisetas_id_formato": [
      "ID"
     ],
     "camisetas_id_inscripcion_jugadora_fkey": [
      "ID_INSCRIPCION_JUGADORA"
     ],
     "camisetas_id_modelo_fkey": [
      "ID_MODELO"
     ],
     "camisetas_id_color_fkey": [
      "ID_COLOR"
     ],
     "camisetas_talla_valores": [
      "TALLA"
     ],
     "camisetas_id_pedido_fkey": [
      "ID_PEDIDO"
     ],
     "camisetas_estado_valores": [
      "ESTADO"
     ]
    }
   },
   "PEDIDOS": {
    "db": "pedidos",
    "clave": "ID",
    "prefijo": "PED",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_MODELO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "MODELOS"
     },
     {
      "nombre": "ID_TEMPORADA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TEMPORADAS"
     },
     {
      "nombre": "ID_PROVEEDOR",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CONTRAPARTES"
     },
     {
      "nombre": "FECHA_PEDIDO",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_ESTIMADA",
      "tipo": "fecha"
     },
     {
      "nombre": "FECHA_RECIBIDO",
      "tipo": "fecha"
     },
     {
      "nombre": "CONFIRMADO",
      "tipo": "booleano"
     },
     {
      "nombre": "ID_FACTURA",
      "tipo": "ref",
      "ref": "FACTURAS"
     },
     {
      "nombre": "ARCHIVO_URL",
      "tipo": "texto"
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
     "pedidos_pkey": [
      "ID"
     ],
     "pedidos_id_formato": [
      "ID"
     ],
     "pedidos_id_modelo_fkey": [
      "ID_MODELO"
     ],
     "pedidos_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "pedidos_id_proveedor_fkey": [
      "ID_PROVEEDOR"
     ],
     "pedidos_id_factura_fkey": [
      "ID_FACTURA"
     ]
    }
   },
   "PEDIDOS_LINEAS": {
    "db": "pedidos_lineas",
    "clave": "ID",
    "prefijo": "PLI",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_PEDIDO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "PEDIDOS"
     },
     {
      "nombre": "ID_COLOR",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COLORES"
     },
     {
      "nombre": "DORSAL",
      "tipo": "texto"
     },
     {
      "nombre": "TALLA",
      "tipo": "lista",
      "obligatoria": true,
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
      "nombre": "CANTIDAD",
      "tipo": "numero",
      "obligatoria": true
     },
     {
      "nombre": "PRECIO_UNIDAD",
      "tipo": "importe"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "pedidos_lineas_pkey": [
      "ID"
     ],
     "pedidos_lineas_id_formato": [
      "ID"
     ],
     "pedidos_lineas_id_pedido_fkey": [
      "ID_PEDIDO"
     ],
     "pedidos_lineas_id_color_fkey": [
      "ID_COLOR"
     ],
     "pedidos_lineas_talla_valores": [
      "TALLA"
     ],
     "pedidos_lineas_id_pedido_id_color_dorsal_talla_key": [
      "ID_PEDIDO",
      "ID_COLOR",
      "DORSAL",
      "TALLA"
     ]
    }
   },
   "AJUSTES_STOCK": {
    "db": "ajustes_stock",
    "clave": "ID",
    "prefijo": "AJU",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "ID_MODELO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "MODELOS"
     },
     {
      "nombre": "ID_COLOR",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COLORES"
     },
     {
      "nombre": "DORSAL",
      "tipo": "texto"
     },
     {
      "nombre": "TALLA",
      "tipo": "lista",
      "obligatoria": true,
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
      "nombre": "CANTIDAD",
      "tipo": "numero",
      "obligatoria": true
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "valores": [
       "Recuento",
       "Regalada",
       "Donada",
       "Perdida",
       "Defectuosa",
       "No llegó",
       "Otro"
      ]
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
     "ajustes_stock_pkey": [
      "ID"
     ],
     "ajustes_stock_id_formato": [
      "ID"
     ],
     "ajustes_stock_id_modelo_fkey": [
      "ID_MODELO"
     ],
     "ajustes_stock_id_color_fkey": [
      "ID_COLOR"
     ],
     "ajustes_stock_talla_valores": [
      "TALLA"
     ],
     "ajustes_stock_tipo_valores": [
      "TIPO"
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
   "FORMATOS": {
    "db": "formatos",
    "clave": "ID",
    "prefijo": "FOR",
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
      "nombre": "DESCRIPCION",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "formatos_pkey": [
      "ID"
     ],
     "formatos_id_formato": [
      "ID"
     ],
     "formatos_nombre_key": [
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
   "COMPETICIONES_ORIGEN": {
    "db": "competiciones_origen",
    "clave": "ID",
    "prefijo": "COR",
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
      "nombre": "ID_COMPETICION_ORIGEN",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "CRITERIO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Todos",
       "Campeones",
       "No campeones",
       "Manual"
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
     "competiciones_origen_pkey": [
      "ID"
     ],
     "competiciones_origen_id_formato": [
      "ID"
     ],
     "competiciones_origen_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "competiciones_origen_id_competicion_origen_fkey": [
      "ID_COMPETICION_ORIGEN"
     ],
     "competiciones_origen_criterio_valores": [
      "CRITERIO"
     ],
     "competiciones_origen_id_competicion_id_competicion_origen_key": [
      "ID_COMPETICION",
      "ID_COMPETICION_ORIGEN"
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
   "CAMPOS_TEMPORADA": {
    "db": "campos_temporada",
    "clave": "ID",
    "prefijo": "CTP",
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
      "nombre": "ID_CAMPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CAMPOS"
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Candidato",
       "Negociando",
       "Contratado",
       "Descartado"
      ]
     },
     {
      "nombre": "PRECIO_HORA",
      "tipo": "importe"
     },
     {
      "nombre": "TIPO_IVA",
      "tipo": "lista",
      "valores": [
       "21%",
       "10%",
       "4%",
       "0%"
      ]
     },
     {
      "nombre": "CONDICIONES",
      "tipo": "texto"
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
     "campos_temporada_pkey": [
      "ID"
     ],
     "campos_temporada_id_formato": [
      "ID"
     ],
     "campos_temporada_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "campos_temporada_id_campo_fkey": [
      "ID_CAMPO"
     ],
     "campos_temporada_estado_valores": [
      "ESTADO"
     ],
     "campos_temporada_tipo_iva_valores": [
      "TIPO_IVA"
     ],
     "campos_temporada_id_temporada_id_campo_key": [
      "ID_TEMPORADA",
      "ID_CAMPO"
     ]
    }
   },
   "DISPONIBILIDAD_CAMPOS": {
    "db": "disponibilidad_campos",
    "clave": "ID",
    "prefijo": "DCA",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_CAMPO_TEMPORADA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CAMPOS_TEMPORADA"
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
      "nombre": "HORA_DESDE",
      "tipo": "hora",
      "obligatoria": true
     },
     {
      "nombre": "HORA_HASTA",
      "tipo": "hora",
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
      "nombre": "FECHA_DESDE",
      "tipo": "fecha"
     },
     {
      "nombre": "FECHA_HASTA",
      "tipo": "fecha"
     }
    ],
    "restricciones": {
     "disponibilidad_campos_pkey": [
      "ID"
     ],
     "disponibilidad_campos_id_formato": [
      "ID"
     ],
     "disponibilidad_campos_id_campo_temporada_fkey": [
      "ID_CAMPO_TEMPORADA"
     ],
     "disponibilidad_campos_dia_semana_valores": [
      "DIA_SEMANA"
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
   "DISPONIBILIDAD_STAFF": {
    "db": "disponibilidad_staff",
    "clave": "ID",
    "prefijo": "DST",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_STAFF",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "STAFF"
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
      "nombre": "HORA_DESDE",
      "tipo": "hora",
      "obligatoria": true
     },
     {
      "nombre": "HORA_HASTA",
      "tipo": "hora",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_DESDE",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_HASTA",
      "tipo": "fecha"
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
     "disponibilidad_staff_pkey": [
      "ID"
     ],
     "disponibilidad_staff_id_formato": [
      "ID"
     ],
     "disponibilidad_staff_id_staff_fkey": [
      "ID_STAFF"
     ],
     "disponibilidad_staff_dia_semana_valores": [
      "DIA_SEMANA"
     ]
    }
   },
   "MENSAJES_WHATSAPP": {
    "db": "mensajes_whatsapp",
    "clave": "ID",
    "prefijo": "MSG",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
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
      "nombre": "TELEFONO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ID_STAFF",
      "tipo": "ref",
      "ref": "STAFF"
     },
     {
      "nombre": "ID_PARTIDO",
      "tipo": "ref",
      "ref": "PARTIDOS"
     },
     {
      "nombre": "TIPO",
      "tipo": "texto"
     },
     {
      "nombre": "CATEGORIA",
      "tipo": "texto"
     },
     {
      "nombre": "MENSAJE",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "REVISADO",
      "tipo": "booleano"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "mensajes_whatsapp_pkey": [
      "ID"
     ],
     "mensajes_whatsapp_id_formato": [
      "ID"
     ],
     "mensajes_whatsapp_id_staff_fkey": [
      "ID_STAFF"
     ],
     "mensajes_whatsapp_id_partido_fkey": [
      "ID_PARTIDO"
     ]
    }
   },
   "LISTAS": {
    "db": "listas",
    "clave": "ID",
    "prefijo": "LIS",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "LISTA",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "VALOR",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ORDEN",
      "tipo": "numero"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "listas_pkey": [
      "ID"
     ],
     "listas_id_formato": [
      "ID"
     ],
     "listas_lista_valor_key": [
      "LISTA",
      "VALOR"
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
   "MOVIMIENTOS": {
    "db": "movimientos",
    "clave": "ID",
    "prefijo": "MOV",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Ingreso",
       "Gasto",
       "Interno"
      ]
     },
     {
      "nombre": "CONCEPTO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ID_CATEGORIA",
      "tipo": "ref",
      "ref": "CATEGORIAS"
     },
     {
      "nombre": "BASE",
      "tipo": "importe",
      "obligatoria": true
     },
     {
      "nombre": "TIPO_IVA",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "21%",
       "10%",
       "4%",
       "0%"
      ]
     },
     {
      "nombre": "ID_CUENTA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CUENTAS"
     },
     {
      "nombre": "ID_CUENTA_DESTINO",
      "tipo": "ref",
      "ref": "CUENTAS"
     },
     {
      "nombre": "ID_CONTRAPARTE",
      "tipo": "ref",
      "ref": "CONTRAPARTES"
     },
     {
      "nombre": "ID_TEMPORADA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TEMPORADAS"
     },
     {
      "nombre": "ID_COMPETICION",
      "tipo": "ref",
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "ID_LIGA",
      "tipo": "ref",
      "ref": "LIGAS"
     },
     {
      "nombre": "REF_TIPO",
      "tipo": "texto"
     },
     {
      "nombre": "REF_ID",
      "tipo": "texto"
     },
     {
      "nombre": "ID_FACTURA",
      "tipo": "ref",
      "ref": "FACTURAS"
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
     "movimientos_pkey": [
      "ID"
     ],
     "movimientos_id_formato": [
      "ID"
     ],
     "movimientos_tipo_valores": [
      "TIPO"
     ],
     "movimientos_id_categoria_fkey": [
      "ID_CATEGORIA"
     ],
     "movimientos_tipo_iva_valores": [
      "TIPO_IVA"
     ],
     "movimientos_id_cuenta_fkey": [
      "ID_CUENTA"
     ],
     "movimientos_id_cuenta_destino_fkey": [
      "ID_CUENTA_DESTINO"
     ],
     "movimientos_id_contraparte_fkey": [
      "ID_CONTRAPARTE"
     ],
     "movimientos_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "movimientos_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "movimientos_id_liga_fkey": [
      "ID_LIGA"
     ],
     "movimientos_id_factura_fkey": [
      "ID_FACTURA"
     ]
    }
   },
   "CATEGORIAS": {
    "db": "categorias",
    "clave": "ID",
    "prefijo": "CAT",
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
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Ingreso",
       "Gasto"
      ]
     },
     {
      "nombre": "GRUPO",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "categorias_pkey": [
      "ID"
     ],
     "categorias_id_formato": [
      "ID"
     ],
     "categorias_tipo_valores": [
      "TIPO"
     ],
     "categorias_nombre_key": [
      "NOMBRE"
     ]
    }
   },
   "CUENTAS": {
    "db": "cuentas",
    "clave": "ID",
    "prefijo": "CUE",
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
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Banco",
       "Caja",
       "Socio"
      ]
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "cuentas_pkey": [
      "ID"
     ],
     "cuentas_id_formato": [
      "ID"
     ],
     "cuentas_tipo_valores": [
      "TIPO"
     ],
     "cuentas_nombre_key": [
      "NOMBRE"
     ]
    }
   },
   "CONTRAPARTES": {
    "db": "contrapartes",
    "clave": "ID",
    "prefijo": "CTR",
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
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Proveedor",
       "Instalación",
       "Sponsor",
       "Staff",
       "Gestoría",
       "Otro"
      ]
     },
     {
      "nombre": "CONTACTO",
      "tipo": "texto"
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
     "contrapartes_pkey": [
      "ID"
     ],
     "contrapartes_id_formato": [
      "ID"
     ],
     "contrapartes_tipo_valores": [
      "TIPO"
     ],
     "contrapartes_nombre_key": [
      "NOMBRE"
     ]
    }
   },
   "FACTURAS": {
    "db": "facturas",
    "clave": "ID",
    "prefijo": "FAC",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Emitida",
       "Recibida",
       "Ticket"
      ]
     },
     {
      "nombre": "NUMERO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "ID_CONTRAPARTE",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CONTRAPARTES"
     },
     {
      "nombre": "BASE",
      "tipo": "importe",
      "obligatoria": true
     },
     {
      "nombre": "TIPO_IVA",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "21%",
       "10%",
       "4%",
       "0%"
      ]
     },
     {
      "nombre": "ARCHIVO_URL",
      "tipo": "texto"
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "valores": [
       "Pendiente",
       "Pagada",
       "Anulada"
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
     "facturas_pkey": [
      "ID"
     ],
     "facturas_id_formato": [
      "ID"
     ],
     "facturas_tipo_valores": [
      "TIPO"
     ],
     "facturas_id_contraparte_fkey": [
      "ID_CONTRAPARTE"
     ],
     "facturas_tipo_iva_valores": [
      "TIPO_IVA"
     ],
     "facturas_estado_valores": [
      "ESTADO"
     ],
     "facturas_tipo_numero_key": [
      "TIPO",
      "NUMERO"
     ]
    }
   },
   "PRESUPUESTOS": {
    "db": "presupuestos",
    "clave": "ID",
    "prefijo": "PRS",
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
      "nombre": "ID_COMPETICION",
      "tipo": "ref",
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "ID_CATEGORIA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "CATEGORIAS"
     },
     {
      "nombre": "IMPORTE",
      "tipo": "importe",
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
     "presupuestos_pkey": [
      "ID"
     ],
     "presupuestos_id_formato": [
      "ID"
     ],
     "presupuestos_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "presupuestos_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "presupuestos_id_categoria_fkey": [
      "ID_CATEGORIA"
     ],
     "presupuestos_id_temporada_id_competicion_id_categoria_key": [
      "ID_TEMPORADA",
      "ID_COMPETICION",
      "ID_CATEGORIA"
     ]
    }
   },
   "TARIFAS": {
    "db": "tarifas",
    "clave": "ID",
    "prefijo": "TAR",
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
      "nombre": "CONCEPTO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Inscripción equipo",
       "Árbitro partido",
       "Gestor partido",
       "Gestor jornada",
       "Camiseta"
      ]
     },
     {
      "nombre": "REF_ID",
      "tipo": "texto"
     },
     {
      "nombre": "UNIDADES_DESDE",
      "tipo": "numero"
     },
     {
      "nombre": "UNIDADES_HASTA",
      "tipo": "numero"
     },
     {
      "nombre": "PRECIO",
      "tipo": "importe",
      "obligatoria": true
     },
     {
      "nombre": "TIPO_IVA",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "21%",
       "10%",
       "4%",
       "0%"
      ]
     },
     {
      "nombre": "FECHA_DESDE",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "FECHA_HASTA",
      "tipo": "fecha"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "tarifas_pkey": [
      "ID"
     ],
     "tarifas_id_formato": [
      "ID"
     ],
     "tarifas_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "tarifas_concepto_valores": [
      "CONCEPTO"
     ],
     "tarifas_tipo_iva_valores": [
      "TIPO_IVA"
     ],
     "tarifas_id_temporada_concepto_ref_id_unidades_desde_fe_be286e3b": [
      "ID_TEMPORADA",
      "CONCEPTO",
      "REF_ID",
      "UNIDADES_DESDE",
      "FECHA_DESDE"
     ]
    }
   },
   "DESCUENTOS": {
    "db": "descuentos",
    "clave": "ID",
    "prefijo": "DES",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "IMPORTE",
      "tipo": "importe",
      "obligatoria": true
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
     "descuentos_pkey": [
      "ID"
     ],
     "descuentos_id_formato": [
      "ID"
     ],
     "descuentos_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ]
    }
   },
   "EQUIPOS": {
    "db": "equipos",
    "clave": "ID",
    "prefijo": "E",
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
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Liga",
       "Kopa di Mondo"
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
     }
    ],
    "restricciones": {
     "equipos_pkey": [
      "ID"
     ],
     "equipos_id_formato": [
      "ID"
     ],
     "equipos_tipo_valores": [
      "TIPO"
     ]
    }
   },
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
   },
   "INSCRIPCIONES_EQUIPOS": {
    "db": "inscripciones_equipos",
    "clave": "ID",
    "prefijo": "IE",
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
      "nombre": "ID_CAPITANA",
      "tipo": "ref",
      "ref": "JUGADORAS"
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
      "nombre": "EXPERIENCIA",
      "tipo": "texto"
     },
     {
      "nombre": "DISPONIBILIDAD",
      "tipo": "texto"
     },
     {
      "nombre": "PREFERENCIA_HORARIA",
      "tipo": "texto"
     },
     {
      "nombre": "COMENTARIOS",
      "tipo": "texto"
     },
     {
      "nombre": "NUM_JUGADORAS",
      "tipo": "numero"
     },
     {
      "nombre": "BUSCA_JUGADORAS",
      "tipo": "booleano"
     },
     {
      "nombre": "CUANTAS_BUSCA",
      "tipo": "numero"
     },
     {
      "nombre": "FACTURA_NOMBRE",
      "tipo": "texto"
     },
     {
      "nombre": "FACTURA_NIF",
      "tipo": "texto"
     },
     {
      "nombre": "FACTURA_DIRECCION",
      "tipo": "texto"
     },
     {
      "nombre": "FACTURA_EMAIL",
      "tipo": "texto"
     },
     {
      "nombre": "ID_COLOR",
      "tipo": "ref",
      "ref": "COLORES"
     },
     {
      "nombre": "ID_RESPONSABLE",
      "tipo": "ref",
      "ref": "STAFF"
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
      "nombre": "FECHA_INSCRIPCION",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "ORIGEN",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Formulario",
       "Clasificación",
       "Histórico",
       "Manual"
      ]
     },
     {
      "nombre": "ID_INSCRIPCION_ORIGEN",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "MENSAJE_INICIAL_ENVIADO",
      "tipo": "booleano"
     },
     {
      "nombre": "GRUPO_CREADO",
      "tipo": "booleano"
     },
     {
      "nombre": "EN_XPORTY",
      "tipo": "booleano"
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
      "nombre": "AVISO_LIGA_ENVIADO",
      "tipo": "booleano"
     }
    ],
    "restricciones": {
     "inscripciones_equipos_pkey": [
      "ID"
     ],
     "inscripciones_equipos_id_formato": [
      "ID"
     ],
     "inscripciones_equipos_id_equipo_fkey": [
      "ID_EQUIPO"
     ],
     "inscripciones_equipos_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "inscripciones_equipos_id_liga_fkey": [
      "ID_LIGA"
     ],
     "inscripciones_equipos_id_capitana_fkey": [
      "ID_CAPITANA"
     ],
     "inscripciones_equipos_nivel_valores": [
      "NIVEL"
     ],
     "inscripciones_equipos_id_color_fkey": [
      "ID_COLOR"
     ],
     "inscripciones_equipos_id_responsable_fkey": [
      "ID_RESPONSABLE"
     ],
     "inscripciones_equipos_estado_valores": [
      "ESTADO"
     ],
     "inscripciones_equipos_origen_valores": [
      "ORIGEN"
     ],
     "inscripciones_equipos_id_inscripcion_origen_fkey": [
      "ID_INSCRIPCION_ORIGEN"
     ],
     "inscripciones_equipos_id_equipo_id_competicion_key": [
      "ID_EQUIPO",
      "ID_COMPETICION"
     ]
    }
   },
   "INSCRIPCIONES_JUGADORAS": {
    "db": "inscripciones_jugadoras",
    "clave": "ID",
    "prefijo": "IJ",
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
      "nombre": "FECHA_INSCRIPCION",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "ACEPTA_NORMAS",
      "tipo": "booleano"
     },
     {
      "nombre": "ACEPTA_DERECHOS_IMAGEN",
      "tipo": "booleano"
     },
     {
      "nombre": "ACEPTA_DATOS",
      "tipo": "booleano"
     },
     {
      "nombre": "ACEPTA_RESPONSABILIDAD",
      "tipo": "booleano"
     },
     {
      "nombre": "COMO_NOS_CONOCIO",
      "tipo": "texto"
     },
     {
      "nombre": "INFO_SEGURO",
      "tipo": "booleano"
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
      "nombre": "COMENTARIOS",
      "tipo": "texto"
     },
     {
      "nombre": "ORIGEN",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Formulario",
       "Clasificación",
       "Histórico",
       "Manual"
      ]
     },
     {
      "nombre": "EN_XPORTY",
      "tipo": "booleano"
     },
     {
      "nombre": "EN_CONTACTOS_GOOGLE",
      "tipo": "booleano"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "inscripciones_jugadoras_pkey": [
      "ID"
     ],
     "inscripciones_jugadoras_id_formato": [
      "ID"
     ],
     "inscripciones_jugadoras_id_jugadora_fkey": [
      "ID_JUGADORA"
     ],
     "inscripciones_jugadoras_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "inscripciones_jugadoras_estado_valores": [
      "ESTADO"
     ],
     "inscripciones_jugadoras_talla_valores": [
      "TALLA"
     ],
     "inscripciones_jugadoras_origen_valores": [
      "ORIGEN"
     ],
     "inscripciones_jugadoras_id_jugadora_id_inscripcion_equipo_key": [
      "ID_JUGADORA",
      "ID_INSCRIPCION_EQUIPO"
     ],
     "inscripciones_jugadoras_id_inscripcion_equipo_dorsal_key": [
      "ID_INSCRIPCION_EQUIPO",
      "DORSAL"
     ]
    }
   },
   "SIN_EQUIPO": {
    "db": "sin_equipo",
    "clave": "ID",
    "prefijo": "SE",
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
      "nombre": "ID_COMPETICION",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "COMPETICIONES"
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Busca equipo",
       "Colocada",
       "Baja"
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
      "nombre": "DISPONIBILIDAD",
      "tipo": "texto"
     },
     {
      "nombre": "PORTERA",
      "tipo": "booleano"
     },
     {
      "nombre": "EN_BANCO",
      "tipo": "booleano"
     },
     {
      "nombre": "BANCO_TELEFONO",
      "tipo": "booleano"
     },
     {
      "nombre": "EQUIPOS_INTERES",
      "tipo": "texto"
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
      "nombre": "ACEPTA_DATOS",
      "tipo": "booleano"
     },
     {
      "nombre": "COMO_NOS_CONOCIO",
      "tipo": "texto"
     },
     {
      "nombre": "COMENTARIOS",
      "tipo": "texto"
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
     "sin_equipo_pkey": [
      "ID"
     ],
     "sin_equipo_id_formato": [
      "ID"
     ],
     "sin_equipo_id_jugadora_fkey": [
      "ID_JUGADORA"
     ],
     "sin_equipo_id_competicion_fkey": [
      "ID_COMPETICION"
     ],
     "sin_equipo_estado_valores": [
      "ESTADO"
     ],
     "sin_equipo_nivel_valores": [
      "NIVEL"
     ],
     "sin_equipo_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "sin_equipo_id_inscripcion_jugadora_fkey": [
      "ID_INSCRIPCION_JUGADORA"
     ],
     "sin_equipo_id_jugadora_id_competicion_key": [
      "ID_JUGADORA",
      "ID_COMPETICION"
     ]
    }
   },
   "FOTOS": {
    "db": "fotos",
    "clave": "ID",
    "prefijo": "FOT",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_JUGADORA",
      "tipo": "ref",
      "ref": "JUGADORAS"
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "ID_TEMPORADA",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "TEMPORADAS"
     },
     {
      "nombre": "ARCHIVO_URL",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "NOMBRE_ORIGINAL",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ESTADO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Vinculada",
       "Sin vincular"
      ]
     },
     {
      "nombre": "PUBLICABLE",
      "tipo": "booleano"
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "fotos_pkey": [
      "ID"
     ],
     "fotos_id_formato": [
      "ID"
     ],
     "fotos_id_jugadora_fkey": [
      "ID_JUGADORA"
     ],
     "fotos_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "fotos_id_temporada_fkey": [
      "ID_TEMPORADA"
     ],
     "fotos_estado_valores": [
      "ESTADO"
     ],
     "fotos_archivo_url_key": [
      "ARCHIVO_URL"
     ]
    }
   },
   "REVISIONES": {
    "db": "revisiones",
    "clave": "ID",
    "prefijo": "REV",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "TIPO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "ID_REGISTRO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "CANDIDATOS",
      "tipo": "texto"
     },
     {
      "nombre": "MOTIVO",
      "tipo": "texto",
      "obligatoria": true
     },
     {
      "nombre": "RESUELTO",
      "tipo": "booleano"
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha",
      "obligatoria": true
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "revisiones_pkey": [
      "ID"
     ],
     "revisiones_id_formato": [
      "ID"
     ]
    }
   },
   "INTERACCIONES": {
    "db": "interacciones",
    "clave": "ID",
    "prefijo": "INT",
    "columnas": [
     {
      "nombre": "ID",
      "tipo": "id",
      "obligatoria": true
     },
     {
      "nombre": "ID_INSCRIPCION_EQUIPO",
      "tipo": "ref",
      "obligatoria": true,
      "ref": "INSCRIPCIONES_EQUIPOS"
     },
     {
      "nombre": "FECHA",
      "tipo": "fecha_hora",
      "obligatoria": true
     },
     {
      "nombre": "TIPO",
      "tipo": "lista",
      "obligatoria": true,
      "valores": [
       "Pedir la señal",
       "Mensaje",
       "Llamada",
       "Correo",
       "Nota"
      ]
     },
     {
      "nombre": "CANAL",
      "tipo": "lista",
      "valores": [
       "WhatsApp",
       "Copiado",
       "Teléfono",
       "Correo",
       "En persona",
       "Otro"
      ]
     },
     {
      "nombre": "TEXTO",
      "tipo": "texto"
     },
     {
      "nombre": "PERSONA",
      "tipo": "texto"
     },
     {
      "nombre": "LOG",
      "tipo": "log"
     }
    ],
    "restricciones": {
     "interacciones_pkey": [
      "ID"
     ],
     "interacciones_id_formato": [
      "ID"
     ],
     "interacciones_id_inscripcion_equipo_fkey": [
      "ID_INSCRIPCION_EQUIPO"
     ],
     "interacciones_tipo_valores": [
      "TIPO"
     ],
     "interacciones_canal_valores": [
      "CANAL"
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
   }
  }
 }
};
