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
  SIG.Symbols, SIG.Loader, SIG.Ribbon, SIG.Geometry, SIG.Views (toggle
  entre vistas principales), SIG.Table (DataTables), SIG.Summary
  (filtros + tarjetas)

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
   **Ampliado (2026-08-20) a pedido del usuario**: se agregaron las 15 columnas reales de `UD_RESIDUOS_SOLIDOS` a `SIG_Setup_ConfiguracionColumnas()`, mismo archivo `099_Setup.gs` (headers reales sacados de la copia local `googlesheet drive/SDMAyRH Centralizador.xlsx`, no inventados). A diferencia de `UD_RIEGOS`, acá `REGIONES`/`PROVINCIAS`/`MUNICIPIOS` no llevan sufijo `_ID` — son los nombres reales de columna. `URBANO_TONALEDAS` no es un typo nuestro: así está escrito el encabezado real en la hoja, hay que dejarlo tal cual para que `SIG_getRows` lo encuentre. `BOTADERO` quedó como el campo "identidad" del registro (equivalente a `NOMBRE_DEL_PROYECTO` en Riegos); `RIESGO` visible en mapa además de tabla, por ser el dato de seguridad más relevante; `SITUACION_ACTUAL`/`PROYECTO` (texto largo, casi siempre vacío en los datos actuales) ocultos de tabla pero visibles en reporte, igual que `OBSERVACIONES` en Riegos.
   **Para aplicar**: volver a correr `SIG_Setup_ConfiguracionColumnas()` en el editor de Apps Script real (con `099_Setup.gs` ya actualizado ahí). **Ojo**: esa función hace `sh.clear()` y reescribe toda la hoja `CONFIGURACION_COLUMNAS` — si se hizo algún ajuste manual directo en esa hoja desde la última vez que se corrió, se pierde. No hace falta limpiar cache aparte: `SIG_UD_getSchema` nunca cachea un esquema vacío (es a propósito, para no dejar "pegado" un error de configuración), así que el primer pedido a `UD_RESIDUOS_SOLIDOS` después de correr el setup ya trae el esquema nuevo solo.
3. ✅ Backend genérico: `SIG_UD_getSchema(hoja)` + `SIG_UD_getRows(hoja)` + `SIG_UD_get(hoja)` en `115_sigUD.gs`, reutilizan `SIG_getRows` ya existente. Cache real en `101_sigCache.gs` (`SIG_Cache_get/put/remove`, `CacheService`, TTL 6h, try/catch por el límite de 100KB por clave; no cachea resultados vacíos para no dejar errores de config "pegados" hasta que expire el TTL) y ya conectado también a `SIG_Drive_getGeoJson`. **Confirmado funcionando en el Apps Script real** con `SIG_Test_UD_RIEGOS` (`099_Setup.gs`): 32 columnas de esquema, 114 filas de `UD_RIEGOS`.
   Nota operativa que costó descubrir: el botón "Ejecutar" del editor de Apps Script llama a la función seleccionada **sin argumentos** — para probar funciones que reciben parámetros (`SIG_UD_get(hoja)`, etc.) hace falta una función envoltorio sin argumentos que la llame por dentro (patrón ya usado en `SIG_Test_UD_RIEGOS`, `SIG_Test_ConfiguracionColumnas`, `SIG_Cache_resetUD_RIEGOS` en `099_Setup.gs`) — reutilizar ese patrón para cualquier prueba manual futura.
4. ✅ Vista Tabla dinámica (portar patrón de `Version previa/js/tabla.js`). Decisión tomada con el usuario: usar **DataTables + jQuery** (como la versión anterior) en vez de una tabla vanilla — se suman como dependencias CDN nuevas en `Index.html`. **Confirmado funcionando en el Apps Script real**, incluidos los 3 ajustes de ribbon pedidos después de la primera prueba.
   Detalle:
   - `Index.html` — se agregó jQuery 3.7.1 + DataTables 1.13.6 (core + estilo Bootstrap 5) por CDN, y los `include()` de `style_table`, `view_table`, `script_table`.
   - `style_table.html` / `view_table.html` (nuevos) — panel `#sig-table-view`, mismo alto que `#map` (`calc(100vh - 155px)`), oculto por defecto, con botón "Volver al mapa".
   - `script_table.html` (nuevo) — módulo `SIG.Table`: `show(hoja)` pide `SIG_UD_get(hoja)` al backend, arma columnas/encabezados de la tabla solo con los campos donde `visibleTabla=true` del esquema (nada hardcodeado), inicializa DataTables; `hide()` vuelve al mapa. Alterna la visibilidad con `#map` a mano (todavía no existe un sistema general de "vistas", ver nota abajo).
   - `script_ribbon_config.html` — nuevo grupo "Datos" con botón "Riego" que llama `SIG.Table.show("UD_RIEGOS")` (hardcodeado a esa unidad a propósito, es la única con `CONFIGURACION_COLUMNAS` cargada hoy).
   **Deuda reconocida**: alternar `#map`/`#sig-table-view` a mano en `SIG.Table.show/hide` funciona para dos vistas, pero no escala si se agregan más (Reportes, otras unidades) — cuando lleguemos ahí conviene un `SIG.Views` genérico en vez de repetir el patrón. Relacionado: cambiar de pestaña en el ribbon (Mapa ↔ Datos) **no** cambia la vista principal — si estás viendo la tabla y click en la pestaña "Mapa", la tabla sigue visible hasta apretar "Volver al mapa". Es el mismo problema de fondo, se resuelve junto con `SIG.Views`.

   **Ajustes pedidos por el usuario después de la primera prueba, aplicados y confirmados**:
   - Botón ribbon "Capas" (antes `alert("Capas")`) → ahora `SIG.LayerPanel.toggle()`, nueva función en `script_layerpanel.html` que muestra/oculta el panel flotante `#sig-layers-panel` completo (distinto del botón interno `btn-toggle-list`, que solo colapsa la lista dejando el header visible).
   - Botón ribbon "Zoom" (antes `alert("Zoom")`) → ahora `SIG.Layers.zoomAll()`, mismo comportamiento que el botón `btn-zoom-all` del panel flotante.
   - `script_ribbon_config.html` reorganizado: pestaña **Mapa** quedó solo con el grupo "Navegación" (Capas, Zoom); se agregó una pestaña **Datos** nueva con el grupo "Unidades" y el botón "Riego" (antes vivía como grupo dentro de la pestaña Mapa).
5. ✅ Filtros + tarjetas resumen dinámicas (portar patrón de `Version previa/js/filtros.js`). Decisión tomada con el usuario: viven en una **pestaña nueva "Resumen", independiente** de la pestaña "Datos" (no filtran la tabla de DataTables) — pide sus propios datos con `SIG_UD_get`, mantiene su propio estado de filtros. Evita necesitar estado compartido entre vistas por ahora. **Confirmado funcionando en el Apps Script real** (filtros y tarjetas se ven correctamente).
   Detalle:
   - `script_views.html` (nuevo) — módulo `SIG.Views`, reemplaza el toggle manual de `#map`/`#sig-table-view` que tenía `SIG.Table`: una lista fija de ids de vista (`map`, `sig-table-view`, `sig-summary-view`), `SIG.Views.show(id)` oculta todas menos la pedida. Es el primer paso del `SIG.Views` genérico que había quedado pendiente como deuda en el paso 4; se volvió necesario al sumar una tercera vista. `script_table.html` ya se actualizó para usarlo (`SIG.Views.show("sig-table-view")` / `SIG.Views.show("map")`).
   - `style_summary.html` / `view_summary.html` (nuevos) — panel `#sig-summary-view`, misma estructura que la tabla: header con título + "Volver al mapa", fila de filtros, fila de tarjetas.
   - `script_summary.html` (nuevo) — módulo `SIG.Summary`: filtros = un `<select>` por cada campo del esquema con `ui="SEL"` (poblado con valores únicos de esa columna); tarjetas = una de "Registros" (conteo) + una por cada campo con `estadistica="SUM"` o `"AVG"` (suma o promedio), todo recalculado sobre las filas que cumplen los filtros activos. Nada hardcodeado, todo sale del esquema de `CONFIGURACION_COLUMNAS`.
   - `script_ribbon_config.html` — nueva pestaña "Resumen" con botón "Riego" → `SIG.Summary.show("UD_RIEGOS")`.
   - `Index.html` — `include()` de los 4 archivos nuevos.
   **Para probar**: copiar `script_views.html`, `style_summary.html`, `view_summary.html`, `script_summary.html`, `script_table.html` (modificado), `script_ribbon_config.html` (modificado) e `Index.html` (modificado) al Apps Script real. Pestaña Resumen → botón Riego. Confirmar que los filtros desplegables y las tarjetas cambian según lo esperado, y que "Volver al mapa" funciona.

   **Bugs reportados en la primera prueba (2026-08-13) y ya corregidos**:
   1. Los botones "Riego" de Datos y de Resumen no cargaban nada — causa más probable: no se copiaron los 4 archivos **nuevos** al Apps Script (`script_views.html` en particular; si `SIG.Views` no existe, `SIG.Table.show`/`SIG.Summary.show` truenan en silencio en la consola del navegador, sin alert visible porque el error ocurre antes de llegar al `google.script.run`). No es un bug de lógica, es un archivo nuevo faltante en el proyecto de Apps Script — a diferencia de editar un archivo existente, crear uno nuevo requiere el paso extra de "+ → Script/HTML" en el editor.
   2. La pestaña "Mapa" del ribbon no volvía a mostrar el mapa — esto sí era un bug real: las pestañas del ribbon (`script_component_ribbon.html`) solo cambiaban qué botones se ven, nunca controlaron la vista principal (`#map`/`#sig-table-view`/`#sig-summary-view`). Corregido agregando un `onShow` opcional a `addTab()` — la pestaña "Mapa" ahora declara `onShow:()=>SIG.Views.show("map")` en `script_ribbon_config.html`, y `SIG.Ribbon.show()` lo llama al activarse la pestaña.
   **Para probar el fix**: copiar `script_component_ribbon.html` y `script_ribbon_config.html` (ambos modificados), además de re-verificar que los 4 archivos nuevos del punto anterior sí estén creados en el Apps Script (no solo editados). Si el botón Riego sigue sin hacer nada después de esto, abrir la consola del navegador (F12) en el web app y mandar el error exacto que aparezca ahí.
   3. `script_config.html` no existía en el Apps Script real (`Uncaught ReferenceError: loadConfig is not defined`) — era un archivo **original**, no creado en esta sesión, que aparentemente nunca se había copiado. Se resolvió creándolo con el contenido ya existente en el repo local. Quedó como aprendizaje: cuando aparece un `ReferenceError` de una función que sí existe en el código local, sospechar primero de un archivo faltante en Apps Script antes que de un bug de lógica.
   4. Con los archivos ya completos, los botones "Riego" seguían sin mostrar nada — se agregaron `console.log` con prefijo `[SIG.Table]`/`[SIG.Summary]`/`[SIG.Views]`/`[SIG.Ribbon]` en `script_table.html`, `script_summary.html`, `script_views.html`, `script_component_ribbon.html`, `script_ribbon_config.html` para diagnosticar. El log mostró que todo el flujo de datos funcionaba perfecto (32 columnas, 114 filas, sin errores) — el problema real era CSS: `SIG.Views.show()` ponía `el.style.display = ""` para "mostrar" una vista, pero `style_table.html`/`style_summary.html` tienen `display:none` puesto directamente en la hoja de estilos (no solo inline) — limpiar el estilo en línea con `""` no alcanza para ganarle a esa regla, la vista seguía oculta aunque los datos ya estuvieran cargados. Con `#map` no se notaba porque no tiene ningún `display:none` en su CSS. **Corregido** en `script_views.html`: ahora usa `"block"` explícito en vez de `""`.
   **Para probar el fix**: copiar `script_views.html` (con el fix de `"block"`, los `console.log` de diagnóstico se dejaron, no hacen daño y sirven para futuras dudas) y confirmar que Datos → Riego y Resumen → Riego ya muestran contenido visible.
   **Filtros en cascada (2026-08-20), a pedido del usuario**: quería que al elegir Región, Provincia/Municipio se acoten solo a los que corresponden (y viceversa). Evaluamos dos caminos: (A) basado en el catálogo `REGIONES`/`PROVINCIAS`/`MUNICIPIOS` — el usuario ya había agregado `region_id`/`Provincia_id` ahí — pero cruzarlo requeriría matchear por nombre el texto que cada fila UD_ ya trae (`"CONO SUR"` en UD_RIEGOS) contra el `nombre` del catálogo (`"Cono Sur"`), frágil por las inconsistencias de mayúsculas/tipeo ya documentadas; (B) **elegida** — sin depender de ningún catálogo, cada `<select>` calcula sus propias opciones a partir de las filas que ya cumplen los **demás** filtros activos (excluyéndose a sí mismo). Autoconsistente con lo que la propia hoja UD_ ya tiene, funciona en cualquier dirección (elegir Provincia primero también acota Región) y para cualquier combinación de campos `SEL`, no solo los geográficos.
   - `script_summary.html` — `uniqueValues(sourceRows, columna)` ahora recibe las filas sobre las que calcular, en vez de usar siempre todas; nueva `getRowsExcludingFilter(columnaExcluida)` (todas las filas que cumplen los filtros activos salvo el de esa columna — son las opciones válidas para su propio select). `buildFilterSelect` arma cada `<select>` con esas opciones y conserva el valor ya elegido (`select.value = activeFilters[...]`). `renderFilters()` ahora limpia primero cualquier filtro cuyo valor elegido ya no aparezca entre las opciones válidas (evita dejarlo "pegado" mostrando 0 resultados sin explicación) antes de dibujar los `<select>`. Cambiar cualquier filtro ahora vuelve a llamar `renderFilters()` (no solo `refresh()`), porque cambiar uno puede volver inválida la opción elegida en otro.
   **Para probar**: copiar `script_summary.html` (modificado). Pestaña Resumen → Riego → elegir una Región y confirmar que Provincia/Municipio solo muestran las que corresponden; probar también el camino inverso (elegir Municipio primero).
   **Bug reportado tras probar el cascada y ya corregido**: en Riegos, el filtro de `GESTION` volvía a "Todos" apenas se elegía un valor. Causa: `GESTION` es el único campo `SEL` de tipo `NUM` en Riegos (los demás son texto) — la fila trae `2019` como número, pero `select.value` siempre devuelve string (`"2019"`). El chequeo nuevo de "¿la selección elegida sigue siendo válida?" comparaba `opciones.indexOf(valorActivo)` sin pasar por `String()` en los dos lados (a diferencia de `getFilteredRows`/`getRowsExcludingFilter`, que sí lo hacían) — `"2019" !== 2019` invalidaba el filtro apenas se elegía. **Corregido**: la comparación ahora usa `String(opcion) === String(valorActivo)`.
   **Para probar el fix**: copiar `script_summary.html` (modificado) y confirmar que el filtro de Gestión en Riego ya conserva el valor elegido.
6. 🔶 Gráficas (barras/anillos) — paso intermedio que faltaba entre el 5 y el 6 original, detectado por el usuario: ya teníamos las tarjetas de indicadores pero no las gráficas de `Version previa/js/graficos.js`. Viven junto a los filtros y tarjetas en la pestaña **Resumen** (mismo módulo `SIG.Summary`, no una vista aparte).
   **Hecho, todavía no probado en el Apps Script real**:
   - `Index.html` — se agregó Chart.js 4.4.4 por CDN.
   - `view_summary.html` — nueva fila `#sig-summary-charts` debajo de las tarjetas.
   - `script_summary.html` — se agregó `getChartFields()` (campos del esquema con `grafico="BAR"` o `"PIE"`), `countByValue()` (cuenta filas por cada valor distinto de la columna, sobre las filas ya filtradas), `renderCharts()` (una tarjeta con `<canvas>` por campo, `Chart.js` tipo `bar` o `doughnut` según el esquema). Se agregó una guarda: si un campo tiene más de 15 valores distintos (o ninguno), se omite su gráfica en vez de dibujar algo ilegible — así los campos numéricos continuos con `GRAFICO=BAR` pero valores casi todos únicos (`COSTO_TOTAL`, `AREA_DE_RIEGO`, etc.) se quedan solo como tarjeta, sin gráfica de conteo sin sentido; los que sí tienen pocas categorías (`TIPO_DE_PROYECTO`, `ESTADO_DEL_PROYECTO`, `GESTION`) sí grafican. Se unificó `renderCards()`+`renderCharts()` en una función `refresh()`, usada en los 3 lugares donde antes se llamaba `renderCards()` sola (carga inicial, cambio de filtro, limpiar filtros).
   **Deuda reconocida**: las gráficas de barra hoy son "conteo de filas por valor", no "suma/promedio de un indicador agrupado por otra columna" (ej. "Costo total por Región", que sí tenía `Version previa`). Eso requeriría una columna de "agrupar por" en el esquema que no existe todavía — se deja pendiente, no bloquea nada de lo demás.
   **Para probar**: copiar `Index.html`, `view_summary.html`, `script_summary.html` (los 3 modificados) al Apps Script real. Pestaña Resumen → Riego, confirmar que aparecen gráficas de Tipo de proyecto, Estado y Gestión, y que cambian al aplicar filtros.
   **Ajuste pedido por el usuario tras confirmar el paso 6**: quería ver el botón de todas las unidades (`UD_RESIDUOS_SOLIDOS`, `UD_FORESTACIONES`, `UD_CUENCAS`, etc.), no solo "Riego" — aunque estén vacías. Antes el botón de "Riego" estaba hardcodeado a mano en `script_ribbon_config.html` porque era la única unidad con filas en `CONFIGURACION_COLUMNAS`. Cambiado a dinámico:
   - `115_sigUD.gs` — nueva `SIG_UD_listUnidades()`: lista toda hoja `UD_*` que exista de verdad en el spreadsheet (`SIG_getSpreadsheet().getSheets()`), con una etiqueta derivada del nombre (`UD_RESIDUOS_SOLIDOS` → "Residuos Solidos"). No depende de `CONFIGURACION_COLUMNAS` — aparece aunque la unidad no tenga ninguna columna configurada todavía.
   - `script_ribbon_config.html` — ya no hardcodea el botón "Riego"; pide `SIG_UD_listUnidades()` y arma un botón por unidad en Datos y en Resumen. Como la respuesta llega async (después de que el ribbon ya se dibujó), se agregó `SIG.Ribbon.refresh()` (nuevo en `script_component_ribbon.html`) para redibujar la pestaña actual si el usuario ya la tenía abierta cuando llegan los botones.
   - `script_table.html` / `view_table.html` — si una unidad no tiene columnas en `CONFIGURACION_COLUMNAS` (esquema vacío), ya no se intenta armar un DataTable sin columnas (rompía) — se muestra un aviso ("Esta unidad todavía no tiene columnas configuradas") en `#sig-table-vacio` en su lugar.
   - `SIG.Summary` no necesitó guarda: con esquema vacío simplemente no dibuja filtros/tarjetas de indicador/gráficas, pero la tarjeta "Registros" (conteo) sí se sigue mostrando siempre.
   - Nota sobre unidades sin la hoja creada todavía (si alguna de `UD_CUENCAS`/`UD_GESTION_RIESGOS`/`UD_FISCALIZACION`/`UD_BIODIVERSIDAD` no existe como pestaña real en el spreadsheet): esa unidad simplemente no aparece en la lista de botones — `SIG_UD_listUnidades()` solo lista hojas que existen de verdad. Si alguna sí existe pero vacía (sin filas), sí aparece y muestra tabla/resumen con 0 registros.
   **Para probar**: copiar `115_sigUD.gs`, `script_ribbon_config.html`, `script_component_ribbon.html`, `script_table.html`, `view_table.html` (los 5 modificados) al Apps Script real. Confirmar que aparece un botón por cada unidad real del spreadsheet en Datos y en Resumen, y que las que no tienen `CONFIGURACION_COLUMNAS` muestran el aviso en vez de romperse.
   **Bugs reportados tras ese ajuste y ya corregidos**:
   1. Etiquetas de dos palabras (`"Residuos Solidos"`, `"Gestion Riesgos"`) se salían de su botón e invadían al vecino — `.ribbon-button` no tenía manejo de corte de palabra ni texto centrado. **Corregido** en `component_ribbon.html`: `width` de 70 a 80px, `text-align:center`, y la etiqueta ahora tiene su propio estilo (`font-size:.72rem`, `overflow-wrap:break-word`, `white-space:normal`) para que las palabras largas corten en vez de desbordar.
   2. Pedido del usuario: un indicador de carga/error reutilizable — hasta ahora, mientras esperaba la respuesta de `google.script.run` no había ninguna señal visible, y un error se perdía en la consola o en un `alert()` bloqueante. **Nuevo módulo `SIG.Loading`** (`component_loading.html` + `script_component_loading.html`, mismo patrón que `component_ribbon`/`script_component_ribbon`): una franja fija bajo el ribbon (`#sig-loading`) con 3 métodos — `show(texto)` (spinner + texto), `error(texto)` (ícono de alerta + texto, fondo rojo, queda visible hasta el próximo `show`/`hide`), `hide()`. Conectado en los 3 lugares que piden datos por `google.script.run`: `script_table.html`, `script_summary.html` y la carga de unidades en `script_ribbon_config.html`. Se reemplazaron los `alert()` de error de `script_table.html`/`script_summary.html` por `SIG.Loading.error(...)` (menos intrusivo, mismo lugar que el estado de carga). De paso se corrigió un bug relacionado: si `SIG_UD_get` fallaba, `currentHoja` había quedado seteado igual — un reintento (clickear el mismo botón de nuevo) no volvía a pedir los datos por el chequeo de "ya estaba cargada"; ahora el error resetea `currentHoja = null`.
   **Para probar**: copiar `component_ribbon.html` (modificado), `component_loading.html` y `script_component_loading.html` (nuevos), `Index.html`, `script_table.html`, `script_summary.html`, `script_ribbon_config.html` (modificados) al Apps Script real.
7. 🔶 Vista Mapa: cruzar `UD_*.SIG_GEOMETRIAS_ID` → `SIG_GEOMETRIAS` para ubicar cada registro. El mapa ya cargaba todas las geometrías de `SIG_GEOMETRIAS` desde el inicio (`SIG.Features`), pero sin ningún dato de a qué proyecto pertenecía cada una — el cruce que faltaba es justamente ese, no un selector de unidad aparte en el mapa.
   **Hecho, todavía no probado en el Apps Script real**:
   - `115_sigUD.gs` — nueva `SIG_UD_indiceGeometrias()`: recorre todas las hojas `UD_*` (via `SIG_UD_listUnidades()`), y arma un índice `SIG_GEOMETRIAS_ID → {hoja, etiqueta, campos}` con los campos marcados `VISIBLE_MAPA=true` del esquema de cada unidad (mismo patrón que `VISIBLE_TABLA` para la tabla). Reutiliza `SIG_UD_getSchema`/`SIG_UD_getRows` ya cacheados, no agrega una cache nueva.
   - `120_sig_geometry.gs` — nueva `SIG_Geometrias_listConRegistros()`: la lista de `SIG_Geometrias_list()` de siempre, pero con un campo `registro` agregado a cada geometría (`null` si ninguna fila UD_ la referencia — geometría suelta).
   - `script_main.html` — `initApp()` ahora pide `SIG_Geometrias_listConRegistros()` en vez de `SIG_Geometrias_list()`. De paso se le agregó `SIG.Loading`/manejo de error, que no tenía (la única llamada de `google.script.run` en toda la app sin `withFailureHandler`).
   - `script_features.html` — `SIG.Features.load()` ahora arma un popup (`layer.bindPopup(...)`) con la etiqueta de la unidad + sus campos `VISIBLE_MAPA` cuando la geometría tiene `registro`; si no tiene registro cruzado, cae a mostrar `nombre`/`descripcion` propios de `SIG_GEOMETRIAS` si existen. Los valores se escapan (`escapeHtml`) antes de meterlos al HTML del popup — vienen de celdas de la hoja, no hay que confiar en ellas a ciegas.
   **Deuda reconocida**: hoy la única forma de "ubicar" un registro es clickear su geometría en el mapa y ver el popup — no hay todavía un botón "ver en el mapa" desde una fila de la tabla/resumen que haga zoom automático a esa geometría. Queda pendiente si hace falta.
   **Para probar**: copiar `115_sigUD.gs`, `120_sig_geometry.gs`, `script_main.html`, `script_features.html` (los 4 modificados) al Apps Script real. Clickear un punto/geometría del mapa que pertenezca a `UD_RIEGOS` y confirmar que el popup muestra Proyecto/Región/Provincia/Municipio/Estado.
8. ⬜ Reportes/PDF dinámicos (el módulo más grande de `Version previa` — `pdf-designer.js` —, dejarlo para el final; mantenerlo en cliente, no en Apps Script, por el límite de 6 min de ejecución).
9. ⬜ (Cuando toque) cerrar el CRUD real: funciones de escritura con `LockService`, estrategia de ID, conectar `onSave` en `script_selection.html`/`script_draw.html`, y recién ahí volver a los componentes vacíos (symbols, ribbon, layer panel editable).

## Notas operativas

- Python real de este equipo (no usar `python`/`python3` a secas en Bash, cae en el stub de Windows Store): `C:\Users\PC04\AppData\Local\Programs\Python\Python314\python.exe` (tiene `openpyxl` para leer el `.xlsx` local).
- El ID real del spreadsheet vive en `002_Constantes.gs` (`SIG_DB.SPREADSHEET_ID`) — no se repite aquí a propósito, para no tener dos fuentes de verdad si cambia.
