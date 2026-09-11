# Prueba: importación Riego (TANQUES/UGR/GEOMEMBRANA)

Instrucciones para llevar a producción y probar lo que ya está aplicado en la
copia local (`SDMAyRH Centralizador.xlsx`) y en el código (`099_Setup.gs`).
Detalle completo de qué se hizo y por qué: `README.md`, sección "Importación
de datos Riego: TANQUES/UGR/GEOMEMBRANA (2026-09-11)".

## 0. Antes de empezar

- Hay un backup de la copia local por si hace falta volver atrás:
  `googlesheet drive/SDMAyRH Centralizador - backup antes de import riego 2026-09-11.xlsx`.
- Estos pasos asumen que la hoja de Google Sheets real (la que usa la app en
  vivo) **todavía no tiene** los datos nuevos — solo la copia local los tiene.

## 1. Llevar los datos a la hoja de Google Sheets real

Dos formas, elegir una:

**Opción A — reemplazar el archivo completo** (más simple si nadie más está
editando la hoja en este momento): subir `SDMAyRH Centralizador.xlsx` (la
copia local ya actualizada) a Google Drive, reemplazando el archivo de origen
del Google Sheet que usa la app.

**Opción B — pegar los CSV a mano** (si preferís no tocar el archivo entero):
todos en `googlesheet drive/`, en este orden:

1. **`CATEGORIAS`** — **no** es un CSV para pegar. Abrir la hoja `CATEGORIAS`
   y completar a mano el nombre de las filas que ya tienen `ID=8`, `ID=9` e
   `ID=10` (están reservadas con el nombre en blanco):
   - `ID 8` → `TANQUES`
   - `ID 9` → `UGR`
   - `ID 10` → `GEOMEMBRANA`

   ⚠️ Si esos 3 IDs no existen todavía en la hoja viva (puede que esté
   desincronizada de la copia local), no completar nada acá — avisar antes de
   seguir, porque el resto de la importación asume `CATEGORIA_ID` 8/9/10.

2. **`import_SIG_GEOMETRIAS_riego.csv`** (59 filas, `ID 269-327`) — pegar al
   final de la hoja `SIG_GEOMETRIAS` (después de la última fila con datos).

3. **`import_UD_RIEGOS_nuevos.csv`** (60 filas, `ID 115-174`) — pegar al
   final de la hoja `UD_RIEGOS`. Va después de las geometrías porque hace
   referencia a los `ID` que se acaban de crear en el paso 2.

## 2. Sincronizar el esquema en Apps Script

1. Copiar `099_Setup.gs` al proyecto de Apps Script (reemplaza el archivo
   entero).
2. En el editor de Apps Script, seleccionar `SIG_Setup_ConfiguracionColumnas`
   en el desplegable de funciones y **Ejecutar**. Esto reescribe la hoja
   `CONFIGURACION_COLUMNAS` para que coincida con el array del código: saca
   `LONGITUD`/`LATITUD` de `UD_RIEGOS` y agrega `CEMENTO`, `FIERRO`,
   `GEOMEMBRANA_M2`.
3. Revisar **Ver > Registros de ejecución** — no debería tirar error.

## 3. Limpiar caché

En el mismo editor de Apps Script, ejecutar `SIG_Cache_resetTodasLasUnidades`.
Sin este paso la app puede seguir sirviendo el esquema/filas viejos desde
`CacheService` aunque la hoja ya esté actualizada.

## 4. Qué revisar en la app (checklist)

Abrir la app publicada (o volver a implementar si hace falta) y confirmar:

- [ ] **Tabla de Riego** (pestaña Datos → Riego): aparecen **174 filas**
      (antes 114). Las columnas `CEMENTO`, `FIERRO` y `Geomembrana (m²)`
      están visibles y con datos en las filas nuevas (vacías en las 114
      originales).
- [ ] **Buscar el proyecto `ID=115`** ("TANQUES - ARQUE - KHAPI"): debería
      tener `CEMENTO=82`, `FIERRO=182`, familias=40, área=1.2.
- [ ] **Caso Capinota dividido**: buscar `ID=126` ("TANQUES - CAPINOTA -
      VILLCABAMBA") e `ID=127` ("TANQUES - CAPINOTA - COCOMA") — deben ser
      dos filas separadas, cada una con su propio punto en el mapa (no una
      sola fila con dos ubicaciones).
- [ ] **Mapa**: la capa de Riego (botón "Represas y Tanques de Agua" en
      Mapa → Datos) debería mostrar **~79 puntos** en vez de 20 (59 nuevos +
      20 previos). Los puntos nuevos caen sobre las provincias andinas y de
      valle de Cochabamba (Arque, Ayopaya, Bolívar, Tapacarí, Capinota,
      Esteban Arze, Punata, Arani, Germán Jordán, Tiraque, Mizque, José
      Carrasco, Campero, Carrasco, Quillacollo), no fuera del departamento.
- [ ] **Formulario de edición** de un registro de Riego cualquiera: **ya no**
      deberían aparecer los campos "Longitud" / "Latitud" (se sacaron del
      esquema — las columnas siguen en la hoja pero la app dejó de leerlas).
- [ ] **Filtro por Categoría** (si el filtro de Categoría está visible en el
      panel de filtros de Riego): deberían aparecer `TANQUES`, `UGR` y
      `GEOMEMBRANA` como opciones nuevas, junto a las 7 que ya había.
- [ ] **Eliminar de prueba**: elegir una fila nueva (p. ej. `ID=174`),
      eliminarla con el botón de basurero, confirmar que desaparece de tabla
      y mapa, y que las otras 173 no se ven afectadas.

## 5. Si algo sale mal

- Si `CONFIGURACION_COLUMNAS` quedó rara después del paso 2, se puede volver
  a correr `SIG_Setup_ConfiguracionColumnas()` las veces que haga falta — es
  idempotente, siempre reescribe la hoja entera desde el array del código.
- Si hay que deshacer todo en la hoja viva: restaurar desde el historial de
  versiones de Google Sheets (Archivo > Historial de versiones), o volver a
  subir el backup local (`SDMAyRH Centralizador - backup antes de import
  riego 2026-09-11.xlsx`) si se usó la Opción A del paso 1.
