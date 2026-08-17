# Estado del proyecto — Visor de Proyectos de Riego (Gobernación de Cochabamba)

Última actualización: 2026-08-12. Este archivo es un resumen de contexto para retomar el trabajo en una próxima sesión, aquí o con Claude.

## Qué es esto

Visor interactivo (una sola app cliente, sin backend) para el despacho y las unidades de la Gobernación de Cochabamba: Cuencas y Recursos Hídricos, Riego y Drenaje, Riesgos, Residuos y Cambio Climático, Control Ambiental, Instituciones. Cada unidad carga su propio JSON (exportado por un macro de Excel) y obtiene tabla + filtros + gráficos + mapa + generador de reportes PDF, todo autoconfigurado a partir del esquema que trae el propio JSON (no hay columnas hardcodeadas).

## Arquitectura actual

```
pagina/
├── index.html              <- punto de entrada real (antes: "Resumen ejecutivo.html")
├── generate_manifests.py   <- correr despues de tocar img/, plantillas/ o proyectos/ (ver mas abajo)
├── css/styles.css
├── js/
│   ├── utils.js             formato/parseo (numeros, fechas, moneda)
│   ├── esquema.js            lectura del JSON del macro (Hojas/Esquema/Campos/Registros) + biblioteca de proyectos
│   ├── estado.js              variables globales + catalogo de unidades (dinamico) + ruteo por hash
│   ├── filtros.js              filtros dinamicos, agregaciones, tarjetas de resumen
│   ├── tabla.js                 DataTables
│   ├── graficos.js               Chart.js
│   ├── geodata.js                 fetch() de siluetas + selectores Region/Provincia/Municipio (picker compartido)
│   ├── mapa.js                    Leaflet: mapa en vivo, capas por nivel admin, selector de resaltado
│   ├── pdf-designer.js             el modulo mas grande: layout tipo grid, widgets, export, biblioteca de plantillas
│   └── bootstrap.js                listeners delegados + arranque en DOMContentLoaded
├── img/            logos de unidades -> img/index.json (catalogo de unidades se genera de aqui)
├── plantillas/      plantillas de PDF guardadas -> plantillas/index.json
├── proyectos/        datasets JSON precargados (biblioteca) -> proyectos/index.json
├── Geojson/
│   ├── Departamento/COCHABAMBA.geojson    (346 KB, fetch al iniciar)
│   ├── Bolivia/Bolivia_Silueta.geojson     (1.2 MB, fetch al iniciar)
│   ├── Regiones/*.geojson + _TODOS.geojson    (5 entidades, 984 KB consolidado)
│   ├── Provincias/*.geojson + _TODOS.geojson   (17 entidades, 1.3 MB consolidado)
│   └── Municipios/*.geojson + _TODOS.geojson    (47 entidades, 1.8 MB consolidado)
├── Resumen ejecutivo.html    <- respaldo del monolito pre-division (ya no es el entry point)
└── Resumen ejecutivo.backup.html  <- respaldo mas viejo, previo a la reorganizacion en modulos
```

Scripts clásicos (`<script src>`, sin `type="module"`) en orden de dependencia — todo comparte el mismo scope global, a propósito, para no complicar con imports/exports.

## Decisiones clave tomadas

0. **Cuidado con mayúsculas/minúsculas en nombres de carpeta/archivo.** Windows no distingue mayúsculas, GitHub Pages (Linux) sí. Ya pasó una vez: `Plantillas`/`Proyectos` (con mayúscula) vs el código que pedía `plantillas`/`proyectos` — funcionaba en local y tiraba 404 en producción. Se corrigió renombrando las carpetas a minúscula. Si aparece un 404 en GitHub Pages para un archivo que "sí existe", **lo primero a revisar es el casing exacto** (`git ls-files` muestra el nombre real tal cual quedó en el repo).

1. **Todo cliente, sin backend, CDN para librerías** (Bootstrap, jQuery, DataTables, Chart.js, SweetAlert2, Leaflet, leaflet-image, html2pdf.js). Decisión consciente de mantenerlo así por ahora — se evaluó y descartó SQLite/CRUD por ahora (ver conversación: sql.js serviría para consultas, pero no resuelve persistencia sin un backend real tipo Supabase; no hay necesidad actual que lo justifique).
2. **El esquema viaja en el propio JSON** (`Hojas[].Esquema.Campos[]` con Tipo/Rol/Agregacion/Orden/Visibilidad) — la página nunca hardcodea nombres de columna.
3. **Siluetas geográficas por `fetch()`, no hardcodeadas.** Requiere servir el sitio por http(s); **no funciona con `file://`** (ver "Cómo probar en local").
4. **`html2canvas` (motor de `html2pdf.js`) ignora `object-fit` de CSS.** Cualquier imagen en el PDF exportado debe mostrarse con `width:100%; height:auto` (aspecto natural) o "hornear" el recorte en un canvas intermedio antes de generar el `<img>` (ver `generateFittedImageDataUrl`, usado por el widget "Imagen").
5. **Widget de mapa "Bolivia"**: dibuja el país completo con Cochabamba resaltado adentro. "Mapa" (departamento) no se tocó.
6. **Catálogo de unidades ya no hardcodeado**: `unitCatalog` (`estado.js`) se construye al iniciar desde `img/index.json`. Agregar una unidad = poner la imagen en `img/` + correr `generate_manifests.py`.
7. **Bibliotecas de "Plantillas" y "Proyectos"**: dropdowns junto a "Cargar JSON" y "Cargar plantilla" que listan lo que haya en `proyectos/index.json` / `plantillas/index.json` y lo cargan con un clic (reutilizan `loadJsonUrl` y `loadPdfTemplatePayload`, que ya existían). El botón de subir archivo manual se mantiene intacto al lado.
8. **`generate_manifests.py` es manual, no automático.** GitHub Pages no permite listar carpetas desde el navegador, así que cada carpeta necesita su `index.json`. Este script escanea `img/`, `plantillas/`, `proyectos/` y los regenera — **hay que correrlo (`python generate_manifests.py`) cada vez que se agrega/quita/renombra algo en esas tres carpetas, antes de `git push`.** Queda pendiente evaluar una GitHub Action que lo automatice si el paso manual resulta molesto.
9. **Region/Provincia/Municipio: seleccionable y funcional**, tanto en el widget de mapa del diseñador de PDF como en un selector nuevo sobre el mapa en vivo ("Resaltar entidades específicas"). Reutilizan `loadSelectedBoundaries`/`renderPdfMapPickerDropdown` (`geodata.js`), con checkbox "Seleccionar todos" en cada dropdown. Además hay toggles independientes "Regiones"/"Provincias"/"Municipios" en el control de capas del mapa en vivo que muestran **todas** las entidades de un nivel a la vez (vía `Geojson/<Nivel>/_TODOS.geojson`, fetch perezoso al activarlas).
10. **Bug ya resuelto, dejar registrado por si reaparece un patrón similar**: `normalizePdfColumn` reconstruía `config` con una lista fija de campos permitidos en cada lectura del layout (`getPdfLayout()`, que se llama todo el tiempo) — cualquier campo nuevo que no esté en esa lista blanca se borra solo, aunque la UI lo muestre marcado. Si se agrega un campo de config nuevo a futuro, **hay que sumarlo también ahí**, no solo en el render del input.
11. **Los checkboxes que disparan un re-render completo del layout (`savePdfLayout` → `renderPdfDesignerLayout`) cierran su propio dropdown en cada clic.** Para Región/Provincia/Municipio se resolvió con `updateColumnByMetaSilent` (muta el layout sin re-renderizar, actualiza el botón a mano). Si se agregan más selectores multi-check al diseñador de PDF, conviene el mismo patrón desde el inicio.

## Pendientes / camino sugerido

1. **Terminar el despliegue en GitHub Pages.** El usuario instaló Git y lo maneja él mismo (pasos ya entregados: `git init` → repo público en GitHub → Settings → Pages → rama `main` → `/root`). Repo público está bien: los 4 JSON en `proyectos/` corresponden a datos que ya son públicos en SICOES (Bolivia), decisión confirmada por el usuario — se suben al repo tal cual, sin excluir la carpeta.
2. **Agregar `robots.txt` + meta `noindex`** para que sea pública pero no aparezca en buscadores (ofrecido, no aplicado aún).
3. **Revisar el bug conocido de ancho aproximado** en widgets de imagen dentro de subfilas anidadas (el cálculo de `widthFraction` no siempre es exacto en anidamientos profundos — no distorsiona, pero el alto real en mm puede no calzar perfecto).
4. **Persistencia de datos entre sesiones**: si recargas la página se pierden los JSON cargados por unidad (viven solo en memoria). `loadJsonUrl` ya existe si se quiere auto-cargar algo de `proyectos/` al iniciar una unidad.
5. **Vendorizar las librerías CDN localmente** si la red del despacho llega a filtrar internet.
6. Opcional: simplificar geometría de Provincias/Municipios (`SIMPLIFICAR_TOL`, sin usar) si el peso por `fetch()` en el mapa en vivo resulta molesto.
7. Opcional: automatizar `generate_manifests.py` con una GitHub Action en vez de correrlo a mano.
8. Opcional: el orden de las unidades en la pantalla de inicio ahora sale alfabético (antes era un orden curado a mano) — si importa, renombrar los archivos en `img/` con un prefijo numérico.

## Cómo probar en local

No abrir `index.html` directo (fetch falla bajo `file://`). Opciones, de la carpeta `pagina/`:

- **Recomendado**: extensión **Live Server** de VS Code (clic derecho en `index.html` → "Open with Live Server"). Confirmado funcionando por el usuario, con auto-reload al guardar.
- Alternativa sin VS Code: `python -m http.server 8000` y abrir `http://localhost:8000/` — funciona, pero el navegador puede cachear archivos `.js` viejos entre cambios; si algo no refleja una edición reciente, probar refresh forzado (Ctrl+F5) antes de asumir que hay un bug.

## generate_manifests.py — cuándo correrlo

Cada vez que se **agregue, quite o renombre** un archivo dentro de `img/`, `plantillas/` o `proyectos/`:

```powershell
python generate_manifests.py
```

Regenera `img/index.json`, `plantillas/index.json` y `proyectos/index.json`. La página lee esos `index.json`, no las carpetas directamente — sin este paso, los cambios en esas carpetas no aparecen en el sitio (ni local ni en GitHub Pages).

## Generación de los geojson (QGIS + scripts)

- Municipios/Provincias/Regiones: 48 shapefiles con dissolve por `NOM_MUN`/`NOM_PROV`/`regiones` (script de QGIS, no quedó guardado como archivo, se corrió desde la consola de QGIS).
- Departamento y Bolivia: shapefiles oficiales con dissolve total, reproyección a EPSG:4326 (igual, vía consola de QGIS).
- `_TODOS.geojson` de Regiones y Provincias: **no se generaron con QGIS** — se fusionaron directamente los `.geojson` individuales ya existentes con un script Python de una sola vez (concatenación de `features`, sin reproyectar ni disolver nada, ya estaban en el CRS correcto). El de Municipios ya existía de una corrida anterior del script de QGIS con la opción `CREAR_TODOS=True`.

Si hace falta regenerar alguno desde cero, pedir el script de nuevo dando contexto de qué carpeta/capa se necesita.
