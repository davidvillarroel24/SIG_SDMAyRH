//--------------------------------------------------
// Motor dinámico de unidades (hojas UD_*)
// Una sola función sirve a cualquier hoja UD_* que tenga
// filas propias en CONFIGURACION_COLUMNAS — no hay funciones
// por unidad, agregar una unidad nueva no requiere código.
//--------------------------------------------------

//--------------------------------------------------
// Esquema de una hoja UD_ (columnas de CONFIGURACION_COLUMNAS)
//--------------------------------------------------

function SIG_UD_getSchema(hoja){

    const key = "ud_schema_" + hoja;

    const cached = SIG_Cache_get(key);

    if(cached){

        return cached;

    }

    const rows = SIG_getRows("CONFIGURACION_COLUMNAS");

    const campos = rows

        .filter(item => item.HOJA === hoja)

        .map(item => ({

            columna        : item.COLUMNA,

            etiqueta       : item.ETIQUETA,

            tipo           : item.TIPO,

            rol            : item.ROL,

            referencia     : item.REFERENCIA,

            estadistica    : item.ESTADISTICA,

            grafico        : item.GRAFICO,

            ui             : item.UI,

            orden          : Number(item.ORDEN),

            visibleTabla   : item.VISIBLE_TABLA === true,

            visibleMapa    : item.VISIBLE_MAPA === true,

            visibleReporte : item.VISIBLE_REPORTE === true

        }))

        .sort((a,b) => a.orden - b.orden);

    // Un esquema vacío casi siempre es un error de configuración
    // (hoja mal escrita, CONFIGURACION_COLUMNAS sin filas para esa
    // hoja). No lo cacheamos para no dejar el error "pegado" 6h.

    if(campos.length){

        SIG_Cache_put(key, campos);

    }

    return campos;

}

//--------------------------------------------------
// Filas de una hoja UD_ (datos crudos)
//--------------------------------------------------

function SIG_UD_getRows(hoja){

    const key = "ud_rows_" + hoja;

    const cached = SIG_Cache_get(key);

    if(cached){

        return cached;

    }

    // Las filas dadas de baja (ELIMINADO, ver SIG_UD_delete) no
    // se muestran más — mismo criterio que ya usa
    // SIG_Geometrias_list para las geometrías. Si la hoja no
    // tiene columna ELIMINADO todavía, row.ELIMINADO es
    // undefined y la fila queda (no rompe nada en las unidades
    // que no la tengan configurada).

    const rows = SIG_getRows(hoja).filter(

        row => !row.ELIMINADO

    );

    if(rows.length){

        SIG_Cache_put(key, rows);

    }

    return rows;

}

//--------------------------------------------------
// Esquema + filas en una sola llamada
// (un solo google.script.run en vez de dos por unidad)
//--------------------------------------------------

function SIG_UD_get(hoja){

    return {

        schema : SIG_UD_getSchema(hoja),

        rows   : SIG_UD_getRows(hoja)

    };

}

//--------------------------------------------------
// Insertar/actualizar una fila de una hoja UD_. Solo se
// permite escribir columnas que ya existen en el esquema de
// CONFIGURACION_COLUMNAS (más "ID") — la libertad de agregar
// columnas nuevas sin configurar todavía queda para más
// adelante, por ahora esto evita escribir basura en columnas
// que no se están mostrando/validando en ningún lado.
//--------------------------------------------------

function SIG_UD_saveRow(hoja, datos){

    const schema = SIG_UD_getSchema(hoja);

    if(!schema.length){

        throw new Error(

            "La unidad " + hoja + " no tiene columnas configuradas todavía."

        );

    }

    const columnasValidas = schema.map(campo => campo.columna);

    const datosFiltrados = {};

    Object.keys(datos).forEach(clave=>{

        if(clave === "ID" || columnasValidas.indexOf(clave) !== -1){

            datosFiltrados[clave] = datos[clave];

        }

    });

    const resultado = SIG_saveRow(hoja, datosFiltrados);

    SIG_Cache_remove("ud_rows_" + hoja);

    return resultado;

}

//--------------------------------------------------
// Baja lógica de un registro (no se borra la fila). Requiere
// que la unidad tenga columna ELIMINADO en CONFIGURACION_
// COLUMNAS — SIG_UD_saveRow descarta en silencio cualquier
// clave que no esté en el esquema (mismo filtro de columnas
// válidas de siempre), así que sin este chequeo el "borrado"
// sería un guardado que no toca ninguna columna: no tira error,
// pero tampoco borra nada. Se valida acá explícito, en vez de
// dejarlo fallar mudo.
//--------------------------------------------------

function SIG_UD_delete(hoja, id){

    const schema = SIG_UD_getSchema(hoja);

    const tieneEliminado = schema.some(

        campo => campo.columna === "ELIMINADO"

    );

    if(!tieneEliminado){

        throw new Error(

            "La unidad " + hoja + " no tiene columna ELIMINADO configurada — no se puede eliminar."

        );

    }

    return SIG_UD_saveRow(hoja, {

        ID        : id,
        ELIMINADO : true

    });

}

//--------------------------------------------------
// Unidades disponibles: toda hoja UD_* que exista en el
// spreadsheet, tenga o no filas cargadas o esquema en
// CONFIGURACION_COLUMNAS todavía — así el ribbon no depende
// de una lista fija en el frontend, agregar/quitar una hoja
// UD_* aparece o desaparece solo.
//--------------------------------------------------

function SIG_UD_listUnidades(){

    return SIG_getSpreadsheet()

        .getSheets()

        .map(sheet => sheet.getName())

        .filter(nombre => nombre.indexOf("UD_") === 0)

        .map(hoja => ({

            hoja,

            etiqueta: hoja

                .slice(3)

                .split("_")

                .map(palabra =>

                    palabra.charAt(0) + palabra.slice(1).toLowerCase()

                )

                .join(" ")

        }));

}

//--------------------------------------------------
// Índice SIG_GEOMETRIAS_ID -> registro de la unidad que lo
// referencia, recorriendo todas las hojas UD_*. Es lo que
// cruza cada geometría del mapa con "a qué proyecto pertenece".
//--------------------------------------------------

function SIG_UD_indiceGeometrias(){

    const indice = {};

    SIG_UD_listUnidades().forEach(unidad=>{

        const schema = SIG_UD_getSchema(unidad.hoja);

        const camposMapa = schema.filter(campo => campo.visibleMapa);

        SIG_UD_getRows(unidad.hoja).forEach(row=>{

            const geometriaId = row.SIG_GEOMETRIAS_ID;

            if(!geometriaId){

                return;

            }

            // Una geometría es de un solo registro — si dos filas
            // (de la misma unidad o de dos distintas) reclaman la
            // misma geometría, es un dato inconsistente. No lo
            // resolvemos solos (podría ser data real que hay que
            // decidir a mano), pero tampoco lo dejamos en silencio.

            if(indice[geometriaId]){

                Logger.log(

                    "Colisión SIG_GEOMETRIAS_ID=" + geometriaId +
                    ": ya estaba vinculada a " + indice[geometriaId].hoja +
                    " (ID " + indice[geometriaId].registroId + "), " +
                    "también la reclama " + unidad.hoja +
                    " (ID " + row.ID + "). Queda la última encontrada."

                );

            }

            indice[geometriaId] = {

                hoja     : unidad.hoja,

                etiqueta : unidad.etiqueta,

                registroId : row.ID,

                campos   : camposMapa.map(campo => ({

                    etiqueta : campo.etiqueta || campo.columna,

                    valor    : row[campo.columna]

                }))

            };

        });

    });

    return indice;

}

//--------------------------------------------------
// Vincular una geometría a un registro — de forma exclusiva:
// una geometría es de un solo registro a la vez (confirmado con
// el usuario, no una limitación técnica). Antes de escribir el
// vínculo nuevo, desvincula cualquier OTRA fila que hoy la
// reclame, sin importar en qué unidad esté. También sirve para
// "Sin vincular" (hoja/registroId vacíos): solo desvincula.
//--------------------------------------------------

function SIG_UD_vincularGeometria(geometriaId, hoja, registroId){

    const actual = SIG_UD_indiceGeometrias()[geometriaId];

    const esMismoVinculo = actual &&

        actual.hoja === hoja &&

        String(actual.registroId) === String(registroId);

    if(esMismoVinculo){

        return;

    }

    if(actual){

        SIG_UD_saveRow(actual.hoja, {

            ID: actual.registroId,

            SIG_GEOMETRIAS_ID: ""

        });

    }

    if(hoja && registroId){

        SIG_UD_saveRow(hoja, {

            ID: registroId,

            SIG_GEOMETRIAS_ID: geometriaId

        });

    }

}

