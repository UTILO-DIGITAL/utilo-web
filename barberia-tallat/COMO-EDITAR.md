# Cómo cambiar la demo de Barbería Tallat

La demo son tres archivos de esta carpeta y uno común. Casi todo se cambia en `ajustes.js`, sin tocar código.

| Quiero cambiar… | Archivo | Qué tocar |
|---|---|---|
| Nombre, logo, dirección, forma de pago | `ajustes.js` | `negocio`, `logo`, `tipo`, `calle`, `barrio`, `ciudad`, `pago` |
| Horario y días que abre | `ajustes.js` | `horario` |
| Barberos | `ajustes.js` | `barberos` |
| Servicios, duración y precios | `ajustes.js` | `servicios` |
| El cliente con el que empieza (Jordi) y sus cortes | `ajustes.js` | `clienteHabitual` |
| Cifras del mes del mostrador | `ajustes.js` | `cifrasDelMes` |
| Textos y botones de los WhatsApp | `ajustes.js` | `mensajes` |
| Colores | `marca.css` | las líneas `--color-…` |
| Letra | `marca.css` | la línea `@import` (de Google Fonts) y `--fuente-titulos` / `--fuente-texto` |
| Esquinas más o menos redondas | `marca.css` | `--radio` y `--radio-peq` |
| Pantallas, tamaños, cómo funciona | `index.html` | es código: mejor pedirlo |
| Botones y campos de todas las webs de Utilo | `../estilos/base.css` | común a todos los clientes: no tocar desde aquí |

## Cómo editar desde la web de GitHub (sin instalar nada)

1. Abre https://github.com/UTILO-DIGITAL/utilo-web y entra en la carpeta `barberia-tallat`.
2. Pulsa el archivo (`ajustes.js` o `marca.css`) y después el lápiz («Edit this file»), arriba a la derecha.
3. Cambia lo que quieras. Las reglas para no romper nada están al principio de `ajustes.js`:
   - cambia solo lo que va entre comillas `'…'` y los números;
   - no borres comas, corchetes `[ ]` ni llaves `{ }`.
4. Pulsa «Commit changes…». Escribe en una línea qué has cambiado (por ejemplo «T0029: corte a 18 €»).
5. Elige «Create a new branch» y después «Propose changes»: se abre un PR. Fusiónalo cuando quieras (o pídeme que lo revise).
6. Al fusionarlo, la web pública se actualiza sola en un minuto: https://utilo-digital.github.io/utilo-web/barberia-tallat/

## Ejemplos

**Subir el corte a 18 €.** En `ajustes.js`, en `servicios`, cambia `precio: 16` por `precio: 18` en la línea de `Corte`.

**Añadir una barbera.** En `barberos`, copia una línea entera, pégala debajo y cámbiala. Todas las líneas menos la última llevan coma al final:

```js
barberos: [
  { nombre: 'Toni',    especialidad: 'Cortes clásicos y a tijera' },
  { nombre: 'Marc',    especialidad: 'Barba y afeitado a navaja' },
  { nombre: 'Yassine', especialidad: 'Degradados y diseños' },
  { nombre: 'Laia',    especialidad: 'Cortes a tijera y color' }
],
```

El mostrador se adapta solo: una columna por barbero.

**Cambiar el recordatorio.** En `mensajes`, cambia el texto de `recordatorio`. Deja las palabras entre llaves (`{cliente}`, `{hora}`…): se rellenan solas con el nombre, la hora, etc. Para un salto de línea, escribe `\n`.

**Que abra también los lunes.** En `horario`, añade `'lunes'` a `dias` y cambia `texto` a `'Lunes a sábado'`.

**Otro color para el botón de reservar.** En `marca.css`, cambia `--color-accion` y `--color-destacado` (por ejemplo `#2547D0` → `#0E7C66`). Comprueba que el texto blanco se lee bien encima.

## Ver qué ha cambiado (también lo que hace Claude)

Cada cambio entra por un PR. En el PR, la pestaña «Files changed» enseña línea a línea lo que se ha quitado (en rojo) y lo que se ha puesto (en verde). En cada archivo, el botón «History» enseña todos los cambios que ha tenido, con fecha y autor, y desde ahí se puede volver a una versión anterior.

## Si algo se rompe

Si la demo sale en blanco o se queda a medias, casi siempre es una coma o una comilla de `ajustes.js`. Abre el archivo en GitHub, mira el último cambio en «History» y compáralo: suele faltar una coma al final de una línea o sobrar una comilla dentro de un texto. Si no lo ves, vuelve a la versión anterior desde «History».

## Qué hay en `index.html` (para cambios más grandes)

- `<style>`: el aspecto de la demo. Usa solo los colores de `marca.css`.
- Pantallas de la app: funciones `vInicio`, `vServicio`, `vBarbero`, `vHora`, `vConfirmar`, `vReservada`, `vCortes`, `vPerfil` y `vChat`.
- Mostrador: función `vNegocio`.
- Respuestas a los botones del WhatsApp: función `responder`.
- Las citas de ejemplo del mostrador se inventan en `generadas` y salen iguales cada vez para el mismo día.
