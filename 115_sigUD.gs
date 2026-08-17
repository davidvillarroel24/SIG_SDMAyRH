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

    const rows = SIG_getRows(hoja);

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
