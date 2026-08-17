# Estado del proyecto — Motor SIG (Gobernación de Cochabamba)

Última actualización: 2026-08-13. Resumen de contexto para retomar el trabajo en una próxima sesión, aquí o con Claude.

## Qué es esto

Evolución de `Version previa/` (antes "Resumen ejecutivo.html", 100% cliente, sin backend). Motor SIG es una web app de Google Apps Script: mapa Leaflet + Leaflet.Draw sobre Bootstrap, con Google Sheets como base de datos y Drive para GeoJSON de capas base. El enfoque nuevo agrega dos frentes que la versión anterior no tenía: **CRUD** de geometrías dibujadas en el mapa, y lectura **dinámica** de las hojas `UD_*` (unidades de la Gobernación) igual que `Version previa` leía el JSON del macro de Excel — sin hardcodear columnas.

Ver también `Version previa/ESTADO_PROYECTO.md` (arquitectura del prototipo cliente-only, decisiones tomadas ahí, sigue vigente como referencia de patrón, no como código a mantener).

## Arquitectura actual

```
000_Codigo.gs           doGet() — entry point
001_utils.gs            include() para plantillas HTML
002_Constantes.gs        SIG_DB (spreadsheet ID), SIG_SHEETS (nombres de hoja)
099_Setup.gs             scripts de configuración manual (correr una vez desde
                         el editor de Apps Script, no se llaman desde el frontend)
100_sigDrive.gs          lee GeoJSON desde Drive por fileId
101_sigCache.gs          SIG_Cache_get/put/remove (CacheService, TTL 6h) +
                         SIG_Drive_getGeoJson ahora sí cachea (antes era pass-through)
110_sigConfig.gs          SIG_getSpreadsheet, SIG_getRows (genérico), SIG_Config_getLayerConfig
115_sigUD.gs              SIG_UD_getSchema/getRows/get (hoja) — motor dinámico
                         genérico para cualquier UD_*, lee CONFIGURACION_COLUMNAS,
                         cacheado con SIG_Cache_*
120_sig_geometry.gs       SIG_Geometrias_list (lectura de SIG_GEOMETRIAS)
130_sig_layers.gs         SIG_Capas_list (lectura de SIG_CAPAS) — agregado hoy
140_Sig_Styles.gs         SIG_Config_getStyles (lectura de SIG_ESTILOS)
150_Sig_Symbols.gs        vacío (stub)
160_SIG_Ribbon.gs         vacío (stub)

Index.html + script_*.html + view_*.html + component_*.html + style_*.html
  Frontend en namespace window.SIG, un módulo IIFE por archivo:
  SIG.Map, SIG.Draw, SIG.Selection, SIG.Modal, SIG.Components, SIG.Form,
  SIG.Layers, SIG.LayerPanel, SIG.Config, SIG.Features, SIG.Styles,
  SIG.Symbols, SIG.Loader, SIG.Ribbon, SIG.Geometry

googlesheet drive/SDMAyRH Centralizador.xlsx
  Copia LOCAL de la hoja real (ID en 002_Constantes.gs). Usarla para revisar
  estructura sin tocar la hoja viva. No se sincroniza sola — si cambia la hoja
  real, pedir una copia nueva antes de asumir que esto sigue vigente.

Version previa/
  Prototipo cliente-only anterior. Referencia de patrón para el motor dinámico
  (esquema.js, filtros.js, tabla.js, graficos.js, pdf-designer.js), no se toca.
```

## Modelo de datos real (hoja de cálculo)

```
Catálogos:    USUARIOS, SESIONES, CATEGORIAS, REGIONES, PROVINCIAS, MUNICIPIOS
Unidades:     UD_RIEGOS (375 filas, 32 cols — la única "madura" con datos reales)
              UD_RESIDUOS_SOLIDOS (54 filas), UD_FORESTACIONES (1000 filas, dispersa)
              UD_CUENCAS, UD_GESTION_RIESGOS, UD_FISCALIZACION, UD_BIODIVERSIDAD
              (vacías, sin encabezados todavía)
SIG:          SIG_CAPAS, SIG_GEOMETRIAS, SIG_ESTILOS, SIG_SIMBOLOS, SIG_TIPO
Apoyo:        DOCUMENTOS (ID/URL/ELIMINADO, adjuntos por DOCUMENTOS_ID)
              CONFIGURACION (CODIGO/CATEGORIA/VALOR/DESCRIPCION)
```

Convención consistente en casi todas las hojas: borrado lógico vía columna `ELIMINADO`, no borrado físico. Mantener este patrón en cualquier función de escritura nueva.

### `CONFIGURACION` hoy es solo un diccionario de códigos

Filas actuales: `PK/FK` (tipo de llave), `NUM/DEC` (tipo de dato), `SUM/AVG` (estadística), `BAR/PIE` (gráfico), `SEL/HID` (UI). **Falta la tabla que mapea cada columna de cada `UD_*` a estos códigos** — el equivalente real a `Campos[]` de `Version previa/js/esquema.js` (Tipo/Rol/Agregacion/Orden/Visibilidad). Sin esa tabla no hay motor dinámico. Ver "Camino sugerido" más abajo, paso 2.

### Inconsistencias detectadas entre hojas `UD_*` (a resolver en el diseño de la config dinámica, no antes)

- `UD_RIEGOS.REGIONES_ID` / `PROVINCIAS_ID` / `MINICIPIOS_ID` (typo, falta la U) contienen **texto** ("CONO SUR", "TIRAQUE"), no el ID numérico de `REGIONES`/`PROVINCIAS`/`MUNICIPIOS`, a pesar del sufijo `_ID`.
- `UD_RESIDUOS_SOLIDOS` usa columnas de texto plano: `REGIONES`, `PROVINCIAS`, `MUNICIPIOS`.
- `UD_FORESTACIONES` usa singular (`REGION`/`PROVINCIA`/`MUNICIPIO`) y ahí sí parecen IDs numéricos reales.
- Conclusión: un motor genérico no puede asumir una sola convención de FK geográfica; la tabla de configuración por columna debe decir, por hoja, cómo resolver cada una (¿es texto a comparar contra `nombre`, o ID a comparar contra `ID`?).

## Bugs concretos ya corregidos en esta sesión

1. **`120_sig_geometry.gs:25`** — `tipo:item.TIPO` → `tipo:item.TIPO_ID`. El header real de `SIG_GEOMETRIAS` es `TIPO_ID`; antes toda geometría llegaba con `tipo: undefined`.
2. **`130_sig_layers.gs`** — se agregó `SIG_Capas_list()` (antes era un stub vacío `myFunction(){}`), leyendo la hoja `SIG_CAPAS` real vía el `SIG_getRows` genérico. Se agregó `CAPAS: "SIG_CAPAS"` a `SIG_SHEETS` en `002_Constantes.gs`.

**Pendiente de verificar**: estos cambios se basan en la copia local del Excel, no en la hoja viva de Google Sheets — confirmar ahí que los nombres de columna coinciden exactamente antes de dar esto por probado.

**Todavía no conectado**: `SIG_Capas_list()` no tiene consumidor en el frontend todavía — el dropdown "Capa" en `view_geometry.html` sigue con una sola opción hardcodeada. Se deja así a propósito, para conectarlo cuando se diseñe la UI dinámica (no antes).

## Gaps grandes que faltan (del review de arquitectura, sin tocar aún)

- **CRUD incompleto**: dibujar una geometría arma el objeto (`SIG.Geometry.build`) pero solo hace `console.log`, nunca `google.script.run` — no existe ninguna función de escritura en el backend (`create/update/delete`). Falta también estrategia de generación de ID y `LockService` para escrituras concurrentes.
- Validación ausente cliente y servidor (`Number()` silencioso, `JSON.parse` sin try/catch en `SIG_Geometrias_list`).
- Manejo de errores inconsistente en frontend (`withFailureHandler` solo en `SIG.Loader`).
- Llamada duplicada en `script_main.html` (`SIG_Config_getLayerConfig("MUNICIPIOS")` se pide dos veces al iniciar, una directa y otra vía `loadConfig`).
- Modelo de permisos sin definir (`XFrameOptionsMode.ALLOWALL`, sin verificación de rol en las funciones del backend) — relevante porque `USUARIOS`/`SESIONES` ya existen en la hoja pero no se leen desde ningún `.gs` todavía.
- Archivos cáscara sin contenido ni uso: `150_Sig_Symbols.gs`, `160_SIG_Ribbon.gs` (stubs); `component_layer_panel.html`, `component_popup.html`, `component_style_editor.html`, `script_api_sig.html`, `script_utils.html` (plantillas vacías, ni siquiera incluidas en `Index.html`).

## Camino sugerido (orden acordado, ir marcando al avanzar)

1. ✅ Bugs concretos: `TIPO_ID` + lector de `SIG_CAPAS`.
2. ✅ Diseñar y crear hoja `CONFIGURACION_COLUMNAS` — una fila por columna de cada `UD_*`, reutilizando los códigos de `CONFIGURACION`. Columnas:
   `HOJA | COLUMNA | ETIQUETA | TIPO (NUM/DEC/TEXTO/FECHA) | ROL (PK/FK/dato) | REFERENCIA (a qué catálogo apunta si es FK) | ESTADISTICA (SUM/AVG/ninguna) | GRAFICO (BAR/PIE/ninguno) | UI (SEL/HID/texto) | ORDEN | VISIBLE_TABLA | VISIBLE_MAPA | VISIBLE_REPORTE`
   **Hecho y confirmado**: `099_Setup.gs` → función `SIG_Setup_ConfiguracionColumnas()`, crea/reinicia la hoja y carga las 32 columnas de `UD_RIEGOS` como piloto (única hoja con datos reales completos). Ya se ejecutó una vez en el Apps Script real y funcionó. Es idempotente, se puede volver a correr si se ajustan los valores.
   Decisiones de diseño a revisar/ajustar en la hoja resultante (juicio propio, no verdad absoluta): `REGIONES_ID`/`PROVINCIAS_ID`/`MINICIPIOS_ID` marcadas `TIPO=TEXTO` (por la inconsistencia FK-vs-texto ya documentada arriba); columnas vacías en los datos actuales (`CATEGORIA PROGRAMATICA`, `TRANSFERENCIA`, `FASES`) quedaron ocultas (`VISIBLE_*=false`) hasta que tengan datos; `LONGITUD`/`LATITUD`/`SIG_GEOMETRIAS_ID`/`DOCUMENTOS_ID` ocultas por ser de uso interno (mapa/documentos), no de visualización directa.
3. ✅ Backend genérico: `SIG_UD_getSchema(hoja)` + `SIG_UD_getRows(hoja)` + `SIG_UD_get(hoja)` en `115_sigUD.gs`, reutilizan `SIG_getRows` ya existente. Cache real en `101_sigCache.gs` (`SIG_Cache_get/put/remove`, `CacheService`, TTL 6h, try/catch por el límite de 100KB por clave; no cachea resultados vacíos para no dejar errores de config "pegados" hasta que expire el TTL) y ya conectado también a `SIG_Drive_getGeoJson`. **Confirmado funcionando en el Apps Script real** con `SIG_Test_UD_RIEGOS` (`099_Setup.gs`): 32 columnas de esquema, 114 filas de `UD_RIEGOS`.
   Nota operativa que costó descubrir: el botón "Ejecutar" del editor de Apps Script llama a la función seleccionada **sin argumentos** — para probar funciones que reciben parámetros (`SIG_UD_get(hoja)`, etc.) hace falta una función envoltorio sin argumentos que la llame por dentro (patrón ya usado en `SIG_Test_UD_RIEGOS`, `SIG_Test_ConfiguracionColumnas`, `SIG_Cache_resetUD_RIEGOS` en `099_Setup.gs`) — reutilizar ese patrón para cualquier prueba manual futura.
4. ⬜ Vista Tabla dinámica (portar patrón de `Version previa/js/tabla.js`).
5. ⬜ Filtros + tarjetas resumen dinámicas (portar patrón de `filtros.js`).
6. ⬜ Vista Mapa: cruzar `UD_*.SIG_GEOMETRIAS_ID` → `SIG_GEOMETRIAS` para ubicar cada registro.
7. ⬜ Reportes/PDF dinámicos (el módulo más grande de `Version previa` — `pdf-designer.js` —, dejarlo para el final; mantenerlo en cliente, no en Apps Script, por el límite de 6 min de ejecución).
8. ⬜ (Cuando toque) cerrar el CRUD real: funciones de escritura con `LockService`, estrategia de ID, conectar `onSave` en `script_selection.html`/`script_draw.html`, y recién ahí volver a los componentes vacíos (symbols, ribbon, layer panel editable).

## Notas operativas

- Python real de este equipo (no usar `python`/`python3` a secas en Bash, cae en el stub de Windows Store): `C:\Users\PC04\AppData\Local\Programs\Python\Python314\python.exe` (tiene `openpyxl` para leer el `.xlsx` local).
- El ID real del spreadsheet vive en `002_Constantes.gs` (`SIG_DB.SPREADSHEET_ID`) — no se repite aquí a propósito, para no tener dos fuentes de verdad si cambia.
